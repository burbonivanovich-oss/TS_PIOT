import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('AP-P1-10: merge-пара объяснима: keep/rewrite, gate, inbound, угол, remediation', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'dedupe-explain-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  const filler = 'Маркировка тестового товара требует внимания при оформлении документов и подготовке оборудования. ';
  const article = (title, repeats) =>
    `---\ntitle: "${title}"\ndescription: "d"\npubDate: "2026-01-01"\ndraft: false\n---\n\n${filler.repeat(repeats)}`;
  writeFileSync(path.join(blog, 'silnaya.md'), article('Маркировка тестового товара: инструкция', 25), 'utf8');
  writeFileSync(path.join(blog, 'slabaya.md'), article('Маркировка тестового товара: подробная инструкция', 20), 'utf8');

  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');

  const proc = spawnSync(process.execPath, ['scripts/dedupe.mjs', 'scan'], {
    cwd: ROOT,
    env: {
      ...process.env,
      AUTOPILOT_CONFIG: configFile,
      AUTOPILOT_DATA_DIR: dataDir,
      AUTOPILOT_LOCK_FILE: path.join(dataDir, '.autopilot.lock'),
      CONTENT_ROOT: root,
    },
    encoding: 'utf8',
  });
  assert.equal(proc.status, 0, proc.stderr);

  const dupes = JSON.parse(readFileSync(path.join(dataDir, 'dupes.json'), 'utf8'));
  const pair = dupes.pairs.find((p) => p.verdict === 'merge');
  assert.ok(pair, JSON.stringify(dupes.pairs));
  assert.ok(pair.keep, 'должна быть сильная статья');
  assert.ok(pair.rewrite, 'должна быть слабая статья');
  assert.notEqual(pair.keep, pair.rewrite);
  assert.equal(pair.keep, 'silnaya.md'.replace('.md', ''), 'длинная статья остаётся как сильная');
  assert.equal(typeof pair.gateScore?.[pair.keep], 'number');
  assert.equal(typeof pair.inbound?.[pair.keep], 'number');
  assert.match(pair.reason, /gate/);
  assert.ok(Array.isArray(pair.weakAngle));
  assert.equal(pair.remediation, 'pending');
});


test('publication scan excludes drafts while topic admission still reserves their themes', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'dedupe-publication-scope-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  const dataDir = path.join(root, 'data');
  mkdirSync(blog, { recursive: true }); mkdirSync(dataDir, { recursive: true });
  const body = 'Проверяем одинаковое тело двух опубликованных материалов и ожидающего черновика. '.repeat(70);
  const article = (title, draft) => `---\ntitle: "${title}"\ndescription: "Описание"\npubDate: "2026-01-01"\ndraft: ${draft}\n---\n${body}`;
  writeFileSync(path.join(blog, 'published-a.md'), article('Опубликованный материал первый', false));
  writeFileSync(path.join(blog, 'published-b.md'), article('Опубликованный материал второй', false));
  writeFileSync(path.join(blog, 'held-draft.md'), article('Уникальная тема ожидающего черновика', true));
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)));
  const moduleUrl = new URL('./dedupe.mjs', import.meta.url).href;
  const proc = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const {scanCorpus,buildIndex,checkTopic}=await import(${JSON.stringify(moduleUrl)}); const index=buildIndex(); console.log(JSON.stringify({pairs:scanCorpus(),index,topic:checkTopic({title:'Уникальная тема ожидающего черновика'},index)}));`],
    {cwd:ROOT,env:{...process.env,AUTOPILOT_CONFIG:configFile,AUTOPILOT_DATA_DIR:dataDir,CONTENT_ROOT:root},encoding:'utf8'});
  assert.equal(proc.status, 0, proc.stderr);
  const result = JSON.parse(proc.stdout);
  assert.ok(result.pairs.some(p=>p.verdict==='merge' && [p.a,p.b].includes('published-a') && [p.a,p.b].includes('published-b')), 'real published body duplicates remain blocking signals');
  assert.ok(result.pairs.every(p=>p.a!=='held-draft' && p.b!=='held-draft'), 'draft must not count as a competing published URL');
  assert.equal(result.topic.verdict,'block','a second topic cannot bypass the existing held draft');
});
