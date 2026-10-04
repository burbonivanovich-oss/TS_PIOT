import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commercialPayload, emitCommercial, commercialEnabled } from '../../src/utils/commercial-events.mjs';

test('new commercial events require explicit activation and stay off on local checks', () => {
  for (const flag of [undefined, null, false, true, '', 'false', '1']) assert.equal(commercialEnabled(flag, 'etiketka-media.ru'), false);
  for (const hostname of ['localhost', '127.0.0.1', '[::1]', '::1']) assert.equal(commercialEnabled('true', hostname), false);
  assert.equal(commercialEnabled('true', 'etiketka-media.ru'), true);
});

test('commercial payload contains controlled interface ids and drops personal/free-text fields', () => {
  const payload = commercialPayload('selector-result', { task: 'etrn', role: 'carrier', offer: 'diadoc-logistika', email: 'private@example.org', phone: '+79991234567', url: 'https://site/?email=private', title: 'private text', inn: '1234567890' });
  assert.deepEqual(payload, { event: 'selector-result', params: { offer: 'diadoc-logistika', task: 'etrn', role: 'carrier' } });
  assert.deepEqual(commercialPayload('form-start', { offer: 'private@example.org', task: 'free text', role: 'John Smith' }).params, {});
});

test('submit attempt is distinct from confirmed leads/payment and sender failure is harmless', () => {
  const sent = [];
  assert.equal(emitCommercial('form-submit-attempt', { offer: 'diadoc-logistika' }, (event, params) => sent.push({ event, params })), true);
  assert.equal(sent[0].event, 'form-submit-attempt');
  assert.equal(commercialPayload('lead-confirmed', {}), null);
  assert.equal(commercialPayload('paid', {}), null);
  assert.equal(emitCommercial('product-cta-click', { offer: 'diadoc-logistika', action: 'lead' }, () => { throw new Error('counter blocked'); }), false);
});
