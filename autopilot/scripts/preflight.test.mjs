import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
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
    gates: { minScore: 70, maxAiMarkerDensity: 0.6, requireFactcheck: true, minChars: 4000, maxChars: 22000, quarantineAfterFailures: 2 },
    publish: { autoPublish: true, draftOnFail: true, maxPerDay: 12 },
    backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2 },
  };
}

function sandbox({ articles = 1 } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'preflight-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  for (let i = 0; i < articles; i++) {
    writeFileSync(path.join(blog, `a${i}.md`), `---\ntitle: "a${i}"\ndescription: "d"\npubDate: "2026-01-01"\n---\n\nBody.\n`, 'utf8');
  }
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(root, 'config.json');
  writeFileSync(configFile, JSON.stringify(baseConfig(root)), 'utf8');
  return { root, blog, dataDir, configFile };
}

function run(fixture, extraEnv = {}) {
  return spawnSync(process.execPath, ['scripts/preflight.mjs', '--json'], {
    cwd: ROOT,
    env: {
      ...process.env,
      AUTOPILOT_CONFIG: fixture.configFile,
      AUTOPILOT_DATA_DIR: fixture.dataDir,
      AUTOPILOT_LOCK_FILE: path.join(fixture.dataDir, '.autopilot.lock'),
      ...extraEnv,
    },
    encoding: 'utf8',
  });
}

function parse(proc) {
  assert.notEqual(proc.status, 1, `preflight не должен падать: ${proc.stderr}`);
  return { status: proc.status, report: JSON.parse(proc.stdout) };
}

test('AP-P0-10: исправный sandbox проходит preflight', () => {
  const fixture = sandbox();
  const { status, report } = parse(run(fixture));
  assert.equal(status, 0, JSON.stringify(report));
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.filter((c) => !c.ok), []);
});

test('AP-P0-10: отсутствующий корпус — отказ без записи файлов', () => {
  const fixture = sandbox();
  // Убираем каталог блога.
  rmSync(fixture.blog, { recursive: true, force: true });
  const before = readdirSync(fixture.dataDir).sort();
  const { status, report } = parse(run(fixture));
  assert.equal(status, 2);
  assert.ok(report.checks.find((c) => c.id === 'content-root').ok === false);
  assert.deepEqual(readdirSync(fixture.dataDir).sort(), before, 'preflight не должен писать');
});

test('AP-P0-10: пустой корпус — отказ', () => {
  const fixture = sandbox({ articles: 0 });
  const { status, report } = parse(run(fixture));
  assert.equal(status, 2);
  assert.match(report.checks.find((c) => c.id === 'content-root').detail, /пуст/);
});

test('AP-P0-10: malformed JSON состояния — отказ', () => {
  const fixture = sandbox();
  writeFileSync(path.join(fixture.dataDir, 'autopilot.json'), '{"month":', 'utf8');
  const { status, report } = parse(run(fixture));
  assert.equal(status, 2);
  const check = report.checks.find((c) => c.id === 'state-json');
  assert.equal(check.ok, false);
  assert.match(check.detail, /autopilot\.json/);
});

test('AP-P0-10: занятый lock живым процессом — отказ', () => {
  const fixture = sandbox();
  writeFileSync(path.join(fixture.dataDir, '.autopilot.lock'), JSON.stringify({ pid: process.pid, runId: 'live', cmd: 'plan' }), 'utf8');
  const { status, report } = parse(run(fixture));
  assert.equal(status, 2);
  assert.match(report.checks.find((c) => c.id === 'lock').detail, /уже работает/);
});

test('AP-P0-10: мёртвый lock и stale reap — отказ с командой снятия', () => {
  const fixture = sandbox();
  writeFileSync(path.join(fixture.dataDir, '.autopilot.lock'), JSON.stringify({ pid: 999999999, runId: 'dead', cmd: 'plan' }), 'utf8');
  const { status, report } = parse(run(fixture));
  assert.equal(status, 2);
  assert.match(report.checks.find((c) => c.id === 'lock').detail, /unlock --force/);

  writeFileSync(`${path.join(fixture.dataDir, '.autopilot.lock')}.reap`, JSON.stringify({ pid: 999999998 }), 'utf8');
  const second = parse(run(fixture));
  assert.equal(second.status, 2);
  assert.match(second.report.checks.find((c) => c.id === 'lock').detail, /reap-файл/);
});

test('AP-P0-10: запрет корня ФС как contentRoot', () => {
  const fixture = sandbox();
  const cfg = baseConfig('/');
  writeFileSync(fixture.configFile, JSON.stringify(cfg), 'utf8');
  const { status, report } = parse(run(fixture));
  assert.equal(status, 2);
  assert.match(report.checks.find((c) => c.id === 'content-root').detail, /корень ФС/);
});

test('AP-P0-10: git-проверка при включении отвергает не-git каталог', () => {
  const fixture = sandbox();
  const { status, report } = parse(run(fixture, { AUTOPILOT_PREFLIGHT_GIT: '1' }));
  assert.equal(status, 2);
  assert.match(report.checks.find((c) => c.id === 'git').detail, /не git-репозиторий/);
});

test('AP-P0-10: preflight не создаёт файлов в data', () => {
  const fixture = sandbox();
  const before = readdirSync(fixture.dataDir).sort();
  run(fixture);
  assert.deepEqual(readdirSync(fixture.dataDir).sort(), before);
  assert.equal(existsSync(path.join(fixture.dataDir, '.autopilot.lock')), false);
});

test('AP-P1-19: мало места на диске — отказ без записи', () => {
  const fixture = sandbox();
  const before = readdirSync(fixture.dataDir).sort();
  const { status, report } = parse(run(fixture, { AUTOPILOT_MIN_FREE_MB: '999999999' }));
  assert.equal(status, 2);
  assert.match(report.checks.find((c) => c.id === 'disk').detail, /мало места/);
  assert.deepEqual(readdirSync(fixture.dataDir).sort(), before);
});

test('AP-P1-03: неверная дата в seeds.json останавливает preflight', () => {
  const fixture = sandbox();
  writeFileSync(
    path.join(fixture.dataDir, 'seeds.json'),
    JSON.stringify({ intents: [], segments: [], calendar: [{ entity: 'маркировка', date: '2026-02-30', boost: 10 }] }),
    'utf8',
  );
  const { status, report } = parse(run(fixture));
  assert.equal(status, 2);
  assert.match(report.checks.find((c) => c.id === 'seeds').detail, /несуществующая календарная дата/);
});
