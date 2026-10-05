import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newLinkDirections } from './new-link-directions.mjs';
const rules = {minInbound:2,minOutbound:3,maxOutbound:8,minRelevance:.7};
const topic={slug:'shop',entity:'маркировка игрушек',title:'Маркировка игрушек для магазина'};
const articles=[{slug:'toys',title:'Маркировка игрушек'},{slug:'tax',title:'Налог на прибыль'}];
test('new topic proposes a relevant orphan without altering the corpus or graph',()=>{
 const graph={inbound:new Map([['toys',new Set()],['tax',new Set()]])};
 const before=JSON.stringify(articles);
 assert.deepEqual(newLinkDirections(topic,articles,graph,rules).map(x=>x.slug),['toys']);
 assert.equal(JSON.stringify(articles),before);assert.equal(graph.inbound.get('toys').size,0);
});
test('sufficient incoming links and self references are excluded',()=>{
 const graph={inbound:new Map([['toys',new Set(['a','b'])]])};
 assert.equal(newLinkDirections(topic,[...articles,{...topic}],graph,rules).length,0);
});
test('empty corpus produces no proposed links',()=>{
 assert.deepEqual(newLinkDirections(topic,[],{inbound:new Map()},rules),[]);
});
test('lowest inbound comes first and suggestions respect the outgoing budget',()=>{
 const list=Array.from({length:5},(_,i)=>({slug:'toy'+i,title:'Маркировка игрушек'}));
 const graph={inbound:new Map(list.map((a,i)=>[a.slug,new Set(i===0?['existing']:[])]))};
 const result=newLinkDirections(topic,list,graph,{...rules,minOutbound:3,maxOutbound:2});
 assert.equal(result.length,2);assert.ok(result.every(x=>x.inbound===0));
});

test('shared intent never substitutes for a shared product entity',()=>{
 const source={slug:'milk',entity:'маркировка молочной продукции',title:'Маркировка молочной продукции: штрафы и ответственность в 2026 году'};
 const target={slug:'epd',title:'ГИС ЭПД: штрафы и ответственность в 2026 году'};
 assert.deepEqual(newLinkDirections(source,[target],{inbound:new Map()}, {...rules,minRelevance:.35}),[]);
});
test('missing entity is not inferred from generic wording',()=>{
 assert.deepEqual(newLinkDirections({...topic,entity:undefined},articles,{inbound:new Map()},rules),[]);
});
