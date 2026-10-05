import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROBE_DIMENSIONS,eventProbeRequest,readPagedProbe,sanitizeProbe,collectCommercialEventProbe } from '../analytics/lib/commercial-event-probe.mjs';
const period={from:'2026-10-05',to:'2026-10-05',timeZone:'UTC'}, asOf='2026-10-05T23:00:00.000Z';
const slug='2026-05-03-etrn-2026',hash=createHash('sha256').update(slug).digest('hex');
const goals=[{event:'cpa-visible',goalId:100},{event:'cpa-click',goalId:101}];
const row=(dimensions,events=2)=>({dimensions:dimensions.map(d=>typeof d==='string'?{name:d}:d),metrics:[events]});
function body(request,data,totalRows=data.length) {
  return {query:{timezone:'+00:00',date1:period.from,date2:period.to,filters:request.filters,dimensions:PROBE_DIMENSIONS[request.kind],metrics:['ym:ep:eventsNumber'],limit:request.limit,offset:request.offset,sort:PROBE_DIMENSIONS[request.kind]},
    sampled:false,sample_share:1,total_rows_rounded:false,contains_sensitive_data:false,data_lag:0,total_rows:totalRows,totals:[10],data};
}
test('probe uses event-time cutoff and event counts, without URL queries or visitor aliases',()=>{
  const r=eventProbeRequest('pages',period,asOf);const u=new URL(r.url);
  assert.equal(u.searchParams.get('metrics'),'ym:ep:eventsNumber');assert.match(r.filters,/ym:ep:dateTime/);
  assert.equal(u.searchParams.get('timezone'),'+00:00');assert.ok(!u.searchParams.get('dimensions').includes('startURL'));
});
test('pagination completes once with stable precision and totals; no row sums',async()=>{
  let calls=0;
  const r=await readPagedProbe({kind:'pages',period,asOf,limit:1,get:async url=>{
    calls++;const offset=Number(new URL(url).searchParams.get('offset'));return body(eventProbeRequest('pages',period,asOf,offset,1),[row(['cpa-click','etiketka-media.ru',offset===1?`/blog/${slug}/`:'/'])],2);
  }});
  assert.equal(calls,2);assert.equal(r.coverage.totalEvents,10);assert.equal(r.rows.length,2);
});
test('changed totals, duplicate rows, truncation, sampling and wrong query fail closed',async()=>{
  for (const kind of ['changed','duplicate','truncated','sampled','query']) {
    let calls=0;
    await assert.rejects(()=>readPagedProbe({kind:'pages',period,asOf,limit:1,get:async url=>{
      calls++;const offset=Number(new URL(url).searchParams.get('offset'));const b=body(eventProbeRequest('pages',period,asOf,offset,1),[row(['cpa-click','etiketka-media.ru',`/blog/${slug}/`])],2);
      if(kind==='changed'&&calls===2)b.totals=[11];if(kind==='truncated')b.data=[];
      if(kind==='sampled')b.sampled=true;if(kind==='query')b.query.timezone='+03:00';return b;
    }}),/pagination_|precision_|response_query_/);
  }
});
test('only known article pages and exact CPA goal identity survive; no private strings',()=>{
  const rows=[row([{id:'101',name:'CPA click'},'etiketka-media.ru',`/blog/${slug}/`]),
    row(['unknown private goal','etiketka-media.ru','/private/user@example.org']),
    row(['cpa-click','other.example',`/blog/${slug}/`]),row(['cpa-click','etiketka-media.ru',`/blog/${slug}/?email=private`])];
  const r=sanitizeProbe({kind:'pages',report:{rows,coverage:{dataLagSeconds:0}},goals,slugs:[slug],period,asOf});
  assert.equal(r.rows.length,1);assert.equal(r.rows[0].slug,slug);assert.equal(r.excludedRows,3);assert.equal(r.unit,'events');assert.ok(!JSON.stringify(r).includes('private'));assert.equal(r.ctr,undefined);
});
test('article parameters are marginal only; unrelated fields, hashes and values are discarded',()=>{
  const r=sanitizeProbe({kind:'parameters',report:{rows:[row(['cpa-visible','contentId',hash]),row(['cpa-visible','email','private@example.org']),row(['cpa-visible','offer','private']),row(['cpa-visible','contentId','f'.repeat(64)])],coverage:{dataLagSeconds:0}},goals,slugs:[slug],period,asOf});
  assert.equal(r.rows.length,1);assert.equal(r.excludedRows,3);assert.ok(!JSON.stringify(r).includes('private'));assert.match(r.semantics,/no join/);
  const early=sanitizeProbe({kind:'parameters',report:{rows:[],coverage:{dataLagSeconds:0}},goals,slugs:[slug],period:{...period,from:'2026-10-04'},asOf});assert.equal(early.complete,false);
});
test('API failures stay unknown and credential never enters export',async()=>{
  const apiGoals=goals.map(g=>({id:g.goalId,type:'action',conditions:[{type:'exact',url:g.event}]}));
  let count=0;
  const r=await collectCommercialEventProbe({token:'fixture-secret',slugs:[slug],sourceRevision:'a'.repeat(40),now:new Date(asOf),fetcher:async(url,options)=>{
    count++;assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'OAuth fixture-secret');
    return url.includes('/management/')?{ok:true,json:async()=>({goals:apiGoals})}:{ok:false,status:400};
  }});
  assert.equal(count,3);assert.equal(r.status,'partial');assert.equal(r.reports.pages.reason,'api_http_400');assert.equal(r.attributionProven,false);assert.equal(r.revenue,null);assert.ok(!JSON.stringify(r).includes('fixture-secret'));
});
test('CLI writes token-unavailable without counts and rejects symlink escape into checkout',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'cpa-probe-')), script=path.resolve('scripts/analytics/probe-commercial-events.mjs');
  const env={...process.env,METRIKA_OAUTH_TOKEN:'',COMMERCIAL_PROBE_OUTPUT:path.join(dir,'probe.json')};
  try {
    assert.notEqual(spawnSync(process.execPath,[script],{env}).status,0);const r=JSON.parse(readFileSync(env.COMMERCIAL_PROBE_OUTPUT));assert.equal(r.reason,'token_unavailable');assert.equal(r.reports,undefined);
    symlinkSync(process.cwd(),path.join(dir,'checkout'));
    assert.notEqual(spawnSync(process.execPath,[script],{env:{...env,COMMERCIAL_PROBE_OUTPUT:path.join(dir,'checkout','probe.json')}}).status,0);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
