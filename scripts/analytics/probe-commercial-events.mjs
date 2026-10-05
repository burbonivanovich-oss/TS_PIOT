#!/usr/bin/env node
import { mkdirSync,writeFileSync,existsSync,realpathSync,renameSync,rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles } from '../../autopilot/scripts/lib/content.mjs';
import { collectCommercialEventProbe } from './lib/commercial-event-probe.mjs';
import { COUNTER_ID,collectionWindow } from './lib/commercial-metrika.mjs';

const root=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
const now=new Date(), days=Number(process.env.COMMERCIAL_DAYS||'1');
try {
  const output=process.env.COMMERCIAL_PROBE_OUTPUT;
  if (!output || !path.isAbsolute(output)) throw Error('Probe output must be an absolute path outside the checkout');
  let ancestor=path.resolve(output);
  while (!existsSync(ancestor)) ancestor=path.dirname(ancestor);
  const physical=path.resolve(realpathSync(ancestor),path.relative(ancestor,path.resolve(output))), logical=path.resolve(output);
  if ([physical,logical].some(p=>p===root || p.startsWith(root+path.sep))) throw Error('Probe output must stay outside the checkout');
  let result;
  try {
    const revision=execFileSync('git',['-c','core.precomposeunicode=false','rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
    const slugs=loadArticles({includeDrafts:false}).filter(a=>a.pubDate && a.pubDate<=now).map(a=>a.slug);
    if (!slugs.length) throw Error('source_articles_unavailable');
    result=await collectCommercialEventProbe({token:process.env.METRIKA_OAUTH_TOKEN,slugs,sourceRevision:revision,now,days});
  } catch(error) {
    result={schemaVersion:1,status:'error',counterId:COUNTER_ID,period:collectionWindow(now,days),asOf:now.toISOString(),
      reason:/^(token_unavailable|goal_missing_or_ambiguous|source_articles_unavailable|api_http_\d{3})$/.test(error.message)?error.message:'collection_failed'};
  }
  mkdirSync(path.dirname(output),{recursive:true}); const temp=`${output}.${randomUUID()}.tmp`;
  try {writeFileSync(temp,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(temp,output);} finally {rmSync(temp,{force:true});}
  // No rows, URLs, parameters or raw API errors in public Actions logs.
  console.log(JSON.stringify({status:result.status,counterId:COUNTER_ID,reports:Object.fromEntries(Object.entries(result.reports||{}).map(([k,r])=>[k,{status:r.status,retainedRows:r.rows?.length??null,reason:r.reason??null}]))}));
  if (result.status!=='ok') process.exitCode=1;
} catch {console.error('Commercial event probe failed before export; check output path and collection window');process.exitCode=1;}
