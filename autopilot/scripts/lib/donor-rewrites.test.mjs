import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donorRewriteDirections } from './donor-rewrites.mjs';

const rules = { minInbound: 2, maxOutbound: 3, minRelevance: 0.7 };
const article = (slug, title, body = title) => ({ slug, title, body, keywords: [], tags: [] });
const target = article('toys', 'Маркировка игрушек');
const donor = article('shop', 'Продажа игрушек', 'Маркировка игрушек требует проверки поставки.');
const unrelated = article('tax', 'Налоговая декларация', 'Уплата налогов и отчётность организации.');
function graph(out = []) {
  return { inbound: new Map([['toys', new Set(['existing'])], ['shop', new Set(['a', 'b'])], ['tax', new Set(['a', 'b'])]]), outbound: new Map([['shop', new Set(out)], ['tax', new Set()], ['toys', new Set()]]) };
}
test('missing incoming links create directions on relevant donors, never unrelated text or target itself', () => {
  const articles = [target, donor, unrelated];
  const before = JSON.stringify(articles);
  const directions = donorRewriteDirections(articles, graph(), rules);
  assert.deepEqual([...directions.keys()], ['shop']);
  assert.equal(directions.get('shop')[0].slug, 'toys');
  assert.equal(JSON.stringify(articles), before);
});
test('existing links and full outgoing budgets do not produce donor tasks', () => {
  assert.equal(donorRewriteDirections([target, donor], graph(['toys']), rules).size, 0);
  assert.equal(donorRewriteDirections([target, donor], graph(['a', 'b', 'c']), rules).size, 0);
});
test('target with sufficient incoming links does not request another donor', () => {
  const g = graph(); g.inbound.set('toys', new Set(['a', 'b']));
  assert.equal(donorRewriteDirections([target, donor], g, rules).size, 0);
});
test('ineligible best donor does not consume the opportunity of an eligible alternative', () => {
  const alternate = article('alternate', donor.title, donor.body);
  const directions = donorRewriteDirections([target, donor, alternate], graph(), rules, new Set(['alternate']));
  assert.equal(directions.has('shop'), false);
  assert.equal(directions.get('alternate')[0].slug, 'toys');
});


test('explicit hub exemption removes only outgoing ceiling from donor directions', () => {
  const hub={...donor,interlinkExempt:true};const full=graph(['a','b','c']);
  assert.equal(donorRewriteDirections([target,donor],full,rules).size,0);
  assert.equal(donorRewriteDirections([target,hub],full,rules).get('shop')[0].slug,'toys');
  assert.equal(donorRewriteDirections([target,hub],graph(['toys']),rules).size,0,'existing target still excluded');
  assert.equal(donorRewriteDirections([target,{...unrelated,interlinkExempt:true}],graph(),rules).size,0,'unrelated exempt donor still rejected');
  assert.equal(donorRewriteDirections([target,hub],full,rules,new Set()).size,0,'eligibility still binds');
});
