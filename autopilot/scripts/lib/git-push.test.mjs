import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pushGitDelivery, inspectWordstatDeliveryRace, readRemoteRef, gitFailureCategory } from './git-push.mjs';

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

function raceFixture({ brokenBuild = false } = {}) {
 const f=fixture();
 // A real npm build in the isolated checkout checks both delivery inputs.
 writeFileSync(path.join(f.root,'package.json'),JSON.stringify({scripts:{build:brokenBuild ? 'node -e "process.exit(7)"' : 'node -e "const fs=require(\'fs\');if(fs.readFileSync(\'article.md\',\'utf8\')!==\'after\'||!fs.existsSync(\'src/data/wordstat/demand.json\'))process.exit(8)"'}}));
 f.local('add','package.json'); f.local('commit','-qm','build script'); f.metadataCommit=f.local('rev-parse','HEAD');
 const journalFile=path.join(f.root,'.git/autopilot-delivery.json');const journal=JSON.parse(readFileSync(journalFile));journal.metadataCommit=f.metadataCommit;writeFileSync(journalFile,JSON.stringify(journal));
 const other=path.join(f.dir,'collector');f.git('clone','-q','--branch','main',f.bare,other);
 mkdirSync(path.join(other,'src/data/wordstat'),{recursive:true});writeFileSync(path.join(other,'src/data/wordstat/demand.json'),'{}');
 f.git('-C',other,'add','.');f.git('-C',other,'commit','-qm','collector');f.git('-C',other,'push','-q','origin','main');
 f.foreign=f.git('-C',other,'rev-parse','HEAD');f.journalFile=journalFile;return f;
}
test('Wordstat recovery builds the real combined checkout and keeps original delivery identity',()=>{
 const f=raceFixture();try {
  const result=pushGitDelivery(f);assert.equal(result.method,'wordstat_merge');assert.equal(result.deployed,false);
  assert.equal(f.local('show','-s','--format=%P',result.commit),`${f.foreign} ${f.metadataCommit}`);
  assert.equal(f.local('rev-parse','HEAD'),result.commit);assert.equal(f.local('status','--porcelain'),'');
  const journal=JSON.parse(readFileSync(f.journalFile));assert.equal(journal.metadataCommit,f.metadataCommit);assert.equal(journal.push.phase,'verified');
  assert.equal(pushGitDelivery(f).commit,result.commit);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('failed combined build changes neither checkout nor remote',()=>{
 const f=raceFixture({brokenBuild:true});try{
  assert.throws(()=>pushGitDelivery(f),/build failed/);assert.equal(f.local('rev-parse','HEAD'),f.metadataCommit);
  assert.equal(f.git('--git-dir',f.bare,'rev-parse','main'),f.foreign);assert.equal(f.local('status','--porcelain'),'');
  assert.equal(JSON.parse(readFileSync(f.journalFile)).push,undefined);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('SIGKILL after push resumes the same merge without another build or commit',()=>{
 const f=raceFixture();try{
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {pushGitDelivery} from ${JSON.stringify(new URL('./git-push.mjs',import.meta.url).href)};pushGitDelivery({root:${JSON.stringify(f.root)},targetRef:${JSON.stringify(f.targetRef)},afterPush:()=>process.kill(process.pid,'SIGKILL')});`],{encoding:'utf8',timeout:60000});
  assert.equal(child.signal,'SIGKILL',child.stderr);
  const pushed=f.git('--git-dir',f.bare,'rev-parse','main');assert.notEqual(pushed,f.metadataCommit);assert.equal(f.local('rev-parse','HEAD'),f.metadataCommit);
  assert.equal(JSON.parse(readFileSync(f.journalFile)).push.phase,'pending');
  const result=pushGitDelivery({...f,build:()=>{throw new Error('must not rebuild');}});assert.equal(result.commit,pushed);
  assert.equal(f.local('rev-parse','HEAD'),pushed);assert.equal(f.local('status','--porcelain'),'');assert.equal(f.git('--git-dir',f.bare,'rev-list','--count','main'),'5');
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});

test('another remote commit during recovery build stops without publishing candidate',()=>{
 const f=raceFixture();try{
  assert.throws(()=>pushGitDelivery({...f,build:()=>{
   const other=path.join(f.dir,'collector');writeFileSync(path.join(other,'outside.md'),'third writer');
   f.git('-C',other,'add','.');f.git('-C',other,'commit','-qm','third writer');f.git('-C',other,'push','-q','origin','main');return {ok:true,code:0};
  }}),/changed during recovery/);
  assert.equal(f.local('rev-parse','HEAD'),f.metadataCommit);assert.equal(f.git('--git-dir',f.bare,'show','main:outside.md'),'third writer');
  assert.equal(JSON.parse(readFileSync(f.journalFile)).push,undefined);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('Wordstat symlinks cannot enter automatic delivery recovery',()=>{
 const f=raceFixture();try{
  const other=path.join(f.dir,'collector');f.git('-C',other,'update-index','--cacheinfo','120000,'+f.git('-C',other,'hash-object','src/data/wordstat/demand.json')+',src/data/wordstat/demand.json');
  f.git('-C',other,'commit','-qm','symlink');f.git('-C',other,'push','-q','origin','main');
  assert.throws(()=>pushGitDelivery(f),/regular data file/);assert.equal(f.local('rev-parse','HEAD'),f.metadataCommit);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});


test('remote lookup retries only bounded read failures and returns current response', () => {
  let calls = 0; const waits = [];
  const response = readRemoteRef({ read: () => { if (++calls < 3) throw Object.assign(new Error('safe'), { category: 'transport' }); return 'current-ref'; }, pause: ms => waits.push(ms) });
  assert.equal(response, 'current-ref'); assert.equal(calls, 3); assert.deepEqual(waits, [250, 500]);
  calls = 0;
  assert.throws(() => readRemoteRef({ read: () => { calls++; throw Object.assign(new Error('safe'), { category: 'unknown' }); }, pause: () => {} }), /safe/);
  assert.equal(calls, 3);
  for (const category of ['access_denied', undefined]) {
    calls = 0;
    assert.throws(() => readRemoteRef({ read: () => { calls++; throw Object.assign(new Error('safe'), { category }); }, pause: () => assert.fail('unexpected delay') }), /safe/);
    assert.equal(calls, 1);
  }
});
test('Git failure diagnostics export safe categories instead of raw messages', () => {
  for (const [stderr, expected] of [['Authentication failed: private URL', 'access_denied'], ['Could not resolve host: private URL', 'dns'], ['HTTP/2 stream error', 'transport'], ['SSL certificate problem', 'tls'], ['private unknown details', 'unknown']]) assert.equal(gitFailureCategory({ stderr }), expected);
  assert.equal(gitFailureCategory({ error: { code: 'ETIMEDOUT' } }), 'timeout');
});
