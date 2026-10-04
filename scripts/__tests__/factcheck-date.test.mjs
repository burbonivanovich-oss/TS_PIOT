import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFactcheckDate } from '../content/lib/factcheck-date.mjs';
const now = new Date('2026-10-03T12:00:00Z');

test('stored dates support legacy formats and JSON, independent of checkout mtime', () => {
  for (const text of ['2026-09-05', '2026-09-05T05:08:20Z', 'Factcheck pass: 2026-09-05\nSources: ...', JSON.stringify({ passed: true, checkedAt: '2026-09-05T00:00:00Z' })]) {
    assert.equal(checkFactcheckDate(text, { now }).ok, true);
  }
  assert.equal(checkFactcheckDate('2025-01-01', { now }).ok, false, 'fresh file with old check is still stale');
});

test('missing, malformed, future and impossible check dates fail closed', () => {
  for (const text of ['', 'passed', '2026-02-30', '2026-10-04', '{broken', JSON.stringify({ passed: false, checkedAt: '2026-09-05' }), JSON.stringify({ passed: true })]) assert.equal(checkFactcheckDate(text, { now }).ok, false, text);
});
