import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { commercialProbeSummary } from '../analytics/lib/commercial-probe-summary.mjs';
const slug='2026-05-03-etrn-2026',hash=createHash('sha256').update(slug).digest('hex');
function fixture(){return {counterId:109130279,sourceRevision:'a'.repeat(40),reports:{
  pages:{status:'ok',rows:[{event:'cpa-visible',slug,events:5},{event:'cpa-visible',slug,events:2}],complete:true,coverage:{returnedRows:2,totalRows:2,paginationComplete:true,sampled:false,sampleShare:1,dataLagSeconds:0}},
  parameters:{status:'ok',rows:[{event:'cpa-visible',contentId:hash,events:7}],complete:true,coverage:{returnedRows:1,totalRows:1,paginationComplete:true,sampled:false,sampleShare:1,dataLagSeconds:0}}}};}
test('derived event-page and article parameter counts agree without becoming CTR or revenue',()=>{
 const s=commercialProbeSummary(fixture(),[slug]);assert.equal(s.articles[0].pageEvents,7);assert.equal(s.articles[0].contentParameterEvents,7);assert.equal(s.articles[0].countsAgree,true);assert.equal(s.unit,'events');assert.equal(s.attributionProven,false);assert.equal(s.revenue,null);assert.ok(!JSON.stringify(s).includes(hash));
});
test('unknown rows, private parameters and unverified counter never enter public summary',()=>{
 const f=fixture();f.private='private@example.org';f.reports.pages.rows.push({event:'cpa-click',slug:'private@example.org',events:9},{event:'other private event',slug,events:5});f.reports.parameters.rows.push({event:'cpa-click',contentId:'f'.repeat(64),events:2,value:'private@example.org'});
 const s=commercialProbeSummary(f,[slug]);assert.equal(s.articleRows,1);assert.ok(!JSON.stringify(s).includes('private'));f.counterId=1;assert.equal(commercialProbeSummary(f,[slug]).articleRows,0);
});
test('missing or failed marginal report is unknown, not zero or matching counts',()=>{
 const f=fixture();f.reports.parameters={status:'error',reason:'private@example.org'};const s=commercialProbeSummary(f,[slug]);assert.equal(s.articles[0].contentParameterEvents,null);assert.equal(s.articles[0].countsAgree,null);assert.equal(s.coverage.parameters.totalRows,null);assert.ok(!JSON.stringify(s).includes('private'));
});
