import test from 'node:test';
import assert from 'node:assert/strict';
import { queryCount, topRows, topScope } from '../wordstat/source-contract.mjs';
test('counts preserve measured zero and reject missing, partial, unsafe and negative evidence', () => {
  for (const x of [0, '0', 42, '42']) assert.equal(queryCount(x), Number(x));
  for (const x of [null, undefined, '', '42bad', '1.5', '01', -1, 1.5, Infinity, '9007199254740992']) assert.throws(() => queryCount(x));
});
test('malformed top response cannot become empty or partially valid demand', () => {
  for (const x of [{}, {results: null}, {results:[{phrase:'x'}]}, {results:[{phrase:' ',count:'0'}]}, {results:[{phrase:'ok',count:'12'},{phrase:'bad',count:'abc'}]}]) assert.throws(() => topRows(x));
  assert.deepEqual(topRows({results:[]}), []);
  assert.deepEqual(topRows({results:[{phrase:' этрн ',count:'12'}]}), [{phrase:'этрн',count:12}]);
});
test('request scope records region and rolling provider window without inventing exact dates or completeness', () => {
  const s=topScope(225); assert.equal(s.region,'225'); assert.equal(s.devices,'all'); assert.equal(s.window.exactDatesVerified,false); assert.equal(s.complete,false); assert.equal(s.window.kind,'provider_last_30_days');
  for(const x of [0,-1,'all','225bad']) assert.throws(() => topScope(x));
});

import {demandSnapshot,collectSnapshots} from '../wordstat/export-autopilot-demand.mjs';
import {rankByDemand} from '../../autopilot/scripts/lib/demand.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const capture={seed:'этрн',fetchedAt:'2026-10-04T10:00:00Z',scope:topScope(225),count:1,phrases:[{phrase:'этрн для перевозчиков',count:8326}]};
const settings={demandMaxBoost:30,demandMaxAgeDays:30,demandRegion:225};
const topics=[{score:50,keywords:['этрн для перевозчиков']}];
test('scoped discovery feeds ranking without fabricating calendar dates',()=>{
 const snapshot=demandSnapshot(capture),now=Date.parse('2026-10-04T12:00:00Z');
 const [ranked]=rankByDemand(topics,{schemaVersion:1,snapshots:[snapshot]},settings,now);
 assert.equal(ranked.demand.count,8326);assert.equal(ranked.demand.periodStart,null);assert.equal(ranked.demand.window.exactDatesVerified,false);assert.ok(ranked.priorityScore>50);
 for(const bad of [{...snapshot,capturedAt:'2026-12-04T10:00:00Z'},{...snapshot,capturedAt:'2026-08-04T10:00:00Z'},{...snapshot,devices:'phone'},{...snapshot,region:'213'},{...snapshot,window:{kind:'invented'}},{...snapshot,endpoint:'https://evil.test'}])assert.equal(rankByDemand(topics,{schemaVersion:1,snapshots:[bad]},settings,now)[0].demand.status,'not_collected');
});
test('export excludes unscoped legacy data and foreign namespace; malformed counts remain unknown',()=>{
 for(const bad of [{...capture,scope:undefined},{...capture,count:2},{...capture,phrases:[{phrase:'x',count:'bad'}]},{...capture,fetchedAt:'2026-02-31T10:00:00Z'}])assert.throws(()=>demandSnapshot(bad));
 const root=mkdtempSync(path.join(os.tmpdir(),'wordstat-export-'));
 try {mkdirSync(path.join(root,'2026-10-04'));mkdirSync(path.join(root,'kontur'));writeFileSync(path.join(root,'2026-10-04','ok.json'),JSON.stringify(capture));writeFileSync(path.join(root,'2026-10-04','old.json'),JSON.stringify({...capture,scope:undefined}));writeFileSync(path.join(root,'kontur','foreign.json'),JSON.stringify(capture));const r=collectSnapshots(root);assert.equal(r.snapshots.length,1);assert.equal(r.rejected,1);}finally{rmSync(root,{recursive:true,force:true});}
});
import {copyFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
test('actual exporter CLI preserves dated evidence and replaces API snapshots idempotently',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'demand-cli-'));
 try {
  for(const d of ['scripts/wordstat','autopilot/data','src/data/wordstat/discoveries/2026-10-04'])mkdirSync(path.join(root,d),{recursive:true});
  for(const f of ['export-autopilot-demand.mjs','source-contract.mjs'])copyFileSync(new URL('../wordstat/'+f,import.meta.url),path.join(root,'scripts/wordstat',f));
  const manual={capturedAt:'2026-10-03T12:00:00Z',periodStart:'2026-09-02',periodEnd:'2026-10-01',rows:[]};
  const output=path.join(root,'autopilot/data/demand.json');writeFileSync(output,JSON.stringify({schemaVersion:1,snapshots:[manual,{source:'Yandex Cloud Wordstat GetTop',rows:[{phrase:'obsolete',count:999}]}]}));
  writeFileSync(path.join(root,'src/data/wordstat/discoveries/2026-10-04/etrn.json'),JSON.stringify(capture));
  for(let i=0;i<2;i++) {const run=spawnSync(process.execPath,[path.join(root,'scripts/wordstat/export-autopilot-demand.mjs')],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const out=JSON.parse(readFileSync(output));assert.equal(out.snapshots.length,2);assert.deepEqual(out.snapshots[0],manual);assert.equal(out.snapshots[1].rows[0].count,8326);assert.equal(out.snapshots[1].periodEnd,null);}
 }finally{rmSync(root,{recursive:true,force:true});}
});
