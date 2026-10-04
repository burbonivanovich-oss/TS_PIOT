import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productionCapacity } from './production-capacity.mjs';
import { validateConfig } from './config-schema.mjs';
import { loadConfig } from './config.mjs';

const config = loadConfig();
const now = new Date('2026-10-15T12:00:00Z');
const state = (n = 0, r = 0) => ({ month: '2026-10', counters: { new: n, rewrite: r }, inFlight: [] });
const cap = (s, opts = {}) => productionCapacity({ state: s, now, config, ...opts });

test('PUB-03: рерайты не уменьшают норму новых статей', () => {
  const c = cap(state(20, 14));
  assert.equal(c.byKind.new.remaining, 35);
  assert.equal(c.byKind.rewrite.remaining, 0);
  assert.equal(c.takeByKind.rewrite, 0);
  assert.equal(c.done, 20);
});

test('PUB-03: исчерпание каждого бюджета не блокирует другой', () => {
  assert.equal(cap(state(55, 0)).takeByKind.new, 0);
  assert.ok(cap(state(55, 0)).takeByKind.rewrite > 0);
  assert.equal(cap(state(55, 14)).canTake, 0);
  assert.equal(cap(state(60, 20)).canTake, 0);
});

test('PUB-03: активные и перенесённые принятые материалы резервируют остаток', () => {
  const s = state(53, 14);
  s.inFlight.push({ kind: 'new', slug: 'active' });
  assert.equal(cap(s).takeByKind.new, 1);
  const waiting = [{ kind: 'new', acceptedAt: '2026-09-30T12:00:00Z' }];
  assert.equal(cap(s, { waiting }).canTake, 0);
  // Принятое в октябре уже включено в counters и повторно не вычитается.
  assert.equal(cap(s, { waiting: [{ kind: 'new', acceptedAt: '2026-10-10' }] }).takeByKind.new, 1);
});

test('PUB-03: маленькие батчи не теряют рерайты за месяц', () => {
  const s = state();
  const small = { ...config, throughput: { ...config.throughput, maxBatchSize: 1 } };
  for (let i = 0; i < 69; i++) {
    const c = cap(s, { config: small });
    const kind = c.takeByKind.new ? 'new' : 'rewrite';
    assert.equal(c.canTake, 1);
    s.counters[kind]++;
  }
  assert.deepEqual(s.counters, { new: 55, rewrite: 14 });
  assert.equal(cap(s).canTake, 0);
});

test('PUB-03: месяцы 28–31 день и перенос активной работы', () => {
  for (const date of ['2026-02-28', '2028-02-29', '2026-09-30', '2026-12-31']) {
    const at = new Date(`${date}T12:00:00Z`);
    const s = state(55, 14);
    s.month = date.slice(0, 7);
    assert.equal(cap(s, { now: at }).canTake, 0);
    assert.equal(cap(s, { now: at }).expectedByToday, 55);
  }
  const s = state(55, 14);
  s.inFlight = [{ kind: 'new', slug: 'carry' }];
  const c = cap(s, { now: new Date('2026-11-01T12:00:00Z') });
  assert.equal(c.done, 0);
  assert.equal(c.byKind.new.remaining, 54);
});

test('PUB-03: неверная отдельная норма отклоняется схемой', () => {
  for (const value of [-1, 1.5, '14', null]) {
    const bad = structuredClone(config);
    bad.throughput.monthlyRewriteTarget = value;
    assert.match(validateConfig(bad).join('\n'), /monthlyRewriteTarget/);
  }
});


test('PUB-03: незавершённые наряды занимают и слоты, и размер задания', () => {
  const s = state();
  s.inFlight = Array.from({length: 3}, (_, i) => ({ slug: `open-${i}`, kind: 'new' }));
  assert.equal(cap(s).freeSlots, 1);
  assert.equal(cap(s).canTake, 0);
});

test('confirmed factual corrections reserve rewrite slots even when ordinary mix favors only new content',()=>{
 const current=state(9,3);const date=new Date('2026-10-04T18:00:00Z');
 const ordinary=cap(current,{now:date});assert.equal(ordinary.takeByKind.rewrite,0);
 const urgent=cap(current,{now:date,urgentRewrites:1});assert.equal(urgent.takeByKind.rewrite,1);assert.equal(urgent.takeByKind.new,2);
 assert.equal(urgent.canTake,ordinary.canTake);assert.equal(urgent.urgentRewriteSlots,1);
});
test('urgent repair cannot exceed batch, active slots or monthly rewrite budget',()=>{
 const bounded=cap(state(9,13),{urgentRewrites:100});assert.equal(bounded.takeByKind.rewrite,1);assert.equal(bounded.urgentRewriteSlots,1);
 const exhausted=cap(state(9,14),{urgentRewrites:1});assert.equal(exhausted.takeByKind.rewrite,0);
 const busy=state(9,13);busy.inFlight.push({kind:'rewrite',slug:'already'});assert.equal(cap(busy,{urgentRewrites:1}).urgentRewriteSlots,0);
 const full=state(9,3);for(let i=0;i<config.throughput.maxBatchSize;i++)full.inFlight.push({kind:'new',slug:'active'+i});
 assert.equal(cap(full,{urgentRewrites:1}).canTake,0);
 const many=cap(state(9,3),{urgentRewrites:100});assert.equal(many.takeByKind.rewrite,many.canTake);
 for(const value of [-1,0.5,Infinity,NaN])assert.throws(()=>cap(state(),{urgentRewrites:value}),/Invalid urgent/);
});

test('accepted buffer reserves active work and pauses normal writing without spending month budget',()=>{
 const waiting=Array.from({length:13},(_,i)=>({kind:'new',slug:'queued-'+i,acceptedAt:'2026-10-04'}));
 const s=state(12,4);let c=cap(s,{waiting});assert.equal(c.canTake,1);
 s.inFlight=[{kind:'new',slug:'active'}];c=cap(s,{waiting});assert.equal(c.canTake,0);assert.equal(c.buffer.paused,true);assert.equal(c.byKind.new.remaining,42);
 s.inFlight=[];waiting.push({kind:'rewrite',acceptedAt:'2026-10-04'});assert.equal(cap(s,{waiting}).canTake,0);
 waiting.splice(0,3);assert.equal(cap(s,{waiting}).canTake,3,'publication frees buffer for refill');
});
test('full buffer allows only urgent correction slots and keeps all hard budgets',()=>{
 const waiting=Array.from({length:14},()=>({kind:'new',acceptedAt:'2026-10-04'}));
 let c=cap(state(12,4),{waiting,urgentRewrites:1});assert.equal(c.canTake,1);assert.deepEqual(c.takeByKind,{new:0,rewrite:1});
 assert.equal(cap(state(12,14),{waiting,urgentRewrites:1}).canTake,0);
 assert.equal(cap(state(12,4),{waiting,urgentRewrites:20}).canTake,config.throughput.maxBatchSize);
 for(const limit of [0,-1,1.5,NaN])assert.throws(()=>cap(state(),{config:{...config,throughput:{...config.throughput,maxAcceptedBuffer:limit}}}),/buffer/);
});
