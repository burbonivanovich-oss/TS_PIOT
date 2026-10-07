import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildFactualRegister } from './factual-register.mjs';
import { extractClaims } from './critical-claims.mjs';
import { claimHash } from './claim-evidence.mjs';

const now = new Date('2026-10-07T12:00:00Z'), stamp = now.toISOString();
const url = 'https://publication.pravo.gov.ru/document/123';
const text = 'Штраф составляет 500 рублей.';
const doc = {url,text,status:200,fetchedAt:stamp,sha256:createHash('sha256').update(text).digest('hex')};
const body = `Штраф 500 рублей согласно [закону](${url}).`;
const evidence = { documents:[doc], claims:extractClaims(body).map(c=>({claimHash:claimHash(c.sentence),source:url,result:'verified',excerpt:text,rationale:'Сумма и применимость сверены.',checkedAt:stamp})) };
const article = {slug:'tested',title:'Проверка',body};
const base = { articles:[article], now, evidenceFor:()=>evidence, sourceFor:a=>a.body };

test('register binds the current version, separates absent evidence from confirmed error and omits drafts',()=>{
  const articles=[article,{slug:'unlinked',body:'Штраф 900 рублей.'},{slug:'neutral',body:'Нейтральный текст.'},{slug:'draft',draft:true,body}];
  const r=buildFactualRegister({...base,articles,evidenceFor:slug=>slug==='tested'?evidence:null});
  assert.equal(r.summary.articles,3);assert.equal(r.summary.statuses.verified,1);assert.equal(r.summary.statuses['needs-review'],1);
  assert.equal(r.summary.statuses['no-critical-claims'],1);assert.equal(r.summary.statuses['confirmed-error'],0);
  assert.equal(r.articles[0].slug,'unlinked');assert.equal(r.articles[0].traffic,null);
  assert.equal(r.articles.find(a=>a.slug==='tested').sourceSha256,createHash('sha256').update(body).digest('hex'));
});
test('register invalidates evidence after an article change or document tampering',()=>{
  for(const options of [{articles:[{...article,body:body.replace('500','900')}]},{evidenceFor:()=>({...evidence,documents:[{...doc,text:'changed'}]})}]) {
    assert.equal(buildFactualRegister({...base,...options}).summary.statuses['needs-review'],1);
  }
});
test('fresh unavailable sources have a distinct status; stale observations do not invent an outage',()=>{
  const r=buildFactualRegister({...base,observations:{[url]:{status:'unavailable',checkedAt:stamp}}});
  assert.equal(r.articles[0].status,'source-unavailable');
  assert.equal(buildFactualRegister({...base,observations:{[url]:{status:'unavailable',checkedAt:'2020-01-01'}}}).articles[0].status,'verified');
});
test('only a validated contradiction in the current text is a confirmed error',()=>{
  const statement='Штраф 900 рублей.';
  const corrections={version:1,slug:'tested',documents:[doc],findings:[{statement,claimHash:claimHash(statement),source:url,result:'contradicted',excerpt:text,rationale:'Указано 900 вместо 500.',checkedAt:stamp}]};
  const changed={...article,body:statement};
  assert.equal(buildFactualRegister({...base,articles:[changed],correctionsFor:()=>corrections}).articles[0].status,'confirmed-error');
  assert.equal(buildFactualRegister({...base,correctionsFor:()=>corrections}).articles[0].status,'verified');
  assert.equal(buildFactualRegister({...base,articles:[changed],correctionsFor:()=>({...corrections,documents:[{...doc,text:'tampered'}]})}).articles[0].status,'needs-review');
});
test('FAQ joins the inventory, but no-claims must not masquerade as verification',()=>{
  const r=buildFactualRegister({...base,articles:[{slug:'faq',body:'Нет норм в теле.',fm:'faq:\n  - question: Когда?\n    answer: С сентября 2026 года.'}],evidenceFor:()=>null});
  assert.equal(r.summary.claims,1);assert.equal(r.articles[0].status,'needs-review');
});
