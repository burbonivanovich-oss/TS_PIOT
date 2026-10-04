import test from 'node:test';
import assert from 'node:assert/strict';
import { rankByDemand } from './demand.mjs';
const now = Date.parse('2026-10-04T12:00:00Z');
const settings = { demandMaxBoost: 30, demandMaxAgeDays: 30, demandRegion: 225 };
const snapshot = { url: 'https://wordstat.yandex.ru/?region=225&words=этрн', region: '225', devices: 'all', match: 'broad', capturedAt: '2026-10-04T07:00:00Z', periodStart: '2026-09-02', periodEnd: '2026-10-01', rows: [{ phrase: 'этрн для перевозчиков', count: 8326 }, { phrase: 'этрн подключить', count: 6796 }] };
const evidence = { schemaVersion: 1, snapshots: [snapshot] };
const topics = [{ slug: 'unknown', score: 42, keywords: ['не собранный запрос'] }, { slug: 'carrier', score: 40, keywords: [' ЭТРН  для перевозчиков ', 'этрн подключить'] }];

test('fresh matching demand changes selection without summing overlapping requests or mutating baseline', () => {
  const ranked = rankByDemand(topics, evidence, settings, now);
  assert.equal(ranked[0].slug, 'carrier');
  assert.equal(ranked[0].demand.count, 8326);
  assert.equal(ranked[0].score, 40);
  assert.equal(ranked[1].demand.count, null);
  assert.equal(ranked[1].demand.status, 'not_collected');
  assert.equal(topics[0].demand, undefined);
  assert.deepEqual(rankByDemand(ranked, evidence, settings, now), ranked);
});
test('stale, future, wrong-region, unproven operator and invalid counts provide no demand boost', () => {
  for (const change of [{ periodEnd: '2026-08-01' }, { capturedAt: '2026-10-05T00:00:00Z' }, { region: 'all' }, { match: 'exact' }, { url: 'https://example.org/?region=225' }, { rows: [{ phrase: 'этрн для перевозчиков', count: '8326' }] }, { periodEnd: '2026-09-31' }]) {
    const ranked = rankByDemand(topics, { schemaVersion: 1, snapshots: [{ ...snapshot, ...change }] }, settings, now);
    assert.equal(ranked[0].slug, 'unknown');
    assert.equal(ranked[1].demand.status, 'not_collected');
  }
});
test('newer observation replaces the old count; absence and disabled signal are unknown', () => {
  const newer = { ...snapshot, capturedAt: '2026-10-04T08:00:00Z', rows: [{ phrase: 'этрн для перевозчиков', count: 0 }] };
  const singleQuery = [{ ...topics[1], keywords: ['этрн для перевозчиков'] }];
  assert.equal(rankByDemand(singleQuery, { schemaVersion: 1, snapshots: [snapshot, newer] }, settings, now)[0].demand.count, 0);
  assert.equal(rankByDemand(topics, null, settings, now)[1].demand.count, null);
  assert.equal(rankByDemand(topics, evidence, { ...settings, demandMaxBoost: 0 }, now)[1].demand.count, null);
});
test('general phrase does not supply unmeasured audience segment demand', () => {
  const segmented = [{ ...topics[1], segment: 'retail', keywords: ['этрн для перевозчиков', 'этрн рознице'] }];
  assert.equal(rankByDemand(segmented, evidence, settings, now)[0].demand.status, 'not_collected');
});
