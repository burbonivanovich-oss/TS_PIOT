import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectBackup,verifyDeployment,validateInputs,validatePriorRun,verifyPriorRun,validateApproval,requireFullScope,verifyPostState,runCleanup,RELEASE_URL,REPOSITORY,WORKFLOW} from '../metrika/scoped-cleanup-workflow.mjs';
import {COUNTER_ID,CANDIDATE_REMOTE_IDS,PROTECTED_REMOTE_IDS} from '../metrika/remove-obsolete-interactive.mjs';
const SHA='a'.repeat(40),NOW='2026-10-06T01:00:00.000Z',TOKEN='own-mock-oauth-never-printed';
const input={mode:'plan',deploymentSha:SHA,checkoutSha:SHA,repository:REPOSITORY,ref:'refs/heads/main',event:'workflow_dispatch',runId:'123',planRunId:'',planHash:'',confirm:''};
function goals(){return [...CANDIDATE_REMOTE_IDS.map((id,i)=>({id,type:'action',name:`candidate-${i}`,conditions:[{type:'exact',url:`flagship-${i}`}]})),...PROTECTED_REMOTE_IDS.map(id=>({id,type:'automatic',name:'protected',conditions:[]}))];}
const response=(data,status=200)=>new Response(typeof data==='string'?data:JSON.stringify(data),{status});
function network(rows=goals()) {
 const calls=[];
 return {calls,fetchImpl:async(url,options)=>{calls.push({url,options});assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  if(url===RELEASE_URL){assert.equal(options.headers.Authorization,undefined);return response({version:1,revision:SHA,sourceClean:true,builtAt:NOW});}
  assert.equal(url,`https://api-metrika.yandex.net/management/v1/counter/${COUNTER_ID}/goals`);assert.equal(options.headers.Authorization,`OAuth ${TOKEN}`);return response({goals:rows});
 }};
}
test('real exporter GET contract: own fixed counter, active full backup, no writes',async()=>{
 const net=network();const backup=await collectBackup({token:TOKEN,fetchImpl:net.fetchImpl,now:()=>NOW});assert.equal(backup.counterId,COUNTER_ID);assert.equal(backup.goals.length,83);assert.equal(backup.fetchedAtUTC,NOW);assert.equal(requireFullScope(backup).targetIds.length,68);assert.equal(net.calls.length,1);
});
for(const [name,body,status] of [['HTTP',{},403],['JSON','invalid',200],['null',null,200],['array',[],200],['missing',{},200],['false',{goals:goals(),success:false},200],['string-success',{goals:goals(),success:'true'},200],['errors',{goals:goals(),errors:{}},200],['partial-total',{goals:goals(),total:84},200],['counter',{goals:goals(),counterId:399891},200],['duplicate',{goals:[...goals(),goals()[0]]},200],['missing-id',{goals:[{type:'action'}]},200]])test(`GET failure never becomes empty successful backup: ${name}`,async()=>{
 await assert.rejects(()=>collectBackup({token:TOKEN,fetchImpl:async()=>response(body,status)}));
});
test('token missing performs zero requests',async()=>{let calls=0;await assert.rejects(()=>collectBackup({token:'',fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);});
test('actual readonly path writes complete approval/hash and sanitized artifacts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scoped-plan-'));try{
  const rows=goals();rows[0].name=TOKEN;const net=network(rows);let deletes=0;
  const approval=await runCleanup({input,token:TOKEN,outputDir:dir,fetchImpl:net.fetchImpl,now:()=>NOW,executeRemover:()=>{deletes++;}});
  assert.equal(deletes,0);assert.equal(approval.plan.targetIds.length,68);assert.equal(approval.plan.preserveIds.length,15);
  assert.equal(JSON.parse(readFileSync(join(dir,'status.json'))).writes,0);
  assert.ok(readdirSync(dir).every(f=>!readFileSync(join(dir,f),'utf8').includes(TOKEN)));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
async function approvalFor(){const net=network();const backup=await collectBackup({token:TOKEN,fetchImpl:net.fetchImpl,now:()=>NOW});return {version:1,mode:'plan',repository:REPOSITORY,deploymentSha:SHA,planRunId:'123',createdAtUTC:NOW,backup,plan:requireFullScope(backup)};}
function executeInput(a){return {...input,mode:'execute',runId:'124',planRunId:'123',planHash:a.plan.planHash,confirm:a.plan.planHash};}
test('explicit execute preserves 15, rereads before CLI, captures receipt + postGET',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scoped-execute-'));try{
  const approval=await approvalFor();const rows=goals();const net=network(rows);let calls=0;
  await runCleanup({input:executeInput(approval),approval,token:TOKEN,outputDir:dir,fetchImpl:net.fetchImpl,now:()=>NOW,executeRemover:({planHash,backupFile,token})=>{
   calls++;assert.equal(planHash,approval.plan.planHash);assert.equal(token,TOKEN);assert.equal(JSON.parse(readFileSync(backupFile)).goals.length,83);
   rows.splice(0,68);return {exitCode:0,receipt:{planHash,result:{completed:[...CANDIDATE_REMOTE_IDS],remaining:[],failed:null,receipts:CANDIDATE_REMOTE_IDS.map((remoteId,i)=>({remoteId,event:`flagship-${i}`,receipt:{success:true}}))}}};}});
  assert.equal(calls,1);assert.equal(net.calls.length,4);assert.equal(JSON.parse(readFileSync(join(dir,'status.json'))).status,'confirmed-and-postGET-verified');assert.equal(JSON.parse(readFileSync(join(dir,'post-backup.json'))).goals.length,15);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
for(const name of ['new-event','protected-missing','candidate-auto','sha-mismatch','unclean-deployment','sha-moved-before-delete','no-confirm','expired','scope-inject','malformed-time'])test(`execute boundary rejects before child writes: ${name}`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scoped-block-'));try{
  const a=JSON.parse(JSON.stringify(await approvalFor())),i=executeInput(a),rows=goals();let writes=0;let net=network(rows);
  if(name==='new-event')rows[0].conditions[0].url='flagship-new-event';
  if(name==='protected-missing')rows.pop();
  if(name==='candidate-auto')rows[0].goal_source='auto';
  if(name==='sha-mismatch')net.fetchImpl=async()=>response({version:1,revision:'b'.repeat(40),sourceClean:true});
  if(name==='unclean-deployment')net.fetchImpl=async()=>response({version:1,revision:SHA,sourceClean:false});
  if(name==='sha-moved-before-delete'){const f=net.fetchImpl;let publicReads=0;net.fetchImpl=async(url,options)=>url===RELEASE_URL&&++publicReads===2?response({version:1,revision:'b'.repeat(40),sourceClean:true}):f(url,options);}
  if(name==='no-confirm')i.confirm='';
  if(name==='expired')a.createdAtUTC='2026-10-05T01:00:00.000Z';
  if(name==='scope-inject')a.plan.targetIds=[...a.plan.targetIds.slice(1),999999999];
  if(name==='malformed-time')a.createdAtUTC='2026-02-30T01:00:00.000Z';
  await assert.rejects(()=>runCleanup({input:i,approval:a,token:TOKEN,outputDir:dir,fetchImpl:net.fetchImpl,now:()=>NOW,executeRemover:()=>{writes++;}}));assert.equal(writes,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
for(const name of ['partial','protected-changed','postGET-failure'])test(`execute failure preserves bounded receipt and attempts postGET: ${name}`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scoped-partial-'));try{
  const a=await approvalFor(),rows=goals(),net=network(rows);let operated=false;const f=net.fetchImpl;
  net.fetchImpl=async(...args)=>{if(operated&&name==='postGET-failure')return response({},500);return f(...args);};
  await assert.rejects(()=>runCleanup({input:executeInput(a),approval:a,token:TOKEN,outputDir:dir,fetchImpl:net.fetchImpl,now:()=>NOW,executeRemover:()=>{
   operated=true;rows.splice(0,name==='partial'?2:68);if(name==='protected-changed')rows[0].name='changed';
   return {exitCode:name==='partial'?1:0,receipt:{planHash:a.plan.planHash,result:{completed:CANDIDATE_REMOTE_IDS.slice(0,name==='partial'?2:68),remaining:name==='partial'?CANDIDATE_REMOTE_IDS.slice(2):[],failed:name==='partial'?{remoteId:CANDIDATE_REMOTE_IDS[2],reason:TOKEN}:null,receipts:[]}}};}}));
  assert.ok(readdirSync(dir).includes('receipt.json'));assert.equal(JSON.parse(readFileSync(join(dir,'status.json'))).status,'blocked');assert.ok(!readFileSync(join(dir,'receipt.json'),'utf8').includes(TOKEN));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('provenance binds successful manual main run, same exact SHA and own workflow',async()=>{
 const a=await approvalFor(),i=executeInput(a);const run={id:123,repository:{full_name:REPOSITORY},event:'workflow_dispatch',head_branch:'main',head_sha:SHA,status:'completed',conclusion:'success',path:WORKFLOW};
 validatePriorRun(run,i);
 for(const patch of [{conclusion:'failure'},{head_sha:'b'.repeat(40)},{path:'.github/workflows/metrika-sync-goals.yml'},{event:'push'},{head_branch:'other'},{id:999}])assert.throws(()=>validatePriorRun({...run,...patch},i));
 let calls=0;await verifyPriorRun(i,'mock-github',async(url,options)=>{calls++;assert.equal(url,`https://api.github.com/repos/${REPOSITORY}/actions/runs/123`);assert.equal(options.method,'GET');return response(run);});assert.equal(calls,1);
});
test('fixed inputs reject arbitrary SHA/ref/repository/network-scope/plan execute inputs',()=>{
 validateInputs(input);
 for(const patch of [{repository:'other/repo'},{ref:'refs/heads/test'},{event:'push'},{deploymentSha:'$(anything)'},{mode:'PRUNE'},{planRunId:'123'}])assert.throws(()=>validateInputs({...input,...patch}));
});

test('escaped secret values and credential metadata are redacted in full backup artifacts',async()=>{
 const secret='mock-quoted-"-token';const rows=goals();rows[0].name=secret;rows[0].access_token='unknown-private-value';
 const backup=await collectBackup({token:secret,fetchImpl:async()=>response({goals:rows}),now:()=>NOW});
 const goal=backup.goals.find(g=>g.id===CANDIDATE_REMOTE_IDS[0]);assert.equal(goal.name,'[REDACTED]');assert.equal(goal.access_token,'[REDACTED]');
});

test('postGET absence does not replace explicit valid per-ID receipts',async()=>{
 const a=await approvalFor();const post={...a.backup,goals:a.backup.goals.filter(g=>PROTECTED_REMOTE_IDS.includes(g.id))};
 const result={completed:[...CANDIDATE_REMOTE_IDS],remaining:[],failed:null,receipts:CANDIDATE_REMOTE_IDS.map((remoteId,i)=>({remoteId,event:`flagship-${i}`,receipt:{success:false}}))};
 assert.throws(()=>verifyPostState(a.backup,post,result),/invalid-per-ID-receipt/);
});
