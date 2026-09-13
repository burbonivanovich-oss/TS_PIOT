#!/usr/bin/env node
// Метрики результата, а не только количества файлов (AP-P1-16).
//
// Недельный audit должен отвечать, почему темп не выполнен, не заставляя
// читать JSON руками: acceptance rate, причины отказов, инфра-пропуски,
// очередь отложенного выпуска, перелинковка, mix, время цикла и ширина бэклога.
//
//   node scripts/metrics.mjs [--days 30] [--json]
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { readJson, today, isMain } from './lib/content.mjs';
import { envelope } from './lib/outcome.mjs';

const cfg = loadConfig();
const dataDir = () => cfg.resolved.dataDir;

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

function readReports(dir, cutoff) {
  if (!existsSync(dir)) return { reports: [], unreadable: 0 };
  const reports = [];
  let unreadable = 0;
  for (const file of readdirSync(dir)) {
    const m = file.match(/^report-(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m || m[1] < cutoff) continue;
    try {
      reports.push(readJson(path.join(dir, file), null));
    } catch {
      unreadable++;
    }
  }
  reports.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { reports, unreadable };
}

function readRuns(dir) {
  const runsDir = path.join(dir, 'runs');
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((f) => /\.json$/.test(f))
    .map((f) => {
      try {
        return readJson(path.join(runsDir, f), null);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function computeMetrics({ dir = dataDir(), days = 30, now = new Date() } = {}) {
  const cutoffDate = new Date(now);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const state = readJson(path.join(dir, 'autopilot.json'), {
    counters: { new: 0, rewrite: 0, published: 0, quarantined: 0, infraReleases: 0 },
    history: [],
  });
  const { reports, unreadable } = readReports(dir, cutoff);
  const publishLog = readJson(path.join(dir, 'publish-log.json'), { days: {} });
  const release = readJson(path.join(dir, 'release-queue.json'), { items: [] });
  const dupes = readJson(path.join(dir, 'dupes.json'), { pairs: [] });
  const backlog = readJson(path.join(dir, 'backlog.json'), { topics: [] });

  const results = reports.flatMap((r) => r.results || []);
  const published = reports.reduce((s, r) => s + (r.published || 0), 0);
  const rejected = results.filter((r) => r.status === 'rejected').length;
  const quarantined = results.filter((r) => r.status === 'quarantined').length;
  const infraMissing = results.filter((r) => r.status === 'infra_missing').length;
  const infraReleased = results.filter((r) => r.status === 'infra_released').length;
  const attempts = published + rejected + quarantined;

  const reasonCounts = new Map();
  for (const r of results.filter((x) => x.status === 'rejected' || x.status === 'quarantined')) {
    for (const reason of String(r.detail || 'unknown').split(',').map((s) => s.trim()).filter(Boolean)) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  }

  const runs = readRuns(dir);
  const cycles = runs
    .filter((r) => r.stages?.planned?.at && r.stages?.gated?.at)
    .map((r) => Math.round((new Date(r.stages.gated.at) - new Date(r.stages.planned.at)) / 60000));

  const plannedTopics = backlog.topics.filter((t) => t.status === 'planned');
  const entityCounts = new Map();
  for (const t of plannedTopics) entityCounts.set(t.entity, (entityCounts.get(t.entity) || 0) + 1);
  const topEntity = [...entityCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  const month = now.toISOString().slice(0, 7);
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const done = state.counters.new + state.counters.rewrite;
  const expectedByToday = Math.round((cfg.throughput.monthlyTarget * day) / daysInMonth);

  // AP-P2-07: целевая доля рерайтов считается на сегодня, а не на конец месяца,
  // и дефицит виден отдельно по новым и рерайтам — иначе недобор одной половины
  // маскируется перевыполнением другой.
  const targetRewriteToday = Math.round(expectedByToday * cfg.mix.rewrite);
  const targetNewToday = expectedByToday - targetRewriteToday;

  const merge = dupes.pairs.filter((p) => p.verdict === 'merge').length;
  const watch = dupes.pairs.filter((p) => p.verdict === 'watch').length;

  const metrics = {
    period: { from: cutoff, to: today(), reports: reports.length, unreadableReports: unreadable },
    pace: {
      month,
      done,
      expectedByToday,
      debt: Math.max(0, expectedByToday - done),
      target: cfg.throughput.monthlyTarget,
    },
    acceptance: {
      attempts,
      published,
      rejected,
      quarantined,
      infraMissing,
      infraReleased,
      acceptanceRate: attempts ? Math.round((published / attempts) * 100) / 100 : null,
    },
    rejectReasons: [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    links: {
      inserted: reports.reduce((s, r) => s + (r.linksInserted || 0), 0),
      orphansBefore: reports.reduce((s, r) => s + (r.orphansBefore || 0), 0),
      orphansAfter: reports.reduce((s, r) => s + (r.orphansAfter || 0), 0),
    },
    mix: {
      new: state.counters.new,
      rewrite: state.counters.rewrite,
      target: cfg.mix,
      targetNewToday,
      targetRewriteToday,
      debtNew: Math.max(0, targetNewToday - state.counters.new),
      debtRewrite: Math.max(0, targetRewriteToday - state.counters.rewrite),
    },
    cycle: { medianMinutes: median(cycles), samples: cycles.length },
    byDay: publishLog.days,
    backlog: {
      planned: plannedTopics.length,
      entities: entityCounts.size,
      topEntity: topEntity ? { entity: topEntity[0], count: topEntity[1], share: plannedTopics.length ? Math.round((topEntity[1] / plannedTopics.length) * 100) / 100 : 0 } : null,
    },
    dupes: { merge, watch, total: dupes.pairs.length },
    waitingRelease: release.items.length,
    quarantinedTotal: state.quarantine?.length || 0,
  };
  metrics.diagnosis = diagnose(metrics);
  return metrics;
}

/** Человекочитаемый ответ «почему темп не выполнен». */
function diagnose(m) {
  const lines = [];
  if (m.pace.debt > 0) {
    lines.push(`темп: ${m.pace.done}/${m.pace.expectedByToday} к сегодня, долг ${m.pace.debt}`);
  } else {
    lines.push(`темп: ${m.pace.done}/${m.pace.expectedByToday}, без долга`);
  }
  if (m.acceptance.infraMissing || m.acceptance.infraReleased) {
    lines.push(`инфра-пропуски исполнителя: ${m.acceptance.infraMissing} ждут, ${m.acceptance.infraReleased} возвращены в план`);
  }
  for (const { reason, count } of m.rejectReasons.slice(0, 3)) {
    lines.push(`отказ ${count}×: ${reason}`);
  }
  if (m.waitingRelease) lines.push(`в ожидании выпуска (лимит maxPerDay): ${m.waitingRelease}`);
  if (m.mix.debtRewrite > 0) lines.push(`рерайты: ${m.mix.rewrite} при цели ${m.mix.targetRewriteToday} к сегодня (дефицит ${m.mix.debtRewrite})`);
  else if (m.mix.debtNew > 0) lines.push(`новые: ${m.mix.new} при цели ${m.mix.targetNewToday} к сегодня (дефицит ${m.mix.debtNew})`);
  if (m.quarantinedTotal) lines.push(`карантин: ${m.quarantinedTotal}`);
  if (m.dupes.merge) lines.push(`дубли на разведение: ${m.dupes.merge}`);
  if (m.backlog.planned < 50) lines.push(`бэклог исчерпан: ${m.backlog.planned} тем`);
  if (m.cycle.medianMinutes !== null) lines.push(`медиана прохода: ${m.cycle.medianMinutes} мин (${m.cycle.samples} проходов)`);
  return lines;
}

function main() {
  const args = process.argv.slice(2);
  const daysIdx = args.indexOf('--days');
  const days = daysIdx !== -1 ? Number(args[daysIdx + 1]) : 30;
  const metrics = computeMetrics({ days });
  if (args.includes('--json')) {
    console.log(JSON.stringify(envelope({ ok: true, category: 'ok', exitCode: 0, ...metrics }), null, 2));
    return;
  }
  console.log(`Аудит за ${metrics.period.from}…${metrics.period.to}: отчётов ${metrics.period.reports}`);
  for (const line of metrics.diagnosis) console.log(`   ${line}`);
  console.log(
    `   приёмка: ${Math.round((metrics.acceptance.acceptanceRate ?? 0) * 100)}%, ` +
      `ссылок ${metrics.links.inserted}, сирот ${metrics.links.orphansBefore} → ${metrics.links.orphansAfter}`,
  );
  console.log(
    `   mix: new ${metrics.mix.new} / rewrite ${metrics.mix.rewrite} (цель ${metrics.mix.target.new}/${metrics.mix.target.rewrite}), ` +
      `бэклог ${metrics.backlog.planned} тем / ${metrics.backlog.entities} сущностей`,
  );
}

if (isMain(import.meta.url)) main();