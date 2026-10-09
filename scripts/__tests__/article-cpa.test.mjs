import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articleCpa } from '../../src/utils/article-cpa.mjs';

test('dedicated transport subjects select Logistics', () => {
  for (const title of ['ЭТрН с 1 сентября', '140-ФЗ: переход на ЭПД', 'Как подписать электронную транспортную накладную']) {
    assert.equal(articleCpa({ title }, 'default-zakonodatelstvo'), 'diadoc-logistika');
  }
  assert.equal(articleCpa({ title: 'Как подключить перевозчика', tags: ['ЭТРН'] }, 'default-zakonodatelstvo'), 'diadoc-logistika');
});
test('cash register/delivery/tax topics keep their offers; explicit assignment wins', () => {
  for (const title of ['Касса для доставки еды', 'Штрафы за кассу', 'Изменения НДС', 'УПД при приёмке маркировки', 'Перевозки товара своим транспортом']) {
    assert.equal(articleCpa({ title }, 'kontur-ofd'), 'kontur-ofd');
  }
  assert.equal(articleCpa({ title: 'ЭТРН', cpa: 'kontur-diadoc' }, 'kontur-ofd'), 'kontur-diadoc');
});

const PAID = new Set(['ts-piot-provider', 'kontur-ofd', 'kontur-market', 'kontur-elba', 'kontur-markirovka', 'diadoc-kedo', 'kontur-mchd', 'kontur-focus', 'kontur-extern', 'diadoc-logistika']);
const isPaid = (id) => PAID.has(id);

test('free button is replaced by a paid offer matching the topic', () => {
  const cases = [
    [{ title: 'ОФД для ТС ПИоТ 2026: что такое оператор фискальных данных' }, 'chestny-znak', 'kontur-ofd'],
    [{ title: 'ТС ПИоТ: что это и кому нужен' }, 'chestny-znak', 'ts-piot-provider'],
    [{ title: 'НДС на УСН в 2026: ставка 5%, 7% или 22%' }, 'default-zakonodatelstvo', 'kontur-elba'],
    [{ title: 'КЭДО для малого бизнеса: с чего начать внедрение' }, 'default-zakonodatelstvo', 'diadoc-kedo'],
    [{ title: 'Маркировка воды в 2026 году: что требуется от розницы' }, 'default-markirovka', 'kontur-market'],
    [{ title: 'Регистрация в «Честном знаке»: пошаговая инструкция', cpa: 'chestny-znak' }, 'kontur-markirovka', 'kontur-markirovka'],
  ];
  for (const [data, fallback, expected] of cases) {
    assert.equal(articleCpa(data, fallback, { isPaid }), expected, data.title);
  }
});

test('paid choices are kept; no topical offer keeps the free button unless the section has one', () => {
  assert.equal(articleCpa({ title: 'ТС ПИоТ и касса', cpa: 'kontur-elba' }, 'chestny-znak', { isPaid }), 'kontur-elba');
  assert.equal(articleCpa({ title: 'Касса для кафе' }, 'kontur-ofd', { isPaid }), 'kontur-ofd');
  assert.equal(articleCpa({ title: 'Персональные данные: штрафы', tags: ['152-фз'] }, 'default-zakonodatelstvo', { isPaid }), 'default-zakonodatelstvo');
  assert.equal(articleCpa({ title: 'Что нового в разделе' }, 'chestny-znak', { isPaid, categoryOffer: 'ts-piot-provider' }), 'ts-piot-provider');
  assert.equal(articleCpa({ title: 'Что нового в разделе' }, 'chestny-znak', { isPaid, categoryOffer: 'draft-offer' }), 'chestny-znak');
});

test('every topical offer is a registered paid banner', async () => {
  const { ARTICLE_TOPIC_OFFERS } = await import('../../src/utils/article-cpa.mjs');
  const fs = await import('node:fs');
  const erids = JSON.parse(fs.readFileSync(new URL('../../src/data/ord-erids.json', import.meta.url), 'utf8'));
  for (const { id } of ARTICLE_TOPIC_OFFERS) assert.ok(erids[id], `${id} без erid`);
});
