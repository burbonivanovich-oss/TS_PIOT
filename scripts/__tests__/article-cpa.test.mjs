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
