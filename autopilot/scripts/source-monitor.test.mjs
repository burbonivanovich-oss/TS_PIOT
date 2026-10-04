import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorSources } from './source-monitor.mjs';
const now = new Date('2026-10-03T12:00:00Z');
const a = 'https://www.consultant.ru/document/a/';
const b = 'https://www.consultant.ru/document/b/';
const article = url => ({ body: `Федеральный закон № 259-ФЗ описан в [источнике](${url}).` });
test('one source is fetched once, limit bounds work, recent observations rotate', async () => {
  const calls = [];
  const capture = async url => { calls.push(url); return { sha256: 'a'.repeat(64), finalUrl: url }; };
  const first = await monitorSources({ articles: [article(a), article(a), article(b)], now, limit: 1, capture });
  assert.equal(first.totalSources, 2); assert.equal(first.checkedCount, 1); assert.equal(first.dueRemaining, 1);
  const second = await monitorSources({ articles: [article(a), article(b)], now, limit: 1, previous: first, capture });
  assert.deepEqual(calls, [a, b]); assert.equal(second.dueRemaining, 0);
});
test('network failure is retained as unavailable without verified evidence', async () => {
  const result = await monitorSources({ articles: [article(a)], now, capture: async () => { throw new Error('HTTP 404'); } });
  assert.equal(result.byUrl[a].status, 'unavailable');
  assert.equal(result.byUrl[a].sha256, undefined);
  assert.equal(result.byUrl[a].reason, 'HTTP 404');
});
test('unsupported sources are never fetched and invalid limit refuses', async () => {
  let calls = 0;
  const capture = async () => { calls++; };
  await monitorSources({ articles: [article('https://example.com/doc'), article('https://consultant.ru/')], now, capture });
  assert.equal(calls, 0);
  await assert.rejects(monitorSources({ articles: [], limit: 0 }), /1–50/);
});

import { sourceCheckBudget } from './source-monitor.mjs';
test('daily coverage budget grows with corpus instead of making a seven-day freshness window impossible',()=>{
 assert.equal(sourceCheckBudget(76,10,7),13);
 assert.equal(sourceCheckBudget(105,10,7),18);
 assert.equal(sourceCheckBudget(10,10,7),10);
 assert.equal(sourceCheckBudget(300,10,7),50);
 assert.throws(()=>sourceCheckBudget(301,10,7),/more than 50/);
 for(const args of [[-1,10,7],[76,0,7],[76,10,0],[76,10,NaN]])assert.throws(()=>sourceCheckBudget(...args));
});
test('monitor rotates 76 actual extracted source URLs within six daily passes',async()=>{
 const articles=Array.from({length:76},(_,i)=>article(`https://www.consultant.ru/document/source-${i}/`));
 let previous={byUrl:{}}, calls=0;
 for(let day=0;day<6;day++) {
  previous=await monitorSources({articles,previous,limit:10,coverageDays:7,now:new Date(now.getTime()+day*86400000),capture:async url=>{calls++;return {sha256:'a'.repeat(64),finalUrl:url};}});
  assert.equal(previous.checkBudget,13);
 }
 assert.equal(Object.keys(previous.byUrl).length,76);assert.equal(calls,78);
 let attempted=false;
 await assert.rejects(monitorSources({articles:Array.from({length:301},(_,i)=>article(`https://www.consultant.ru/document/large-${i}/`)),limit:10,coverageDays:7,capture:async()=>{attempted=true;}}),/more than 50/);
 assert.equal(attempted,false);
});

test('future-dated observation is refreshed before regularly due sources and then rejoins rotation', async () => {
  const articles = [article(a), article(b)];
  let previous = { byUrl: {
    [a]: { status: 'ok', checkedAt: '2030-01-01T00:00:00Z', sha256: 'b'.repeat(64) },
    [b]: { status: 'ok', checkedAt: '2026-10-01T00:00:00Z', sha256: 'a'.repeat(64) },
  } };
  const calls = [];
  const capture = async url => { calls.push(url); return { sha256: 'c'.repeat(64), finalUrl: url }; };
  for (let day = 0; day < 4; day++) {
    previous = await monitorSources({ articles, previous, now: new Date(now.getTime() + day * 86400000), limit: 1, capture });
  }
  assert.deepEqual(calls, [a, b, a, b]);
  assert.equal(previous.byUrl[a].checkedAt, '2026-10-05T12:00:00.000Z');
});
