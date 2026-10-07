import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractClaims, articleClaimText, monetaryValues } from './critical-claims.mjs';
import { checkClaimEvidence, claimHash } from './claim-evidence.mjs';

const url='https://publication.pravo.gov.ru/document/123';
const now=new Date('2026-10-07T12:00:00Z');
const cases=[
  ['Новый порядок обязателен с 1.9.2026.','date'],
  ['Новый порядок обязателен с 01.9.2026.','date'],
  ['Новый порядок обязателен с сентября 2026 года.','date'],
  ['Применяется после 1 сентября 2026 года.','date'],
  ['Уведомление обязательно не позднее 1.9.2026.','date'],
  ['Нарушение влечёт штраф 500 рублей.','fine'],
  ['За нарушение штраф 5 ₽.','fine'],
  ['За нарушение штраф от 500 до 900 рублей.','fine'],
  ['За нарушение штраф 500–900 руб.','fine'],
  ['За нарушение штраф 5 тыс. рублей.','fine'],
  ['За нарушение штраф 5–10 тыс. рублей.','fine'],
  ['За нарушение штраф пять тысяч рублей.','fine'],
  ['За нарушение штраф от пяти до десяти тысяч рублей.','fine'],
  ['Ответственность — неустойка 0,5 рубля.','fine'],
  ['Штраф 5\u202f000 рублей.','fine'],
  ['Штраф `500 рублей`.','fine'],
  ['Штраф **500** рублей.','fine'],
  ['Штраф <strong>500</strong> рублей.','fine'],
  ['<Notice>Штраф 500 рублей.</Notice>','fine'],
  ['| Санкция | Штраф 500 рублей |','fine'],
];
for(const [text,id] of cases) test(`AUD-01 captures ${text}`,()=>{
  const claims=extractClaims(text);
  assert.ok(claims.some(c=>c.id===id),JSON.stringify(claims));
  assert.ok(claims.every(c=>c.covered===false));
});

test('prices, order numbers, publication metadata and fenced examples are not legal claims',()=>{
  const article={body:'Касса стоит 500 рублей. Номер заказа 12345.\n\n```js\nconst text = "штраф 500 рублей с 1.9.2026";\n```',fm:'title: Статья 2026-10-07\ndescription: Описание статьи 2026-10-07\npubDate: 2026-10-07\nupdatedDate: 2026-10-07\n'};
  assert.deepEqual(extractClaims(article),[]);
});
test('a source in another paragraph or table cell cannot cover a claim',()=>{
  for(const text of [`[Закон](${url})\n\nШтраф 500 рублей`, `| [Закон](${url}) | Штраф 500 рублей |`]) {
    assert.equal(extractClaims(text).find(c=>c.id==='fine').covered,false);
  }
});
test('a source adjacent to a short date remains in the same sentence',()=>{
  const claims=extractClaims(`Обязателен с 1.9.2026 по [закону](${url}).`);
  assert.equal(claims.length,1);assert.equal(claims[0].covered,true);assert.equal(claims[0].source,url);
});
test('FAQ answers are covered by the same detector, including folded scalars',()=>{
  const article={body:'Нейтральный текст.',fm:`title: Статья\nfaq:\n  - question: "Какая санкция?"\n    answer: >\n      Штраф 500 рублей согласно\n      [закону](${url}).\n  - question: "Когда действует порядок?"\n    answer: 'Порядок обязателен с 1.9.2026.'\nseo:\n  keywords:\n    - штраф 900 рублей\n`};
  const claims=extractClaims(article);assert.equal(claims.length,2);
  assert.equal(claims.find(c=>c.id==='fine').covered,true);
  assert.equal(claims.find(c=>c.id==='date').covered,false);
  assert.ok(!articleClaimText(article).includes('900'));
});
test('a source in a FAQ question cannot cover its unsupported answer',()=>{
  const article={body:'',fm:`faq:\n  - question: "Что говорит [закон](${url})?"\n    answer: "Штраф 500 рублей"`};
  assert.equal(extractClaims(article)[0].covered,false);
});
test('money normalization preserves both bounds and common word forms',()=>{
  assert.deepEqual(monetaryValues('от 500 до 900 рублей'),[500,900]);
  assert.deepEqual(monetaryValues('5–10 тыс. рублей'),[5000,10000]);
  assert.deepEqual(monetaryValues('пять тысяч рублей'),[5000]);
  assert.deepEqual(monetaryValues('от пяти до десяти тысяч рублей'),[5000,10000]);
  assert.deepEqual(monetaryValues('сто пятьдесят тысяч рублей'),[150000]);
  assert.deepEqual(monetaryValues('касса стоит 500 рублей'),[500]);
});
test('real evidence rejects a wrong amount and accepts equivalent word/numeric amounts',()=>{
  for(const [statement,excerpt,ok] of [
    ['Штраф 500 рублей','Штраф составляет 500 рублей.',true],
    ['Штраф 500 рублей','Штраф составляет 900 рублей.',false],
    ['Штраф пять тысяч рублей','Штраф составляет 5000 рублей.',true],
    ['Штраф пять тысяч рублей','Штраф составляет 9000 рублей.',false],
    ['Штраф 5–10 тыс. рублей','Штраф составляет от 5000 до 10000 рублей.',true],
    ['Штраф от пяти до десяти тысяч рублей','Штраф составляет от 5000 до 10000 рублей.',true],
  ]) {
    const claims=extractClaims(`${statement} согласно [закону](${url}).`);
    const evidence={documents:[{url,text:excerpt,status:200,fetchedAt:now.toISOString(),sha256:createHash('sha256').update(excerpt).digest('hex')}],claims:claims.map(c=>({claimHash:claimHash(c.sentence),source:url,excerpt,checkedAt:now.toISOString(),result:'verified',rationale:'Сумма и область применения сверены.'}))};
    assert.equal(checkClaimEvidence({claims,evidence,now}).ok,ok,statement);
  }
});
test('date evidence accepts equivalent formats and rejects a different month in the same year',()=>{
  for (const [statement,excerpt,ok] of [
    ['Порядок обязателен с 1.9.2026','Действует с 01.09.2026.',true],
    ['Порядок обязателен с сентября 2026 года','Действует с 01.09.2026.',true],
    ['Порядок обязателен с сентября 2026 года','Действует с августа 2026 года.',false],
    ['Порядок обязателен с 1.9.2026','Действует с 02.09.2026.',false],
  ]) {
    const claims=extractClaims(`${statement} согласно [закону](${url}).`);
    const evidence={documents:[{url,text:excerpt,status:200,fetchedAt:now.toISOString(),sha256:createHash('sha256').update(excerpt).digest('hex')}],claims:claims.map(c=>({claimHash:claimHash(c.sentence),source:url,excerpt,checkedAt:now.toISOString(),result:'verified',rationale:'Дата и применимость сверены.'}))};
    assert.equal(checkClaimEvidence({claims,evidence,now}).ok,ok,statement);
  }
});
