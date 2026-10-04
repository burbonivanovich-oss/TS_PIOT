import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pushGitDelivery, inspectWordstatDeliveryRace } from './git-push.mjs';

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'autopilot-push-')); const root = path.join(dir, 'work'); const bare = path.join(dir, 'remote.git');
  const git = (...args) => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.test' } }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '--bare', '-q', bare); git('init', '-q', '-b', 'codex/push', root);
  const local = (...args) => git('-C', root, ...args);
  writeFileSync(path.join(root, 'article.md'), 'before'); local('add', '.'); local('commit', '-qm', 'baseline'); const baseHead = local('rev-parse', 'HEAD');
  local('remote', 'add', 'origin', bare); local('push', '-q', 'origin', 'HEAD:refs/heads/main');
  writeFileSync(path.join(root, 'article.md'), 'after'); local('commit', '-qam', 'delivery'); const metadataCommit = local('rev-parse', 'HEAD');
  writeFileSync(path.join(root, '.git/autopilot-delivery.json'), JSON.stringify({ version: 1, root, branch: 'refs/heads/codex/push', phase: 'committed', baseHead, metadataCommit }));
  return { dir, root, bare, local, git, metadataCommit, targetRef: 'refs/heads/main' };
}
test('real bare remote confirms delivery and repeated push adds no commits', () => {
  const f = fixture(); try { assert.equal(pushGitDelivery(f).deployed, false); assert.equal(f.git('--git-dir', f.bare, 'rev-parse', 'main'), f.metadataCommit); assert.equal(pushGitDelivery(f).pushed, true); assert.equal(f.git('--git-dir', f.bare, 'rev-list', '--count', 'main'), '2'); } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
test('dirty checkout and invalid destination refuse push', () => {
  const f = fixture(); try { assert.throws(() => pushGitDelivery({ ...f, targetRef: 'main' }), /explicit/); writeFileSync(path.join(f.root, 'user.txt'), 'user'); assert.throws(() => pushGitDelivery(f), /changed/); assert.notEqual(f.git('--git-dir', f.bare, 'rev-parse', 'main'), f.metadataCommit); } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
test('remote divergence refuses push without force or overwriting external commit', () => {
  const f = fixture(); try { writeFileSync(path.join(f.root, 'article.md'), 'external'); f.local('commit', '-qam', 'external'); const external = f.local('rev-parse', 'HEAD'); f.local('push', '-q', 'origin', 'HEAD:refs/heads/main'); f.local('reset', '--hard', f.metadataCommit); assert.throws(() => pushGitDelivery(f), /outside/); assert.equal(f.git('--git-dir', f.bare, 'rev-parse', 'main'), external); } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('Wordstat race inspection preserves both trees without changing checkout or remote', () => {
 const f=fixture();try {
  const other=path.join(f.dir,'collector');f.git('clone','-q','--branch','main',f.bare,other);
  const folder=path.join(other,'src/data/wordstat');mkdirSync(folder,{recursive:true});writeFileSync(path.join(folder,'спрос.json'),'{}');
  f.git('-C',other,'add','.');f.git('-C',other,'commit','-qm','collector');f.git('-C',other,'push','-q','origin','main');
  const remoteHead=f.git('-C',other,'rev-parse','HEAD');f.local('fetch','-q','origin','main');
  const result=inspectWordstatDeliveryRace({...f,remoteHead});assert.equal(result.deliveryBytesUnchanged,true);assert.equal(result.wordstatBytesUnchanged,true);
  assert.equal(f.local('rev-parse','HEAD'),f.metadataCommit);assert.equal(f.local('status','--porcelain'),'');assert.equal(f.git('--git-dir',f.bare,'rev-parse','main'),remoteHead);
  writeFileSync(path.join(other,'unexpected.md'),'outside');f.git('-C',other,'add','.');f.git('-C',other,'commit','-qm','outside');f.git('-C',other,'push','-q','origin','main');f.local('fetch','-q','origin','main');
  assert.throws(()=>inspectWordstatDeliveryRace({...f,remoteHead:f.git('-C',other,'rev-parse','HEAD')}),/outside Wordstat/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
