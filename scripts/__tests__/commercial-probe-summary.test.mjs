import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { commercialProbeSummary } from '../analytics/lib/commercial-probe-summary.mjs';
import { collectCommercialEventProbe, PROBE_DIMENSIONS } from '../analytics/lib/commercial-event-probe.mjs';
const slug = '2026-05-03-etrn-2026', hash = createHash('sha256').update(slug).digest('hex');
const period = { from: '2026-10-05', to: '2026-10-05', timeZone: 'UTC' };
const asOf = '2026-10-05T23:00:00.000Z';
const fetchedAt = '2026-10-05T23:00:05.000Z';
function fixture() {
  return {
    counterId: 109130279, sourceRevision: 'a'.repeat(40), period: { ...period }, asOf, fetchedAt,
    sourceArticleCount: 1,
    reports: {
      pages: { status: 'ok', asOf, rows: [{ event: 'cpa-visible', slug, events: 5 }, { event: 'cpa-visible', slug, events: 2 }], complete: true, coverage: { returnedRows: 2, totalRows: 2, paginationComplete: true, sampled: false, sampleShare: 1, dataLagSeconds: 0 } },
      parameters: { status: 'ok', asOf, rows: [{ event: 'cpa-visible', contentId: hash, events: 7 }], complete: true, coverage: { returnedRows: 1, totalRows: 1, paginationComplete: true, sampled: false, sampleShare: 1, dataLagSeconds: 0 } },
    },
  };
}
test('derived event-page and article parameter counts agree without becoming CTR or revenue', () => {
  const s = commercialProbeSummary(fixture(), [slug]);
  assert.equal(s.articles[0].pageEvents, 7);
  assert.equal(s.articles[0].contentParameterEvents, 7);
  assert.equal(s.articles[0].countsAgree, true);
  assert.equal(s.unit, 'events');
  assert.equal(s.attributionProven, false);
  assert.equal(s.revenue, null);
  assert.ok(!JSON.stringify(s).includes(hash));
  // Real event window is preserved in the safe summary.
  assert.equal(s.status, 'ok');
  assert.deepEqual(s.period, { from: period.from, to: period.to });
  assert.equal(s.asOf, asOf);
  assert.equal(s.fetchedAt, fetchedAt);
  assert.equal(s.timezoneUTC, '+00:00');
  assert.equal(s.paidModelCost, null);
});
test('unknown rows, private parameters and unverified counter never enter public summary', () => {
  const f = fixture();
  f.private = 'private@example.org';
  f.reports.pages.rows.push({ event: 'cpa-click', slug: 'private@example.org', events: 9 }, { event: 'other private event', slug, events: 5 });
  f.reports.parameters.rows.push({ event: 'cpa-click', contentId: 'f'.repeat(64), events: 2, value: 'private@example.org' });
  const s = commercialProbeSummary(f, [slug]);
  assert.equal(s.articleRows, 1);
  assert.ok(!JSON.stringify(s).includes('private'));
  f.counterId = 1;
  assert.equal(commercialProbeSummary(f, [slug]).articleRows, 0);
});
test('missing or failed marginal report is unknown, not zero or matching counts', () => {
  const f = fixture();
  f.reports.parameters = { status: 'error', reason: 'private@example.org' };
  const s = commercialProbeSummary(f, [slug]);
  assert.equal(s.articles[0].contentParameterEvents, null);
  assert.equal(s.articles[0].countsAgree, null);
  assert.equal(s.coverage.parameters.totalRows, null);
  assert.ok(!JSON.stringify(s).includes('private'));
});
test('missing or invalid window fails closed with null dates and no confirmed counts', () => {
  const cases = [
    f => { delete f.period; },
    f => { f.period = null; },
    f => { f.period = { from: 'private@example.org', to: period.to, timeZone: 'UTC' }; },
    f => { f.period = { from: '2026-02-30', to: '2026-02-30', timeZone: 'UTC' }; },
    f => { f.asOf = null; },
    f => { f.asOf = 'not-a-date'; },
    f => { f.fetchedAt = null; },
  ];
  for (const mutate of cases) {
    const f = fixture();
    mutate(f);
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'unverified');
    assert.equal(s.period, null);
    assert.equal(s.asOf, null);
    assert.equal(s.fetchedAt, null);
    assert.equal(s.timezoneUTC, null);
    assert.equal(s.articleRows, 0);
    assert.deepEqual(s.articles, []);
    assert.equal(s.sourceRevision, null);
    assert.ok(!JSON.stringify(s).includes('private'));
  }
});
test('wrong timezone or non-ISOZ dates never become a confirmed UTC window', () => {
  const cases = [
    f => { f.period = { ...period, timeZone: '+03:00' }; },
    f => { f.period = { ...period, timeZone: 'Europe/Moscow' }; },
    f => { f.asOf = '2026-10-05 23:00:00'; },
    f => { f.asOf = '2026-10-05T23:00:00+03:00'; },
    f => { f.fetchedAt = '2026-10-05T23:00:05+00:00'; },
  ];
  for (const mutate of cases) {
    const f = fixture();
    mutate(f);
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'unverified');
    assert.equal(s.timezoneUTC, null);
    assert.equal(s.articleRows, 0);
    assert.ok(!JSON.stringify(s).includes('+03:00'));
    assert.ok(!JSON.stringify(s).includes('Europe/Moscow'));
  }
  // Valid window exposes exactly one invented-offset-free UTC marker.
  const s = commercialProbeSummary(fixture(), [slug]);
  assert.equal(s.timezoneUTC, '+00:00');
  assert.ok(!JSON.stringify(s).includes('+03:00'));
});
test('reversed window and out-of-window or reordered cutoffs stay unverified', () => {
  const reversed = fixture();
  reversed.period = { from: '2026-10-06', to: '2026-10-05', timeZone: 'UTC' };
  assert.equal(commercialProbeSummary(reversed, [slug]).status, 'unverified');
  assert.equal(commercialProbeSummary(reversed, [slug]).articleRows, 0);

  const early = fixture();
  early.asOf = '2026-10-04T23:00:00.000Z';
  early.fetchedAt = '2026-10-04T23:00:05.000Z';
  early.reports.pages.asOf = early.asOf;
  early.reports.parameters.asOf = early.asOf;
  assert.equal(commercialProbeSummary(early, [slug]).status, 'unverified');

  const reordered = fixture();
  reordered.fetchedAt = '2026-10-05T22:59:59.000Z';
  const rs = commercialProbeSummary(reordered, [slug]);
  assert.equal(rs.status, 'unverified');
  assert.equal(rs.fetchedAt, null);
});
test('mismatched per-kind cutoff excludes only that side, leaving numbers unknown', () => {
  const f = fixture();
  f.reports.pages.asOf = '2026-10-05T22:00:00.000Z';
  const s = commercialProbeSummary(f, [slug]);
  assert.equal(s.coverage.pages.status, 'unverified');
  assert.equal(s.coverage.pages.totalRows, null);
  assert.equal(s.coverage.parameters.status, 'ok');
  assert.equal(s.articles[0].pageEvents, null);
  assert.equal(s.articles[0].contentParameterEvents, 7);
  assert.equal(s.articles[0].countsAgree, null);
  assert.equal(s.paidModelCost, null);
});
test('private strings injected into window fields never leak into the summary', () => {
  const f = fixture();
  f.extra = 'private@example.org';
  f.period = { from: 'private@example.org', to: 'private@example.org', timeZone: 'private@example.org' };
  f.asOf = 'private@example.org';
  f.fetchedAt = 'private@example.org';
  f.reports.pages.asOf = 'private@example.org';
  f.sourceRevision = 'private@example.org';
  const s = commercialProbeSummary(f, [slug]);
  assert.equal(s.status, 'unverified');
  assert.ok(!JSON.stringify(s).includes('private'));
});
test('collector output with validated window flows into the summary with real counts', async () => {
  const now = new Date(asOf);
  const clock = () => new Date(fetchedAt);
  const apiGoals = [{ id: 100, type: 'action', conditions: [{ type: 'exact', url: 'cpa-visible' }] }, { id: 101, type: 'action', conditions: [{ type: 'exact', url: 'cpa-click' }] }];
  const pageRow = { dimensions: [{ id: '100', name: 'cpa-visible' }, { name: 'etiketka-media.ru' }, { name: `/blog/${slug}/` }], metrics: [7] };
  const paramRow = { dimensions: [{ id: '100', name: 'cpa-visible' }, { name: 'contentId' }, { name: hash }], metrics: [7] };
  const fetcher = async url => {
    if (url.includes('/management/')) return { ok: true, json: async () => ({ goals: apiGoals }) };
    const u = new URL(url);
    const dims = u.searchParams.get('dimensions').split(',');
    const kind = dims.includes('ym:ep:eventURLPath') ? 'pages' : 'parameters';
    const expectedDims = PROBE_DIMENSIONS[kind].join(',');
    assert.equal(u.searchParams.get('timezone'), '+00:00');
    const data = kind === 'pages' ? [pageRow] : [paramRow];
    return {
      ok: true,
      json: async () => ({
        query: {
          timezone: '+00:00', date1: period.from, date2: period.to, filters: `ym:ep:dateTime<='${asOf.slice(0, 19).replace('T', ' ')}'`,
          dimensions: expectedDims.split(','), metrics: ['ym:ep:eventsNumber'],
          limit: 1000, offset: 1, sort: expectedDims.split(','),
        },
        sampled: false, sample_share: 1, total_rows_rounded: false, contains_sensitive_data: false,
        data_lag: 0, total_rows: data.length, totals: [7], data,
      }),
    };
  };
  const collected = await collectCommercialEventProbe({ token: 'fixture-secret', slugs: [slug], sourceRevision: 'a'.repeat(40), fetcher, now, days: 1, clock });
  assert.equal(collected.status, 'ok');
  assert.deepEqual(collected.period, period);
  const s = commercialProbeSummary(collected, [slug]);
  assert.equal(s.status, 'ok');
  assert.deepEqual(s.period, { from: period.from, to: period.to });
  assert.equal(s.asOf, asOf);
  assert.equal(s.fetchedAt, fetchedAt);
  assert.equal(s.timezoneUTC, '+00:00');
  assert.equal(s.articles[0].pageEvents, 7);
  assert.equal(s.articles[0].contentParameterEvents, 7);
  assert.equal(s.articles[0].countsAgree, true);
  assert.equal(s.unit, 'events');
  assert.equal(s.attributionProven, false);
  assert.equal(s.revenue, null);
  assert.equal(s.paidModelCost, null);
  assert.ok(!JSON.stringify(s).includes('fixture-secret'));
  assert.ok(!JSON.stringify(s).includes(hash));
});
test('normalized impossible timestamps never become a verified window (CW1)', () => {
  // Date.parse normalizes these instead of rejecting them; the summary must not.
  const cases = [
    // asOf 30 Feb normalizes to 02 Mar via Date.parse.
    f => { f.asOf = '2026-02-30T23:00:00.000Z'; f.fetchedAt = '2026-03-02T23:00:05.000Z'; },
    // fetchedAt 30 Feb normalizes to 02 Mar via Date.parse.
    f => { f.fetchedAt = '2026-02-30T23:00:05.000Z'; },
    // Same-day Oct 5 window, but asOf 24:00 normalizes to Oct 6 via Date.parse.
    f => { f.asOf = '2026-10-05T24:00:00Z'; f.fetchedAt = '2026-10-06T00:00:05.000Z'; },
  ];
  for (const mutate of cases) {
    const f = fixture();
    mutate(f);
    for (const kind of ['pages', 'parameters']) f.reports[kind].asOf = f.asOf;
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'unverified');
    assert.equal(s.period, null);
    assert.equal(s.asOf, null);
    assert.equal(s.fetchedAt, null);
    assert.equal(s.timezoneUTC, null);
    assert.equal(s.articleRows, 0);
    assert.deepEqual(s.articles, []);
    assert.equal(s.sourceRevision, null);
  }
});
test('UTC calendar boundaries accept real instants and reject overflow clock fields', () => {
  const withCutoff = (f) => { for (const kind of ['pages', 'parameters']) f.reports[kind].asOf = f.asOf; return f; };
  // Valid leap day 2024-02-29 passes.
  {
    const f = withCutoff(fixture());
    f.period = { from: '2024-02-29', to: '2024-02-29', timeZone: 'UTC' };
    f.asOf = '2024-02-29T12:00:00.000Z';
    f.fetchedAt = '2024-02-29T12:00:05.000Z';
    for (const kind of ['pages', 'parameters']) f.reports[kind].asOf = f.asOf;
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'ok');
    assert.deepEqual(s.period, { from: '2024-02-29', to: '2024-02-29' });
    assert.equal(s.articleRows, 1);
  }
  // Invalid non-leap 2026-02-29 fails.
  {
    const f = fixture();
    f.asOf = '2026-02-29T12:00:00.000Z';
    f.fetchedAt = '2026-02-29T12:00:05.000Z';
    for (const kind of ['pages', 'parameters']) f.reports[kind].asOf = f.asOf;
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'unverified');
    assert.equal(s.articleRows, 0);
    assert.equal(s.asOf, null);
  }
  // Exact window edges pass: 00:00:00.000 and 23:59:59.999 on the same day.
  for (const instant of ['2026-10-05T00:00:00.000Z', '2026-10-05T23:59:59.999Z']) {
    const f = withCutoff(fixture());
    f.asOf = instant;
    f.fetchedAt = instant;
    for (const kind of ['pages', 'parameters']) f.reports[kind].asOf = f.asOf;
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'ok');
    assert.equal(s.asOf, instant);
    assert.equal(s.articleRows, 1);
  }
  // Overflow clock fields fail: minute 60, second 60.
  for (const bad of ['2026-10-05T23:60:00.000Z', '2026-10-05T23:00:60.000Z']) {
    const f = fixture();
    f.asOf = bad;
    f.fetchedAt = bad;
    for (const kind of ['pages', 'parameters']) f.reports[kind].asOf = f.asOf;
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'unverified');
    assert.equal(s.articleRows, 0);
    assert.equal(s.asOf, null);
  }
  // Collector canonical milliseconds pass (.000Z) and short fractions pass.
  for (const instant of ['2026-10-05T23:00:00.000Z', '2026-10-05T23:00:00.1Z', '2026-10-05T23:00:00.12Z']) {
    const f = withCutoff(fixture());
    f.asOf = instant;
    f.fetchedAt = instant;
    for (const kind of ['pages', 'parameters']) f.reports[kind].asOf = f.asOf;
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'ok');
    assert.equal(s.asOf, instant);
  }
  // fetchedAt before asOf stays unverified with null dates.
  {
    const f = withCutoff(fixture());
    f.fetchedAt = '2026-10-05T22:59:59.000Z';
    const s = commercialProbeSummary(f, [slug]);
    assert.equal(s.status, 'unverified');
    assert.equal(s.fetchedAt, null);
    assert.equal(s.articleRows, 0);
  }
});
