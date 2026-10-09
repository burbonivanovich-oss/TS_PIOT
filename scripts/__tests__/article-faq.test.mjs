import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArticleFaq, faqPageJsonLd } from '../../src/utils/article-faq.mjs';

test('bold questions with line-break backslash and multi-line question', () => {
  const body = `Вступление.

## Частые вопросы

**Нужен ли отдельный договор с ЦРПТ?**\\
Нет. Договор у вас уже есть — когда регистрировались в [«Честном знаке»](/blog/x/).

**Можно ли торговать без кассы — например,
на рынке?**\\
Освобождение от ККТ не снимает обязательство по разрешительному режиму.

## Что дальше

Текст после блока.`;
  const items = extractArticleFaq(body);
  assert.equal(items.length, 2);
  assert.equal(items[0].question, 'Нужен ли отдельный договор с ЦРПТ?');
  assert.equal(items[0].answer, 'Нет. Договор у вас уже есть — когда регистрировались в «Честном знаке».');
  assert.equal(items[1].question, 'Можно ли торговать без кассы — например, на рынке?');
  assert.ok(!items[1].answer.includes('Текст после блока'));
});

test('subheading questions get a question mark; block ends at next section', () => {
  const body = `## FAQ

### Нужна ли касса кофейне на патенте
Да. Патент сам по себе не отменяет обязанность применять онлайн-кассу.

### Какой ФФД нужен кафе с пивом?
ФФД 1.2: продажа маркированного товара требует записи кода в чек.

## Итог
Не вопрос.`;
  const items = extractArticleFaq(body);
  assert.deepEqual(items.map((i) => i.question), ['Нужна ли касса кофейне на патенте?', 'Какой ФФД нужен кафе с пивом?']);
});

test('ambiguous or unverified blocks produce no markup', () => {
  assert.deepEqual(extractArticleFaq('Статья без блока вопросов.'), []);
  assert.deepEqual(extractArticleFaq(`## Частые вопросы

**Один вопрос?**
Только один ответ без пары.`), []);
  assert.deepEqual(extractArticleFaq(`## Частые вопросы

### Сколько стоит закрыть ООО
На бумаге — 800 ₽ <!-- VERIFY: размер госпошлины -->, при электронной подаче пошлины нет.

### Нужен ли ликвидатор?
Нет. В упрощённой процедуре ликвидатор не назначается.`), []);
  assert.deepEqual(extractArticleFaq(`## Частые вопросы

**Важно знать**
Это не вопрос, а выделение, поэтому разбор неоднозначен.

**Что делать?**
Ответ достаточной длины для разметки.`), []);
});

test('FAQPage requires at least two items', () => {
  assert.equal(faqPageJsonLd([{ question: 'Один?', answer: 'Ответ.' }]), null);
  const ld = faqPageJsonLd([{ question: 'А?', answer: 'Ответ А.' }, { question: 'Б?', answer: 'Ответ Б.' }]);
  assert.equal(ld['@type'], 'FAQPage');
  assert.equal(ld.mainEntity[1].acceptedAnswer.text, 'Ответ Б.');
});
