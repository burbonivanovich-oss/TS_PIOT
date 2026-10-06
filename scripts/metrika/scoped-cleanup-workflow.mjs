#!/usr/bin/env node
// Manual Actions adapter: fixed own counter, fixed public release, no PRUNE.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { COUNTER_ID, CANDIDATE_REMOTE_IDS, PROTECTED_REMOTE_IDS, buildScopedPlan, backupHash, isExplicitDeleteSuccess } from './remove-obsolete-interactive.mjs';
import { isObsoleteInteractiveGoal } from '../../src/utils/obsolete-interactive-goals.mjs';

export const REPOSITORY = 'burbonivanovich-oss/TS_PIOT';
export const WORKFLOW = '.github/workflows/metrika-scoped-cleanup.yml';
export const RELEASE_URL = 'https://etiketka-media.ru/release.json';
const API = 'https://api-metrika.yandex.net/management/v1';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REMOVED = ['flagship-ts-piot-completed','quiz-ts-piot-completed','calc-usn-nds-used','calc-shtraf-markirovka-used','roi-ip-ooo-used','selector-task','selector-result'];
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function validateInputs(input) {
  if (!['plan','execute'].includes(input.mode)) throw Error('invalid-mode');
  if (input.repository !== REPOSITORY || input.ref !== 'refs/heads/main' || input.event !== 'workflow_dispatch') throw Error('manual-own-main-only');
  if (!/^[a-f0-9]{40}$/.test(input.deploymentSha || '') || input.checkoutSha !== input.deploymentSha) throw Error('deployment-checkout-sha-mismatch');
  if (input.mode === 'execute') {
    if (!/^[1-9][0-9]{0,19}$/.test(input.planRunId || '') || !/^[a-f0-9]{64}$/.test(input.planHash || '') || input.confirm !== input.planHash) throw Error('exact-plan-confirmation-required');
  } else if (input.planRunId || input.planHash || input.confirm) throw Error('plan-mode-does-not-accept-execution-inputs');
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function redact(value, tokens) {
  if (typeof value === 'string') return tokens.filter(Boolean).reduce((s,t)=>s.split(t).join('[REDACTED]'),value);
  if (Array.isArray(value)) return value.map(v=>redact(v,tokens));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[
    redact(k,tokens), /^(authorization|oauth|access_token|refresh_token|secret)$/i.test(k) ? '[REDACTED]' : redact(v,tokens),
  ]));
  return value;
}
async function jsonGet(url, token, fetchImpl) {
  const res = await fetchImpl(url, { method:'GET', redirect:'error', signal:AbortSignal.timeout(20000), headers:token ? {Authorization:`OAuth ${token}`} : {} });
  if (!res.ok) throw Error(`GET-failed-http-${res.status}`); // No raw API body/credential in logs.
  let data;
  try { data = JSON.parse(await res.text()); } catch { throw Error('GET-invalid-json'); }
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('GET-invalid-object');
  return data;
}
export async function collectBackup({token,fetchImpl=fetch,now=()=>new Date().toISOString()}) {
  if (!token) throw Error('own-token-unavailable');
  const data = await jsonGet(`${API}/counter/${COUNTER_ID}/goals`,token,fetchImpl);
  if (!Array.isArray(data.goals) || (data.success !== undefined && data.success !== true) || (data.errors !== undefined && (!Array.isArray(data.errors) || data.errors.length)) || (data.total !== undefined && data.total !== data.goals.length) || (data.counterId !== undefined && data.counterId !== COUNTER_ID)) throw Error('GET-incomplete-or-wrong-counter');
  const ids = new Set();
  for(const g of data.goals) {
    if (!g || !Number.isSafeInteger(g.id) || g.id < 1 || typeof g.type !== 'string' || !g.type || ids.has(g.id)) throw Error('GET-invalid-or-duplicate-goal');
    if(g.counterId !== undefined && g.counterId !== COUNTER_ID)throw Error('GET-wrong-goal-counter');
    ids.add(g.id);
  }
  return {counterId:COUNTER_ID,fetchedAtUTC:now(),goals:stable(redact(data.goals,[token])).sort((a,b)=>a.id-b.id)};
}
export async function verifyDeployment(input,fetchImpl=fetch) {
  const live = await jsonGet(RELEASE_URL,'',fetchImpl);
  if (live.revision !== input.deploymentSha || live.sourceClean !== true || live.version !== 1) throw Error('public-deployment-not-exact-clean-sha');
  return {revision:live.revision,sourceClean:live.sourceClean,builtAt:live.builtAt};
}
export function requireFullScope(backup) {
  const plan = buildScopedPlan({backup});
  const sort = list => [...list].sort((a,b)=>a-b);
  if (!equal(sort(plan.targetIds),sort(CANDIDATE_REMOTE_IDS)) || plan.invalid.length || plan.unavailableIds.length || !PROTECTED_REMOTE_IDS.every(id=>plan.preserveIds.includes(id))) throw Error('full-68-remove-15-preserve-required');
  return plan;
}
export function validatePriorRun(run,input) {
  if (String(run.id) !== input.planRunId || run.repository?.full_name !== REPOSITORY || run.event !== 'workflow_dispatch' || run.head_branch !== 'main' || run.head_sha !== input.deploymentSha || run.status !== 'completed' || run.conclusion !== 'success' || ![WORKFLOW,WORKFLOW+'@refs/heads/main'].includes(run.path)) throw Error('approved-plan-run-provenance-mismatch');
}
export async function verifyPriorRun(input,githubToken,fetchImpl=fetch) {
  if(!githubToken)throw Error('actions-read-token-unavailable');
  const res=await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/actions/runs/${input.planRunId}`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${githubToken}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!res.ok)throw Error(`plan-provenance-http-${res.status}`);
  let run;try{run=JSON.parse(await res.text());}catch{throw Error('plan-provenance-invalid-json');}
  validatePriorRun(run,input);
}
export function validateApproval(approval,input,now=Date.now()) {
  if (!approval || approval.version !== 1 || approval.mode !== 'plan' || approval.repository !== REPOSITORY || approval.deploymentSha !== input.deploymentSha || approval.planRunId !== input.planRunId) throw Error('approval-metadata-mismatch');
  const time=Date.parse(approval.createdAtUTC);
  if(typeof approval.createdAtUTC !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approval.createdAtUTC) || !Number.isFinite(time) || new Date(time).toISOString()!==approval.createdAtUTC)throw Error('approval-invalid-UTC-time');
  if(!Number.isFinite(time)||time>now+60000||now-time>6*60*60*1000)throw Error('approval-expired-or-invalid-time');
  const plan=requireFullScope(approval.backup);
  if(plan.planHash!==input.planHash || !equal(plan,approval.plan))throw Error('approval-plan-hash-or-scope-mismatch');
  return plan;
}
export function verifyPostState(before,post,result) {
  const byId=new Map(post.goals.map(g=>[g.id,g]));
  const keep=before.goals.filter(g=>!CANDIDATE_REMOTE_IDS.includes(g.id));
  if(keep.some(g=>!equal(stable(g),stable(byId.get(g.id)))))throw Error('postGET-preserved-goal-missing-or-changed');
  if(!result || result.failed || !equal(result.completed,CANDIDATE_REMOTE_IDS) || result.remaining?.length || result.receipts?.length!==68)throw Error('delete-not-fully-confirmed');
  const targets=requireFullScope(before).targets;
  if(result.receipts.some((r,i)=>r.remoteId!==targets[i].remoteId || r.event!==targets[i].event || !isExplicitDeleteSuccess(r.receipt)))throw Error('invalid-per-ID-receipt');
  if(CANDIDATE_REMOTE_IDS.some(id=>byId.has(id)))throw Error('postGET-candidate-still-present');
}
export function invokeRemover({backupFile,planHash,token}) {
  const proc=spawnSync(process.execPath,[join(ROOT,'scripts/metrika/remove-obsolete-interactive.mjs'),'--backup',backupFile,'--execute','--plan-hash',planHash,'--confirm',planHash],{encoding:'utf8',timeout:10*60*1000,maxBuffer:4*1024*1024,env:{...process.env,METRIKA_OAUTH_TOKEN:token,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.precomposeunicode',GIT_CONFIG_VALUE_0:'false'}});
  const stdout=String(proc.stdout||'').split(token).join('[REDACTED]');
  let receipt=null;try{receipt=JSON.parse(stdout.slice(stdout.lastIndexOf('{\n  "planHash"')));}catch{}
  // Do not serialize raw subprocess stderr/API bodies; failure is bounded metadata.
  return {exitCode:proc.status,signal:proc.signal||null,error:proc.error?.code||null,receipt};
}
export async function runCleanup({input,token,outputDir,approval,fetchImpl=fetch,executeRemover=invokeRemover,now=()=>new Date().toISOString()}) {
  validateInputs(input);mkdirSync(outputDir,{recursive:true});
  const save=(file,data)=>writeFileSync(join(outputDir,file),JSON.stringify(redact(data,[token]),null,2)+'\n');
  try {
    const live=await verifyDeployment(input,fetchImpl);save('deployment.json',live);
    const backup=await collectBackup({token,fetchImpl,now});save('backup.json',backup);
    const plan=requireFullScope(backup);save('plan.json',plan);
    if(input.mode==='plan') {
      const proposal={version:1,mode:'plan',repository:REPOSITORY,deploymentSha:input.deploymentSha,planRunId:input.runId,createdAtUTC:now(),backup,plan};
      save('approval.json',proposal);save('status.json',{status:'readonly-plan',writes:0,planHash:plan.planHash,candidates:68,protected:15});return proposal;
    }
    validateApproval(approval,input,Date.parse(now()));
    if(backupHash(backup)!==backupHash(approval.backup)||plan.planHash!==input.planHash)throw Error('fresh-backup-differs-reapproval-required');
    // Recheck public deployment immediately before child DELETE.
    await verifyDeployment(input,fetchImpl);
    let operation;
    try {
      operation=await executeRemover({backupFile:join(outputDir,'backup.json'),planHash:input.planHash,token});save('receipt.json',operation);
    } finally {
      const post=await collectBackup({token,fetchImpl,now});save('post-backup.json',post);
    }
    const post=JSON.parse(readFileSync(join(outputDir,'post-backup.json'),'utf8'));
    if(operation.exitCode!==0 || operation.receipt?.planHash!==input.planHash)throw Error('remover-failed-or-unparseable-receipt');
    verifyPostState(backup,post,operation.receipt.result);
    save('status.json',{status:'confirmed-and-postGET-verified',completed:68,preserved:15,planHash:input.planHash});return operation;
  } catch(error) {
    save('status.json',{status:'blocked',reason:String(error.message||error).split(token||'\0').join('[REDACTED]')});throw error;
  }
}
function checkPrevention() {
  const config=JSON.parse(readFileSync(join(ROOT,'src/data/metrika/goals.json'),'utf8'));
  if(config.counterId!==COUNTER_ID || REMOVED.some(id=>config.goals.some(g=>g.id===id)) || REMOVED.some(id=>!isObsoleteInteractiveGoal(id)) || isObsoleteInteractiveGoal('lead-ts-piot-provider'))throw Error('deployed-source-prevention-missing');
}
async function main() {
  const input={mode:process.env.CLEANUP_MODE,deploymentSha:process.env.DEPLOYMENT_SHA,planRunId:process.env.PLAN_RUN_ID||'',planHash:process.env.PLAN_HASH||'',confirm:process.env.CONFIRM||'',repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,event:process.env.GITHUB_EVENT_NAME,checkoutSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID};
  validateInputs(input);
  const actual=execFileSync('git',['-c','core.precomposeunicode=false','rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  if(actual!==input.deploymentSha)throw Error('actual-checkout-sha-mismatch');checkPrevention();
  if(process.argv[2]==='validate') {if(input.mode==='execute')await verifyPriorRun(input,process.env.GITHUB_TOKEN);return;}
  if(process.argv[2]!=='run')throw Error('fixed-command-required');
  if(!process.env.RUNNER_TEMP)throw Error('runner-temp-required');
  const outputDir=join(resolve(process.env.RUNNER_TEMP),'metrika-scoped-cleanup');
  const approval=input.mode==='execute'?JSON.parse(readFileSync(join(resolve(process.env.RUNNER_TEMP),'metrika-scoped-approval/approval.json'),'utf8')):null;
  await runCleanup({input,token:process.env.METRIKA_OAUTH_TOKEN,outputDir,approval});
  console.log('Scoped cleanup artifacts saved; inspect status.json before any next action.');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Scoped cleanup blocked; inspect sanitized artifacts.');process.exitCode=1;});
