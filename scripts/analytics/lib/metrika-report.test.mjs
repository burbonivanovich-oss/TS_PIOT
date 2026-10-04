import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMetrikaReport } from './metrika-report.mjs';
const row = (path, views, users) => ({ dimensions: [{ name: path }], metrics: [views, users] });

test('one visitor on two pages stays one report visitor', () => {
  const r = normalizeMetrikaReport({ data: [row('/a/', 2, 1), row('/b/', 1, 1)], totals: [3, 1], total_rows: 2 });
  assert.equal(r.totals.users, 1); assert.equal(r.totals.pageviews, 3); assert.equal(r.coverage.complete, true);
});
test('truncated report preserves API totals and discloses partial page coverage', () => {
  const r = normalizeMetrikaReport({ data: [row('/a/', 2, 1)], totals: [100, 40], total_rows: 20, sampled: true, sample_share: 0.5 });
  assert.equal(r.totals.users, 40); assert.equal(r.totals.pageviews, 100); assert.equal(r.coverage.complete, false); assert.equal(r.coverage.sampleShare, 0.5);
});
test('missing or invalid aggregates stay unknown, never page sums or zero', () => {
  const r = normalizeMetrikaReport({ data: [row('/a/', 2, 1)], totals: [NaN, -1] });
  assert.equal(r.totals.users, null); assert.equal(r.totals.pageviews, null); assert.equal(r.coverage.complete, null);
  assert.throws(() => normalizeMetrikaReport({}), /нет строк/);
});
test('URL normalization combines views but cannot combine distinct users', () => {
  const r = normalizeMetrikaReport({ data: [row('/a/?x=1', 2, 1), row('/a/?x=2', 3, 1)], totals: [5, 1], total_rows: 2 });
  assert.equal(r.byPage['/a/'].pageviews, 5); assert.equal(r.byPage['/a/'].users, null); assert.equal(r.totals.users, 1);
});
test('rounded row counts cannot prove complete page coverage', () => {
  const r = normalizeMetrikaReport({ data: [row('/a/', 2, 1)], totals: [2, 1], total_rows: 1, total_rows_rounded: true });
  assert.equal(r.coverage.complete, null); assert.equal(r.coverage.totalRowsRounded, true);
});
