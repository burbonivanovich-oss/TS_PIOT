import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { beginGitDelivery, commitGitDelivery, corpusHash } from './lib/git-delivery.mjs';
import { createRun, setStage } from './lib/run.mjs';

function fixture({ baseline = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'daily-git-'));
  const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = path.join(root, 'autopilot/data'); const blog = path.join(root, 'src/content/blog');
  mkdirSync(dataDir, { recursive: true }); mkdirSync(blog, { recursive: true });
  writeFileSync(path.join(root, '.gitignore'), '*.bak\nautopilot/data/.autopilot.lock*\nautopilot/data/lock-events.jsonl\ndist/\n');
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'node build.mjs' } }));
  writeFileSync(path.join(root, 'build.mjs'), "import {mkdirSync,copyFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('src/content/blog/article.md','dist/article.txt');");
  writeFileSync(path.join(blog, 'article.md'), 'before');
  const config = JSON.parse(readFileSync(path.join(engine, 'config/autopilot.config.json'))); config.security.strictContentRoot = false;
  const configFile = path.join(root, 'config.json'); writeFileSync(configFile, JSON.stringify(config));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.test' };
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-qb', 'codex/daily-git'); git('add', '.'); git('commit', '-qm', 'baseline');
  const head = git('rev-parse', 'HEAD'); if (baseline) beginGitDelivery(root);
  const run = createRun({ dir: dataDir, orders: ['article'] }); setStage(run.runId, 'planned', {}, { dir: dataDir });
  writeFileSync(path.join(blog, 'article.md'), 'after');
  writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify({ runId: run.runId, orders: [{ slug: 'article', kind: 'new' }] }));
  setStage(run.runId, 'gated', { published: 1 }, { dir: dataDir });
  setStage(run.runId, 'built', { checked: true, ok: true, code: 0, corpusSha256: corpusHash(blog) }, { dir: dataDir });
  const call = options => spawnSync(process.execPath, ['--input-type=module', '-e', `import {dailyCycle} from './scripts/daily.mjs';try{console.log(JSON.stringify(await dailyCycle(${JSON.stringify(typeof options === 'boolean' ? { commit: options } : options)})));}catch(e){console.error(e.message);process.exitCode=1;}`], { cwd: engine, encoding: 'utf8', env: { ...env, AUTOPILOT_CONFIG: configFile, CONTENT_ROOT: root, AUTOPILOT_DATA_DIR: dataDir, AUTOPILOT_LOCK_FILE: path.join(dataDir, '.autopilot.lock') } });
  return { root, dataDir, blog, runId: run.runId, head, git, call };
}
test('real daily owner resumes prepared Git delivery without new writing and produces clean checkout', () => {
  const f = fixture(); try {
    assert.throws(() => commitGitDelivery({ ...f, afterPrepared: () => { throw Error('interrupted'); } }), /interrupted/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.head);
    const observed = f.call(false); assert.equal(observed.status, 0, observed.stderr); assert.equal(JSON.parse(observed.stdout).status, 'git_delivery_pending');
    assert.equal(f.git('rev-parse', 'HEAD'), f.head);
    const resumed = f.call(true); assert.equal(resumed.status, 0, resumed.stderr); const result = JSON.parse(resumed.stdout);
    assert.equal(result.status, 'committed'); assert.equal(result.modelCalled, false); assert.equal(result.runId, f.runId);
    assert.equal(f.git('status', '--porcelain'), ''); assert.equal(f.git('rev-list', '--count', 'HEAD'), '3');
    assert.equal(readFileSync(path.join(f.root, 'dist/article.txt'), 'utf8'), 'after');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('daily owner refuses retrofitting a clean baseline after planning', () => {
  const f = fixture({ baseline: false }); try {
    const r = f.call(true); assert.equal(r.status, 1); assert.match(r.stderr, /не записана до plan/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.head); assert.equal(f.git('rev-list', '--count', 'HEAD'), '1');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('daily resumes lost push before new planning against real bare remote', () => {
  const f = fixture(); const bare = mkdtempSync(path.join(tmpdir(), 'daily-push-'));
  try {
    f.git('init', '--bare', '-q', bare); f.git('remote', 'add', 'origin', bare); f.git('push', '-q', 'origin', `${f.head}:refs/heads/main`);
    const committed = commitGitDelivery(f);
    const result = f.call({ commit: true, push: true, targetRef: 'refs/heads/main' });
    assert.equal(result.status, 0, result.stderr); const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'pushed'); assert.equal(output.modelCalled, false); assert.equal(output.publication.deployed, false);
    assert.match(f.git('ls-remote', 'origin', 'refs/heads/main'), new RegExp('^' + committed.metadataCommit));
    assert.equal(f.git('rev-list', '--count', 'HEAD'), '3'); assert.equal(f.git('status', '--porcelain'), '');
  } finally { rmSync(f.root, { recursive: true, force: true }); rmSync(bare, { recursive: true, force: true }); }
});
