import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRun, readRun, listRuns, latestRun, findResumableRun, setStage, isStageDone, STAGES } from './run.mjs';

const dir = () => mkdtempSync(path.join(tmpdir(), 'run-'));

test('AP-P0-11: манифест создаётся и читается', () => {
  const d = dir();
  const run = createRun({ dir: d, date: '2026-09-13', orders: [{ slug: 'a' }, 'b'] });
  assert.match(run.runId, /^2026-09-13-[0-9a-f]{8}$/);
  assert.deepEqual(run.orders, ['a', 'b']);
  assert.deepEqual(readRun(run.runId, { dir: d }), run);
  assert.equal(latestRun({ dir: d }).runId, run.runId);
  assert.equal(listRuns({ dir: d }).length, 1);
});

test('AP-P0-11: стадии идемпотентны и не дублируют историю', () => {
  const d = dir();
  const run = createRun({ dir: d, date: '2026-09-13' });
  const first = setStage(run.runId, 'planned', { orderCount: 3 }, { dir: d });
  assert.equal(first.changed, true);
  const second = setStage(run.runId, 'planned', { orderCount: 3 }, { dir: d });
  assert.equal(second.changed, false);
  const manifest = readRun(run.runId, { dir: d });
  assert.equal(manifest.history.length, 1, 'повтор не добавляет запись в историю');
  assert.equal(manifest.stages.planned.orderCount, 3);
  assert.equal(isStageDone(manifest, 'planned'), true);
});

test('AP-P0-11: порядок стадий строгий, неизвестная стадия отвергается', () => {
  const d = dir();
  const run = createRun({ dir: d, date: '2026-09-13' });
  setStage(run.runId, 'gated', {}, { dir: d });
  assert.throws(() => setStage(run.runId, 'planned', {}, { dir: d }), /позже уже отмеченной/);
  assert.throws(() => setStage(run.runId, 'nope', {}, { dir: d }), /Неизвестная стадия/);
  assert.throws(() => setStage('нет-такого', 'planned', {}, { dir: d }), /Нет манифеста/);
});

test('AP-P0-11: ретрай продолжает незавершённый проход за ту же дату', () => {
  const d = dir();
  const run = createRun({ dir: d, date: '2026-09-13' });
  setStage(run.runId, 'planned', {}, { dir: d });
  const resumed = findResumableRun({ dir: d, date: '2026-09-13' });
  assert.equal(resumed.runId, run.runId, 'тот же runId, а не новый');
  // После committed проход больше не переиспользуется.
  for (const stage of STAGES.slice(1)) setStage(run.runId, stage, {}, { dir: d });
  assert.equal(findResumableRun({ dir: d, date: '2026-09-13' }), null);
  const next = createRun({ dir: d, date: '2026-09-13' });
  assert.notEqual(next.runId, run.runId);
});

test('AP-P0-11: симуляция падения после planned не создаёт дубль прохода', () => {
  const d = dir();
  const first = createRun({ dir: d, date: '2026-09-13', orders: ['a'] });
  setStage(first.runId, 'planned', { orderCount: 1 }, { dir: d });
  // «Перезапуск»: ищем resumable и повторно отмечаем стадию.
  const resumed = findResumableRun({ dir: d, date: '2026-09-13' });
  const again = setStage(resumed.runId, 'planned', { orderCount: 1 }, { dir: d });
  assert.equal(again.changed, false);
  assert.equal(listRuns({ dir: d }).length, 1, 'второго прохода не появилось');
});
