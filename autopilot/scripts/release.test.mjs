import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
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

function validWaitingArticle(title) {
  const description = 'Проверенное описание ожидающей статьи для проверки повторной приёмки и ограниченной суточной квоты публикаций сайта.';
  const body = ['Первый', 'Второй', 'Третий'].map(h => `## ${h} раздел\n\n` + ('Нейтральный материал описывает рабочие действия команды и порядок подготовки технической документации. '.split(' ').map(w => w + title).join(' ') + ' ').repeat(17)).join('\n');
  return `---\ntitle: "${title}"\ndescription: "${description}"\npubDate: "2026-01-01"\ndraft: true\nautopilotHold: true\n---\n${body}\n[Первый](/blog/ref-one/) [Второй](/blog/ref-two/) [Третий](/blog/ref-three/)\n`;
}
function addReferenceArticles(blog) {
  for (const slug of ['ref-one', 'ref-two', 'ref-three']) writeFileSync(path.join(blog, `${slug}.md`), `---\ntitle: ${slug}\ndraft: false\n---\nСоседний материал ${slug}`);
}

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
  addReferenceArticles(blog);
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
  for (const item of waiting) writeFileSync(path.join(blog, `${item.slug}.md`), validWaitingArticle(item.slug), 'utf8');

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

test('PUB-04: изменение принятой статьи требует повторной проверки перед выпуском', () => {
  const fx = fixture();
  writeFileSync(path.join(fx.blog, 'w1.md'), heldArticle('Повреждённая статья'));
  const report = settle(fx);
  assert.equal(report.published, 1);
  assert.ok(report.results.some(r => r.slug === 'w1' && r.status === 'release_rejected'));
  assert.match(readFileSync(path.join(fx.blog, 'w1.md'), 'utf8'), /draft: true/);
  const queue = JSON.parse(readFileSync(path.join(fx.dataDir, 'release-queue.json')));
  assert.ok(!queue.items.some(i => i.slug === 'w1'));
  const state = JSON.parse(readFileSync(path.join(fx.dataDir, 'autopilot.json')));
  assert.ok(state.inFlight.some(i=>i.slug==='w1' && i.acceptedRepair && i.failures===1));
  const log = JSON.parse(readFileSync(path.join(fx.dataDir, 'publish-log.json')));
  assert.ok(!log.days[fx.day].includes('w1'));
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

import { releaseCalendar } from './lib/release.mjs';

for (const [year, month, days] of [[2026, 1, 28], [2028, 1, 29], [2026, 3, 30], [2026, 0, 31]]) {
  test(`calendar: ${days} days releases exactly 55 new + 14 rewrites, repeat runs do not exceed quota`, () => {
    const config = { throughput: { monthlyTarget: 55, monthlyRewriteTarget: 14 } };
    const publishLog = { days: {}, kinds: {} };
    let waiting = [...Array.from({ length: 80 }, (_, i) => ({ slug: `new-${i}`, kind: 'new' })), ...Array.from({ length: 30 }, (_, i) => ({ slug: `rewrite-${i}`, kind: 'rewrite' }))];
    for (let d = 1; d <= days; d++) {
      const date = new Date(Date.UTC(year, month, d)); const day = date.toISOString().slice(0, 10);
      publishLog.days[day] = []; publishLog.kinds[day] = {};
      for (let pass = 0; pass < 4; pass++) {
        const calendar = releaseCalendar({ date, config, publishLog });
        const result = allocateReleases({ waiting, maxPerDay: 3, alreadyToday: publishLog.days[day].length, calendar });
        for (const item of result.release) { publishLog.days[day].push(item.slug); publishLog.kinds[day][item.slug] = item.kind; }
        waiting = result.wait;
      }
      assert.ok(publishLog.days[day].length <= 3);
    }
    const end = releaseCalendar({ date: new Date(Date.UTC(year, month, days)), config, publishLog });
    assert.equal(end.byKind.new.done, 55); assert.equal(end.byKind.rewrite.done, 14);
    assert.equal(end.byKind.new.remaining, 0); assert.equal(end.byKind.rewrite.remaining, 0);
  });
}

test('calendar carries debt with daily ceiling; previous month does not consume current norm', () => {
  const config = { throughput: { monthlyTarget: 55, monthlyRewriteTarget: 14 } };
  const date = new Date('2026-10-20T23:00:00Z');
  const calendar = releaseCalendar({ date, config, publishLog: { days: { '2026-09-30': ['old'] } } });
  const { release } = allocateReleases({ accepted: Array.from({ length: 50 }, (_, i) => ({ slug: `n-${i}`, kind: 'new' })), maxPerDay: 3, calendar });
  assert.equal(release.length, 3);
  assert.equal(calendar.byKind.new.done, 0);
});

test('calendar counts legacy entries as new and rejects corrupt ledger', () => {
  const config = { throughput: { monthlyTarget: 55, monthlyRewriteTarget: 14 } };
  const date = new Date('2026-10-03T00:00:00Z');
  const result = releaseCalendar({ date, config, publishLog: { days: { '2026-10-01': ['legacy'] } } });
  assert.equal(result.byKind.new.done, 1);
  assert.throws(() => releaseCalendar({ date, config, publishLog: { days: { '2026-10-04': ['future'] } } }), /Повреждён/);
});

import { preservePublishedRewrite, stageQueuedRewrite } from './lib/queued-rewrite.mjs';
test('queued rewrite keeps published URL through full quota, then promotes once after rechecking gates', () => {
  const fx = fixture();
  const slug = 'rewrite-safe';
  const oldFile = path.join(fx.blog, slug + '.md');
  const original = '---\ntitle: "Старая опубликованная версия"\ndraft: false\n---\nСтабильная опубликованная страница.';
  writeFileSync(oldFile, original);
  preservePublishedRewrite({ ...fx, slug });
  writeFileSync(oldFile, validWaitingArticle('rewrite-safe'));
  const stagedFile = stageQueuedRewrite({ ...fx, slug, file: oldFile });
  const queuePath = path.join(fx.dataDir, 'release-queue.json');
  writeFileSync(queuePath, JSON.stringify({ items: [{ slug, kind: 'rewrite', acceptedAt: '2026-09-01T00:00:00Z', score: 100, stagedFile }] }));
  const logPath = path.join(fx.dataDir, 'publish-log.json');
  writeFileSync(logPath, JSON.stringify({ days: { [fx.day]: ['x1', 'x2', 'x3'] } }));
  assert.equal(settle(fx).published, 0);
  assert.equal(readFileSync(oldFile, 'utf8'), original);
  assert.equal(JSON.parse(readFileSync(queuePath)).items[0].stagedFile, stagedFile);
  writeFileSync(logPath, JSON.stringify({ days: { [fx.day]: ['x1', 'x2'] } }));
  assert.equal(settle(fx).published, 1);
  assert.match(readFileSync(oldFile, 'utf8'), /draft: false/);
  assert.match(readFileSync(oldFile, 'utf8'), /rewrite-safe/);
  assert.equal(existsSync(path.join(fx.dataDir, stagedFile)), false);
  assert.equal(settle(fx).published, 0);
  assert.equal(JSON.parse(readFileSync(logPath)).days[fx.day].filter(s => s === slug).length, 1);
});

test('gated delivered draft-only run obtains real build evidence before Git recovery; failure preserves queued bytes', () => {
 const fx=fixture();
 const runId='2026-10-04-abcdef01';
 const config=JSON.parse(readFileSync(fx.configFile));config.security={buildCheck:true};writeFileSync(fx.configFile,JSON.stringify(config));
 mkdirSync(path.join(fx.dataDir,'runs'));
 const runFile=path.join(fx.dataDir,'runs',runId+'.json');
 writeFileSync(runFile,JSON.stringify({runId,stages:{planned:{},written:{delivered:3},gated:{published:0}},history:[]}));
 writeFileSync(path.join(fx.dataDir,'orders.json'),JSON.stringify({runId,date:fx.day,orders:[]}));
 writeFileSync(path.join(fx.dataDir,'publish-log.json'),JSON.stringify({days:{[fx.day]:['x1','x2','x3']}}));
 writeFileSync(path.join(fx.root,'package.json'),JSON.stringify({scripts:{build:'node -e "process.exit(1)"'}}));
 const before=readFileSync(path.join(fx.blog,'w1.md'),'utf8');
 const failed=settle(fx);assert.equal(failed.ok,false);assert.match(failed.error,/build принимающего сайта не прошёл/);
 assert.equal(readFileSync(path.join(fx.blog,'w1.md'),'utf8'),before);
 assert.equal(JSON.parse(readFileSync(runFile)).stages.built,undefined);
 writeFileSync(path.join(fx.root,'package.json'),JSON.stringify({scripts:{build:'node -e "process.exit(0)"'}}));
 const result=settle(fx);
 assert.equal(result.published,0);assert.equal(result.acceptedWaiting,5);
 assert.equal(result.build.checked,true);assert.equal(result.build.ok,true);
 const manifest=JSON.parse(readFileSync(runFile));assert.equal(manifest.stages.built.corpusSha256,result.build.corpusSha256);
 const repeated=settle(fx);assert.equal(repeated.build.checked,false);
});

import { publicationCapacity } from './lib/release.mjs';
test('publication capacity uses published kinds and consumed daily slots, not accepted counters', () => {
  const config = {throughput:{monthlyTarget:55,monthlyRewriteTarget:14},publish:{maxPerDay:3}};
  const slugs = Array.from({length:63}, (_,i)=>`s${i}`);
  const days = {'2026-10-30':slugs.slice(0,60),'2026-10-31':slugs.slice(60)};
  const kinds = Object.fromEntries(Object.entries(days).map(([day,ss])=>[day,Object.fromEntries(ss.map(s=>[s,Number(s.slice(1))<50?'new':'rewrite']))]));
  const result=publicationCapacity({date:new Date('2026-10-31T12:00:00Z'),config,publishLog:{days,kinds}});
  assert.equal(result.slotsRemaining,0);assert.equal(result.needed,6);assert.equal(result.impossible,true);
  assert.deepEqual(result.byKind.new,{target:55,published:50,remaining:5});
  const before=publicationCapacity({date:new Date('2026-10-04T12:00:00Z'),config,publishLog:{days:{}}});
  assert.equal(before.impossible,false);assert.equal(before.slotsRemaining,84);
});

import { publicationFailureStreak } from './lib/release.mjs';
test('publication stop counts distinct completed passes; recovery and month boundary reset it', () => {
 const run=(id,date,bad,committed=true)=>({runId:id,date,createdAt:date,stages:{gated:{at:date,publicationCapacity:{impossible:bad}},...(committed?{committed:{}}:{})}});
 const a=run('a','2026-10-20',true),b=run('b','2026-10-21',true),c=run('c','2026-10-22',true);
 assert.equal(publicationFailureStreak([a,b,c,c,run('pending','2026-10-23',true,false)],'2026-10-23'),3);
 assert.equal(publicationFailureStreak([a,b,c,run('recovered','2026-10-23',false)],'2026-10-23'),0);
 assert.equal(publicationFailureStreak([a,b,c],'2026-11-01'),0);
 assert.equal(publicationFailureStreak([a,b,c,run('legacy','2026-10-24',undefined)],'2026-10-24'),0);
});

test('accepted factual correction goes first and skips the rewrite calendar, daily limit stays binding',()=>{
 const waiting=[{slug:'older',kind:'rewrite',acceptedAt:'2026-10-01'},{slug:'new',kind:'new',acceptedAt:'2026-10-01'}];
 const accepted=[{slug:'correction',kind:'rewrite',factualCorrection:true,acceptedAt:'2026-10-04'}];
 let result=allocateReleases({waiting,accepted,alreadyToday:0,maxPerDay:1,calendar:{byKind:{new:{remaining:1},rewrite:{remaining:1}}}});
 assert.deepEqual(result.release.map(i=>i.slug),['correction']);
 result=allocateReleases({waiting,accepted,alreadyToday:0,maxPerDay:1,calendar:{byKind:{new:{remaining:1},rewrite:{remaining:0}}}});
 assert.deepEqual(result.release.map(i=>i.slug),['correction']);assert.ok(result.wait.some(i=>i.slug==='new'));
 result=allocateReleases({waiting,accepted,alreadyToday:1,maxPerDay:1,calendar:{byKind:{new:{remaining:1},rewrite:{remaining:0}}}});assert.equal(result.release.length,0);
 result=allocateReleases({waiting,accepted,alreadyToday:1,maxPerDay:1});assert.equal(result.release.length,0);
});

test('factual corrections spend the rewrite calendar so planned rewrites cannot overtake it',()=>{
 const corrections=['c1','c2','c3','c4'].map((slug,i)=>({slug,kind:'rewrite',factualCorrection:true,acceptedAt:`2026-10-0${i+1}`}));
 const waiting=[...corrections,{slug:'planned',kind:'rewrite',acceptedAt:'2026-09-01'},{slug:'n1',kind:'new',acceptedAt:'2026-09-01'}];
 let result=allocateReleases({waiting,maxPerDay:3,calendar:{byKind:{new:{remaining:5},rewrite:{remaining:1}}}});
 assert.deepEqual(result.release.map(i=>i.slug),['c1','c2','c3']);
 assert.deepEqual(result.wait.map(i=>i.slug),['c4','n1','planned']);
 result=allocateReleases({waiting:[{slug:'c4',kind:'rewrite',factualCorrection:true,acceptedAt:'2026-10-04'},{slug:'planned',kind:'rewrite',acceptedAt:'2026-09-01'},{slug:'n1',kind:'new',acceptedAt:'2026-09-01'}],maxPerDay:3,calendar:{byKind:{new:{remaining:5},rewrite:{remaining:1}}}});
 assert.deepEqual(result.release.map(i=>i.slug),['c4','n1']);assert.deepEqual(result.wait.map(i=>i.slug),['planned']);
 const unconfirmed=allocateReleases({waiting:[{slug:'r',kind:'rewrite',acceptedAt:'2026-10-01'},{slug:'n',kind:'new',acceptedAt:'2026-10-02'}],maxPerDay:3,calendar:{byKind:{new:{remaining:1},rewrite:{remaining:0}}}});
 assert.deepEqual(unconfirmed.release.map(i=>i.slug),['n']);assert.deepEqual(unconfirmed.wait.map(i=>i.slug),['r']);
});

test('missing accepted file stays held in release queue instead of silently disappearing',()=>{
 const fx=fixture();unlinkSync(path.join(fx.blog,'w1.md'));const report=settle(fx);
 assert.ok(report.results.some(r=>r.slug==='w1'&&r.status==='release_missing'));
 assert.ok(JSON.parse(readFileSync(path.join(fx.dataDir,'release-queue.json'))).items.some(i=>i.slug==='w1'));
 assert.ok(!JSON.parse(readFileSync(path.join(fx.dataDir,'publish-log.json'))).days[fx.day].includes('w1'));
});
