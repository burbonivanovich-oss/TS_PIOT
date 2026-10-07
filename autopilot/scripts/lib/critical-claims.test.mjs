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
test('recognition preserves the exact displayed sentence for retained evidence',()=>{
  const sentence=`**Штраф** составляет **500** рублей согласно [закону](${url}).`;
  const claims=extractClaims(sentence);
  assert.equal(claims[0].sentence,sentence);
  assert.equal(claimHash(claims[0].sentence),claimHash(sentence));
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


test('legal genitive money forms preserve tens, hundreds and both bounds',()=>{
  assert.deepEqual(monetaryValues('от пятидесяти тысяч до трехсот тысяч рублей'),[50000,300000]);
  assert.deepEqual(monetaryValues('от ста пятидесяти тысяч до двухсот тысяч рублей'),[150000,200000]);
  assert.deepEqual(monetaryValues('от пятисот до девятисот рублей'),[500,900]);
  assert.deepEqual(monetaryValues('от одиннадцати до девятнадцати рублей'),[11,19]);
  assert.deepEqual(monetaryValues('от трёхсот тысяч до четырёхсот тысяч рублей'),[300000,400000]);
});

test('a real legal amount representation confirms numeric claims but rejects other bounds',()=>{
  const excerpt='Штраф от пятидесяти тысяч до трехсот тысяч рублей.';
  for(const [amount,ok] of [['50 000–300 000',true],['50 000–100 000',false],['150 000–300 000',false]]){
    const claims=extractClaims(`Штраф ${amount} рублей согласно [закону](${url}).`);
    assert.equal(claims.length,1);
    const evidence={documents:[{url,text:excerpt,status:200,fetchedAt:now.toISOString(),sha256:createHash('sha256').update(excerpt).digest('hex')}],claims:[{claimHash:claimHash(claims[0].sentence),source:url,excerpt,checkedAt:now.toISOString(),result:'verified',rationale:'Суммы и применимость сверены.'}]};
    assert.equal(checkClaimEvidence({claims,evidence,now}).ok,ok);
  }
});

test('genitive fine recognition retains source binding and does not turn a price into liability',()=>{
  const sentence=`За нарушение штраф от пятидесяти тысяч до трехсот тысяч рублей согласно [закону](${url}).`;
  const claims=extractClaims(sentence);
  assert.equal(claims.length,1);assert.equal(claims[0].text,'от пятидесяти тысяч до трехсот тысяч рублей');
  assert.equal(claims[0].sentence,sentence);assert.equal(claims[0].source,url);
  assert.deepEqual(extractClaims('Оборудование стоит от пятидесяти тысяч до трехсот тысяч рублей.'),[]);
});

test('a legal part abbreviation inside a Markdown link keeps the full source sentence',()=>{
  const sentence=`Продажа без маркировки — [ст. 15.12 ч. 2 КоАП РФ](${url}).`;
  const claims=extractClaims(sentence);
  assert.equal(claims.length,2);
  assert.ok(claims.every(c=>c.sentence===sentence && c.source===url && c.covered));
  assert.equal(claimHash(claims[0].sentence),claimHash(sentence));
});

test('legal abbreviations preserve a sentence but a source in the next sentence does not cover it',()=>{
  for(const abbreviation of ['ч. 2','п. 2','пп. 2','подп. 2','абз. 2']) {
    const sentence=`По ${abbreviation} порядок обязателен с 1.9.2026 согласно [норме](${url}).`;
    assert.equal(extractClaims(sentence).find(c=>c.id==='date').sentence,sentence);
  }
  const claims=extractClaims(`По [ст. 15.12 ч. 2](${url}) действует запрет. Штраф 500 рублей.`);
  assert.equal(claims.find(c=>c.id==='fine').source,null);
});

test('a pipe in a source URL or escaped prose is not a sentence or table-cell boundary',()=>{
  const source=url+'?part=1|2';
  const sentence=`Штраф 500 рублей по [ст. 15.12 ч. 2](${source}).`;
  const claims=extractClaims(sentence);
  assert.ok(claims.every(c=>c.sentence===sentence && c.source===source));
  const escaped=`Штраф 500 рублей \\| согласно [норме](${url}).`;
  assert.equal(extractClaims(escaped)[0].sentence,escaped);
});

test('bare regulatory table dates are found in written, short and month-only form with exact text',()=>{
  for(const date of ['1 сентября 2026','1.9.2026','сентября 2026']) {
    const table=`| Дата | Требование |\n|---|---|\n| ${date} | Обязательная маркировка |`;
    const claims=extractClaims(table);
    assert.equal(claims.length,1,date);
    assert.equal(claims[0].text,date);assert.equal(claims[0].sentence,` ${date} `);
    assert.equal(claims[0].covered,false);
  }
});

test('actual header/separator and normative row context are required for bare table dates',()=>{
  for(const text of [
    '| Дата | Релиз |\n|---|---|\n| 1 сентября 2026 | Версия 2.3.24.18 |',
    '| Дата | Событие |\n|---|---|\n| 1 сентября 2026 | Публикация статьи |',
    '| Дата | Цена |\n|---|---|\n| 1 сентября 2026 | Касса 500 рублей |',
    '| 1 сентября 2026 | Обязательная маркировка |',
    '```md\n| Дата | Требование |\n|---|---|\n| 1 сентября 2026 | Обязательная маркировка |\n```',
  ]) assert.deepEqual(extractClaims(text),[],text);
  // Adding a release mention must not hide an explicit regulatory obligation.
  assert.equal(extractClaims('| Дата | Требование |\n|---|---|\n| 1 сентября 2026 | Обязательная маркировка; обновите релиз |').length,1);
});

test('table date evidence stays in its own sentence/cell and stale or wrong evidence still fails',()=>{
  const outside=`| Дата | Требование | Источник |\n|---|---|---|\n| 1 сентября 2026 | Обязательная маркировка | [Норма](${url}) |`;
  assert.equal(extractClaims(outside)[0].source,null);
  const inside=`| Дата | Требование |\n|---|---|\n| [1 сентября 2026](${url}) | Обязательная маркировка |`;
  const claims=extractClaims(inside);assert.equal(claims.length,1);assert.equal(claims[0].source,url);
  const evidence={documents:[{url,text:'Порядок обязателен с 1 сентября 2026.',status:200,fetchedAt:now.toISOString(),sha256:createHash('sha256').update('Порядок обязателен с 1 сентября 2026.').digest('hex')}],claims:[{claimHash:claimHash(claims[0].sentence),source:url,excerpt:'Порядок обязателен с 1 сентября 2026.',checkedAt:now.toISOString(),result:'verified',rationale:'Дата и область применения сверены.'}]};
  assert.equal(checkClaimEvidence({claims,evidence,now}).ok,true);
  assert.equal(checkClaimEvidence({claims:extractClaims(inside.replace('1 сентября','2 сентября')),evidence,now}).ok,false);
  const stale=structuredClone(evidence);stale.documents[0].fetchedAt='2025-01-01';
  assert.equal(checkClaimEvidence({claims,evidence:stale,now}).ok,false);
  assert.equal(extractClaims(`| Дата | Требование |\n|---|---|\n| 1 сентября 2026. [Норма](${url}) | Обязательная маркировка |`)[0].source,null);
});

test('tables without outer pipes work, prefixed dates are not duplicated, URL dates are invisible',()=>{
  const table='Дата | Требование\n--- | ---\n1 сентября 2026 | Регистрация участников оборота в Честном знаке';
  assert.equal(extractClaims(table).length,1);
  assert.equal(extractClaims(table.replace('1 сентября','с 1 сентября')).length,1);
  const hidden=`| Дата | Требование |\n|---|---|\n| [Источник](${url}?date=1.9.2026) | Обязательная маркировка |`;
  assert.deepEqual(extractClaims(hidden),[]);
});
