import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeMetrics } from './metrics.mjs';

const iso = (daysAgo) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
};
const day = (daysAgo) => iso(daysAgo).toISOString().slice(0, 10);

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'metrics-'));
  mkdirSync(path.join(dir, 'runs'), { recursive: true });
  writeFileSync(
    path.join(dir, 'autopilot.json'),
    JSON.stringify({
      version: 1,
      month: day(0).slice(0, 7),
      counters: { new: 5, rewrite: 1, published: 5, blockedDupes: 0, quarantined: 1, infraReleases: 1 },
      inFlight: [],
      quarantine: [{ slug: 'q1' }],
      history: [],
    }),
    'utf8',
  );
  writeFileSync(
    path.join(dir, `report-${day(1)}.json`),
    JSON.stringify({
      date: day(1),
      published: 3,
      results: [
        { slug: 'a', status: 'published' },
        { slug: 'b', status: 'published' },
        { slug: 'c', status: 'published' },
        { slug: 'd', status: 'rejected', detail: 'sources, length' },
      ],
      linksInserted: 4,
      orphansBefore: 10,
      orphansAfter: 8,
    }),
    'utf8',
  );
  writeFileSync(
    path.join(dir, `report-${day(0)}.json`),
    JSON.stringify({
      date: day(0),
      published: 2,
      results: [
        { slug: 'e', status: 'published' },
        { slug: 'f', status: 'published' },
        { slug: 'g', status: 'quarantined', detail: 'sources' },
        { slug: 'h', status: 'infra_missing', detail: 'файл не создан' },
      ],
      linksInserted: 2,
      orphansBefore: 8,
      orphansAfter: 6,
    }),
    'utf8',
  );
  writeFileSync(path.join(dir, 'publish-log.json'), JSON.stringify({ days: { [day(0)]: ['e', 'f'], [day(1)]: ['a', 'b', 'c'] } }), 'utf8');
  writeFileSync(path.join(dir, 'release-queue.json'), JSON.stringify({ items: [{ slug: 'w1' }, { slug: 'w2' }] }), 'utf8');
  writeFileSync(
    path.join(dir, 'dupes.json'),
    JSON.stringify({ generatedAt: day(0), pairs: [{ verdict: 'merge' }, { verdict: 'watch' }, { verdict: 'merge' }] }),
    'utf8',
  );
  const topics = [
    ...Array.from({ length: 4 }, (_, i) => ({ slug: `t${i}`, status: 'planned', entity: 'e1' })),
    { slug: 't4', status: 'planned', entity: 'e2' },
    { slug: 't5', status: 'planned', entity: 'e3' },
    { slug: 't6', status: 'planned', entity: 'e4' },
    { slug: 'rel', status: 'released', entity: 'e1' },
  ];
  writeFileSync(path.join(dir, 'backlog.json'), JSON.stringify({ generatedAt: day(0), topics }), 'utf8');
  describeRun(dir, 'r1', 30);
  describeRun(dir, 'r2', 50);
  return dir;
}

function describeRun(dir, runId, minutes) {
  const start = new Date(Date.now() - minutes * 60000);
  const end = new Date(start.getTime() + minutes * 60000);
  writeFileSync(
    path.join(dir, 'runs', `${runId}.json`),
    JSON.stringify({
      runId,
      date: day(0),
      stages: { planned: { at: start.toISOString() }, gated: { at: end.toISOString() } },
      orders: [],
    }),
    'utf8',
  );
}

test('AP-P1-16: метрики собираются из отчётов, состояния и очередей', () => {
  const dir = fixture();
  const m = computeMetrics({ dir, days: 30 });
  assert.equal(m.acceptance.published, 5);
  assert.equal(m.acceptance.rejected, 1);
  assert.equal(m.acceptance.quarantined, 1);
  assert.equal(m.acceptance.infraMissing, 1);
  assert.equal(m.acceptance.acceptanceRate, Math.round((5 / 7) * 100) / 100);
  assert.deepEqual(m.rejectReasons[0], { reason: 'sources', count: 2 });
  assert.deepEqual(m.links, { inserted: 6, orphansBefore: 18, orphansAfter: 14 });
  assert.equal(m.mix.new, 5);
  assert.equal(m.mix.rewrite, 1);
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const expectedByToday = Math.round((55 * now.getUTCDate()) / daysInMonth);
  assert.equal(m.mix.targetRewriteToday, Math.round(14 * now.getUTCDate() / daysInMonth));
  assert.equal(m.mix.debtRewrite, Math.max(0, Math.round(14 * now.getUTCDate() / daysInMonth) - 1));
  assert.equal(m.cycle.medianMinutes, 40);
  assert.equal(m.cycle.samples, 2);
  assert.equal(m.backlog.planned, 7);
  assert.equal(m.backlog.entities, 4);
  assert.equal(m.backlog.topEntity.share, Math.round((4 / 7) * 100) / 100);
  assert.equal(m.dupes.merge, 2);
  assert.equal(m.waitingRelease, 2);
  assert.equal(m.quarantinedTotal, 1);
  assert.ok(m.byDay[day(0)].includes('e'));
});

test('AP-P1-16: диагностика объясняет недобор темпа без чтения JSON', () => {
  const dir = fixture();
  const m = computeMetrics({ dir, days: 30 });
  const text = m.diagnosis.join('\n');
  assert.match(text, /темп:/);
  assert.match(text, /отказ 2×: sources/);
  assert.match(text, /в ожидании выпуска/);
  assert.match(text, /карантин: 1/);
  assert.match(text, /дубли на разведение: 2/);
  assert.match(text, /медиана прохода: 40 мин/);
});

test('AP-P1-16: пустой каталог даёт нулевые метрики без падения', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'metrics-empty-'));
  const m = computeMetrics({ dir });
  assert.equal(m.acceptance.published, 0);
  assert.equal(m.acceptance.acceptanceRate, null);
  assert.equal(m.cycle.medianMinutes, null);
  assert.equal(m.backlog.planned, 0);
});

test('multiple gated runs on one day survive the overwritten day report and queue acceptance counts as success',()=>{
 const dir=fixture(), date=day(0);
 const first={runId:'first',date,stages:{gated:{published:0,results:[{slug:'new-a',status:'accepted_waiting_release'},{slug:'bad',status:'rejected',detail:'sources'}],links:{linksInserted:3}}}};
 const second={runId:'second',date,stages:{gated:{published:0,results:[{slug:'new-b',status:'accepted_waiting_release'}],links:{linksInserted:1}}}};
 writeFileSync(path.join(dir,'runs','first.json'),JSON.stringify(first));writeFileSync(path.join(dir,'runs','second.json'),JSON.stringify(second));
 writeFileSync(path.join(dir,`report-${date}.json`),JSON.stringify({date,runId:'second',published:0,results:second.stages.gated.results,linksInserted:1}));
 const m=computeMetrics({dir,days:0});assert.equal(m.period.gatedRuns,2);assert.equal(m.period.reports,2);assert.equal(m.acceptance.accepted,2);assert.equal(m.acceptance.attempts,3);assert.equal(m.acceptance.acceptanceRate,.67);assert.equal(m.acceptance.published,2,'journal is authoritative for publication');assert.equal(m.links.inserted,4);assert.deepEqual(m.rejectReasons,[{reason:'sources',count:1}]);
});

test('ambiguous legacy day report is flagged and future/outside-window runs do not affect cycle or rates',()=>{
 const dir=fixture(),date=day(0);writeFileSync(path.join(dir,'runs','current.json'),JSON.stringify({runId:'current',date,stages:{gated:{results:[{slug:'a',status:'accepted_waiting_release'}]}}}));
 writeFileSync(path.join(dir,'runs','future.json'),JSON.stringify({runId:'future',date:'2999-01-01',stages:{planned:{at:'2999-01-01T00:00:00Z'},gated:{at:'2999-01-01T01:00:00Z',results:[{slug:'future',status:'rejected'}]}}}));
 const m=computeMetrics({dir,days:0});assert.equal(m.period.ambiguousLegacyReports,1);assert.equal(m.period.gatedRuns,1);assert.equal(m.acceptance.accepted,1);assert.equal(m.acceptance.rejected,0);assert.equal(m.period.linkMeasurements,0);assert.equal(m.cycle.samples,2);
});

test('model accounting keeps failures and unknown historical/unfinished usage distinct from zero', async () => {
  const { modelUsage } = await import('./metrics.mjs');
  const start = '2026-10-04T01:00:00Z';
  const runs = [{ date:'2026-10-04', stages:{written:{}}, meta:{modelInvocations:[
    {startedAt:start,status:'delivered',reportedTokens:100,tokenSource:'codex-cli-footer',durationMs:1000},
    {startedAt:start,status:'failed',reportedTokens:50,tokenSource:'codex-cli-footer',durationMs:3000},
    {startedAt:start,status:'started',reportedTokens:null,durationMs:null},
    {startedAt:'2026-09-01',status:'delivered',reportedTokens:999,tokenSource:'codex-cli-footer',durationMs:999},
  ]}}, {date:'2026-10-04',stages:{written:{}}}];
  const m=modelUsage(runs,'2026-10-01','2026-10-04');
  assert.equal(m.callsRecorded,3);assert.equal(m.finished,2);assert.equal(m.unfinished,1);
  assert.equal(m.reportedTokens,150);assert.equal(m.callsWithoutTokenMeasurement,1);
  assert.equal(m.totalDurationMs,4000);assert.equal(m.medianDurationMs,2000);
  assert.equal(m.historicalWrittenRunsWithoutLedger,1);assert.equal(m.paidCost,null);
  const empty=modelUsage([],'2026-10-01','2026-10-04');assert.equal(empty.reportedTokens,null);assert.equal(empty.totalDurationMs,null);
});
