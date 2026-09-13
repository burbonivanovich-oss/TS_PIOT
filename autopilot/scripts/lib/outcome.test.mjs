import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, envelope, EXIT } from './outcome.mjs';

test('AP-P1-14: категории ошибок различаются', () => {
  assert.deepEqual(classifyError(new Error('Некорректный конфиг config.json')), { category: 'config', exitCode: EXIT.config });
  const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
  assert.deepEqual(classifyError(enoent), { category: 'infra', exitCode: EXIT.infra });
  assert.deepEqual(classifyError(new Error('Не найден каталог статей: /x')), { category: 'infra', exitCode: EXIT.infra });
  assert.deepEqual(classifyError(new Error('Контур уже работает: pid 1')), { category: 'infra', exitCode: EXIT.infra });
  assert.deepEqual(classifyError(new Error('Повреждён lock-файл /x')), { category: 'infra', exitCode: EXIT.infra });
  assert.deepEqual(classifyError(new Error('что-то сломалось')), { category: 'internal', exitCode: EXIT.internal });
});

test('AP-P1-14: конверт результата стабилен', () => {
  assert.deepEqual(envelope({ ok: true, runId: 'r1' }), { ok: true, category: 'ok', exitCode: EXIT.ok, runId: 'r1' });
  assert.deepEqual(envelope({ ok: false, category: 'infra', exitCode: EXIT.infra, error: 'нет' }), {
    ok: false, category: 'infra', exitCode: EXIT.infra, error: 'нет',
  });
});
