import {test} from 'node:test';import assert from 'node:assert/strict';import {latestPostFirst,relatedPostFirst} from '../../src/utils/post-order.mjs';
const post=(id,date='2026-10-07')=>({id,data:{pubDate:new Date(date)}});
test('equal date and relevance select the same related cards across shuffled collection loads',()=>{
 const candidates=['e','a','d','c','b'].map(id=>({post:post(id),score:2}));
 for(const input of [candidates,[...candidates].reverse(),[candidates[2],candidates[4],candidates[0],candidates[1],candidates[3]]])assert.deepEqual([...input].sort(relatedPostFirst).slice(0,4).map(x=>x.post.id),['a','b','c','d']);
});
test('relevance still outranks recency, and dates still outrank slug ties',()=>{
 const rows=[{post:post('z','2026-10-07'),score:1},{post:post('old','2026-01-01'),score:3},{post:post('b','2026-10-06'),score:1}];assert.deepEqual(rows.sort(relatedPostFirst).map(x=>x.post.id),['old','z','b']);assert.deepEqual([post('z'),post('a'),post('new','2026-10-08')].sort(latestPostFirst).map(x=>x.id),['new','a','z']);
});
