import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE = path.join(ROOT, 'scripts', 'rewrite-queue.mjs');

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

function fixture(items = []) {
  const root = mkdtempSync(path.join(tmpdir(), 'rwq-'));
  mkdirSync(path.join(root, 'src', 'content', 'blog'), { recursive: true });
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');
  writeFileSync(path.join(dataDir, 'rewrite-queue.json'), JSON.stringify({ generatedAt: null, size: items.length, items }), 'utf8');
  return { root, dataDir, configFile };
}

function run(code, fx) {
  const proc = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: ROOT,
    env: {
      ...process.env,
      AUTOPILOT_CONFIG: fx.configFile,
      AUTOPILOT_DATA_DIR: fx.dataDir,
      AUTOPILOT_LOCK_FILE: path.join(fx.dataDir, '.autopilot.lock'),
    },
    encoding: 'utf8',
  });
  assert.notEqual(proc.status, 1, proc.stderr);
  return JSON.parse(proc.stdout);
}

const item = (slug, score) => ({ slug, title: slug, score, reasons: ['старое'] });
const queue = (fx) => JSON.parse(readFileSync(path.join(fx.dataDir, 'rewrite-queue.json'), 'utf8'));

test('AP-P1-09: выдача резервирует рерайт и не отдаёт его повторно', () => {
  const fx = fixture([item('a', 10), item('b', 9), item('c', 8)]);
  const first = run(
    `import { takeRewrites } from ${JSON.stringify(MODULE)};
     const taken = takeRewrites(2, { runId: 'r1', active: [] }).map((i) => i.slug);
     process.stdout.write(JSON.stringify({ taken }));`,
    fx,
  );
  assert.deepEqual(first.taken, ['a', 'b']);
  for (const slug of ['a', 'b']) {
    assert.ok(queue(fx).items.find((i) => i.slug === slug).reservedAt, `${slug} зарезервирован`);
  }

  const second = run(
    `import { takeRewrites } from ${JSON.stringify(MODULE)};
     const taken = takeRewrites(2, { runId: 'r1', active: ['a', 'b'] }).map((i) => i.slug);
     process.stdout.write(JSON.stringify({ taken }));`,
    fx,
  );
  assert.deepEqual(second.taken, ['c'], 'активные и зарезервированные не выдаются повторно');
});

test('AP-P1-09: брошенная резервация снимается, активная — переносится', () => {
  const fx = fixture([item('a', 10), item('b', 9)]);
  run(
    `import { takeRewrites } from ${JSON.stringify(MODULE)};
     takeRewrites(2, { runId: 'r1', active: [] });
     process.stdout.write('{}');`,
    fx,
  );

  // a в работе, b потерян (не активен): b освобождается, a переносится.
  const result = run(
    `import { activeRewrites, takeRewrites } from ${JSON.stringify(MODULE)};
     const carried = activeRewrites(['a']).map((i) => i.slug);
     const taken = takeRewrites(1, { runId: 'r2', active: ['a'] }).map((i) => i.slug);
     process.stdout.write(JSON.stringify({ carried, taken }));`,
    fx,
  );
  assert.deepEqual(result.carried, ['a']);
  assert.deepEqual(result.taken, ['b'], 'брошенная резервация снята и снова доступна');
  assert.equal(queue(fx).items.find((i) => i.slug === 'b').runId, 'r2');
});

test('AP-P1-09: mark и release снимают резервацию', () => {
  const fx = fixture([item('a', 10), item('b', 9)]);
  const result = run(
    `import { takeRewrites, markRewritten, releaseReservation } from ${JSON.stringify(MODULE)};
     takeRewrites(2, { runId: 'r1', active: [] });
     markRewritten('a');
     releaseReservation('b');
     process.stdout.write('{}');`,
    fx,
  );
  assert.deepEqual(result, {});
  for (const slug of ['a', 'b']) {
    assert.equal(queue(fx).items.find((i) => i.slug === slug).reservedAt, undefined);
  }
});

/** Sandbox с корпусом для проверки сигналов buildQueue. */
function scoringFixture({ rewriteLog = null } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'rwq-score-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  const mesh = (slug, targets) => `Смотрите [${targets[0]}](/blog/${targets[0]}/) и [${targets[1]}](/blog/${targets[1]}/). `;
  const long = (slug, targets) => mesh(slug, targets) + 'Наполнитель для объёма статьи. '.repeat(300);
  const today = new Date().toISOString().slice(0, 10);
  const article = (title, pubDate, body) =>
    `---\ntitle: "${title}"\ndescription: "d"\npubDate: "${pubDate}"\ndraft: false\n---\n\n${body}\n`;
  // Три свежих, не тонких, полностью связанных статьи — не кандидаты.
  writeFileSync(path.join(blog, 'a.md'), article('Свежая A', today, long('a', ['b', 'c'])), 'utf8');
  writeFileSync(path.join(blog, 'b.md'), article('Свежая B', today, long('b', ['a', 'c'])), 'utf8');
  writeFileSync(path.join(blog, 'c.md'), article('Свежая C', today, long('c', ['a', 'b'])), 'utf8');
  // Старая — кандидат по возрасту.
  writeFileSync(path.join(blog, 'old.md'), article('Старая статья', '2020-01-01', 'Коротко.'), 'utf8');
  // Свежая, но тонкая — кандидат по thinContentChars.
  writeFileSync(path.join(blog, 'thin.md'), article('Тонкая статья', today, mesh('thin', ['a', 'b'])), 'utf8');

  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');
  if (rewriteLog) writeFileSync(path.join(dataDir, 'rewrite-log.json'), JSON.stringify(rewriteLog), 'utf8');
  return { root, dataDir, configFile };
}

function buildQueueCli(fx) {
  const proc = spawnSync(process.execPath, ['scripts/rewrite-queue.mjs', 'build', '--json'], {
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

test('AP-P1-05: возраст, тонкость и minDaysBetweenRewrites управляют очередью', () => {
  const fx = scoringFixture();
  const queue = buildQueueCli(fx);
  const slugs = queue.items.map((i) => i.slug).sort();
  assert.ok(slugs.includes('old'), `старая должна быть кандидатом: ${slugs}`);
  assert.ok(slugs.includes('thin'), `тонкая должна быть кандидатом: ${slugs}`);
  assert.ok(!slugs.includes('a') && !slugs.includes('b') && !slugs.includes('c'), `свежие не кандидаты: ${slugs}`);
  const thin = queue.items.find((i) => i.slug === 'thin');
  assert.ok(thin.reasons.some((r) => /тонкий текст/.test(r)));

  // minDaysBetweenRewrites: только что переписанная старая выпадает.
  const today = new Date().toISOString().slice(0, 10);
  const fx2 = scoringFixture({ rewriteLog: { entries: { old: { lastRewrite: today, count: 1 } } } });
  const queue2 = buildQueueCli(fx2);
  assert.ok(!queue2.items.some((i) => i.slug === 'old'), 'свежий рерайт не берётся повторно');
});
