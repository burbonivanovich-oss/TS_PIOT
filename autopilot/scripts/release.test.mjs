import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allocateReleases } from './lib/release.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('AP-P0-17: квота делит 20 принятых на выпуск и ожидание', () => {
  const accepted = Array.from({ length: 20 }, (_, i) => ({ slug: `s${String(i).padStart(2, '0')}`, acceptedAt: `2026-09-13T10:${String(i).padStart(2, '0')}:00Z` }));
  const { release, wait } = allocateReleases({ accepted, alreadyToday: 0, maxPerDay: 12 });
  assert.equal(release.length, 12);
  assert.equal(wait.length, 8);
  assert.deepEqual(release.map((r) => r.slug), accepted.slice(0, 12).map((r) => r.slug), 'старейшие первыми');
});

test('AP-P0-17: ожидавшие выпускаются раньше свежих', () => {
  const waiting = [{ slug: 'old', acceptedAt: '2026-09-01T00:00:00Z' }];
  const accepted = [{ slug: 'new', acceptedAt: '2026-09-13T00:00:00Z' }];
  const { release, wait } = allocateReleases({ waiting, accepted, alreadyToday: 0, maxPerDay: 1 });
  assert.deepEqual(release.map((r) => r.slug), ['old']);
  assert.deepEqual(wait.map((r) => r.slug), ['new']);
});

test('AP-P0-17: уже опубликованное сегодня сокращает остаток', () => {
  const accepted = [{ slug: 'a' }, { slug: 'b' }];
  const { release, wait } = allocateReleases({ accepted, alreadyToday: 2, maxPerDay: 3 });
  assert.equal(release.length, 1);
  assert.equal(wait.length, 1);
  const full = allocateReleases({ accepted, alreadyToday: 3, maxPerDay: 3 });
  assert.equal(full.release.length, 0);
  assert.equal(full.wait.length, 2);
});

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
    publish: { autoPublish: true, draftOnFail: true, maxPerDay: 3 },
    backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2 },
  };
}

const heldArticle = (title) =>
  `---\ntitle: "${title}"\ndescription: "d"\npubDate: "2026-01-01"\ndraft: true\nautopilotHold: true\nautopilotHoldReason: accepted_waiting_release\n---\n\nКороткое тело.\n`;

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'release-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);

  const waiting = ['w1', 'w2', 'w3', 'w4', 'w5'].map((slug, i) => ({
    slug,
    kind: 'new',
    score: 80,
    acceptedAt: `2026-09-${String(10 + i).padStart(2, '0')}T00:00:00Z`,
  }));
  for (const item of waiting) writeFileSync(path.join(blog, `${item.slug}.md`), heldArticle(item.slug), 'utf8');

  writeFileSync(path.join(dataDir, 'release-queue.json'), JSON.stringify({ generatedAt: day, items: waiting }), 'utf8');
  writeFileSync(path.join(dataDir, 'publish-log.json'), JSON.stringify({ days: { [day]: ['x1', 'x2'] } }), 'utf8');
  writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify({ date: day, orders: [] }), 'utf8');
  writeFileSync(
    path.join(dataDir, 'autopilot.json'),
    JSON.stringify({ version: 1, startedAt: day, month, counters: { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 }, inFlight: [], quarantine: [], history: [], lastRunAt: null }),
    'utf8',
  );
  return { root, blog, dataDir, configFile, day };
}

function settle(fx) {
  const proc = spawnSync(process.execPath, ['scripts/pipeline.mjs', 'settle', '--json'], {
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
  assert.notEqual(proc.status, 1, `settle упал: ${proc.stderr}`);
  return JSON.parse(proc.stdout);
}

test('AP-P0-17: settle выпускает только остаток квоты и держит остальных', () => {
  const fx = fixture();
  const report = settle(fx);
  assert.equal(report.published, 1, 'сегодня уже 2 публикации, лимит 3 → остаток 1');
  assert.equal(report.acceptedWaiting, 4);
  const log = JSON.parse(readFileSync(path.join(fx.dataDir, 'publish-log.json'), 'utf8'));
  assert.deepEqual(log.days[fx.day], ['x1', 'x2', 'w1'], 'старейший w1 выпущен');
  const w1 = readFileSync(path.join(fx.blog, 'w1.md'), 'utf8');
  assert.match(w1, /draft: false/);
  assert.ok(!/autopilotHold/.test(w1), 'hold снят при выпуске');
  const w2 = readFileSync(path.join(fx.blog, 'w2.md'), 'utf8');
  assert.match(w2, /draft: true/);
  assert.match(w2, /autopilotHold: true/);
});

test('AP-P0-17: повторный settle в тот же день не выпускает и не дублирует', () => {
  const fx = fixture();
  settle(fx);
  const second = settle(fx);
  assert.equal(second.published, 0);
  assert.equal(second.acceptedWaiting, 4);
  const log = JSON.parse(readFileSync(path.join(fx.dataDir, 'publish-log.json'), 'utf8'));
  assert.deepEqual(log.days[fx.day], ['x1', 'x2', 'w1']);
});

test('AP-P0-17: на следующий день квота открывается снова, старейшие первыми', () => {
  const fx = fixture();
  settle(fx);
  // Сдвигаем журнал на вчера: сегодня квота снова свободна.
  const logPath = path.join(fx.dataDir, 'publish-log.json');
  const log = JSON.parse(readFileSync(logPath, 'utf8'));
  log.days = { '2026-09-12': log.days[fx.day] };
  writeFileSync(logPath, JSON.stringify(log), 'utf8');
  const report = settle(fx);
  assert.equal(report.published, 3, 'лимит 3 за новый день');
  assert.equal(report.acceptedWaiting, 1);
  const remaining = JSON.parse(readFileSync(path.join(fx.dataDir, 'release-queue.json'), 'utf8'));
  assert.deepEqual(remaining.items.map((i) => i.slug), ['w5']);
  for (const slug of ['w2', 'w3', 'w4']) {
    assert.match(readFileSync(path.join(fx.blog, `${slug}.md`), 'utf8'), /draft: false/);
  }
});
