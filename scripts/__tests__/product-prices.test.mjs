import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPrice, PRODUCT_PRICES } from '../../src/data/product-prices.mjs';

test('price is shown only while its check is fresh', () => {
  const prices = { x: { lines: ['от 1 ₽'], url: 'https://kontur.ru/x', checkedAt: '2026-10-09' } };
  assert.ok(freshPrice('x', { prices, now: new Date('2026-10-20T00:00:00Z') }));
  assert.equal(freshPrice('x', { prices, now: new Date('2026-12-01T00:00:00Z') }), null);
  assert.equal(freshPrice('missing', { prices }), null);
});

test('every price links to an official Kontur page and has a date', () => {
  for (const [id, p] of Object.entries(PRODUCT_PRICES)) {
    assert.match(p.url, /^https:\/\/([a-z-]+\.)?(kontur\.ru|diadoc\.ru|e-kontur\.ru)\//, id);
    assert.match(p.checkedAt, /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(p.lines.length > 0, id);
  }
});
