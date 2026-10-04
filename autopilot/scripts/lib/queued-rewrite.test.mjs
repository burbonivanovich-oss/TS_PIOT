import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {preservePublishedRewrite,stageQueuedRewrite,queuedRewriteFile,promoteQueuedRewrite,retainFailedRewrite,publishedRewriteTargets} from './queued-rewrite.mjs';
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'queued-rewrite-'));const blog=path.join(root,'blog'),dataDir=path.join(root,'data');fs.mkdirSync(blog);fs.mkdirSync(dataDir);return {root,blog,dataDir,slug:'published-article'};}
test('queued rewrite retains original published bytes and promotes the staged version only on release',()=>{
 const x=fixture();try{const old='---\ntitle: Original\ndraft: false\n---\nOld published body\n';fs.writeFileSync(path.join(x.blog,x.slug+'.md'),old);preservePublishedRewrite(x);fs.unlinkSync(path.join(x.blog,x.slug+'.md'));const candidate='---\ntitle: Updated\ndraft: true\n---\nApproved rewritten body\n';const file=path.join(x.blog,x.slug+'.mdx');fs.writeFileSync(file,candidate);const stagedFile=stageQueuedRewrite({...x,file});assert.equal(fs.readFileSync(path.join(x.blog,x.slug+'.md'),'utf8'),old);const staged=queuedRewriteFile({...x,stagedFile});assert.equal(fs.readFileSync(staged,'utf8'),candidate);assert.throws(()=>queuedRewriteFile({...x,stagedFile:'../outside.md'}));fs.writeFileSync(staged,candidate.replace('draft: true','draft: false'));promoteQueuedRewrite({...x,stagedFile});assert.equal(fs.existsSync(path.join(x.blog,x.slug+'.md')),false);assert.equal(fs.readFileSync(path.join(x.blog,x.slug+'.mdx'),'utf8'),candidate.replace('draft: true','draft: false'));assert.equal(fs.existsSync(staged),false);}finally{fs.rmSync(x.root,{recursive:true,force:true});}
});
test('rejected rewrite also restores live original; missing baseline fails closed for queued rewrite',()=>{
 const x=fixture();try{const file=path.join(x.blog,x.slug+'.md');fs.writeFileSync(file,'---\ndraft: false\n---\nOriginal');assert.throws(()=>stageQueuedRewrite({...x,file}),/baseline/);preservePublishedRewrite(x);fs.writeFileSync(file,'---\ndraft: true\n---\nBad candidate');assert.equal(retainFailedRewrite({...x,file}),true);assert.match(fs.readFileSync(file,'utf8'),/Original/);assert.match(fs.readFileSync(path.join(x.dataDir,'failed-rewrites',x.slug+'.md'),'utf8'),/Bad candidate/);}finally{fs.rmSync(x.root,{recursive:true,force:true});}
});

test('only active rewrite with a live regular baseline retains its published target',()=>{
 const x=fixture();try {
  const file=path.join(x.blog,x.slug+'.md');
  fs.writeFileSync(file,'---\npubDate: 2026-01-01\ndraft: false\n---\nOriginal');preservePublishedRewrite(x);
  fs.writeFileSync(file,'---\ndraft: true\n---\nCandidate');
  const state=path.join(x.dataDir,'autopilot.json'),articles=[{slug:x.slug}];
  fs.writeFileSync(state,JSON.stringify({inFlight:[{slug:x.slug,kind:'rewrite'}]}));
  assert.ok(publishedRewriteTargets({...x,articles}).has(x.slug));
  assert.equal(publishedRewriteTargets({...x,articles:[]}).size,0,'removed URL remains invalid');
  fs.writeFileSync(state,JSON.stringify({inFlight:[{slug:x.slug,kind:'new'}]}));
  assert.equal(publishedRewriteTargets({...x,articles}).size,0,'new draft cannot use stale backup');
  fs.writeFileSync(state,JSON.stringify({inFlight:[{slug:x.slug,kind:'rewrite'}]}));
  const backup=path.join(x.dataDir,'published-rewrites',x.slug+'.md');
  for(const fm of ['draft: true','draft: false\nautopilotHold: true','draft: false\npubDate: 2999-01-01']) {
   fs.writeFileSync(backup,'---\npubDate: 2026-01-01\n'+fm+'\n---\nUnavailable');
   assert.equal(publishedRewriteTargets({...x,articles}).size,0);
  }
  fs.unlinkSync(backup);fs.symlinkSync(file,backup);
  assert.throws(()=>publishedRewriteTargets({...x,articles}),/Unsafe rewrite/);
 }finally{fs.rmSync(x.root,{recursive:true,force:true});}
});
