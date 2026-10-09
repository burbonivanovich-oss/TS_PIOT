import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineOfferTarget, placeInlineOffer } from '../../src/utils/inline-offer.mjs';

function prose(sectionCount, { hasInline = false } = {}) {
  const sections = Array.from({ length: sectionCount }, (_, i) => ({ i, inserted: null, before(node) { this.inserted = node; } }));
  return {
    sections,
    querySelector: (sel) => (sel === '[data-cpa-placement="inline"]' && hasInline ? {} : null),
    querySelectorAll: (sel) => (sel === ':scope > h2' ? sections : []),
  };
}

test('offer goes before the third section of a long article', () => {
  const p = prose(6);
  assert.equal(inlineOfferTarget(p), p.sections[2]);
});

test('short articles and articles with their own inline offer are left alone', () => {
  assert.equal(inlineOfferTarget(prose(3)), null);
  assert.equal(inlineOfferTarget(prose(8, { hasInline: true })), null);
  assert.equal(inlineOfferTarget(null), null);
});

test('placement clones the server template once; no template — no offer', () => {
  const p = prose(5);
  const clone = { cloned: true };
  const doc = (template) => ({
    getElementById: (id) => (id === 'inline-offer' ? template : null),
    querySelector: (sel) => (sel === '.prose' ? p : null),
  });
  assert.equal(placeInlineOffer(doc({ content: { cloneNode: () => clone } })), true);
  assert.equal(p.sections[2].inserted, clone);
  assert.equal(placeInlineOffer(doc(null)), false);
});
