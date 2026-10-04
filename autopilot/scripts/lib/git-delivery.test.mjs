import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { beginGitDelivery, commitGitDelivery, corpusHash, readDeliveryJournal } from './git-delivery.mjs';
import { createRun, setStage, readRun } from './run.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'git-delivery-'));
  const dataDir = path.join(root, 'autopilot/data'); const blog = path.join(root, 'src/content/blog');
  mkdirSync(dataDir, { recursive: true }); mkdirSync(blog, { recursive: true });
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.test' } });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  git('init', '-q', '-b', 'codex/delivery-test');
  writeFileSync(path.join(root, '.gitignore'), '*.bak\n');
  writeFileSync(path.join(root, 'README.md'), 'baseline'); writeFileSync(path.join(blog, 'article.md'), 'before');
  git('add', '.'); git('commit', '-qm', 'baseline');
  const baseHead = git('rev-parse', 'HEAD'); beginGitDelivery(root);
  const run = createRun({ dir: dataDir, orders: ['article'] }); setStage(run.runId, 'planned', {}, { dir: dataDir });
  writeFileSync(path.join(blog, 'article.md'), 'after');
  writeFileSync(path.join(dataDir, 'autopilot.json'), JSON.stringify({ published: 1 }));
  setStage(run.runId, 'gated', { published: 1 }, { dir: dataDir });
  setStage(run.runId, 'built', { checked: true, ok: true, code: 0, corpusSha256: corpusHash(blog) }, { dir: dataDir });
  return { root, dataDir, blog, runId: run.runId, baseHead, git, build: () => ({ ok: true, code: 0 }) };
}
test('real Git delivery atomically carries article, state and receipt; repeat adds no commits', () => {
  const f = fixture(); try {
    const result = commitGitDelivery(f);
    assert.equal(f.git('rev-parse', 'HEAD'), result.metadataCommit); assert.equal(f.git('status', '--porcelain'), '');
    assert.equal(f.git('show', `${result.contentCommit}:src/content/blog/article.md`), 'after');
    assert.equal(JSON.parse(f.git('show', `${result.metadataCommit}:autopilot/data/runs/${f.runId}.json`)).stages.committed.commit, result.contentCommit);
    assert.equal(f.git('rev-list', '--count', 'HEAD'), '3'); assert.equal(commitGitDelivery(f).metadataCommit, result.metadataCommit); assert.equal(f.git('rev-list', '--count', 'HEAD'), '3');
    assert.equal(result.pushed, false); assert.equal(result.deployed, false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('prepared delivery survives interruption before branch update', () => {
  const f = fixture(); try {
    assert.throws(() => commitGitDelivery({ ...f, afterPrepared: () => { throw Error('crash'); } }), /crash/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.baseHead);
    assert.ok(readRun(f.runId, { dir: f.dataDir }).stages.committed.commit);
    commitGitDelivery(f); assert.equal(f.git('rev-list', '--count', 'HEAD'), '3'); assert.equal(f.git('status', '--porcelain'), '');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('unrelated edits and staged user changes refuse delivery without touching HEAD/index', () => {
  const f = fixture(); try {
    writeFileSync(path.join(f.root, 'README.md'), 'user change');
    assert.throws(() => commitGitDelivery(f), /Посторонняя/); assert.equal(f.git('rev-parse', 'HEAD'), f.baseHead);
    f.git('add', 'README.md'); const index = f.git('write-tree');
    assert.throws(() => commitGitDelivery(f), /Индекс Git/); assert.equal(f.git('write-tree'), index);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('changed corpus or failed final build cannot create a delivered branch tip', () => {
  const f = fixture(); try {
    writeFileSync(path.join(f.blog, 'article.md'), 'not built'); assert.throws(() => commitGitDelivery(f), /Корпус изменился/);
    writeFileSync(path.join(f.blog, 'article.md'), 'after'); assert.throws(() => commitGitDelivery({ ...f, build: () => ({ ok: false, code: 1 }) }), /сборка доставки/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.baseHead); assert.equal(readRun(f.runId, { dir: f.dataDir }).stages.committed, undefined);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('state change after preparation refuses publication of stale prepared tree', () => {
  const f = fixture(); try {
    assert.throws(() => commitGitDelivery({ ...f, afterPrepared: () => { throw Error('crash'); } }), /crash/);
    writeFileSync(path.join(f.dataDir, 'autopilot.json'), '{}');
    assert.throws(() => commitGitDelivery(f), /Файлы изменились/); assert.equal(f.git('rev-parse', 'HEAD'), f.baseHead);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('next cycle can record a new clean baseline after completed delivery', () => {
  const f = fixture(); try {
    const delivered = commitGitDelivery(f); const baseline = beginGitDelivery(f.root);
    assert.equal(baseline.baseHead, delivered.metadataCommit); assert.equal(baseline.phase, 'baseline');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('completed delivery archives after clean maintenance commit preserving its ancestry', () => {
  const f = fixture(); try {
    const delivered = commitGitDelivery(f);
    writeFileSync(path.join(f.root, 'README.md'), 'reviewed maintenance'); f.git('add', 'README.md'); f.git('commit', '-qm', 'maintenance');
    const baseline = beginGitDelivery(f.root); assert.equal(baseline.baseHead, f.git('rev-parse', 'HEAD')); assert.notEqual(baseline.baseHead, delivered.metadataCommit);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('unverified push cannot be archived even after local delivery completes', () => {
  const f = fixture(); try {
    commitGitDelivery(f); const journal = readDeliveryJournal(f.root); journal.push = { phase: 'pending' };
    writeFileSync(path.join(f.root, '.git/autopilot-delivery.json'), JSON.stringify(journal));
    assert.throws(() => beginGitDelivery(f.root), /Незавершённая/); assert.equal(readDeliveryJournal(f.root).push.phase, 'pending');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('article research cannot bypass secret checks with fixture allow marker', () => {
  const f = fixture(); try {
    const research = path.join(f.root, 'autopilot/research'); mkdirSync(research);
    writeFileSync(path.join(research, 'article.md'), 'secret-scan:allow\n' + 'ghp_' + 'a'.repeat(40));
    assert.throws(() => commitGitDelivery(f), /обнаружен секрет/); assert.equal(f.git('rev-parse', 'HEAD'), f.baseHead);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('empty pass commits state only without inventing build or publication', () => {
  const f = fixture(); try {
    writeFileSync(path.join(f.blog, 'article.md'), 'before');
    const file = path.join(f.dataDir, 'runs', `${f.runId}.json`); const manifest = JSON.parse(readFileSync(file));
    delete manifest.stages.built; manifest.stages.gated.published = 0; writeFileSync(file, JSON.stringify(manifest));
    const result = commitGitDelivery({ ...f, build: () => { throw Error('no content changed'); } });
    assert.equal(f.git('show', `${result.metadataCommit}:src/content/blog/article.md`), 'before');
    const delivered = readRun(f.runId, { dir: f.dataDir }); assert.equal(delivered.stages.built, undefined); assert.equal(delivered.stages.committed.stateOnly, true);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('state-only delivery refuses asset changes without a real build', () => {
  const f = fixture(); try {
    writeFileSync(path.join(f.blog, 'article.md'), 'before');
    const file = path.join(f.dataDir, 'runs', `${f.runId}.json`); const manifest = JSON.parse(readFileSync(file));
    delete manifest.stages.built; manifest.stages.gated.published = 0; writeFileSync(file, JSON.stringify(manifest));
    const assets = path.join(f.root, 'public/images/hero'); mkdirSync(assets, { recursive: true }); writeFileSync(path.join(assets, 'article.webp'), 'changed');
    assert.throws(() => commitGitDelivery(f), /только состояние/); assert.equal(f.git('rev-parse', 'HEAD'), f.baseHead);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
