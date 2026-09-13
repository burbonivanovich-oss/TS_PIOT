import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, setStage, readRun } from './lib/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = '2026-09-13-test-topic';

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

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'pipeline-'));
  mkdirSync(path.join(root, 'src', 'content', 'blog'), { recursive: true });
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');
  const month = new Date().toISOString().slice(0, 7);
  writeFileSync(
    path.join(dataDir, 'autopilot.json'),
    JSON.stringify({
      version: 1,
      startedAt: '2026-09-13',
      month,
      counters: { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 },
      inFlight: [{ slug: SLUG, kind: 'new', title: 't', claimedAt: new Date().toISOString(), failures: 0, infraFailures: 0 }],
      quarantine: [],
      history: [],
      lastRunAt: null,
    }),
    'utf8',
  );
  writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify({ date: '2026-09-13', orders: [{ kind: 'new', slug: SLUG, title: 't' }] }), 'utf8');
  writeFileSync(path.join(dataDir, 'backlog.json'), JSON.stringify({ generatedAt: null, topics: [{ slug: SLUG, status: 'writing' }] }), 'utf8');
  return { root, dataDir, configFile };
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

const readState = (fx) => JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'));

test('AP-P0-12: два settle без файла не карантинят тему и не считают редакционный провал', () => {
  const fx = fixture();
  const first = settle(fx);
  const second = settle(fx);
  assert.equal(first.infraMissing, 1);
  assert.equal(second.infraMissing, 1);
  assert.equal(first.quarantined, 0);
  assert.equal(second.quarantined, 0);
  const state = readState(fx);
  assert.equal(state.quarantine.length, 0);
  assert.equal(state.inFlight.length, 1, 'слот удерживается до лимита инфраструктурных повторов');
  assert.equal(state.inFlight[0].failures, 0);
  assert.equal(state.inFlight[0].infraFailures, 2);
  assert.equal(state.counters.quarantined, 0);
});

test('AP-P0-12: после лимита инфраструктурных пропусков тема возвращается в план, не в карантин', () => {
  const fx = fixture();
  settle(fx);
  settle(fx);
  const third = settle(fx);
  assert.equal(third.infraReleased, 1);
  const state = readState(fx);
  assert.equal(state.inFlight.length, 0, 'слот освобождён');
  assert.equal(state.quarantine.length, 0, 'карантин не пополнён');
  assert.equal(state.counters.infraReleases, 1);
  const backlog = JSON.parse(readFileSync(path.join(fx.dataDir, 'backlog.json'), 'utf8'));
  assert.equal(backlog.topics[0].status, 'planned', 'тема возвращена в очередь');
});

test('AP-P0-11: settle фиксирует стадию gated и не повторяет её', () => {
  const fx = fixture();
  const run = createRun({ dir: fx.dataDir, date: '2026-09-13' });
  setStage(run.runId, 'planned', { orderCount: 1 }, { dir: fx.dataDir });
  const ordersFile = path.join(fx.dataDir, 'orders.json');
  const orders = JSON.parse(readFileSync(ordersFile, 'utf8'));
  orders.runId = run.runId;
  writeFileSync(ordersFile, JSON.stringify(orders), 'utf8');

  const first = settle(fx);
  assert.equal(first.runId, run.runId);
  assert.equal(first.runStage, 'set');
  assert.ok(readRun(run.runId, { dir: fx.dataDir }).stages.gated, 'стадия gated записана');

  const second = settle(fx);
  assert.equal(second.runStage, 'already', 'повтор стадии идемпотентен');
  const manifest = readRun(run.runId, { dir: fx.dataDir });
  assert.equal(manifest.history.filter((h) => h.stage === 'gated').length, 1);
});

test('AP-P0-11: при потере манифеста приёмка останавливается (fail-closed)', () => {
  const fx = fixture();
  const ordersFile = path.join(fx.dataDir, 'orders.json');
  const orders = JSON.parse(readFileSync(ordersFile, 'utf8'));
  orders.runId = '2026-09-13-deadbeef';
  writeFileSync(ordersFile, JSON.stringify(orders), 'utf8');
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
  assert.notEqual(proc.status, 0, 'должен упасть до записи счётчиков');
  const out = JSON.parse(proc.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /Нет манифеста прохода/);
  assert.equal(out.category, 'internal');
});

test('AP-P1-05: draftOnFail возвращает завёрнутый текст в черновики', () => {
  const fx = fixture();
  const article = `---\ntitle: "t"\ndescription: "d"\npubDate: "2026-01-01"\ndraft: false\n---\n\nКоротко.\n`;
  writeFileSync(path.join(fx.root, 'src', 'content', 'blog', `${SLUG}.md`), article, 'utf8');
  const report = settle(fx);
  assert.ok(report.rejected >= 0);
  const after = readFileSync(path.join(fx.root, 'src', 'content', 'blog', `${SLUG}.md`), 'utf8');
  assert.match(after, /autopilotHold: true/);
  assert.match(after, /draft: true/, 'draftOnFail должен вернуть текст в черновики');

  // draftOnFail=false: hold ставится, но draft не форсируется.
  const fx2 = fixture();
  const cfg = JSON.parse(readFileSync(fx2.configFile, 'utf8'));
  cfg.publish.draftOnFail = false;
  writeFileSync(fx2.configFile, JSON.stringify(cfg), 'utf8');
  writeFileSync(path.join(fx2.root, 'src', 'content', 'blog', `${SLUG}.md`), article, 'utf8');
  settle(fx2);
  const after2 = readFileSync(path.join(fx2.root, 'src', 'content', 'blog', `${SLUG}.md`), 'utf8');
  assert.match(after2, /autopilotHold: true/);
  assert.match(after2, /draft: false/);
});

test('AP-P1-09: потеря orders.json не оставляет активный рерайт без наряда', () => {
  const fx = fixture();
  const rewriteSlug = '2020-01-01-old-article';
  const runId = '2026-09-13-aaaaaaaa';
  writeFileSync(
    path.join(fx.root, 'src', 'content', 'blog', `${rewriteSlug}.md`),
    `---\ntitle: "Старая статья"\ndescription: "d"\npubDate: "2020-01-01"\ndraft: false\n---\n\nКороткое тело.\n`,
    'utf8',
  );
  const state = JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'));
  state.inFlight = [{ slug: rewriteSlug, kind: 'rewrite', title: 'Старая статья', claimedAt: new Date().toISOString(), failures: 0, infraFailures: 0 }];
  writeFileSync(path.join(fx.dataDir, 'autopilot.json'), JSON.stringify(state), 'utf8');
  writeFileSync(
    path.join(fx.dataDir, 'rewrite-queue.json'),
    JSON.stringify({ generatedAt: null, size: 1, items: [{ slug: rewriteSlug, title: 'Старая статья', score: 50, reasons: ['не обновлялась'], reservedAt: new Date().toISOString(), runId }] }),
    'utf8',
  );
  writeFileSync(path.join(fx.dataDir, 'orders.json'), JSON.stringify({ date: '2026-09-13', orders: [] }), 'utf8');
  writeFileSync(path.join(fx.dataDir, 'backlog.json'), JSON.stringify({ generatedAt: null, topics: [] }), 'utf8');

  const proc = spawnSync(process.execPath, ['scripts/pipeline.mjs', 'plan', '--json'], {
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
  assert.notEqual(proc.status, 1, proc.stderr);
  const payload = JSON.parse(proc.stdout);
  const carried = payload.orders.find((o) => o.slug === rewriteSlug);
  assert.ok(carried, `рерайт должен быть перенесён в наряд: ${JSON.stringify(payload.orders)}`);
  assert.equal(carried.kind, 'rewrite');
  assert.equal(carried.retry, true);
  assert.equal(carried.runId, runId, 'наряд сохраняет runId резервации');

  const queue = JSON.parse(readFileSync(path.join(fx.dataDir, 'rewrite-queue.json'), 'utf8'));
  const reserved = queue.items.find((i) => i.slug === rewriteSlug);
  assert.equal(reserved.runId, runId, 'резервация пережила пересборку очереди');
  assert.ok(reserved.reservedAt);
});

test('AP-P0-16: провал build не публикует и не финализирует, успех — публикует', () => {
  const fx = fixture();
  const heldSlug = '2026-09-13-waiting-article';
  const article = `---\ntitle: "Ожидающая"\ndescription: "d"\npubDate: "2026-01-01"\ndraft: true\nautopilotHold: true\nautopilotHoldReason: accepted_waiting_release\n---\n\nТело.\n`;
  writeFileSync(path.join(fx.root, 'src', 'content', 'blog', `${heldSlug}.md`), article, 'utf8');
  writeFileSync(path.join(fx.dataDir, 'release-queue.json'), JSON.stringify({ generatedAt: '2026-09-13', items: [{ slug: heldSlug, kind: 'new', score: 80, acceptedAt: '2026-09-10T00:00:00Z' }] }), 'utf8');
  writeFileSync(path.join(fx.dataDir, 'publish-log.json'), JSON.stringify({ days: {} }), 'utf8');
  // Нарядов нет: inFlight пуст. Проверяем именно build-гейт ожидающего выпуска.
  const state = JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'));
  state.inFlight = [];
  writeFileSync(path.join(fx.dataDir, 'autopilot.json'), JSON.stringify(state), 'utf8');
  writeFileSync(path.join(fx.dataDir, 'orders.json'), JSON.stringify({ date: '2026-09-13', orders: [] }), 'utf8');

  const env = {
    ...process.env,
    AUTOPILOT_CONFIG: fx.configFile,
    AUTOPILOT_DATA_DIR: fx.dataDir,
    AUTOPILOT_LOCK_FILE: path.join(fx.dataDir, '.autopilot.lock'),
    CONTENT_ROOT: fx.root,
    AUTOPILOT_BUILD: '1',
  };

  // Падение сборки: приёмка останавливается, статью не трогает.
  writeFileSync(path.join(fx.root, 'package.json'), JSON.stringify({ name: 'fake-site', scripts: { build: 'node -e "process.exit(1)"' } }), 'utf8');
  const failed = spawnSync(process.execPath, ['scripts/pipeline.mjs', 'settle', '--json'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.notEqual(failed.status, 0);
  const out = JSON.parse(failed.stdout);
  assert.match(out.error, /build принимающего сайта не прошёл/);
  assert.match(readFileSync(path.join(fx.root, 'src', 'content', 'blog', `${heldSlug}.md`), 'utf8'), /draft: true/);
  assert.equal(existsSync(path.join(fx.dataDir, `report-${new Date().toISOString().slice(0, 10)}.json`)), false);
  assert.equal(existsSync(path.join(fx.dataDir, 'runs')), false, 'манифест не должен получить gated');

  // Успешная сборка: ожидающая статья выпускается.
  writeFileSync(path.join(fx.root, 'package.json'), JSON.stringify({ name: 'fake-site', scripts: { build: 'node -e "process.exit(0)"' } }), 'utf8');
  const ok = spawnSync(process.execPath, ['scripts/pipeline.mjs', 'settle', '--json'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.notEqual(ok.status, 1, ok.stderr);
  const report = JSON.parse(ok.stdout);
  assert.equal(report.published, 1);
  const after = readFileSync(path.join(fx.root, 'src', 'content', 'blog', `${heldSlug}.md`), 'utf8');
  assert.match(after, /draft: false/);
  assert.ok(!/autopilotHold/.test(after));
});

test('AP-P1-19: занятый lock останавливает settle категорией infra и без изменений', () => {
  const fx = fixture();
  const stateBefore = readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8');
  writeFileSync(
    path.join(fx.dataDir, '.autopilot.lock'),
    JSON.stringify({ pid: process.pid, runId: 'live', cmd: 'plan', startedAt: new Date().toISOString() }),
    'utf8',
  );
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
  assert.equal(proc.status, 4, proc.stderr);
  const out = JSON.parse(proc.stdout);
  assert.equal(out.ok, false);
  assert.equal(out.category, 'infra');
  assert.match(out.error, /уже работает/);
  // Состояние не тронуто, отчёт не создан.
  assert.equal(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'), stateBefore);
  assert.equal(existsSync(path.join(fx.dataDir, 'report-' + new Date().toISOString().slice(0, 10) + '.json')), false);
});
