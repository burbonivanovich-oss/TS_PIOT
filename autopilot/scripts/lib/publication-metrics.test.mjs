import {test} from 'node:test';import assert from 'node:assert/strict';import {publicationMetrics} from './publication-metrics.mjs';
const now=new Date('2026-10-07T12:00:00Z'),revision='a'.repeat(40),html='b'.repeat(64),source='c'.repeat(64);
const ledger={days:{'2026-10-06':['new','rewrite','rewrite'],'2026-09-30':['outside']},kinds:{'2026-10-06':{new:'new',rewrite:'rewrite'}}};
const item=slug=>({date:'2026-10-06',slug,kind:slug==='new'?'new':'rewrite',releaseCommit:revision,sourceSha256:source,expectedHtmlSha256:html});
const check=slugs=>({liveVerified:true,revision,builtAt:'2026-10-07T10:00:00Z',checkedAt:'2026-10-07T11:00:00Z',items:slugs.map(item),pages:slugs.map(slug=>({path:`/blog/${slug}/`,status:200,contentVerified:true,verification:'exact-rendered-html',htmlSha256:html}))});
const base={state:{month:'2026-10',counters:{new:15,rewrite:14}},publishLog:ledger,queue:[{kind:'new'},{kind:'rewrite'}],proofs:{checks:[]},targets:{new:55,rewrite:14},now};
test('accepted ledger confirmed and waiting counts stay separate with explicit coverage',()=>{
 const r=publicationMetrics({...base,proofs:{checks:[check(['new'])]}});assert.equal(r.accepted.new,15);assert.deepEqual(r.released,{new:1,rewrite:1,unknown:0,total:2});assert.equal(r.confirmedOnSite.total,1);assert.equal(r.liveCoverage.complete,false);assert.equal(r.liveCoverage.ledgerEvents,2);assert.equal(r.remainingToRelease.new,54);assert.equal(r.remainingToAccept.rewrite,0);assert.equal(r.releaseDebt.new,11);
});
test('push a headline-only receipt a future receipt and missing body proof cannot confirm a version',()=>{
 for(const altered of [{liveVerified:false},{checkedAt:'2026-10-08T11:00:00Z'},{pages:[{path:'/blog/new/',status:200,contentVerified:true}]},{pages:[{path:'/blog/new/',status:200,contentVerified:true,verification:'exact-rendered-html',htmlSha256:'d'.repeat(64)}]}]){const r=publicationMetrics({...base,proofs:{checks:[{...check(['new']),...altered}]}});assert.equal(r.confirmedOnSite.total,0);assert.ok(r.liveCoverage.invalidProofs>0);}
});
test('wrong event day or kind cannot transfer proof and duplicate checks add no publications',()=>{
 for(const change of [{date:'2026-10-05'},{kind:'rewrite'},{sourceSha256:null},{releaseCommit:null}]){const proof=check(['new']);proof.items[0]={...proof.items[0],...change};assert.equal(publicationMetrics({...base,proofs:{checks:[proof]}}).confirmedOnSite.total,0);}
 const proof=check(['new','rewrite']);const r=publicationMetrics({...base,proofs:{checks:[proof,proof]}});assert.equal(r.confirmedOnSite.total,2);assert.equal(r.liveCoverage.complete,true);
});
test('a missing kind is unknown and a previous month cannot supply accepted counters',()=>{
 const r=publicationMetrics({...base,state:{...base.state,month:'2026-09'},publishLog:{days:{'2026-10-06':['legacy']}}});assert.equal(r.accepted,null);assert.equal(r.released.unknown,1);assert.equal(r.released.new,0);assert.equal(r.remainingToAccept.new,null);
});
test('rewrite events on separate days count separately; duplicate NEW URL refuses metrics',()=>{
 const repeated={days:{'2026-10-05':['same'],'2026-10-06':['same']},kinds:{'2026-10-05':{same:'rewrite'},'2026-10-06':{same:'rewrite'}}};assert.equal(publicationMetrics({...base,publishLog:repeated}).released.rewrite,2);repeated.kinds['2026-10-05'].same='new';repeated.kinds['2026-10-06'].same='new';assert.throws(()=>publicationMetrics({...base,publishLog:repeated}),/Repeated NEW/);
});
