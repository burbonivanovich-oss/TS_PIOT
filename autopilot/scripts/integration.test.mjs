import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);

function baseConfig(contentRoot) {
  return {
    contentRoot,
    paths: { blog: 'src/content/blog', pillars: 'src/content/pillars', glossary: 'src/content/glossary', wiki: 'src/content/wiki' },
    throughput: { monthlyTarget: 200, batchesPerDay: 2, maxBatchSize: 6, maxParallelWriting: 8, catchUpFactor: 1.35 },
    mix: { new: 0.75, rewrite: 0.25 },
    dedupe: { canonicalExact: true, containmentBlock: 0.72, containmentWarn: 0.5, titleJaccardBlock: 0.62, titleJaccardWarn: 0.45, bodyShingleBlock: 0.3, shingleSize: 5, keywordOverlapBlock: 0.7 },
    rewrite: { staleAfterDays: 180, hardStaleAfterDays: 365, minDaysBetweenRewrites: 90, npaTriggerBoost: 40, thinContentChars: 4500 },
    interlink: { minOutbound: 3, maxOutbound: 8, minInbound: 2, maxInboundPerRun: 4, maxLinksPerParagraph: 1, anchorMinLength: 8, reciprocalPenalty: true, protectedZones: ['frontmatter'], minAnchorIdf: 3.2, rareAnchorIdf: 3.0, minRelevance: 0.35 },
    gates: { minScore: 70, maxAiMarkerDensity: 0.6, requireFactcheck: true, minChars: 4000, maxChars: 22000, quarantineAfterFailures: 2, infraRetryLimit: 3, sourceMaxAgeDays: 180 },
    publish: { autoPublish: true, draftOnFail: true, maxPerDay: 12 },
    backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2 },
  };
}

/** Тело, проходящее гейты: 3 H2, подтверждённые даты, внутренние ссылки. */
function goodBody({ links, salt, draft = true }) {
  const sections = ['Первый', 'Второй', 'Третий'].map(
    (h, i) =>
      `## ${h} раздел ${salt}\n\n` +
      `Норма вступает в силу с 01.0${i + 1}.2026 согласно [закону](https://publication.pravo.gov.ru/document/${salt}${i}). ` +
      `Смежные материалы: ${links.map((s) => `[${s}](/blog/${s}/)`).join(', ')}.\n\n` +
      `Наполнитель ${salt} для объёма и связности текста без штампов и правовых утверждений. `.repeat(20),
  );
  const body =
    `Вводный абзац ${salt} с осмысленным содержанием и достаточной длиной для проверок.\n\n` +
    `${sections.join('\n')}\n${`Ещё нейтральный наполнитель ${salt} для уникальности шинглов. `.repeat(40)}`;
  const description = `Описание статьи ${salt} на сто двадцать символов для прохождения проверки description без кликбейта и воды.`.slice(0, 150).padEnd(120, 'о');
  return `---\ntitle: "Статья ${salt}"\ndescription: "${description}"\npubDate: "${TODAY}"\ndraft: ${draft}\n---\n\n${body}`;
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'integration-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');

  // Три опубликованные статьи, полностью связанные между собой: не сироты,
  // не тонкие, не старые — в рерайт не попадают.
  const targets = ['target-odin', 'target-dva', 'target-tri'];
  for (const slug of targets) {
    const links = targets.filter((s) => s !== slug);
    writeFileSync(path.join(blog, `${slug}.md`), goodBody({ links, salt: slug, draft: false }), 'utf8');
  }

  writeFileSync(
    path.join(dataDir, 'seeds.json'),
    JSON.stringify({
      intents: [{ id: 'what', template: 'Что такое {entity}', format: 'guide', weight: 1 }],
      segments: [{ id: 'all', label: '', weight: 1 }],
      extraEntities: ['маркировка тестового товара'],
      calendar: [],
    }),
    'utf8',
  );
  writeFileSync(path.join(dataDir, 'backlog.json'), JSON.stringify({ generatedAt: null, topics: [] }), 'utf8');
  writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify({ date: TODAY, orders: [] }), 'utf8');
  writeFileSync(
    path.join(dataDir, 'autopilot.json'),
    JSON.stringify({
      version: 1, startedAt: TODAY, month: TODAY.slice(0, 7),
      counters: { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 },
      inFlight: [], quarantine: [], history: [], lastRunAt: null,
    }),
    'utf8',
  );
  return { root, blog, dataDir, configFile, targets };
}

function runCli(args, fx) {
  const proc = spawnSync(process.execPath, args, {
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
  return proc;
}

test('AP-P1-18: полный цикл plan → simulated write → settle → graph, повтор идемпотентен', () => {
  const fx = fixture();

  // 1. plan: детерминированно выдаёт наряд на новую статью.
  const planProc = runCli(['scripts/pipeline.mjs', 'plan', '--json'], fx);
  assert.notEqual(planProc.status, 1, planProc.stderr);
  const plan = JSON.parse(planProc.stdout);
  assert.ok(plan.orders.length >= 1, `ожидался хотя бы один наряд: ${planProc.stdout}`);
  const order = plan.orders.find((o) => o.kind === 'new');
  assert.ok(order, 'нужен новый наряд');
  const runId = plan.runId;

  // 2. simulated write: агент создаёт файл по наряду, проходящий гейты.
  writeFileSync(path.join(fx.blog, `${order.slug}.md`), goodBody({ links: fx.targets, salt: order.slug.slice(0, 12) }), 'utf8');

  // 3. settle: гейты, публикация, перелинковка, счётчики.
  const settleProc = runCli(['scripts/pipeline.mjs', 'settle', '--json'], fx);
  assert.notEqual(settleProc.status, 1, settleProc.stderr);
  const report = JSON.parse(settleProc.stdout);
  assert.equal(report.published, 1, JSON.stringify(report.results));
  assert.equal(report.runId, runId);
  assert.equal(report.runStage, 'set');

  const published = readFileSync(path.join(fx.blog, `${order.slug}.md`), 'utf8');
  assert.match(published, /draft: false/);
  assert.ok(!/autopilotHold/.test(published));

  const state = JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'));
  assert.equal(state.counters.new, 1);
  assert.equal(state.counters.published, 1);
  assert.equal(state.inFlight.length, 0);

  // Манифест дошёл до gated, отчёт приёмки лежит на диске.
  const manifest = JSON.parse(readFileSync(path.join(fx.dataDir, 'runs', `${runId}.json`), 'utf8'));
  assert.ok(manifest.stages.planned && manifest.stages.gated);
  assert.ok(readdirSync(fx.dataDir).some((f) => f === `report-${TODAY}.json`));

  // 4. повторный settle идемпотентен: ничего не публикует и не дублирует счётчик.
  const settleAgain = JSON.parse(runCli(['scripts/pipeline.mjs', 'settle', '--json'], fx).stdout);
  assert.equal(settleAgain.published, 0);
  assert.ok(settleAgain.skipped >= 1);
  const stateAgain = JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json'), 'utf8'));
  assert.equal(stateAgain.counters.new, 1);
  assert.equal(stateAgain.counters.published, 1);

  // 5. повторный plan в тот же день продолжает тот же проход и не плодит дубли:
  //    та же тема не выдаётся как новая статья повторно (рерайт-наряд для
  //    только что опубликованной сироты — законный, это не дубль статьи).
  const planAgain = JSON.parse(runCli(['scripts/pipeline.mjs', 'plan', '--json'], fx).stdout);
  assert.equal(planAgain.runId, runId, 'тот же runId незавершённого дня');
  assert.ok(!planAgain.orders.some((o) => o.kind === 'new' && o.slug === order.slug), 'новая статья не выдаётся повторно');
  assert.ok(!planAgain.skipped.some((o) => o.slug === order.slug && o.kind === 'new'));
});
