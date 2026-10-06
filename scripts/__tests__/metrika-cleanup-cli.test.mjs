import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildScopedPlan, CANDIDATE_REMOTE_IDS, PROTECTED_REMOTE_IDS, COUNTER_ID, isExplicitDeleteSuccess } from '../metrika/remove-obsolete-interactive.mjs';
const cli = fileURLToPath(new URL('../metrika/remove-obsolete-interactive.mjs', import.meta.url));
const backup = { counterId: COUNTER_ID, goals: [
  ...CANDIDATE_REMOTE_IDS.map((id,i) => ({id,type:'action',conditions:[{type:'exact',url:`flagship-test-${i}`}]})),
  ...PROTECTED_REMOTE_IDS.map(id => ({id,type:'automatic',conditions:[]})),
] };
const plan = buildScopedPlan({backup});
const cases = [
  ['success', {success:true}, 200, 68],
  ['false', {success:false}, 200, 0],
  ['false-after-prefix', {success:false}, 200, 2],
  ['empty', {}, 200, 0],
  ['null', null, 200, 0],
  ['boolean', true, 200, 0],
  ['array', [{success:true}], 200, 0],
  ['string-success', {success:'true'}, 200, 0],
  ['adapter-ok-only', {ok:true}, 200, 0],
  ['contradictory', {success:true,ok:false}, 200, 0],
  ['errors', {success:true,errors:[{message:'failed'}]}, 200, 0],
  ['bad-body-status', {success:true,status:500}, 200, 0],
  ['wrong-receipt-id', {success:true,remoteId:999999999}, 200, 2],
  ['invalid-json', 'not JSON', 200, 2],
  ['http-error', {success:true}, 500, 2],
  ['empty-body', '', 200, 2],
  ['read-changed', {success:true}, 200, 2],
  ['read-auto', {success:true}, 200, 2],
  ['read-missing', {success:true}, 200, 2],
  ['read-http-error', {success:true}, 200, 2],
];
for (const [name, body, status, prefix] of cases) test(`actual CLI mocked DELETE: ${name}`, () => {
  const dir=mkdtempSync(join(tmpdir(),'metrika-delete-cli-'));
  try {
    const b=join(dir,'backup.json'), calls=join(dir,'calls.json'), loader=join(dir,'mock.mjs');
    writeFileSync(b,JSON.stringify(backup));
    writeFileSync(loader,`import {readFileSync,writeFileSync} from 'node:fs';\nconst backup=JSON.parse(readFileSync(${JSON.stringify(b)},'utf8'));\nconst calls=[];let deletes=0;\nglobalThis.fetch=async(url,options={})=>{\nif(!String(url).startsWith('https://api-metrika.yandex.net/management/v1/counter/109130279/goal/')) throw Error('unexpected network');\nconst id=Number(String(url).split('/').at(-1));calls.push({id,method:options.method});writeFileSync(${JSON.stringify(calls)},JSON.stringify(calls));\nif(options.method==='GET'){let goal=backup.goals.find(g=>g.id===id); if(${JSON.stringify(name)}.startsWith('read-') && id===${plan.targetIds[prefix]??0}){if(${JSON.stringify(name)}==='read-changed') goal={...goal,conditions:[{type:'exact',url:'changed-event'}]};if(${JSON.stringify(name)}==='read-auto')goal={...goal,goal_source:'auto'};if(${JSON.stringify(name)}==='read-missing')goal=null;if(${JSON.stringify(name)}==='read-http-error')return new Response('{}',{status:500});}return new Response(JSON.stringify({goal}),{status:200});}\nif(options.method!=='DELETE') throw Error('unexpected method');\nconst good=deletes++<${name==='success'?68:prefix};\nconst body=good?JSON.stringify({success:true}):${JSON.stringify(typeof body==='string'?body:JSON.stringify(body))};\nreturn new Response(body,{status:good?200:${status}});};\n`);
    const proc=spawnSync(process.execPath,['--import',loader,cli,'--backup',b,'--execute','--plan-hash',plan.planHash,'--confirm',plan.planHash],{encoding:'utf8',env:{...process.env,METRIKA_OAUTH_TOKEN:'mock-only',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.precomposeunicode',GIT_CONFIG_VALUE_0:'false'}});
    const pos=proc.stdout.lastIndexOf('{\n  "planHash"');
    assert.ok(pos>=0,proc.stderr); const result=JSON.parse(proc.stdout.slice(pos)).result;
    assert.equal(proc.status,name==='success'?0:1,proc.stderr);
    assert.deepEqual(result.completed,plan.targetIds.slice(0,prefix));
    assert.deepEqual(result.remaining,plan.targetIds.slice(prefix));
    assert.equal(result.failed?.remoteId??null,name==='success'?null:plan.targetIds[prefix]);
    const sent=JSON.parse(readFileSync(calls,'utf8'));
    assert.deepEqual(sent.filter(c=>c.method==='DELETE').map(c=>c.id),plan.targetIds.slice(0,name==='success'?68:(name.startsWith('read-')?prefix:prefix+1)));
    assert.equal(result.receipts.length,prefix);
    assert.ok(sent.every(c=>CANDIDATE_REMOTE_IDS.includes(c.id)&&!PROTECTED_REMOTE_IDS.includes(c.id)));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('helper receipt contract rejects contradictions and malformed positive fields',()=>{
  for(const receipt of [{ok:true,success:false},{success:true,deleted:false},{ok:true,success:'true'},{success:true,errors:['failure']},{ok:true,status:500},[ {success:true} ],null,{}]) assert.equal(isExplicitDeleteSuccess(receipt),false);
  for(const receipt of [{ok:true},{success:true},{deleted:true},{ok:true,success:true}]) assert.equal(isExplicitDeleteSuccess(receipt),true);
});

for (const name of ['readonly','wrong-confirm','missing-token','wrong-counter']) test(`actual CLI preflight zero network: ${name}`,()=>{
 const dir=mkdtempSync(join(tmpdir(),'metrika-preflight-'));
 try {
  const b=join(dir,'backup.json'),loader=join(dir,'mock.mjs');
  writeFileSync(b,JSON.stringify(name==='wrong-counter'?{...backup,counterId:1}:backup));
  writeFileSync(loader,"globalThis.fetch=async()=>{console.error('UNEXPECTED_NETWORK');throw Error('no network permitted')};");
  const args=['--import',loader,cli,'--backup',b];
  if(name!=='readonly')args.push('--execute','--plan-hash',plan.planHash,'--confirm',name==='wrong-confirm'?'wrong':plan.planHash);
  const env={...process.env,METRIKA_OAUTH_TOKEN:name==='missing-token'?'':'mock-only',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.precomposeunicode',GIT_CONFIG_VALUE_0:'false'};
  const result=spawnSync(process.execPath,args,{encoding:'utf8',env});
  assert.equal(result.status,name==='readonly'?0:1);assert.ok(!result.stderr.includes('UNEXPECTED_NETWORK'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
