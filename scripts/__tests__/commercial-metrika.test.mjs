import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,mkdirSync,writeFileSync,symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COMMERCIAL_GOALS, COUNTER_ID, collectionWindow, resolveCommercialGoals, reportRequest, normalizeCommercialReport, collectCommercialMetrika } from '../analytics/lib/commercial-metrika.mjs';
import {computeCommercialReport} from '../../autopilot/scripts/commercial-report.mjs';
const now=new Date('2026-10-20T12:00:00Z');
const goals=COMMERCIAL_GOALS.map(([event],i)=>({id:100+i,type:'action',conditions:[{type:'exact',url:event}]}));
const rows=resolveCommercialGoals(goals),period=collectionWindow(now,7),asOf=now.toISOString(),request=reportRequest(rows,period,asOf);
const context={period,asOf,fetchedAt:asOf,request,goalRows:rows};
function response(over={}) {return {query:{timezone:'+00:00',date1:period.from,date2:period.to,metrics:request.definitions.map(d=>d.metric),filters:request.filters,dimensions:[]},sampled:false,sample_share:1,total_rows_rounded:false,contains_sensitive_data:false,data_lag:0,totals:[10,12,...COMMERCIAL_GOALS.map(()=>2)],data:[{metrics:[999,999]}],...over};}
test('one UTC request uses report totals and unique goal users, not page sums or paid/lead aliases',()=>{
  const url=new URL(request.url);assert.equal(url.searchParams.get('ids'),String(COUNTER_ID));assert.equal(url.searchParams.get('timezone'),'+00:00');assert.equal(request.definitions.length,11);
  const r=normalizeCommercialReport(response(),context);
  assert.equal(r.status,'ok');assert.equal(r.users,10);assert.equal(r.siteVisits,12);assert.equal(r.productViews,2);assert.equal(r.formSubmitAttempts,2);
  assert.equal(r.validLeads,undefined);assert.equal(r.paid,undefined);assert.equal(r.paymentClicks,undefined);
  assert.equal(r.measurement.productViews.unit,'visitors');assert.deepEqual(r.measurement.productViews.subsetOf,['users']);assert.equal(r.measurement.productViews.complete,true);
});
test('sampling, rounded/hidden totals, missing precision and changed query never become exact counts',()=>{
  for(const patch of [{sampled:true},{sample_share:0.9},{total_rows_rounded:true},{contains_sensitive_data:true},{data_lag:null},{totals:null},{query:{...response().query,timezone:'+03:00'}},{query:{...response().query,metrics:['ym:s:pageviews']}}]) {
    const r=normalizeCommercialReport(response(patch),context);assert.equal(r.status,'error');assert.equal(r.users,undefined);assert.equal(r.productViews,undefined);
  }
});
test('real zero survives while absent, fractional and contradictory aggregates stay unknown',()=>{
  const zero=normalizeCommercialReport(response({totals:[0,0,...COMMERCIAL_GOALS.map(()=>0)]}),context);assert.equal(zero.productViews,0);
  const bad=response();bad.totals[2]=null;bad.totals[3]=2.5;bad.totals[4]=11;
  const r=normalizeCommercialReport(bad,context);assert.equal(r.status,'partial');for(const f of ['productViews','ctaClicks','selectorTasks']) assert.equal(r[f],undefined);
});
test('missing or duplicate exact goals are not guessed from names or contains operators',()=>{
  const broken=[...goals,goals[0]].filter(g=>g.conditions[0].url!=='form-start');
  broken.push({id:500,type:'action',conditions:[{type:'contain',url:'form-start'}]});
  const r=resolveCommercialGoals(broken);assert.equal(r[0].goalId,null);assert.equal(r.find(x=>x.event==='form-start').goalId,null);
});
test('pre-launch days and processing lag explicitly prevent claims of complete conversion coverage',()=>{
  const earlyPeriod=collectionWindow(new Date('2026-10-04T12:00:00Z'),7);const earlyReq=reportRequest(rows,earlyPeriod,'2026-10-04T12:00:00Z');
  const body=response();body.query={...body.query,date1:earlyPeriod.from,date2:earlyPeriod.to,filters:earlyReq.filters};
  const early=normalizeCommercialReport(body,{...context,period:earlyPeriod,asOf:'2026-10-04T12:00:00Z',request:earlyReq});
  assert.equal(early.measurement.productViews.complete,false);assert.equal(early.measurement.productViews.trackingCoverage,'partial_since_verified_release');
  assert.equal(normalizeCommercialReport(response({data_lag:30}),context).measurement.users.complete,false);
});
test('collector reads only the own counter and keeps OAuth out of its exported artifact',async()=>{
  const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('/management/')?{goals}:response()};};
  const r=await collectCommercialMetrika({token:'fixture-token',fetcher,now,clock:()=>now});
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.url.startsWith('https://api-metrika.yandex.net/')));assert.ok(calls[0].url.includes(String(COUNTER_ID)));assert.equal(calls[1].options.redirect,'error');
  assert.ok(!JSON.stringify(r).includes('fixture-token'));
  await assert.rejects(()=>collectCommercialMetrika({token:'',fetcher,now}),/absent/);assert.equal(calls.length,2);
});
test('CLI records failed collection without fake zero and rejects paths inside a checkout containing spaces',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'commercial-private-'));
  const script=path.resolve('scripts/analytics/fetch-commercial.mjs');
  try {
    const output=path.join(dir,'analytics','export.json');const env={...process.env,METRIKA_OAUTH_TOKEN:'',COMMERCIAL_OUTPUT:output};
    const bad=spawnSync(process.execPath,[script],{env,encoding:'utf8'});assert.notEqual(bad.status,0);
    const data=JSON.parse(readFileSync(output,'utf8'));assert.equal(data.status,'error');assert.equal(data.reason,'token_unavailable');assert.equal(data.users,undefined);
    const inside=spawnSync(process.execPath,[script],{env:{...env,COMMERCIAL_OUTPUT:path.resolve('private-test-export.json')},encoding:'utf8'});assert.notEqual(inside.status,0);assert.match(inside.stderr,/outside/);
    symlinkSync(process.cwd(),path.join(dir,'checkout'));
    const escaped=spawnSync(process.execPath,[script],{env:{...env,COMMERCIAL_OUTPUT:path.join(dir,'checkout','private-test-export.json')},encoding:'utf8'});assert.notEqual(escaped.status,0);assert.match(escaped.stderr,/outside/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('collected aggregates feed the report while client attempts and unrelated stages stay unconfirmed',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'commercial-bridge-'));
  try {
    mkdirSync(path.join(dir,'analytics'));writeFileSync(path.join(dir,'analytics','export.json'),JSON.stringify(normalizeCommercialReport(response(),context)));
    const r=computeCommercialReport({dir,now,days:7});
    assert.equal(r.metrics.users.value,10);assert.equal(r.metrics.formSubmitAttempts.value,2);
    assert.equal(r.metrics.cpaVisibleVisitors.value,2);assert.equal(r.cr.cpaVisibleReach.value,0.2);
    assert.equal(r.metrics.ctaCtr.value,null);
    assert.equal(r.metrics.validLeads.value,null);assert.equal(r.metrics.paymentClicks.value,null);
    assert.equal(r.cr.productReach.value,0.2);assert.equal(r.cr.ctaReach.value,0.2);
    assert.equal(r.cr.formStart.value,null);assert.equal(r.projectIncome.value,null);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('CPA visibility uses its own release boundary and never becomes raw impressions or CTR',()=>{
  const p={from:'2026-10-04',to:'2026-10-04',timeZone:'UTC'};
  const req=reportRequest(rows,p,asOf); const b=response();
  b.query={...b.query,date1:p.from,date2:p.to,filters:req.filters};
  const r=normalizeCommercialReport(b,{...context,period:p,request:req});
  assert.equal(r.cpaVisibleVisitors,2); assert.equal(r.cpaClickVisitors,2);
  assert.equal(r.measurement.cpaVisibleVisitors.complete,false);
  assert.equal(r.measurement.cpaVisibleVisitors.trackingVerifiedAt,'2026-10-04T21:31:08.779Z');
  assert.equal(r.offerImpressions,undefined); assert.equal(r.ctaCtr,undefined);
});
