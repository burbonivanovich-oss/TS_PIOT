import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideNotification, healthSignature } from './notify.mjs';

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

const articleBody = (targets) => `Смотрите [${targets[0]}](/blog/${targets[0]}/) и [${targets[1]}](/blog/${targets[1]}/).\n`;

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'notify-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  // Полный mesh: у каждой статьи две входящие (норма minInbound=2).
  for (const [slug, targets] of [['a', ['b', 'c']], ['b', ['a', 'c']], ['c', ['a', 'b']]]) {
    writeFileSync(
      path.join(blog, `${slug}.md`),
      `---\ntitle: "${slug}"\ndescription: "d"\npubDate: "2026-01-01"\ndraft: false\n---\n\n${articleBody(targets)}`,
      'utf8',
    );
  }
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');
  writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify({ date: TODAY, orders: [] }), 'utf8');
  writeFileSync(
    path.join(dataDir, 'autopilot.json'),
    JSON.stringify({ version: 1, startedAt: TODAY, month: MONTH, counters: { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 }, inFlight: [], quarantine: [], history: [], lastRunAt: null }),
    'utf8',
  );
  return { root, dataDir, configFile };
}

function healthyBacklog(fx) {
  const topics = Array.from({ length: 60 }, (_, i) => ({ slug: `t${i}`, status: 'planned', entity: 'e' }));
  writeFileSync(path.join(fx.dataDir, 'backlog.json'), JSON.stringify({ generatedAt: null, topics }), 'utf8');
}

function notify(fx) {
  const proc = spawnSync(process.execPath, ['scripts/notify.mjs', '--json'], {
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

test('AP-P1-15: три одинаковых отказа дают одно уведомление, recovery — закрывающее', () => {
  const fx = fixture(); // без backlog: 'бэклог' имеет уровень fail
  const first = notify(fx);
  assert.equal(first.notify, true);
  assert.equal(first.kind, 'first');
  assert.equal(notify(fx).notify, false);
  assert.equal(notify(fx).notify, false);

  healthyBacklog(fx);
  const recovered = notify(fx);
  assert.equal(recovered.notify, true);
  assert.equal(recovered.kind, 'recovery');
  assert.equal(notify(fx).notify, false, 'после recovery повтор молчит');
});

test('AP-P1-15: решение о уведомлении чистое и предсказуемое', () => {
  const sig = (level, failed) => healthSignature({ level, checks: failed.map((name) => ({ name, level: 'fail' })) });
  const a = { signature: sig('fail', ['бэклог']), failed: ['бэклог'], level: 'fail' };
  assert.deepEqual(decideNotification(null, a).kind, 'first');
  assert.deepEqual(decideNotification(a, { ...a }).notify, false);
  const changed = { signature: sig('fail', ['карантин']), failed: ['карантин'], level: 'fail' };
  assert.equal(decideNotification(a, changed).kind, 'changed');
  const ok = { signature: sig('warn', []), failed: [], level: 'warn' };
  assert.equal(decideNotification(changed, ok).kind, 'recovery');
});
