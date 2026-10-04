import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { claimHash } from './claim-evidence.mjs';
import { factFreshness } from './fact-freshness.mjs';
const now = new Date('2026-10-03T12:00:00Z');
const url = 'https://www.consultant.ru/document/cons_doc_LAW_72388/';
const text = 'Федеральный закон № 259-ФЗ. Подтверждающий текст первоисточника.';
const sha256 = createHash('sha256').update(text).digest('hex');
const claims = [{ sentence: 'Федеральный закон № 259-ФЗ.', text: '259-ФЗ', source: url }];
const evidence = { documents: [{ url, text, sha256, status: 200, fetchedAt: '2026-10-01T12:00:00Z' }], claims: [{ claimHash: claimHash(claims[0].sentence), source: url, result: 'verified', rationale: 'Сверена норма.', excerpt: text, checkedAt: '2026-10-01T12:00:00Z' }] };
test('missing and expired evidence schedule factual review', () => {
  assert.equal(factFreshness({ claims, now }).needsReview, true);
  const old = structuredClone(evidence); old.claims[0].checkedAt = '2025-01-01';
  assert.equal(factFreshness({ claims, evidence: old, now }).needsReview, true);
});
test('new source bytes trigger review even after a recent rewrite', () => {
  const result = factFreshness({ claims, evidence, now, observations: { [url]: { status: 'ok', sha256: '0'.repeat(64), checkedAt: now.toISOString() } } });
  assert.deepEqual(result.changed, [url]);
  assert.equal(result.needsReview, true);
});
test('unchanged sources cannot refresh an expired semantic check', () => {
  const old = structuredClone(evidence); old.claims[0].checkedAt = '2025-01-01';
  assert.equal(factFreshness({ claims, evidence: old, now, observations: { [url]: { status: 'ok', sha256, checkedAt: now.toISOString() } } }).needsReview, true);
});
test('unavailable is uncertainty, future and old observations are ignored', () => {
  assert.equal(factFreshness({ claims, evidence, now, observations: { [url]: { status: 'unavailable', checkedAt: now.toISOString() } } }).unavailable.length, 1);
  for (const date of ['2026-10-04', '2026-01-01', 'invalid']) assert.equal(factFreshness({ claims, evidence, now, observations: { [url]: { status: 'ok', sha256: '0'.repeat(64), checkedAt: date } } }).needsReview, false);
  assert.equal(factFreshness({ claims: [], now }).needsReview, false);
});
