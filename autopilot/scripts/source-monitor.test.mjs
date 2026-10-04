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
