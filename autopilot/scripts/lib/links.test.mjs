import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInternalTarget, extractInternalLinks, listInternalLinks, unpublishedSlugs } from './links.mjs';

test('AP-P1-07: формы внутренних ссылок нормализуются к slug', () => {
  assert.equal(normalizeInternalTarget('/blog/abc'), 'abc');
  assert.equal(normalizeInternalTarget('/blog/abc/'), 'abc');
  assert.equal(normalizeInternalTarget('/blog/abc?utm=1'), 'abc');
  assert.equal(normalizeInternalTarget('/blog/abc#section'), 'abc');
  assert.equal(normalizeInternalTarget('/blog/abc/?q=1#s'), 'abc');
  assert.equal(normalizeInternalTarget('./abc'), 'abc');
  assert.equal(normalizeInternalTarget('/blog/%D0%BC%D0%B0%D1%80%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0'), 'маркировка');
  assert.equal(normalizeInternalTarget('https://example.com/x'), null);
  assert.equal(normalizeInternalTarget('/blog/a/b'), null, 'вложенный маршрут — не slug');
  assert.equal(normalizeInternalTarget('/other/abc'), null);
  assert.equal(normalizeInternalTarget('mailto:a@b'), null);
});

test('AP-P1-07: дубли и разные формы одной ссылки схлопываются', () => {
  const body =
    'Первая [a](/blog/x/) и [b](/blog/x?utm=1) и [c](/blog/x#top), плюс [d](/blog/y).';
  assert.deepEqual([...extractInternalLinks(body)].sort(), ['x', 'y']);
  assert.equal(listInternalLinks(body).length, 4, 'отчёт хранит все вхождения');
});

test('AP-P1-07: непубликуемые цели определяются', () => {
  const articles = [
    { slug: 'published', draft: false, data: {} },
    { slug: 'draft', draft: true, data: {} },
    { slug: 'held', draft: false, data: { autopilotHold: true } },
  ];
  assert.deepEqual([...unpublishedSlugs(articles)].sort(), ['draft', 'held']);
});
