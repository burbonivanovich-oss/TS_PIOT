import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectDiverse } from './backlog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function refillFixture(extraEntities, intents = [{ id: 'what', template: 'Что такое {entity}', format: 'guide', weight: 1 }], mutateConfig = null) {
  const root = mkdtempSync(path.join(tmpdir(), 'refill-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  writeFileSync(
    path.join(blog, 'existing.md'),
    '---\ntitle: "Что такое маркировка тестового товара"\ndescription: "d"\npubDate: "2026-01-01"\ndraft: false\n---\n\nТело статьи.\n',
    'utf8',
  );
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, 'backlog.json'), JSON.stringify({ generatedAt: null, topics: [] }), 'utf8');
  writeFileSync(
    path.join(dataDir, 'seeds.json'),
    JSON.stringify({
      intents,
      segments: [{ id: 'all', label: '', weight: 1 }],
      extraEntities,
      calendar: [],
    }),
    'utf8',
  );
  const configFile = path.join(root, 'config.json');
  const config = baseConfig(root);
  if (mutateConfig) mutateConfig(config);
  writeFileSync(configFile, JSON.stringify(config), 'utf8');
  return { root, dataDir, configFile };
}

function runRefill(fx, target = 1) {
  const proc = spawnSync(process.execPath, ['scripts/backlog.mjs', 'refill', '--target', String(target), '--json'], {
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
  return JSON.parse(proc.stdout);
}

const topics = (spec) =>
  spec.flatMap(([entity, n]) =>
    Array.from({ length: n }, (_, i) => ({ slug: `${entity}-${i}`, entity })),
  );

test('батч не забивается одной сущностью', () => {
  // В первом реальном проходе четыре статьи из шести пришлись на один
  // кластер: квота бэклога ограничивает долю в запасе, а наряды берутся
  // с верха списка по приоритету.
  const planned = topics([['ГИС ЭПД', 10], ['маркировка воды', 5], ['ЕГАИС', 5]]);
  const picked = selectDiverse(planned, 6, 2);
  const perEntity = {};
  for (const t of picked) perEntity[t.entity] = (perEntity[t.entity] || 0) + 1;
  assert.equal(picked.length, 6);
  assert.ok(Math.max(...Object.values(perEntity)) <= 2, JSON.stringify(perEntity));
});

test('норма дня важнее разнообразия, когда других тем нет', () => {
  // Недобрать норму хуже, чем взять три темы одного кластера: отложенные
  // добираются, если альтернатив не осталось.
  const planned = topics([['ГИС ЭПД', 10]]);
  assert.equal(selectDiverse(planned, 5, 2).length, 5);
});

test('потолок не опускается ниже одной темы', () => {
  const planned = topics([['ГИС ЭПД', 3], ['ЕГАИС', 3]]);
  const picked = selectDiverse(planned, 4, 0);
  assert.equal(picked.length, 4);
});

test('AP-P2-08: пустой refill при непустой потребности объясняет исчерпание seeds', () => {
  // Кандидат совпадает с существующей статьёй → dedupe block → accepted=0.
  const fx = refillFixture(['маркировка тестового товара']);
  const result = runRefill(fx, 1);
  assert.equal(result.added.length, 0);
  assert.equal(result.exhausted, true);
  assert.ok(result.stats.candidates >= 1);
  assert.ok(result.stats.blocked >= 1);
  const entityRow = result.stats.byEntity['маркировка тестового товара'];
  assert.ok(entityRow, JSON.stringify(result.stats.byEntity));
  assert.equal(entityRow.blocked, 1);
  assert.ok(result.topBlocked.some((r) => r.entity === 'маркировка тестового товара'));
  assert.ok(Object.keys(result.stats.blockedAdvice).length >= 1);
});

test('AP-P2-08: новая сущность принимается, исчерпания нет', () => {
  const fx = refillFixture(['совершенно новая сущность']);
  const result = runRefill(fx, 1);
  assert.equal(result.added.length, 1);
  assert.equal(result.exhausted, false);
  assert.equal(result.stats.accepted, 1);
  assert.ok(result.stats.byEntity['совершенно новая сущность'].accepted === 1);
});

test('AP-P1-05: maxPerEntityShare ограничивает долю одной сущности', () => {
  // Пять намерений одной сущности: квота 6% от 10 → не больше двух тем.
  const intents = [
    { id: 'what', template: 'Что такое {entity}', format: 'guide', weight: 1 },
    { id: 'who', template: 'Кому нужен {entity}', format: 'guide', weight: 1 },
    { id: 'howto', template: 'Как подключить {entity}', format: 'guide', weight: 1 },
    { id: 'deadline', template: '{entity}: сроки', format: 'guide', weight: 1 },
    { id: 'fines', template: 'Штраф за {entity}', format: 'guide', weight: 1 },
  ];
  const fx = refillFixture(['популярная сущность'], intents, (config) => {
    // Отключаем dedupe-пороги, чтобы изолированно проверить именно квоту:
    // иначе в маленьком корпусе кандидаты блокируются как «похожие».
    config.dedupe.canonicalExact = false;
    config.dedupe.containmentBlock = 0.999;
    config.dedupe.containmentWarn = 0.998;
    config.dedupe.titleJaccardBlock = 0.999;
    config.dedupe.titleJaccardWarn = 0.998;
    config.dedupe.keywordOverlapBlock = 0.999;
  });
  const result = runRefill(fx, 10);
  assert.equal(result.stats.candidates, 5);
  assert.ok(result.stats.accepted <= 2, `принято ${result.stats.accepted}`);
  assert.ok(result.stats.capped >= 1, JSON.stringify({ stats: result.stats, topBlocked: result.topBlocked }));
  assert.equal(result.stats.byEntity['популярная сущность'].accepted, result.stats.accepted);
  assert.ok(result.stats.byEntity['популярная сущность'].capped >= 1);
});
