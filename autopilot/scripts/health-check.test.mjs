import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const MONTH = TODAY.slice(0, 7);

function baseConfig(contentRoot) {
  return {
    contentRoot,
    paths: { blog: 'src/content/blog', pillars: 'src/content/pillars', glossary: 'src/content/glossary', wiki: 'src/content/wiki' },
    throughput: { monthlyTarget: 200, batchesPerDay: 2, maxBatchSize: 6, maxParallelWriting: 8, catchUpFactor: 1.35 },
    mix: { new: 0.75, rewrite: 0.25 },
    dedupe: { canonicalExact: true, containmentBlock: 0.72, containmentWarn: 0.5, titleJaccardBlock: 0.62, titleJaccardWarn: 0.45, bodyShingleBlock: 0.3, shingleSize: 5, keywordOverlapBlock: 0.7 },
    rewrite: { staleAfterDays: 180, hardStaleAfterDays: 365, minDaysBetweenRewrites: 90, npaTriggerBoost: 40, thinContentChars: 4500 },
    interlink: { minOutbound: 3, maxOutbound: 8, minInbound: 2, maxInboundPerRun: 4, maxLinksPerParagraph: 1, anchorMinLength: 8, reciprocalPenalty: true, protectedZones: ['frontmatter'], minAnchorIdf: 3.2, rareAnchorIdf: 3.0, minRelevance: 0.35 },
    gates: { minScore: 70, maxAiMarkerDensity: 0.6, requireFactcheck: true, minChars: 4000, maxChars: 22000, quarantineAfterFailures: 2, infraRetryLimit: 3 },
    publish: { autoPublish: true, draftOnFail: true, maxPerDay: 12 },
    backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2 },
  };
}

function fixture({ writing = [], inFlight = [], orders = [], extraTopics = [], quarantine = [] } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'health-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  writeFileSync(path.join(blog, 'seed.md'), '---\ntitle: "s"\ndescription: "d"\npubDate: "2026-01-01"\n---\n\nBody.\n', 'utf8');
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');

  const topics = [
    ...writing.map((slug) => ({ slug, status: 'writing', entity: 'e', intent: 'what' })),
    ...extraTopics,
  ];
  writeFileSync(path.join(dataDir, 'backlog.json'), JSON.stringify({ generatedAt: null, topics }), 'utf8');
  writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify({ date: TODAY, orders: orders.map((slug) => ({ slug, kind: 'new' })) }), 'utf8');
  writeFileSync(
    path.join(dataDir, 'autopilot.json'),
    JSON.stringify({
      version: 1, startedAt: TODAY, month: MONTH,
      counters: { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 },
      inFlight: inFlight.map((slug) => ({ slug, kind: 'new', title: 't', claimedAt: new Date().toISOString(), failures: 0, infraFailures: 0 })),
      quarantine: quarantine.map((slug) => ({ slug })),
      history: [], lastRunAt: null,
    }),
    'utf8',
  );
  return { root, dataDir, configFile };
}

function health(fx) {
  const proc = spawnSync(process.execPath, ['scripts/health-check.mjs', '--json'], {
    cwd: ROOT,
    env: {
      ...process.env,
      AUTOPILOT_CONFIG: fx.configFile,
      AUTOPILOT_DATA_DIR: fx.dataDir,
      AUTOPILOT_LOCK_FILE: path.join(fx.dataDir, '.autopilot.lock'),
      CONTENT_ROOT: fx.root,
    },
    encoding: 'utf8',
  });
  const report = JSON.parse(proc.stdout);
  return { report, check: report.checks.find((c) => c.name === 'согласованность') };
}

test('AP-P1-13: рассинхронизация writing/inFlight/orders — отдельный blocker с repair plan', () => {
  const fx = fixture({ writing: ['t1', 't2'], inFlight: [], orders: ['t1', 't2'] });
  const { check } = health(fx);
  assert.equal(check.level, 'fail');
  assert.match(check.detail, /writing без активного слота \(2\)/);
  assert.match(check.detail, /наряды без слота/);
  assert.match(check.detail, /backlog\.mjs reconcile/);
});

test('AP-P1-13: согласованное состояние проходит инвариант', () => {
  const fx = fixture({ writing: ['t1'], inFlight: ['t1'], orders: ['t1'] });
  const { check } = health(fx);
  assert.equal(check.level, 'ok', JSON.stringify(check));
});

test('AP-P1-13: released без файла и дубли в карантине ловятся', () => {
  const fx = fixture({
    writing: ['t1'],
    inFlight: ['t1'],
    orders: ['t1'],
    extraTopics: [{ slug: 'gone', status: 'released', entity: 'e' }],
    quarantine: ['q1', 'q1'],
  });
  const { check } = health(fx);
  assert.equal(check.level, 'fail');
  assert.match(check.detail, /released без файла: gone/);
  assert.match(check.detail, /дубли в карантине: q1/);
});

test('AP-P1-13: reconcile возвращает writing без слота в planned', () => {
  const fx = fixture({ writing: ['t1', 't2'], inFlight: [], orders: ['t1', 't2'] });
  const proc = spawnSync(process.execPath, ['scripts/backlog.mjs', 'reconcile'], {
    cwd: ROOT,
    env: {
      ...process.env,
      AUTOPILOT_CONFIG: fx.configFile,
      AUTOPILOT_DATA_DIR: fx.dataDir,
      AUTOPILOT_LOCK_FILE: path.join(fx.dataDir, '.autopilot.lock'),
      CONTENT_ROOT: fx.root,
    },
    encoding: 'utf8',
  });
  assert.equal(proc.status, 0, proc.stderr);
  const backlog = JSON.parse(readFileSync(path.join(fx.dataDir, 'backlog.json'), 'utf8'));
  assert.ok(backlog.topics.every((t) => t.status === 'planned'), JSON.stringify(backlog.topics));
  const { check } = health(fx);
  // После reconcile writing пуст, но orders остались без слотов — это уже другой
  // сигнал; проверяем, что writing-рассинхронизация ушла.
  assert.ok(!/writing без активного слота/.test(check.detail), check.detail);
});
