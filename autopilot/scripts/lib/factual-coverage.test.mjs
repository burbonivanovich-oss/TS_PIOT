import test from 'node:test';import assert from 'node:assert/strict';import {factualCoverage} from './factual-coverage.mjs';
const url='https://www.consultant.ru/document/cons_doc_LAW_34661/';
const articles=[{slug:'a',body:`Федеральный закон № 259-ФЗ описан в [источнике](${url}).`},{slug:'b',body:'Штраф составляет 10 000 ₽.'}];
const now=new Date('2026-10-04T12:00:00Z');
const base={articles,now,evidenceFor:()=>null};
test('fresh reachable sources never imply semantic verification or coverage of unlinked claims',()=>{const r=factualCoverage({...base,observations:{[url]:{status:'ok',checkedAt:now.toISOString(),sha256:'a'.repeat(64)}}});assert.equal(r.sourceUrls,1);assert.equal(r.freshSources,1);assert.equal(r.articlesWithUnlinkedClaims,1);assert.equal(r.reviewRequired,2);assert.equal(r.level,'warn');});
test('missing, expired, future and malformed source observations cannot be counted as fresh',()=>{for(const obs of [undefined,{status:'ok',checkedAt:'2026-09-01',sha256:'a'.repeat(64)},{status:'ok',checkedAt:'2030-01-01',sha256:'a'.repeat(64)},{status:'ok',checkedAt:now.toISOString(),sha256:'bad'}]){const r=factualCoverage({...base,observations:{[url]:obs}});assert.equal(r.freshSources,0);assert.equal(r.missingOrExpiredSources,1);}});
test('recent unavailable sources remain explicit uncertainty',()=>{const r=factualCoverage({...base,observations:{[url]:{status:'unavailable',checkedAt:now.toISOString()}}});assert.equal(r.unavailableSources,1);assert.equal(r.freshSources,0);});
