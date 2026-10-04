import test from 'node:test';
import assert from 'node:assert/strict';
import { queryCount, topRows, topScope } from '../wordstat/source-contract.mjs';
test('counts preserve measured zero and reject missing, partial, unsafe and negative evidence', () => {
  for (const x of [0, '0', 42, '42']) assert.equal(queryCount(x), Number(x));
  for (const x of [null, undefined, '', '42bad', '1.5', '01', -1, 1.5, Infinity, '9007199254740992']) assert.throws(() => queryCount(x));
});
test('malformed top response cannot become empty or partially valid demand', () => {
  for (const x of [{}, {results: null}, {results:[{phrase:'x'}]}, {results:[{phrase:' ',count:'0'}]}, {results:[{phrase:'ok',count:'12'},{phrase:'bad',count:'abc'}]}]) assert.throws(() => topRows(x));
  assert.deepEqual(topRows({results:[]}), []);
  assert.deepEqual(topRows({results:[{phrase:' этрн ',count:'12'}]}), [{phrase:'этрн',count:12}]);
});
test('request scope records region and rolling provider window without inventing exact dates or completeness', () => {
  const s=topScope(225); assert.equal(s.region,'225'); assert.equal(s.devices,'all'); assert.equal(s.window.exactDatesVerified,false); assert.equal(s.complete,false); assert.equal(s.window.kind,'provider_last_30_days');
  for(const x of [0,-1,'all','225bad']) assert.throws(() => topScope(x));
});
