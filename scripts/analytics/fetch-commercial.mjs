#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from '../../autopilot/scripts/lib/content.mjs';
import { collectCommercialMetrika, collectionWindow, COUNTER_ID } from './lib/commercial-metrika.mjs';

if (isMain(import.meta.url)) {
  const now=new Date(), days=Number(process.env.COMMERCIAL_DAYS || '7');
  const output=process.env.COMMERCIAL_OUTPUT;
  try {
    if(!output || !path.isAbsolute(output)) throw new Error('COMMERCIAL_OUTPUT must be an explicit absolute path outside the checkout');
    const root=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
    let ancestor=path.resolve(output);
    while(!existsSync(ancestor)) ancestor=path.dirname(ancestor);
    const physical=path.resolve(realpathSync(ancestor),path.relative(ancestor,path.resolve(output)));
    const logical=path.resolve(output);
    if(logical===root || logical.startsWith(root+path.sep) || physical===root || physical.startsWith(root+path.sep)) throw new Error('Commercial output must stay outside the checkout');
    let result;
    try { result=await collectCommercialMetrika({token:process.env.METRIKA_OAUTH_TOKEN,now,days}); }
    catch(error) { const msg=String(error.message); result={schemaVersion:1,status:'error',counterId:COUNTER_ID,period:collectionWindow(now,days),asOf:now.toISOString(),fetchedAt:new Date().toISOString(),reason:msg==='METRIKA_OAUTH_TOKEN is absent'?'token_unavailable':/^Metrika API HTTP \d{3}$/.test(msg)?msg:'collection_failed'}; }
    mkdirSync(path.dirname(output),{recursive:true});
    const temp=`${output}.${randomUUID()}.tmp`;
    try {writeFileSync(temp,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(temp,output);} finally {rmSync(temp,{force:true});}
    console.log(`Commercial collection: ${result.status}; counter ${COUNTER_ID}; no forms or partner mutations`);
    if(result.status!=='ok') process.exitCode=1;
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
