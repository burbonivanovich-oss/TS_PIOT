import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planReconcile, applyReconcile } from './migrate-reconcile.mjs';
import { today } from './lib/content.mjs';

const passGates = ({ file }) =>
  file.includes('exists-pass') ? { passed: true, score: 80, blockers: [] } : { passed: false, score: 40, blockers: ['sources'] };

function fixture({ inFlight = [] } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'migrate-'));
  const dataDir = path.join(root, 'data');
  const blog = path.join(root, 'blog');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(blog, { recursive: true });
  writeFileSync(path.join(blog, 'exists-pass.md'), '---\ntitle: "a"\n---\nтело', 'utf8');
  writeFileSync(path.join(blog, 'exists-fail.md'), '---\ntitle: "b"\n---\nтело', 'utf8');
  writeFileSync(
    path.join(dataDir, 'backlog.json'),
    JSON.stringify({
      topics: [
        { slug: 'exists-pass', title: 'a', status: 'writing' },
        { slug: 'exists-fail', title: 'b', status: 'writing' },
        { slug: 'missing', title: 'c', status: 'writing' },
        { slug: 'planned-one', title: 'd', status: 'planned' },
      ],
    }),
    'utf8',
  );
  writeFileSync(
    path.join(dataDir, 'autopilot.json'),
    JSON.stringify({ version: 1, month: '2026-09', counters: {}, inFlight, quarantine: [], history: [] }),
    'utf8',
  );
  writeFileSync(
    path.join(dataDir, 'orders.json'),
    JSON.stringify({ date: '2026-08-10', orders: [{ slug: 'exists-pass' }, { slug: 'exists-fail' }, { slug: 'missing' }, { slug: 'stale-order' }] }),
    'utf8',
  );
  return { root, dataDir, blog };
}

test('AP-P0-05: план разбирает writing по наличию файла и гейтам', () => {
  const fx = fixture();
  const plan = planReconcile({ dataDir: fx.dataDir, blog: fx.blog, gates: passGates });
  const byslug = Object.fromEntries(plan.actions.map((a) => [a.slug, a]));
  assert.equal(byslug['exists-pass'].action, 'released');
  assert.equal(byslug['exists-fail'].action, 'planned');
  assert.equal(byslug['missing'].action, 'planned');
  assert.ok(!('planned-one' in byslug), 'нетронутые planned не входят в действия');
  assert.deepEqual([...plan.dropOrders].sort(), ['exists-fail', 'exists-pass', 'missing', 'stale-order']);
  assert.deepEqual(plan.keepOrders, []);
});

test('AP-P0-05: dry-run ничего не меняет', () => {
  const fx = fixture();
  const before = {
    backlog: readFileSync(path.join(fx.dataDir, 'backlog.json'), 'utf8'),
    orders: readFileSync(path.join(fx.dataDir, 'orders.json'), 'utf8'),
    state: readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'),
  };
  planReconcile({ dataDir: fx.dataDir, blog: fx.blog, gates: passGates });
  assert.equal(readFileSync(path.join(fx.dataDir, 'backlog.json'), 'utf8'), before.backlog);
  assert.equal(readFileSync(path.join(fx.dataDir, 'orders.json'), 'utf8'), before.orders);
  assert.equal(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'), before.state);
  assert.equal(existsSync(path.join(fx.dataDir, `reconcile-report-${today()}.json`)), false);
});

test('AP-P0-05: apply восстанавливает инвариант и идемпотентен', () => {
  const fx = fixture();
  const report = applyReconcile({ dataDir: fx.dataDir, blog: fx.blog, gates: passGates, backup: false });
  assert.equal(report.changed, true);

  const backlog = JSON.parse(readFileSync(path.join(fx.dataDir, 'backlog.json'), 'utf8'));
  const status = Object.fromEntries(backlog.topics.map((t) => [t.slug, t.status]));
  assert.equal(status['exists-pass'], 'released');
  assert.equal(status['exists-fail'], 'planned');
  assert.equal(status.missing, 'planned');
  assert.equal(status['planned-one'], 'planned');

  const orders = JSON.parse(readFileSync(path.join(fx.dataDir, 'orders.json'), 'utf8'));
  const state = JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'));
  assert.deepEqual(orders.orders, []);
  assert.deepEqual(state.inFlight, []);
  // Инвариант: writing == inFlight == open orders.
  const writing = backlog.topics.filter((t) => t.status === 'writing').length;
  assert.equal(writing, 0);
  assert.equal(state.inFlight.length, 0);
  assert.equal(orders.orders.length, 0);
  assert.ok(existsSync(path.join(fx.dataDir, `reconcile-report-${today()}.json`)));

  const second = applyReconcile({ dataDir: fx.dataDir, blog: fx.blog, gates: passGates, backup: false });
  assert.equal(second.changed, false, 'повторный запуск не меняет состояние');
});

test('AP-P0-05: orphan inFlight снимается, backup создаётся', () => {
  const fx = fixture({ inFlight: [{ slug: 'orphan-1', kind: 'new' }] });
  const plan = planReconcile({ dataDir: fx.dataDir, blog: fx.blog, gates: passGates });
  assert.deepEqual(plan.orphanInFlight, ['orphan-1']);
  applyReconcile({ dataDir: fx.dataDir, blog: fx.blog, gates: passGates, backup: true });
  const state = JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'));
  assert.deepEqual(state.inFlight, []);
  assert.ok(existsSync(path.join(fx.dataDir, 'backups')), 'backup создан перед миграцией');
});
