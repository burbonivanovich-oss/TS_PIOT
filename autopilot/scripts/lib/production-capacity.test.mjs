import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productionCapacity } from './production-capacity.mjs';
import { validateConfig } from './config-schema.mjs';
import { loadConfig } from './config.mjs';

const config = loadConfig();
const now = new Date('2026-10-15T12:00:00Z');
const state = (n = 0, r = 0) => ({ month: '2026-10', counters: { new: n, rewrite: r }, inFlight: [] });
const cap = (s, opts = {}) => productionCapacity({ state: s, now, config, ...opts });

test('PUB-03: рерайты не уменьшают норму новых статей', () => {
  const c = cap(state(20, 14));
  assert.equal(c.byKind.new.remaining, 35);
  assert.equal(c.byKind.rewrite.remaining, 0);
  assert.equal(c.takeByKind.rewrite, 0);
  assert.equal(c.done, 20);
});

test('PUB-03: исчерпание каждого бюджета не блокирует другой', () => {
  assert.equal(cap(state(55, 0)).takeByKind.new, 0);
  assert.ok(cap(state(55, 0)).takeByKind.rewrite > 0);
  assert.equal(cap(state(55, 14)).canTake, 0);
  assert.equal(cap(state(60, 20)).canTake, 0);
});

test('PUB-03: активные и перенесённые принятые материалы резервируют остаток', () => {
  const s = state(53, 14);
  s.inFlight.push({ kind: 'new', slug: 'active' });
  assert.equal(cap(s).takeByKind.new, 1);
  const waiting = [{ kind: 'new', acceptedAt: '2026-09-30T12:00:00Z' }];
  assert.equal(cap(s, { waiting }).canTake, 0);
  // Принятое в октябре уже включено в counters и повторно не вычитается.
  assert.equal(cap(s, { waiting: [{ kind: 'new', acceptedAt: '2026-10-10' }] }).takeByKind.new, 1);
});

test('PUB-03: маленькие батчи не теряют рерайты за месяц', () => {
  const s = state();
  const small = { ...config, throughput: { ...config.throughput, maxBatchSize: 1 } };
  for (let i = 0; i < 69; i++) {
    const c = cap(s, { config: small });
    const kind = c.takeByKind.new ? 'new' : 'rewrite';
    assert.equal(c.canTake, 1);
    s.counters[kind]++;
  }
  assert.deepEqual(s.counters, { new: 55, rewrite: 14 });
  assert.equal(cap(s).canTake, 0);
});

test('PUB-03: месяцы 28–31 день и перенос активной работы', () => {
  for (const date of ['2026-02-28', '2028-02-29', '2026-09-30', '2026-12-31']) {
    const at = new Date(`${date}T12:00:00Z`);
    const s = state(55, 14);
    s.month = date.slice(0, 7);
    assert.equal(cap(s, { now: at }).canTake, 0);
    assert.equal(cap(s, { now: at }).expectedByToday, 55);
  }
  const s = state(55, 14);
  s.inFlight = [{ kind: 'new', slug: 'carry' }];
  const c = cap(s, { now: new Date('2026-11-01T12:00:00Z') });
  assert.equal(c.done, 0);
  assert.equal(c.byKind.new.remaining, 54);
});

test('PUB-03: неверная отдельная норма отклоняется схемой', () => {
  for (const value of [-1, 1.5, '14', null]) {
    const bad = structuredClone(config);
    bad.throughput.monthlyRewriteTarget = value;
    assert.match(validateConfig(bad).join('\n'), /monthlyRewriteTarget/);
  }
});


test('PUB-03: незавершённые наряды занимают и слоты, и размер задания', () => {
  const s = state();
  s.inFlight = Array.from({length: 3}, (_, i) => ({ slug: `open-${i}`, kind: 'new' }));
  assert.equal(cap(s).freeSlots, 1);
  assert.equal(cap(s).canTake, 0);
});
