#!/usr/bin/env node
// Record exact rendered versions; this never releases content or changes quotas.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadConfig,assertContentRoot} from './lib/config.mjs';
import {readJson,writeJson,isMain,parseArgs} from './lib/content.mjs';
import {acquireLock,releaseLock} from './lib/lock.mjs';
import {verifyLiveRelease} from './lib/live-release.mjs';
import {parseIsoDate} from './lib/dates.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(root,args)=>{const r=spawnSync('git',args,{cwd:root,encoding:null,maxBuffer:10*1024*1024});if(r.status!==0)throw Error('Git publication identity lookup failed');return r.stdout;};

export function publicationInputs({root,dataDir,month,dist=path.join(root,'dist'),to=new Date().toISOString().slice(0,10)}) {
 if(git(root,['status','--porcelain','--untracked-files=no']).toString().trim())throw Error('Tracked checkout changed since build');
 const revision=git(root,['rev-parse','HEAD']).toString().trim();const build=readJson(path.join(dist,'release.json'),null);
 if(build?.version!==1||build.sourceClean!==true||build.revision!==revision)throw Error('Build receipt does not match clean current HEAD');
 const ledger=readJson(path.join(dataDir,'publish-log.json'),{days:{}}),latest=new Map();
 for(const [date,slugs] of Object.entries(ledger.days||{}).sort()){
  if(!parseIsoDate(date).ok||!Array.isArray(slugs))throw Error('Invalid publication ledger');
  if(!date.startsWith(month)||date>to)continue;
  for(const slug of new Set(slugs)){
  if(typeof slug!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(slug))throw Error('Unsafe publication slug');latest.set(slug,{date,slug,kind:ledger.kinds?.[date]?.[slug]??'unknown'});
 }
 }
 const dir=path.join(dataDir,'runs');const runs=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>readJson(path.join(dir,f),null)).filter(Boolean):[];
 const items=[],pages=[],skipped=[];
 for(const event of latest.values()) {
  const matches=runs.filter(r=>r.date===event.date&&r.stages?.gated?.results?.some(x=>x.slug===event.slug&&x.status==='published')&&/^[a-f0-9]{40,64}$/.test(r.stages?.committed?.commit||''));
  if(matches.length!==1){skipped.push({...event,reason:'release-manifest-missing-or-ambiguous'});continue;}
  const releaseCommit=matches[0].stages.committed.commit;const files=['md','mdx'].map(ext=>`src/content/blog/${event.slug}.${ext}`).filter(f=>fs.existsSync(path.join(root,f)));
  if(files.length!==1){skipped.push({...event,reason:'source-file-missing-or-ambiguous'});continue;}
  const source=fs.readFileSync(path.join(root,files[0]));let releaseSource;
  try{releaseSource=git(root,['show',`${releaseCommit}:${files[0]}`]);}catch{skipped.push({...event,reason:'release-source-unavailable'});continue;}
  if(!source.equals(releaseSource)){skipped.push({...event,reason:'current-source-differs-from-released-version'});continue;}
  const rendered=path.join(dist,'blog',event.slug,'index.html');if(!fs.existsSync(rendered)){skipped.push({...event,reason:'rendered-page-missing'});continue;}
  const expectedHtmlSha256=hash(fs.readFileSync(rendered));items.push({...event,releaseCommit,sourceSha256:hash(source),expectedHtmlSha256});pages.push({path:`/blog/${event.slug}/`,requiredText:'<article',expectedHtmlSha256});
 }
 return{revision,build,items,pages,skipped,ledgerSha256:hash(fs.readFileSync(path.join(dataDir,'publish-log.json')))};
}

export async function verifyPublications({site,now=new Date()}={}) {
 const cfg=loadConfig();assertContentRoot(cfg);const root=cfg.resolved.contentRoot,dataDir=cfg.resolved.dataDir;
 acquireLock({cmd:'verify-publications'});
 try{
  const inputs=publicationInputs({root,dataDir,month:now.toISOString().slice(0,7)});
  const proof=await verifyLiveRelease({site,expectedCommit:inputs.revision,pages:inputs.pages,now:new Date()});
  if(git(root,['rev-parse','HEAD']).toString().trim()!==inputs.revision||hash(fs.readFileSync(path.join(dataDir,'publish-log.json')))!==inputs.ledgerSha256)throw Error('Publication inputs changed during verification');
  for(const item of inputs.items){const files=['md','mdx'].map(ext=>path.join(root,'src/content/blog',`${item.slug}.${ext}`)).filter(f=>fs.existsSync(f));if(files.length!==1||hash(fs.readFileSync(files[0]))!==item.sourceSha256||hash(fs.readFileSync(path.join(root,'dist/blog',item.slug,'index.html')))!==item.expectedHtmlSha256)throw Error('Verified bytes changed before recording');}
  const file=path.join(dataDir,'live-verifications.json'),previous=readJson(file,{version:1,checks:[]});
  const check={...proof,items:inputs.items,ledgerSha256:inputs.ledgerSha256};
  writeJson(file,{version:1,checks:[...(previous.checks||[]).filter(x=>x.revision!==proof.revision),check]});
  return{...proof,recorded:inputs.items.length,skipped:inputs.skipped,file};
 }finally{releaseLock();}
}
if(isMain(import.meta.url)){
 try{const args=parseArgs(process.argv.slice(2));console.log(JSON.stringify(await verifyPublications({site:args.site}),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
