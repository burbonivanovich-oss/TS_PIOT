import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, declaredKey, remoteKey } from '../metrika/goal-contract.mjs';
test('API depth and duration thresholds match existing goals, avoiding duplicate creation', () => {
  const depth = {id:'depth',name:'3 pages',type:'number',operator:'gt',value:'2'};
  const duration = {id:'time',name:'2 minutes',type:'time',operator:'gt',value:'119'};
  assert.deepEqual(buildPayload(depth),{goal:{name:'3 pages',type:'number',depth:3}});
  assert.deepEqual(buildPayload(duration),{goal:{name:'2 minutes',type:'visit_duration',duration:119}});
  assert.equal(declaredKey(depth),remoteKey({id:1,type:'number',depth:3}));
  assert.equal(declaredKey(duration),remoteKey({id:2,type:'visit_duration',duration:119}));
  assert.equal(declaredKey({...depth,operator:'gte',value:'3'}),declaredKey(depth));
  assert.equal(declaredKey({...duration,operator:'gte',value:'120'}),declaredKey(duration));
});
test('an action requires exact matching; invalid thresholds fail before requests', () => {
  const g={id:'product-view',name:'View',type:'action'};
  assert.equal(declaredKey(g),'action:product-view');
  assert.equal(remoteKey({type:'action',conditions:[{type:'contain',url:g.id}]}),null);
  assert.equal(remoteKey({type:'action',conditions:[{type:'exact',url:g.id},{type:'exact',url:'other'}]}),null);
  for (const value of ['NaN','2.5','0','-1']) assert.throws(()=>buildPayload({id:'x',type:'number',operator:'gt',value}));
});
