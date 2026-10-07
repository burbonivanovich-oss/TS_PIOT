import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {beginGitDelivery,commitGitDelivery,readDeliveryJournal} from './lib/git-delivery.mjs';
import {pushGitDelivery} from './lib/git-push.mjs';
import {verifyLiveRelease} from './lib/live-release.mjs';
import {createRun,setStage,readRun} from './lib/run.mjs';
import {extractClaims} from './lib/critical-claims.mjs';
import {claimHash} from './lib/claim-evidence.mjs';

const ENGINE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('AUD-02 receipt -> refusal -> correction -> build -> commit -> rejected push -> recovery -> HTTP readback',async(t)=>{
  const dir=fs.mkdtempSync(path.join(tmpdir(),'delivery-path-'));
  const root=path.join(dir,'site'),bare=path.join(dir,'remote.git');
  const dataDir=path.join(root,'autopilot/data'),blog=path.join(root,'src/content/blog');
  fs.mkdirSync(blog,{recursive:true});fs.mkdirSync(dataDir,{recursive:true});
  const today=new Date().toISOString().slice(0,10),slug='audit-delivery-candidate',file=path.join(blog,slug+'.md');
  const git=(...args)=>{
    const r=spawnSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.test',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.test'}});
    assert.equal(r.status,0,r.stderr);return r.stdout.trim();
  };
  const config=JSON.parse(fs.readFileSync(path.join(ENGINE,'config/autopilot.config.json')));
  config.contentRoot=root;config.security.strictContentRoot=false;config.security.qualityCheck=false;config.security.buildCheck=true;
  config.gates.requireHeroImage=false;config.gates.requireWritingReceipt=true;config.gates.requireClaimEvidence=true;
  config.throughput.monthlyTarget=200;config.throughput.monthlyRewriteTarget=50;
  const configFile=path.join(root,'config.json');fs.writeFileSync(configFile,JSON.stringify(config));
  const stateFile=path.join(dataDir,'autopilot.json');
  fs.writeFileSync(stateFile,JSON.stringify({version:1,month:today.slice(0,7),startedAt:today,counters:{new:0,rewrite:0,published:0,blockedDupes:0,quarantined:0,infraReleases:0},inFlight:[{slug,kind:'new',title:'Испытание доставки',claimedAt:new Date().toISOString(),failures:0,infraFailures:0}],quarantine:[],history:[],lastRunAt:null}));
  fs.writeFileSync(path.join(dataDir,'backlog.json'),JSON.stringify({topics:[{slug,status:'writing'}]}));
  fs.writeFileSync(path.join(root,'.gitignore'),'dist/\n*.bak\n');
  // A real npm command creates the rendered candidate; site QA/assets are out
  // of scope here and have their own real-site acceptance checks.
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:{build:'node build.cjs'}}));
  fs.writeFileSync(path.join(root,'build.cjs'),`const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});const s=fs.readFileSync('src/content/blog/${slug}.md','utf8');fs.writeFileSync('dist/article.html','<html><body><pre>'+s+'</pre></body></html>');`);
  for(const ref of ['ref-one','ref-two','ref-three'])fs.writeFileSync(path.join(blog,ref+'.md'),`---\ntitle: ${ref}\ndraft: false\n---\nСоседний материал ${ref}.`);
  const text=`---\ntitle: Испытание доставки\ndescription: Проверенное описание испытания полного пути доставки материала и восстановления после отказа принимающего репозитория без повторного учёта.\npubDate: ${today}\ndraft: true\nautopilotHold: true\n---\n`+['Первый','Второй','Третий'].map(h=>`## ${h} раздел\n\n`+'Нейтральный материал описывает рабочие действия команды и порядок подготовки технической документации. '.repeat(17)).join('\n')+'\n[Первый](/blog/ref-one/) [Второй](/blog/ref-two/) [Третий](/blog/ref-three/)\n';
  fs.writeFileSync(file,text+'\nШтраф 500 рублей.\n');
  git('init','-q','-b','codex/delivery-path');git('add','.');git('commit','-qm','baseline');
  const baseHead=git('rev-parse','HEAD');git('init','--bare','-q',bare);git('remote','add','origin',bare);git('push','-q','origin','HEAD:refs/heads/main');beginGitDelivery(root);
  const env={...process.env,AUTOPILOT_CONFIG:configFile,AUTOPILOT_DATA_DIR:dataDir,CONTENT_ROOT:root,AUTOPILOT_LOCK_FILE:path.join(dataDir,'.autopilot.lock')};
  const cli=(...args)=>{const r=spawnSync(process.execPath,args,{cwd:ENGINE,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);return JSON.parse(r.stdout)};
  const issue=()=>{const run=createRun({dir:dataDir,date:today});setStage(run.runId,'planned',{orderCount:1},{dir:dataDir});fs.writeFileSync(path.join(dataDir,'orders.json'),JSON.stringify({runId:run.runId,date:today,orders:[{slug,kind:'new'}]}));cli('scripts/writing-checkpoint.mjs','record','--slug',slug);return run.runId};
  let deployed=baseHead,html='<html><body>Предыдущая версия</body></html>';
  const server=createServer((req,res)=>{if(req.url.startsWith('/release.json')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:1,revision:deployed,sourceClean:true,builtAt:new Date().toISOString()}));}else{res.setHeader('Content-Type','text/html');res.end(html);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    issue();const refused=cli('scripts/pipeline.mjs','settle','--json');assert.equal(refused.rejected,1);assert.equal(refused.published,0);assert.equal(git('--git-dir',bare,'rev-parse','main'),baseHead);
    const url='https://publication.pravo.gov.ru/document/synthetic-law',statement=`Штраф 500 рублей согласно [закону](${url}).`,excerpt='Штраф составляет 500 рублей. Применяется к тестовой категории.',stamp=new Date().toISOString();
    fs.writeFileSync(file,text+'\n'+statement+'\n');fs.mkdirSync(path.join(dataDir,'claim-evidence'));
    fs.writeFileSync(path.join(dataDir,'claim-evidence',slug+'.json'),JSON.stringify({documents:[{url,status:200,text:excerpt,sha256:createHash('sha256').update(excerpt).digest('hex'),fetchedAt:stamp}],claims:extractClaims(statement).map(c=>({claimHash:claimHash(c.sentence),source:url,excerpt,result:'verified',checkedAt:stamp,rationale:'Сумма и область применения сверены в синтетическом источнике.'}))}));
    const runId=issue(),accepted=cli('scripts/pipeline.mjs','settle','--json');assert.equal(accepted.published,1);assert.equal(accepted.build.ok,true);
    const builtHtml=fs.readFileSync(path.join(root,'dist/article.html'),'utf8');assert.ok(builtHtml.includes(statement));assert.ok(builtHtml.includes('draft: false'));assert.ok(!builtHtml.includes('autopilotHold: true'));
    const delivery=commitGitDelivery({root,dataDir,blog,runId});assert.equal(delivery.deployed,false);assert.equal(git('show',delivery.contentCommit+':src/content/blog/'+slug+'.md'),fs.readFileSync(file,'utf8').trim());
    const count=git('rev-list','--count','HEAD'),state=fs.readFileSync(stateFile),manifest=readRun(runId,{dir:dataDir});assert.equal(manifest.stages.built.corpusSha256,accepted.build.corpusSha256);
    const hook=path.join(bare,'hooks/pre-receive');fs.writeFileSync(hook,'#!/bin/sh\nexit 1\n',{mode:0o755});
    assert.throws(()=>pushGitDelivery({root,targetRef:'refs/heads/main'}),/Git push failed/);assert.equal(readDeliveryJournal(root).push.phase,'pending');assert.equal(git('--git-dir',bare,'rev-parse','main'),baseHead);assert.equal(git('rev-list','--count','HEAD'),count);
    const site=`http://127.0.0.1:${server.address().port}`,pages=[{path:'/article/',requiredText:statement}];
    await assert.rejects(verifyLiveRelease({site,expectedCommit:delivery.metadataCommit,pages}),/Live revision not confirmed/);
    fs.unlinkSync(hook);const recovered=pushGitDelivery({root,targetRef:'refs/heads/main'});assert.equal(recovered.commit,delivery.metadataCommit);assert.equal(recovered.deployed,false);assert.equal(git('rev-list','--count','HEAD'),count);assert.deepEqual(fs.readFileSync(stateFile),state);
    await assert.rejects(verifyLiveRelease({site,expectedCommit:recovered.commit,pages}),/Live revision not confirmed/);
    deployed=recovered.commit;html='<html><body>Чужой материал</body></html>';await assert.rejects(verifyLiveRelease({site,expectedCommit:recovered.commit,pages}),/Expected page content missing/);
    html=builtHtml;const live=await verifyLiveRelease({site,expectedCommit:recovered.commit,pages});assert.equal(live.liveVerified,true);assert.equal(live.pages[0].contentVerified,true);
    assert.equal(pushGitDelivery({root,targetRef:'refs/heads/main'}).commit,recovered.commit);assert.equal(git('rev-list','--count','HEAD'),count);assert.deepEqual(fs.readFileSync(stateFile),state);
    t.diagnostic(JSON.stringify({kind:'aud02-delivery-evidence',runId,baseHead,contentCommit:delivery.contentCommit,metadataCommit:delivery.metadataCommit,buildCorpusSha256:accepted.build.corpusSha256,articleSha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),refused:{rejected:refused.rejected,published:refused.published},after:JSON.parse(state.toString()).counters,live,isolated:true,syntheticLegalSource:true}));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
