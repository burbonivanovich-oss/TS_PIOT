import {test} from 'node:test';import assert from 'node:assert/strict';
import {reviewTraffic} from './factual-traffic.mjs';import {buildFactualRegister} from './factual-register.mjs';
const now=new Date('2026-10-07T12:00:00Z');
const snapshot={counterId:'109130279',fetchedAt:'2026-10-05T10:00:00Z',days:28,coverage:{complete:true,sampled:false},byPage:{'/blog/a/':{pageviews:10,users:8},'/blog/a':{pageviews:2,users:2}}};
test('dated complete traffic combines path views, preserves provenance and does not add users',()=>{
 const r=reviewTraffic({snapshot,now});assert.equal(r.metadata.status,'usable-dated-snapshot');assert.deepEqual(r.metadata.period,{date1:'2026-09-07',date2:'2026-10-05',inclusiveDays:29,derivation:'legacy collector subtracts days; API date bounds inclusive'});assert.equal(r.trafficFor('a').pageviews,12);assert.equal(r.trafficFor('a').users,undefined);assert.equal(r.trafficFor('absent').pageviews,0);assert.equal(r.trafficFor('absent').status,'zero-in-complete-report');
});
test('stale future wrong-counter partial sampled and invalid-period snapshots are unknown, not zero',()=>{
 for(const change of [{fetchedAt:'2026-09-01'}, {fetchedAt:'2026-10-08'}, {counterId:'399891'}, {coverage:{complete:false,sampled:false}}, {coverage:{complete:true,sampled:true}}, {period:{date1:'2026-02-30',date2:'2026-10-05'}}, {period:{date1:'2026-10-05',date2:'2026-10-06'}}, {days:undefined}]) {const r=reviewTraffic({snapshot:{...snapshot,...change},now});assert.equal(r.metadata.status,'unavailable',JSON.stringify(change));assert.equal(r.trafficFor('a'),null);}
});
test('missing or malformed view metric stays unknown; explicit period is retained',()=>{
 const r=reviewTraffic({snapshot:{...snapshot,period:{date1:'2026-09-08',date2:'2026-10-05'},byPage:{'/blog/a/':{pageviews:null}}},now});assert.equal(r.trafficFor('a').pageviews,null);assert.equal(r.trafficFor('a').status,'unknown-invalid-metric');assert.equal(r.metadata.period.date1,'2026-09-08');assert.equal(reviewTraffic({now}).trafficFor('a'),null);
});
test('review urgency precedes views; measured views rank within unresolved review tier',()=>{
 const articles=[{slug:'a',body:'Штраф 500 рублей.'},{slug:'b',body:'Штраф 900 рублей.'},{slug:'unknown',body:'Штраф 800 рублей.'},{slug:'neutral',body:'Нейтральный текст.'}];
 const r=buildFactualRegister({articles,now,evidenceFor:()=>null,sourceFor:a=>a.body,trafficFor:slug=>slug==='unknown'?null:{pageviews:slug==='b'?100:slug==='neutral'?5000:0},trafficEvidence:{status:'dated'}});
 assert.deepEqual(r.articles.map(a=>a.slug),['b','a','unknown','neutral']);assert.equal(r.reviewPriority.trafficEvidence.status,'dated');
});
test('a confirmed contradiction outranks a more visited article awaiting verification',async()=>{
 const {createHash}=await import('node:crypto');const {claimHash}=await import('./claim-evidence.mjs');const statement='Штраф 500 рублей.',url='https://publication.pravo.gov.ru/document/test',text='Штраф составляет 900 рублей.';
 const correction={version:1,slug:'error',documents:[{url,text,status:200,fetchedAt:now.toISOString(),sha256:createHash('sha256').update(text).digest('hex')}],findings:[{statement,claimHash:claimHash(statement),source:url,result:'contradicted',excerpt:text,checkedAt:now.toISOString(),rationale:'В синтетической норме другой штраф.'}]};
 const r=buildFactualRegister({articles:[{slug:'popular',body:statement},{slug:'error',body:statement}],now,evidenceFor:()=>null,correctionsFor:slug=>slug==='error'?correction:null,sourceFor:a=>a.body,trafficFor:slug=>({pageviews:slug==='popular'?1000:0})});assert.equal(r.articles[0].slug,'error');assert.equal(r.articles[0].status,'confirmed-error');
});
