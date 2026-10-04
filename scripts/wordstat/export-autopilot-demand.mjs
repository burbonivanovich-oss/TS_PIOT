#!/usr/bin/env node
import {readdirSync,readFileSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {topRows,topScope} from './source-contract.mjs';
export function demandSnapshot(record) {
  const scope=record?.scope, expected=topScope(scope?.region);
  for(const k of ['schemaVersion','source','endpoint','region','devices','match','complete']) if(scope[k]!==expected[k]) throw new Error('Unverified Wordstat scope');
  if(scope.window?.kind!==expected.window.kind || scope.window.exactDatesVerified!==false) throw new Error('Unverified Wordstat window');
  if(typeof record.seed!=='string' || !record.seed.trim() || typeof record.fetchedAt!=='string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.fetchedAt) || (!Number.isFinite(Date.parse(record.fetchedAt)) || new Date(record.fetchedAt).toISOString().slice(0,10)!==record.fetchedAt.slice(0,10))) throw new Error('Unverified Wordstat capture');
  const rows=topRows({results:record.phrases});
  if(record.count!==rows.length) throw new Error('Wordstat row count mismatch');
  const url=new URL('https://wordstat.yandex.ru/');url.searchParams.set('region',scope.region);url.searchParams.set('view','table');url.searchParams.set('words',record.seed);
  return {...expected,capturedAt:record.fetchedAt,url:url.href,periodStart:null,periodEnd:null,rows};
}
export function collectSnapshots(root) {
  const snapshots=[];let rejected=0;
  // Only this project's dated discovery directories; no Kontur namespace.
  for(const e of readdirSync(root,{withFileTypes:true})) {
    if(!e.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(e.name))continue;
    const dir=path.join(root,e.name);
    for(const f of readdirSync(dir,{withFileTypes:true})) {
      if(!f.isFile() || !f.name.endsWith('.json'))continue;
      try {snapshots.push(demandSnapshot(JSON.parse(readFileSync(path.join(dir,f.name),'utf8'))));}catch{rejected++;}
    }
  }
  return {snapshots,rejected};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
  const output=path.join(root,'autopilot/data/demand.json');
  const old=JSON.parse(readFileSync(output,'utf8'));
  if(old.schemaVersion!==1 || !Array.isArray(old.snapshots))throw new Error('Invalid existing demand');
  const collected=collectSnapshots(path.join(root,'src/data/wordstat/discoveries'));
  // Keep dated browser evidence; API evidence is replaced by its source files.
  const next={schemaVersion:1,snapshots:[...old.snapshots.filter(s=>s.source!=='Yandex Cloud Wordstat GetTop'),...collected.snapshots]};
  const temp=output+'.'+randomUUID()+'.tmp';
  try {writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});renameSync(temp,output);}finally{rmSync(temp,{force:true});}
  console.log(`Demand export: ${collected.snapshots.length} scoped snapshots; ${collected.rejected} legacy/invalid records excluded`);
}
