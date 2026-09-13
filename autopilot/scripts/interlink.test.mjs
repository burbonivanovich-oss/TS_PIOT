import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const article = (title, body) =>
  `---\ntitle: "${title}"\ndescription: "${'о'.repeat(120)}"\npubDate: "2026-01-01"\ndraft: false\n---\n\n${body}\n`;

/** Полный валидный конфиг с переопределениями interlink. */
function configFor(root, interlink = {}) {
  return {
    contentRoot: root,
    paths: { blog: 'src/content/blog', pillars: 'src/content/pillars', glossary: 'src/content/glossary', wiki: 'src/content/wiki' },
    throughput: { monthlyTarget: 200, batchesPerDay: 2, maxBatchSize: 6, maxParallelWriting: 8, catchUpFactor: 1.35 },
    mix: { new: 0.75, rewrite: 0.25 },
    dedupe: { canonicalExact: true, containmentBlock: 0.72, containmentWarn: 0.5, titleJaccardBlock: 0.62, titleJaccardWarn: 0.45, bodyShingleBlock: 0.3, shingleSize: 5, keywordOverlapBlock: 0.7 },
    rewrite: { staleAfterDays: 180, hardStaleAfterDays: 365, minDaysBetweenRewrites: 90, npaTriggerBoost: 40, thinContentChars: 4500 },
    interlink: {
      minOutbound: 3, maxOutbound: 8, minInbound: 2, maxInboundPerRun: 4, maxLinksPerParagraph: 1,
      anchorMinLength: 8, reciprocalPenalty: true, protectedZones: ['frontmatter', 'code', 'heading', 'existingLink'],
      // Пороги обнулены, чтобы fixture не зависел от размеров корпуса.
      minAnchorIdf: 0, rareAnchorIdf: 0, minRelevance: 0,
      ...interlink,
    },
    gates: { minScore: 70, maxAiMarkerDensity: 0.6, requireFactcheck: true, minChars: 4000, maxChars: 22000, quarantineAfterFailures: 2 },
    publish: { autoPublish: true, draftOnFail: true, maxPerDay: 12 },
    backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2 },
  };
}

/** Многострочный fixture: target-сирота получает одну входящую ссылку. */
function buildFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'interlink-fx-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });

  // Целевая статья: одна входящая есть, до нормы minInbound=2 не хватает.
  writeFileSync(
    path.join(blog, 'target-marka.md'),
    article('Маркировка поэкземплярного учёта', 'Короткое тело целевой статьи.'),
  );
  // Источник, уже ссылающийся на target.
  writeFileSync(
    path.join(blog, 'existing-source.md'),
    article('Источник с готовой ссылкой', 'Уже есть [ссылка](/blog/target-marka/) на материал о маркировке.'),
  );
  // Новый источник: длинная строка с точной фразой-якорем цели.
  const phrase = 'Маркировка поэкземплярного учёта требует внимания при подготовке документов и оборудования.';
  writeFileSync(path.join(blog, 'new-source.md'), article('Новый источник без ссылок', phrase));

  const dataDir = path.join(root, 'data');
  const configFile = path.join(root, 'autopilot.config.json');
  writeFileSync(configFile, JSON.stringify(configFor(root), null, 2));
  return { root, blog, dataDir, configFile };
}

/** Fixture с одной длинной строкой, где стоят якоря двух разных целей. */
function buildTwoTargetsFixture({ maxLinksPerParagraph = 1, protectedZones, body, interlink = {}, extraSources = [] } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'interlink-cap-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  writeFileSync(path.join(blog, 'target-a.md'), article('Поэкземплярный учёт воды', 'Коротко.'));
  writeFileSync(path.join(blog, 'target-b.md'), article('Маркировка молочной продукции', 'Коротко.'));
  writeFileSync(
    path.join(blog, 'source.md'),
    article(
      'Источник',
      body ||
        'Требуется поэкземплярный учёт воды и маркировка молочной продукции при подготовке документов и оборудования.',
    ),
  );
  extraSources.forEach((text, i) => {
    writeFileSync(path.join(blog, `source-${i}.md`), article(`Источник ${i}`, text));
  });
  const dataDir = path.join(root, 'data');
  const configFile = path.join(root, 'autopilot.config.json');
  const overrides = { maxLinksPerParagraph, ...interlink };
  if (protectedZones) overrides.protectedZones = protectedZones;
  writeFileSync(configFile, JSON.stringify(configFor(root, overrides), null, 2));
  return { root, blog, dataDir, configFile };
}

function runApply(fixture, extraArgs = []) {
  const proc = spawnSync(process.execPath, ['scripts/interlink.mjs', 'apply', ...extraArgs], {
    cwd: ROOT,
    env: {
      ...process.env,
      AUTOPILOT_CONFIG: fixture.configFile,
      AUTOPILOT_DATA_DIR: fixture.dataDir,
      AUTOPILOT_LOCK_FILE: path.join(fixture.dataDir, '.autopilot.lock'),
    },
    encoding: 'utf8',
  });
  assert.equal(proc.status, 0, proc.stderr);
  return proc;
}

test('AP-P1-06: apply пересчитывает граф и показывает уменьшение сирот', () => {
  const fixture = buildFixture();
  const targetBefore = readFileSync(path.join(fixture.blog, 'target-marka.md'), 'utf8');
  const proc = runApply(fixture);
  const report = JSON.parse(readFileSync(path.join(fixture.dataDir, 'interlink-report.json'), 'utf8'));
  assert.equal(report.orphansBefore, 3, 'на старте сироты все три статьи');
  assert.equal(report.orphansAfter, 2, 'одна вставка выводит целевую статью из сирот');
  assert.ok(report.orphansAfter < report.orphansBefore);
  assert.equal(report.inserted, 1);
  // Целевая статья — только приёмник ссылки, её собственное тело не меняется.
  assert.equal(readFileSync(path.join(fixture.blog, 'target-marka.md'), 'utf8'), targetBefore);
  const newSource = readFileSync(path.join(fixture.blog, 'new-source.md'), 'utf8');
  assert.equal((newSource.match(/\]\(\/blog\/target-marka\/\)/g) || []).length, 1);
  assert.match(proc.stdout, /Сирот было 3, стало 2/);
});

test('AP-P1-06: dry-run показывает оценку after, не меняя файлы', () => {
  const fixture = buildFixture();
  const before = readFileSync(path.join(fixture.blog, 'new-source.md'), 'utf8');
  const proc = runApply(fixture, ['--dry', '--json']);
  const result = JSON.parse(proc.stdout);
  assert.equal(result.orphansBefore, 3);
  assert.equal(result.orphansAfter, 2);
  // dry-run ничего не пишет: ни тело статьи, ни файл отчёта.
  assert.equal(existsSync(path.join(fixture.dataDir, 'interlink-report.json')), false);
  assert.equal(readFileSync(path.join(fixture.blog, 'new-source.md'), 'utf8'), before);
});

test('AP-P1-05: maxLinksPerParagraph управляет числом ссылок на абзац', () => {
  const one = buildTwoTargetsFixture({ maxLinksPerParagraph: 1 });
  runApply(one);
  const oneLinks = (readFileSync(path.join(one.blog, 'source.md'), 'utf8').match(/\]\(\/blog\//g) || []).length;
  assert.equal(oneLinks, 1, 'при лимите 1 в строку вставляется одна ссылка');

  const two = buildTwoTargetsFixture({ maxLinksPerParagraph: 2 });
  runApply(two);
  const twoLinks = (readFileSync(path.join(two.blog, 'source.md'), 'utf8').match(/\]\(\/blog\//g) || []).length;
  assert.equal(twoLinks, 2, 'при лимите 2 вставляются обе ссылки');
});

test('AP-P1-05: protectedZones управляет защитой заголовков', () => {
  const heading = 'Маркировка молочной продукции и поэкземплярный учёт воды в документах предприятия';
  const protectedHeading = buildTwoTargetsFixture({
    protectedZones: ['frontmatter', 'code', 'heading', 'existingLink'],
    body: `## ${heading}\n\nКоротко.`,
  });
  runApply(protectedHeading);
  assert.equal((readFileSync(path.join(protectedHeading.blog, 'source.md'), 'utf8').match(/\]\(\/blog\//g) || []).length, 0);

  const unprotected = buildTwoTargetsFixture({ protectedZones: ['frontmatter', 'code', 'existingLink'], body: `## ${heading}\n\nКоротко.` });
  runApply(unprotected);
  assert.equal((readFileSync(path.join(unprotected.blog, 'source.md'), 'utf8').match(/\]\(\/blog\//g) || []).length >= 1, true);
});

test('AP-P1-05: anchorMinIdf/rareAnchorIdf отсеивают якоря', () => {
  const high = buildTwoTargetsFixture({ interlink: { minAnchorIdf: 999, rareAnchorIdf: 999 } });
  runApply(high);
  assert.equal(
    (readFileSync(path.join(high.blog, 'source.md'), 'utf8').match(/\]\(\/blog\//g) || []).length,
    0,
    'при недостижимом IDF якорь не проходит',
  );

  const low = buildTwoTargetsFixture({ interlink: { minAnchorIdf: 0, rareAnchorIdf: 0 } });
  runApply(low);
  assert.ok((readFileSync(path.join(low.blog, 'source.md'), 'utf8').match(/\]\(\/blog\//g) || []).length >= 1);
});

test('AP-P1-05: maxInboundPerRun ограничивает входящие на статью за проход', () => {
  const phrase = 'Требуется поэкземплярный учёт воды при подготовке документов и оборудования для склада.';
  const capped = buildTwoTargetsFixture({
    interlink: { maxInboundPerRun: 1, anchorMinLength: 20 },
    body: phrase,
    extraSources: [phrase],
  });
  runApply(capped);
  const total = ['source.md', 'source-0.md']
    .map((f) => (readFileSync(path.join(capped.blog, f), 'utf8').match(/\]\(\/blog\//g) || []).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(total, 1, 'за проход на цель допускается одна новая входящая');

  const roomy = buildTwoTargetsFixture({
    interlink: { maxInboundPerRun: 4, anchorMinLength: 20 },
    body: phrase,
    extraSources: [phrase],
  });
  runApply(roomy);
  const totalRoomy = ['source.md', 'source-0.md']
    .map((f) => (readFileSync(path.join(roomy.blog, f), 'utf8').match(/\]\(\/blog\//g) || []).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(totalRoomy, 2, 'при лимите 4 обе статьи могут дать входящую');
});

test('AP-P1-08: цитаты, списки, инлайн-код и JSX не редактируются', () => {
  const body = [
    '> Цитата: поэкземплярный учёт воды важен при оформлении документов на предприятии.',
    '- Пункт: поэкземплярный учёт воды важен при оформлении документов на предприятии.',
    '`код: поэкземплярный учёт воды важен при оформлении документов на предприятии`',
    '{выражение: поэкземплярный учёт воды при оформлении документов}',
    '<Callout>поэкземплярный учёт воды важен при оформлении документов на предприятии</Callout>',
    'Обычный абзац: требуется поэкземплярный учёт воды при подготовке документов и оборудования.',
  ].join('\n');
  const fixture = buildTwoTargetsFixture({ maxLinksPerParagraph: 8, body });
  runApply(fixture);
  const text = readFileSync(path.join(fixture.blog, 'source.md'), 'utf8');
  const lines = text.split('\n');
  const normal = lines.find((l) => l.startsWith('Обычный абзац'));
  assert.match(normal, /\]\(\/blog\//, 'ссылка должна встать в обычный абзац');
  for (const prefix of ['>', '- ', '`', '{', '<']) {
    const line = lines.find((l) => l.trim().startsWith(prefix));
    assert.ok(line && !line.includes('/blog/'), `не должен редактироваться: ${prefix}`);
  }
});
