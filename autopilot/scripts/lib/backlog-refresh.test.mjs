import test from 'node:test';import assert from 'node:assert/strict';
import {rebalancePlanned} from './backlog-refresh.mjs';
const rank=xs=>xs.map(t=>({...t,priorityScore:t.score+(t.fresh?30:0)})).sort((a,b)=>b.priorityScore-a.priorityScore);
const check=()=>({verdict:'ok',hits:[]});
const opts={target:2,maxShare:1,rank,check,day:'2026-10-04'};
test('fresh topic enters overflowing queue; deferred history and live/quarantine records survive',()=>{
 const writing={slug:'w',entity:'x',status:'writing',receipt:'keep'},q={slug:'q',status:'quarantine',attempts:2};
 const old=Array.from({length:4},(_,i)=>({slug:'old'+i,entity:'x',status:'planned',score:50}));
 const offer={slug:'fresh',entity:'x',score:50,fresh:true};const r=rebalancePlanned([...old,writing,q],[offer],opts);
 assert.equal(r.selected[0].slug,'fresh');assert.equal(r.deferred.length,4);assert.deepEqual(r.topics.find(t=>t.slug==='w'),writing);assert.deepEqual(r.topics.find(t=>t.slug==='q'),q);
 const again=rebalancePlanned(r.topics,[offer],opts);assert.equal(again.topics.filter(t=>t.slug==='fresh').length,1);assert.deepEqual(again.topics,r.topics);
});
test('blocked offers never enter; entity diversity and active slot excess are respected',()=>{
 const x=rebalancePlanned([], [{slug:'bad',entity:'x',score:100}],{...opts,check:()=>({verdict:'block',advice:'duplicate'})});assert.equal(x.topics.length,0);assert.equal(x.rejected.length,1);
 const writing=Array.from({length:3},(_,i)=>({slug:'w'+i,entity:'x',status:'writing'}));const r=rebalancePlanned(writing,[{slug:'new',entity:'y',score:50}],opts);assert.equal(r.selected.length,0);assert.equal(r.topics.filter(t=>t.status==='writing').length,3);
});
