import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRun, setStage, readRun } from './lib/run.mjs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { writingStatus } from './writing-checkpoint.mjs';

test('receipt binds delivered bytes and attempt; changed/retried article requires work', () => {
  const blog = mkdtempSync(path.join(tmpdir(), 'writing-receipt-'));
  try {
    const orders = { orders: [{ slug: 'article', kind: 'new' }] };
    const state = { inFlight: [{ slug: 'article', kind: 'new', claimedAt: '2026-10-03T00:00:00Z', failures: 0, infraFailures: 0 }] };
    assert.equal(writingStatus({ orders, state, blog })[0].action, 'write');
    writeFileSync(path.join(blog, 'article.md'), 'delivered text');
    const first = writingStatus({ orders, state, blog })[0];
    assert.equal(first.action, 'write', 'existence alone does not prove delivery');
    const receipts = { items: { article: { kind: 'new', attempt: first.attempt, sha256: first.sha256 } } };
    assert.equal(writingStatus({ orders, state, blog, receipts })[0].action, 'settle');
    writeFileSync(path.join(blog, 'article.md'), 'changed text');
    assert.equal(writingStatus({ orders, state, blog, receipts })[0].action, 'write');
    writeFileSync(path.join(blog, 'article.md'), 'delivered text');
    state.inFlight[0].failures = 1;
    assert.equal(writingStatus({ orders, state, blog, receipts })[0].action, 'write');
    state.inFlight = [];
    assert.equal(writingStatus({ orders, state, blog, receipts })[0].action, 'closed');
  } finally { rmSync(blog, { recursive: true, force: true }); }
});

test('ambiguous files and duplicate orders fail closed', () => {
  const blog = mkdtempSync(path.join(tmpdir(), 'writing-ambiguous-'));
  try {
    const orders = { orders: [{ slug: 'article', kind: 'new' }] };
    const state = { inFlight: [{ slug: 'article', kind: 'new', claimedAt: 'now', failures: 0, infraFailures: 0 }] };
    writeFileSync(path.join(blog, 'article.md'), 'one'); writeFileSync(path.join(blog, 'article.mdx'), 'two');
    assert.throws(() => writingStatus({ orders, state, blog }), /Две версии/);
    orders.orders.push(orders.orders[0]);
    assert.throws(() => writingStatus({ orders, state, blog }), /Повтор наряда/);
  } finally { rmSync(blog, { recursive: true, force: true }); }
});


test('record CLI stores delivery and written stage without pretending quality acceptance', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writing-cli-'));
  const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const blog = path.join(root, 'src/content/blog'); const dataDir = path.join(root, 'data');
    mkdirSync(blog, { recursive: true }); mkdirSync(dataDir);
    const config = JSON.parse(readFileSync(path.join(engine, 'config/autopilot.config.json'), 'utf8'));
    config.security.strictContentRoot = false;
    const configFile = path.join(root, 'config.json'); writeFileSync(configFile, JSON.stringify(config));
    const run = createRun({ dir: dataDir, orders: ['article'] });
    setStage(run.runId, 'planned', {}, { dir: dataDir });
    writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify({ runId: run.runId, orders: [{ slug: 'article', kind: 'new' }] }));
    writeFileSync(path.join(dataDir, 'autopilot.json'), JSON.stringify({ inFlight: [{ slug: 'article', kind: 'new', claimedAt: 'now', failures: 0, infraFailures: 0 }] }));
    writeFileSync(path.join(blog, 'article.md'), 'A delivered draft that will fail quality gates');
    const env = { ...process.env, AUTOPILOT_CONFIG: configFile, CONTENT_ROOT: root, AUTOPILOT_DATA_DIR: dataDir, AUTOPILOT_LOCK_FILE: path.join(dataDir, '.autopilot.lock') };
    const record = spawnSync(process.execPath, ['scripts/writing-checkpoint.mjs', 'record', '--slug', 'article'], { cwd: engine, env, encoding: 'utf8' });
    assert.equal(record.status, 0, record.stderr);
    const manifest = readRun(run.runId, { dir: dataDir });
    assert.equal(manifest.stages.written.delivered, 1);
    assert.equal(manifest.stages.gated, undefined);
    const status = spawnSync(process.execPath, ['scripts/writing-checkpoint.mjs', 'status'], { cwd: engine, env, encoding: 'utf8' });
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout)[0].action, 'settle');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
