import test from 'node:test';
import assert from 'node:assert/strict';
import { readinessPlan } from '../../src/utils/etrn-readiness.mjs';

test('incomplete or unsupported answers cannot yield a readiness result', () => {
  assert.equal(readinessPlan({}).complete, false);
  assert.equal(readinessPlan({ role: 'sender', interface: '1c', partners: 'yes', signing: 'yes', trial: '<script>' }).complete, false);
});
test('unknowns remain tasks and 1C compatibility must be checked', () => {
  const plan = readinessPlan({ role: 'carrier', interface: '1c', partners: 'unknown', signing: 'no', trial: 'unknown' });
  assert.equal(plan.unresolved, 3);
  assert.match(plan.steps[0].text, /водителем/);
  assert.match(plan.steps.find(s => s.id === 'interface').text, /совместимость/);
  assert.ok(plan.steps.some(s => s.id === 'partners'));
});
test('all affirmative answers still require operational checks and make no legal certificate', () => {
  const plan = readinessPlan({ role: 'recipient', interface: 'web', partners: 'yes', signing: 'yes', trial: 'yes' });
  assert.equal(plan.unresolved, 0);
  assert.equal(plan.steps.length, 2);
  assert.match(plan.title, /проверить/);
  assert.match(plan.steps[0].text, /замечания/);
});

test('forwarder and self-pickup give distinct operational tasks and retain unresolved checks', () => {
  const answers = { interface: '1c', partners: 'unknown', signing: 'unknown', trial: 'no' };
  const forwarder = readinessPlan({ ...answers, role: 'forwarder' });
  const pickup = readinessPlan({ ...answers, role: 'self_pickup' });
  for (const plan of [forwarder, pickup]) {
    assert.equal(plan.complete, true);
    assert.equal(plan.unresolved, 3);
    assert.deepEqual(plan.steps.map(s => s.id), ['roles', 'interface', 'partners', 'signing', 'trial']);
  }
  assert.match(forwarder.steps[0].text, /заказчиком и перевозчиком/);
  assert.match(forwarder.steps[0].text, /полномочия/);
  assert.match(pickup.steps[0].text, /чей транспорт/);
  assert.match(pickup.steps[0].text, /самовывоз сам по себе не определяет/);
  assert.notEqual(forwarder.steps[0].text, pickup.steps[0].text);
  assert.equal(readinessPlan({ ...answers, role: 'forwarder<script>' }).complete, false);
});
