import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { claimHash, checkClaimEvidence } from './claim-evidence.mjs';

const now = new Date('2026-10-03T12:00:00Z');
const url = 'https://publication.pravo.gov.ru/document/123';
const sentence = 'Норма действует с 01.10.2026 согласно [закону](https://publication.pravo.gov.ru/document/123).';
const claims = [{ text: 'с 01.10.2026', sentence, source: url }];
function fixture() {
  const text = 'Начало действия документа — с 01.10.2026. Норма применяется к организациям указанной категории.';
  return {
    documents: [{ url, text, status: 200, fetchedAt: '2026-10-02', sha256: createHash('sha256').update(text).digest('hex') }],
    claims: [{ claimHash: claimHash(sentence), source: url, excerpt: text, checkedAt: '2026-10-02', result: 'verified', rationale: 'Дата и область применения сверены с текстом документа.' }],
  };
}
const verify = evidence => checkClaimEvidence({ claims, evidence, now });

test('PUB-05: сохранённый документ и точное утверждение проходят', () => {
  assert.equal(verify(fixture()).ok, true);
  assert.equal(claimHash('Норма [действует](/blog/a/) с 01.10.2026.'), claimHash('Норма действует с 01.10.2026.'));
});

test('PUB-05: нет evidence, другой текст статьи, неподтверждённый результат', () => {
  assert.equal(verify(null).ok, false);
  for (const edit of [e => e.claims[0].claimHash = claimHash('Другая норма'), e => e.claims[0].result = 'uncertain', e => e.claims[0].rationale = '']) {
    const e = fixture(); edit(e); assert.equal(verify(e).ok, false);
  }
});

test('PUB-05: повреждение снимка, чужой фрагмент, другая дата и недоступный источник блокируют', () => {
  for (const edit of [
    e => e.documents[0].text += 'изменение',
    e => e.claims[0].excerpt = 'В документе такой фразы нет',
    e => { const text = 'Начало действия с 01.09.2026.'; e.documents[0].text = text; e.documents[0].sha256 = createHash('sha256').update(text).digest('hex'); e.claims[0].excerpt = text; },
    e => e.documents[0].status = 404,
    e => e.claims[0].checkedAt = '2025-01-01',
    e => e.claims[0].checkedAt = '2027-01-01',
    e => e.documents[0].fetchedAt = 'invalid',
  ]) {
    const e = fixture(); edit(e); assert.equal(verify(e).ok, false);
  }
});


test('official clarification still requires an exact fresh semantic receipt and whole snapshot', () => {
  const source = 'https://zpp.rospotrebnadzor.ru/news/federal/575519';
  const sentence = `Тестовая норма действует с 01.10.2026 согласно [разъяснению](${source}).`;
  const list = [{id:'date',text:'с 01.10.2026',sentence,source}];
  const make = () => { const e=fixture(); e.documents[0].url=source; e.claims[0].source=source; e.claims[0].claimHash=claimHash(sentence); return e; };
  const run=e=>checkClaimEvidence({claims:list,evidence:e,now});
  assert.equal(run(make()).ok,true);
  assert.equal(run(null).ok,false);
  for(const mutate of [e=>e.claims[0].excerpt='Чужой фрагмент',e=>e.claims[0].checkedAt='2025-01-01',e=>e.documents[0].text+='повреждение',e=>{e.claims[0].source='https://rospotrebnadzor.ru.evil.example/news/1';e.documents[0].url=e.claims[0].source;},e=>e.claims[0].result='unverified']){const e=make();mutate(e);assert.equal(run(e).ok,false);}
});
