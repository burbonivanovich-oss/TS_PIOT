import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coordinateCycle, readPendingOrders, pendingWrites } from './daily.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRun, setStage } from './lib/run.mjs';

test('legacy empty orders bootstrap only with proven empty slots; lost current manifest refuses', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'daily-legacy-'));
  try {
    const put = (file, data) => writeFileSync(path.join(dir, file), JSON.stringify(data));
    put('orders.json', { orders: [] });
    assert.throws(() => readPendingOrders(dir), /сверка/);
    put('autopilot.json', { inFlight: [] }); assert.equal(readPendingOrders(dir), null);
    put('autopilot.json', { inFlight: [{ slug: 'active' }] }); assert.throws(() => readPendingOrders(dir), /сверка/);
    put('autopilot.json', { inFlight: [] }); put('orders.json', { orders: [{ slug: 'active' }] }); assert.throws(() => readPendingOrders(dir), /сверка/);
    put('orders.json', { runId: '2026-10-04-12345678', orders: [] }); assert.throws(() => readPendingOrders(dir), /манифеста/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function fixture(current) {
  const calls = [];
  return { calls, operations: {
    pending: () => current,
    refresh: async () => calls.push('refresh'),
    plan: () => { calls.push('plan'); return { runId: 'new', orders: [{ slug: 'article' }] }; },
    write: async () => { calls.push('write'); return { ok: true }; },
    settle: () => { calls.push('settle'); return { published: 1 }; },
  } };
}
test('fresh cycle refreshes, plans, writes and accepts in order', async () => {
  const f = fixture(null); const r = await coordinateCycle(f.operations);
  assert.deepEqual(f.calls, ['refresh', 'plan', 'write', 'settle']); assert.equal(r.runId, 'new'); assert.equal(r.status, 'delivery_pending');
});
test('restart after delivery resumes same run without refresh or new plan', async () => {
  const f = fixture({ orders: { runId: 'original', orders: [{ slug: 'article' }] }, manifest: { stages: { planned: {}, written: {} } } });
  const r = await coordinateCycle(f.operations);
  assert.deepEqual(f.calls, ['write', 'settle']); assert.equal(r.runId, 'original');
});
test('accepted but undelivered run stops new work; committed run allows next plan', async () => {
  const f = fixture({ orders: { runId: 'original', orders: [] }, manifest: { stages: { gated: {}, built: {} } } });
  const r = await coordinateCycle(f.operations); assert.deepEqual(f.calls, []); assert.equal(r.modelCalled, false);
  f.operations.pending = () => ({ orders: { runId: 'original' }, manifest: { stages: { gated: {}, committed: {} } } });
  await coordinateCycle(f.operations); assert.deepEqual(f.calls, ['refresh', 'plan', 'write', 'settle']);
});
test('writer infrastructure refusal reaches acceptance for retry accounting', async () => {
  const f = fixture(null); f.operations.write = async () => { f.calls.push('write'); return { ok: false, results: [{ status: 'failed' }] }; };
  const r = await coordinateCycle(f.operations); assert.equal(r.writing.ok, false); assert.deepEqual(f.calls, ['refresh', 'plan', 'write', 'settle']);
  f.calls.length = 0; f.operations.write = async () => { throw new Error('actor still alive'); };
  await assert.rejects(coordinateCycle(f.operations), /actor still alive/); assert.deepEqual(f.calls, ['refresh', 'plan']);
});
test('cycle delivers only after acceptance and resumes gated delivery without writing again', async () => {
  const f = fixture(null); f.operations.deliver = async runId => { f.calls.push('commit'); return { runId, metadataCommit: 'verified' }; };
  const r = await coordinateCycle(f.operations); assert.equal(r.status, 'committed'); assert.deepEqual(f.calls, ['refresh', 'plan', 'write', 'settle', 'commit']);
  f.calls.length = 0; f.operations.pending = () => ({ orders: { runId: 'original' }, manifest: { stages: { gated: {} } } });
  const resumed = await coordinateCycle(f.operations); assert.deepEqual(f.calls, ['commit']); assert.equal(resumed.runId, 'original'); assert.equal(resumed.modelCalled, false);
});
test('real owner reads gated manifest and leaves article untouched without model or planning', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'daily-pending-'));
  const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const data = path.join(root, 'data'); const blog = path.join(root, 'src/content/blog');
    mkdirSync(data); mkdirSync(blog, { recursive: true });
    const article = path.join(blog, 'article.md'); writeFileSync(article, 'original bytes');
    const config = JSON.parse(readFileSync(path.join(engine, 'config/autopilot.config.json')));
    config.security.strictContentRoot = false;
    const configFile = path.join(root, 'config.json'); writeFileSync(configFile, JSON.stringify(config));
    const run = createRun({ dir: data, orders: ['article'] });
    setStage(run.runId, 'planned', {}, { dir: data }); setStage(run.runId, 'gated', {}, { dir: data });
    writeFileSync(path.join(data, 'orders.json'), JSON.stringify({ runId: run.runId, orders: [{ slug: 'article' }] }));
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import {dailyCycle} from './scripts/daily.mjs'; console.log(JSON.stringify(await dailyCycle()));"], { cwd: engine, encoding: 'utf8', env: { ...process.env, AUTOPILOT_CONFIG: configFile, CONTENT_ROOT: root, AUTOPILOT_DATA_DIR: data, AUTOPILOT_LOCK_FILE: path.join(data, '.autopilot.lock') } });
    assert.equal(child.status, 0, child.stderr); const result = JSON.parse(child.stdout);
    assert.equal(result.status, 'delivery_pending'); assert.equal(result.runId, run.runId); assert.equal(result.modelCalled, false);
    assert.equal(readFileSync(article, 'utf8'), 'original bytes');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('external writer: plan is issued, then cycle waits without write or settle accounting', async () => {
  const f = fixture(null);
  const r = await coordinateCycle({ ...f.operations, hold: () => ['article'] });
  assert.equal(r.status, 'awaiting_writer'); assert.deepEqual(r.writer, ['article']); assert.equal(r.runId, 'new'); assert.equal(r.modelCalled, false);
  assert.deepEqual(f.calls, ['refresh', 'plan']);
});
test('external writer: delivered receipts let the same cycle accept and commit', async () => {
  const f = fixture({ orders: { runId: 'open', orders: [{ slug: 'article' }] }, manifest: { stages: { planned: true } } });
  f.operations.deliver = async () => { f.calls.push('commit'); return { commit: 'x' }; };
  const r = await coordinateCycle({ ...f.operations, hold: () => [] });
  assert.equal(r.status, 'committed'); assert.deepEqual(f.calls, ['write', 'settle', 'commit']);
});
test('pending writes are orders without a receipt of the current attempt', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'daily-pending-'));
  try {
    const blog = path.join(dir, 'blog'); mkdirSync(blog);
    const put = (file, data) => writeFileSync(path.join(dir, file), JSON.stringify(data));
    put('orders.json', { runId: 'r', orders: [{ slug: 'a', kind: 'new' }] });
    put('autopilot.json', { inFlight: [{ slug: 'a', kind: 'new', claimedAt: 't', failures: 0, infraFailures: 0 }] });
    put('writing-receipts.json', { items: {} });
    assert.deepEqual(pendingWrites(dir, blog), ['a']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
