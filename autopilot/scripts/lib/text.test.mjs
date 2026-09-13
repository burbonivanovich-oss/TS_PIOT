import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, canonicalKey, jaccard, weightedJaccard, weightedCoverage, buildIdf, shingles, slugify } from './text.mjs';

test('tokenize убирает стоп-слова и стеммирует', () => {
  const t = tokenize('Что такое маркировка и кому она нужна');
  assert.ok(!t.has('что'));
  assert.ok(!t.has('нужна'));
  assert.ok(t.has('маркировк'));
});

test('canonicalKey не зависит от порядка слов', () => {
  assert.equal(
    canonicalKey('Кто обязан подключить ТС ПИоТ'),
    canonicalKey('ТС ПИоТ подключить обязан кто'),
  );
});

test('IDF гасит общие слова тематики', () => {
  // Корпус, где «маркировка» есть везде, а товарная группа — в одном месте.
  const corpus = [
    'маркировка игрушек',
    'маркировка косметики',
    'маркировка обуви',
    'маркировка одежды',
  ];
  const model = buildIdf(corpus);
  const igrushki = tokenize('маркировка игрушек');
  const kosmetika = tokenize('маркировка косметики');

  const plain = jaccard(igrushki, kosmetika);
  const weighted = weightedJaccard(igrushki, kosmetika, model);
  assert.ok(plain >= 0.3, `без весов сходство должно быть заметным, получили ${plain}`);
  assert.ok(weighted < plain, 'взвешенное сходство обязано быть ниже простого');
});

test('weightedCoverage ловит тему, целиком лежащую внутри другой', () => {
  const model = buildIdf(['ЕГАИС для розницы', 'маркировка обуви', 'касса для общепита']);
  const narrow = tokenize('ЕГАИС розница');
  const wide = tokenize('ЕГАИС для розницы: подключение и отчётность');
  assert.ok(weightedCoverage(narrow, wide, model) > 0.8);
});

test('стеммер не трогает короткие слова — это осознанный предел', () => {
  // «бар» и «бара» остаются разными токенами: агрессивное срезание окончаний
  // у четырёхбуквенных слов склеивает несвязанные термины куда чаще, чем
  // помогает. Тест фиксирует предел, чтобы он не «чинился» случайно.
  assert.notEqual([...tokenize('бар')][0], [...tokenize('бара')][0]);
});

test('shingles пустеют на коротком тексте, а не падают', () => {
  assert.equal(shingles('два слова', 5).size, 0);
});

test('slugify транслитерирует и чистит', () => {
  assert.equal(slugify('ГИС ЭПД: как подключить — инструкция'), 'gis-epd-kak-podklyuchit-instrukciya');
});
