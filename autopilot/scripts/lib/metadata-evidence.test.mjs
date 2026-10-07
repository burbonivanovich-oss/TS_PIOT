import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractClaims } from './critical-claims.mjs';
import { bindMetadataSources, claimHash, checkClaimEvidence } from './claim-evidence.mjs';
import { runGates } from '../gates.mjs';
import { monitorSources } from '../source-monitor.mjs';
import { factualCoverage } from './factual-coverage.mjs';
import { buildFactualRegister } from './factual-register.mjs';

const now = new Date('2026-10-07T08:00:00Z');
const url = 'https://publication.pravo.gov.ru/document/123';
const fm = 'title: "Переход на электронные документы с 1.9.2026"\ndescription: "Проверяем порядок перехода, действия участников, правила обмена и основания исключений для малого предприятия."';
const article = { slug: 'metadata-fixture', fm, body: 'Текст без дат.' };
const claims = extractClaims(article);
function fixture() {
  const text = 'Документ вступает в силу с 1 сентября 2026 года.';
  return { documents: [{url,text,status:200,fetchedAt:now.toISOString(),sha256:createHash('sha256').update(text).digest('hex')}],
    claims: [{field:'title',claimHash:claimHash(claims[0].sentence),source:url,checkedAt:now.toISOString(),excerpt:text,result:'verified',rationale:'Проверены дата начала и область применения.'}] };
}
const bind = evidence => bindMetadataSources({claims,evidence,now});

test('plain title receives a source only from an exact field receipt and passes the real gates',()=>{
  assert.equal(claims[0].field,'title');assert.equal(claims[0].covered,false);
  const evidence=fixture(),bound=bind(evidence);
  assert.equal(bound[0].source,url);assert.equal(bound[0].covered,true);
  assert.equal(checkClaimEvidence({claims:bound,evidence,now}).ok,true);
  const source=`---\n${fm}\npubDate: "2026-05-01"\n---\n${article.body}`;
  const r=runGates({source,claimEvidence:evidence,siteQuality:()=>({ok:true,blockers:[]}),assetVerifier:()=>({ok:true}),knownSlugs:new Set()});
  assert.equal(r.checks.find(c=>c.id==='sources').ok,true);
  assert.equal(r.checks.find(c=>c.id==='claim-evidence').ok,true);
  assert.equal(buildFactualRegister({articles:[article],evidenceFor:()=>evidence,sourceFor:()=>source,now}).articles[0].status,'verified');
});

test('metadata bindings reject another field, another statement, stale evidence and damaged documents',()=>{
  for(const edit of [
    e=>delete e.claims[0].field,
    e=>e.claims[0].field='description',
    e=>e.claims[0].claimHash=claimHash('Другая дата'),
    e=>e.claims[0].result='uncertain',
    e=>e.claims[0].checkedAt='2020-01-01',
    e=>e.claims[0].checkedAt='2027-01-01',
    e=>e.claims[0].rationale='',
    e=>e.documents[0].text+='tampered',
    e=>e.claims[0].excerpt='Не существует в документе',
    e=>{const text='С 2 сентября 2026 года.';e.documents[0].text=text;e.documents[0].sha256=createHash('sha256').update(text).digest('hex');e.claims[0].excerpt=text;},
    e=>e.claims.push({...e.claims[0],source:'https://publication.pravo.gov.ru/document/other'}),
  ]) {const evidence=fixture();edit(evidence);assert.equal(bind(evidence)[0].covered,false);}
});

test('a metadata receipt cannot cover the body or a FAQ answer, including identical words',()=>{
  for(const input of [claims[0].sentence,{body:'',fm:'faq:\n  - question: Когда?\n    answer: "Переход на электронные документы с 1.9.2026"'}]) {
    assert.ok(bindMetadataSources({claims:extractClaims(input),evidence:fixture(),now}).every(c=>!c.covered));
  }
  const changed={...article,fm:fm.replace('1.9.2026','2.9.2026')};
  assert.equal(bindMetadataSources({claims:extractClaims(changed),evidence:fixture(),now})[0].covered,false);
});


test('metadata-only sources enter monitoring and expired receipts remain review tasks',async()=>{
  for(const expired of [false,true]) {
    const evidence=fixture();if(expired)evidence.claims[0].checkedAt='2020-01-01';
    const calls=[];
    const observation=await monitorSources({articles:[article],now,evidenceFor:()=>evidence,capture:async source=>{calls.push(source);return {sha256:evidence.documents[0].sha256,finalUrl:source};}});
    assert.deepEqual(calls,[url]);
    const coverage=factualCoverage({articles:[article],now,evidenceFor:()=>evidence,observations:observation.byUrl});
    assert.equal(coverage.sourceUrls,1);assert.equal(coverage.reviewRequired,expired?1:0);
  }
});
