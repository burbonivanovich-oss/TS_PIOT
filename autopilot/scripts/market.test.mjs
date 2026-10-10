import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAccepted } from './market.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'market-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  writeFileSync(path.join(blog, 'existing.md'), '---\ntitle: "Договор ГПХ с физическим лицом: как оформить"\ndescription: "d"\npubDate: "2026-01-01"\ntags: ["гпх", "кадры"]\ndraft: false\n---\n\nТело.\n');
  mkdirSync(path.join(root, '.agents', 'skills', 'auto-market'), { recursive: true });
  writeFileSync(path.join(root, '.agents', 'skills', 'auto-market', 'SKILL.md'), '# test skill\n');
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, 'backlog.json'), JSON.stringify({ topics: [] }));
  writeFileSync(path.join(dataDir, 'seeds.json'), JSON.stringify({ intents: [], segments: [], extraEntities: ['АУСН', 'ЭДО'], calendar: [], topicSeeds: [{ title: 'Идентификатор ЭДО: где найти и как передать', entity: 'эдо', keywords: ['идентификатор эдо'], format: 'howto' }] }));
  const now = new Date().toISOString();
  writeFileSync(path.join(dataDir, 'demand.json'), JSON.stringify({ schemaVersion: 1, snapshots: [{
    source: 'Yandex Cloud Wordstat GetTop', endpoint: 'https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests',
    url: 'https://wordstat.yandex.ru/?region=225&view=table&words=%D0%B0%D1%83%D1%81%D0%BD', region: '225', devices: 'all', match: 'broad',
    window: { kind: 'provider_last_30_days', exactDatesVerified: false }, periodStart: null, periodEnd: null, capturedAt: now,
    rows: [{ phrase: 'аусн доходы', count: 26737 }, { phrase: 'аусн налог', count: 25754 }, { phrase: 'договор гпх с физическим лицом', count: 26318 }, { phrase: 'промокод аусн', count: 9000 }],
  }] }));
  const config = {
    contentRoot: root,
    paths: { blog: 'src/content/blog', pillars: 'src/content/pillars', glossary: 'src/content/glossary', wiki: 'src/content/wiki' },
    throughput: { monthlyTarget: 55, batchesPerDay: 1, maxBatchSize: 3, maxParallelWriting: 4, catchUpFactor: 1.35 },
    mix: { new: 0.75, rewrite: 0.25 },
    dedupe: { canonicalExact: true, containmentBlock: 0.72, containmentWarn: 0.5, titleJaccardBlock: 0.62, titleJaccardWarn: 0.45, bodyShingleBlock: 0.3, shingleSize: 5, keywordOverlapBlock: 0.7 },
    rewrite: { staleAfterDays: 180, hardStaleAfterDays: 365, minDaysBetweenRewrites: 90, npaTriggerBoost: 40, thinContentChars: 4500 },
    interlink: { minOutbound: 3, maxOutbound: 8, minInbound: 2, maxInboundPerRun: 4, maxLinksPerParagraph: 1, anchorMinLength: 8, reciprocalPenalty: true, protectedZones: ['frontmatter'], minAnchorIdf: 3.2, rareAnchorIdf: 3.0, minRelevance: 0.35 },
    gates: { minScore: 70, maxAiMarkerDensity: 0.6, requireFactcheck: true, minChars: 4000, maxChars: 22000, quarantineAfterFailures: 2, infraRetryLimit: 3 },
    publish: { autoPublish: true, draftOnFail: true, maxPerDay: 3 },
    backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2, demandMaxBoost: 30, demandMaxAgeDays: 30, demandRegion: 225 },
  };
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(config));
  const env = { ...process.env, AUTOPILOT_CONFIG: configFile, AUTOPILOT_DATA_DIR: dataDir, AUTOPILOT_LOCK_FILE: path.join(dataDir, '.lock'), CONTENT_ROOT: root };
  return { root, dataDir, env };
}

const runModule = (fx, code) => {
  const proc = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8', env: fx.env });
  assert.equal(proc.status, 0, proc.stderr);
  return JSON.parse(proc.stdout);
};

const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

test('бриф: только непокрытый свежий спрос без навигационного шума', () => {
  const fx = fixture();
  const brief = runModule(fx, "import { buildBrief } from './scripts/market.mjs'; console.log(JSON.stringify(buildBrief().brief))");
  const phrases = brief.uncovered.map((r) => r.phrase);
  assert.ok(phrases.includes('аусн доходы'));
  assert.ok(!phrases.includes('промокод аусн'), 'навигационный запрос отсеян');
  assert.ok(!phrases.includes('договор гпх с физическим лицом'), 'закрытое статьёй не попадает в бриф');
});

test('модель предлагает, код принимает: спрос, дубли, лимиты и первоисточник', async () => {
  const fx = fixture();
  const proposals = {
    summary: 'тест',
    topics: [
      { title: 'АУСН: какие доходы учитываются и как считается налог', entity: 'аусн', keywords: ['аусн доходы', 'аусн налог'], format: 'howto', reason: 'спрос' },
      { title: 'АУСН для ИП: кому подходит режим в Москве', entity: 'аусн', keywords: ['аусн для ип москва'], format: 'explainer', reason: 'угадан' },
      { title: 'Договор ГПХ с физическим лицом: как оформить', entity: 'гпх', keywords: ['договор гпх с физическим лицом'], format: 'howto', reason: 'дубль' },
      { title: 'Идентификатор ЭДО: где найти и как передать', entity: 'эдо', keywords: ['аусн налог'], format: 'howto', reason: 'повтор seeds' },
      { title: 'Коротко', entity: 'аусн', keywords: ['аусн налог'], format: 'howto', reason: 'короткий' },
    ],
    calendar: [
      { date: future(60), entity: 'АУСН', event: 'вступают в силу изменения порядка расчёта', source: 'https://www.consultant.ru/document/cons_doc_LAW_1/' },
      { date: future(30), entity: 'ЭДО', event: 'новые правила обмена документами для всех', source: 'https://example.com/news' },
      { date: future(-5), entity: 'ЭДО', event: 'уже прошедшее изменение правил обмена', source: 'https://www.garant.ru/news/1/' },
    ],
  };
  writeFileSync(path.join(fx.root, 'proposals.json'), JSON.stringify(proposals));
  const report = runModule(fx, `import { runMarket } from './scripts/market.mjs'; import { readFileSync } from 'node:fs';
    const p = JSON.parse(readFileSync(${JSON.stringify(path.join(fx.root, 'proposals.json'))}, 'utf8'));
    console.log(JSON.stringify(await runMarket({ propose: async (prompt) => { if (!prompt.includes('аусн доходы')) throw new Error('бриф не дошёл до модели'); return p; } })))`);
  assert.deepEqual(report.accepted.topics.map((t) => t.title), ['АУСН: какие доходы учитываются и как считается налог']);
  const reasons = Object.fromEntries(report.rejected.map((r) => [r.item, r.reason]));
  assert.match(reasons['АУСН для ИП: кому подходит режим в Москве'], /без свежего спроса/);
  assert.match(reasons['Договор ГПХ с физическим лицом: как оформить'], /дубль/);
  assert.match(reasons['Идентификатор ЭДО: где найти и как передать'], /уже есть в seeds/);
  assert.match(reasons['Коротко'], /длина/);
  assert.equal(report.accepted.calendar.length, 1);
  assert.match(reasons['новые правила обмена документами для всех'], /первоисточник/);
  assert.match(reasons['уже прошедшее изменение правил обмена'], /вне ближайшего года/);
  const seeds = JSON.parse(readFileSync(path.join(fx.dataDir, 'seeds.json'), 'utf8'));
  assert.equal(seeds.topicSeeds.length, 2);
  assert.equal(seeds.topicSeeds[1].source, 'market');
  assert.equal(seeds.calendar[0].boost, 40);
  assert.ok(JSON.parse(readFileSync(path.join(fx.dataDir, 'market-latest.json'), 'utf8')).rejected.length >= 5);
});

test('сухой прогон ничего не записывает', () => {
  const fx = fixture();
  const before = readFileSync(path.join(fx.dataDir, 'seeds.json'), 'utf8');
  runModule(fx, "import { runMarket } from './scripts/market.mjs'; console.log(JSON.stringify(await runMarket({ dry: true, propose: async () => ({ summary: '', topics: [{ title: 'АУСН: какие доходы учитываются и как считается налог', entity: 'аусн', keywords: ['аусн доходы'], format: 'howto', reason: 'r' }], calendar: [] }) })))");
  assert.equal(readFileSync(path.join(fx.dataDir, 'seeds.json'), 'utf8'), before);
});

test('applyAccepted только дописывает и не меняет исходник', () => {
  const seeds = { topicSeeds: [{ title: 'a' }], calendar: [], intents: [1] };
  const next = applyAccepted(seeds, { topics: [{ title: 'b', entity: 'e', keywords: ['k'], format: 'howto' }], calendar: [{ date: '2027-01-01', entity: 'e', event: 'x', boost: 40, source: 'https://garant.ru/' }] }, '2026-10-12');
  assert.equal(seeds.topicSeeds.length, 1);
  assert.deepEqual(next.topicSeeds[1], { title: 'b', entity: 'e', keywords: ['k'], format: 'howto', source: 'market', addedAt: '2026-10-12' });
  assert.equal(next.calendar[0].addedAt, '2026-10-12');
  assert.deepEqual(next.intents, [1]);
});
