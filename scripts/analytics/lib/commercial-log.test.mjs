import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commercialLogSummary} from './commercial-log.mjs';
test('aggregate logger never includes arbitrary source data or credentials',()=>{
 const secret='SENSITIVE_SENTINEL';
 const s=commercialLogSummary({status:'ok',counterId:109130279,users:12,ctaClicks:3,measurement:{ctaClicks:{complete:false}},sourceRequest:secret,token:secret,issues:{ctaClicks:secret},period:{from:secret,to:'2026-10-05'},coverage:{sampled:false,sampleShare:1,dataLagSeconds:0}});
 assert.equal(JSON.stringify(s).includes(secret),false);assert.equal(s.metrics.users.value,12);assert.equal(s.metrics.ctaClicks.complete,false);assert.equal(s.confirmedLeads,null);assert.equal(s.payments,null);
});
test('failed or wrong-counter responses never become zero or usable measurements',()=>{
 for(const input of [{status:'error',counterId:109130279,users:0},{status:'ok',counterId:399891,users:99}]) {
 const s=commercialLogSummary(input);assert.equal(s.metrics.users.value,null);assert.equal(s.metrics.users.complete,false);
 }
});
