import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedPaths, codexAutomationActive, parseDailyOutput, releasedFromResult, requiredText } from './scheduler.mjs';

const sha = 'a'.repeat(40);

test('итог daily берётся из последнего JSON после вывода тестов', () => {
  const stdout = '✔ test one\nℹ tests 468\n{\n  "nested": {\n    "x": 1\n  }\n}\nещё вывод\n{\n  "status": "committed",\n  "runId": "2026-10-12-abcd1234"\n}\n';
  assert.deepEqual(parseDailyOutput(stdout), { status: 'committed', runId: '2026-10-12-abcd1234' });
  assert.deepEqual(parseDailyOutput('{\n  "status": "push_pending"\n}\n'), { status: 'push_pending' });
  assert.equal(parseDailyOutput('нет JSON'), null);
  assert.equal(parseDailyOutput('\n{\n  оборвано'), null);
});

test('выпуск: SHA из обычной доставки или восстановления, только опубликованные', () => {
  const result = { delivery: { publication: { commit: sha } }, acceptance: { results: [
    { slug: 'a', status: 'published' }, { slug: 'b', status: 'release_rejected' }, { slug: 'a', status: 'published' }, { slug: 'c', status: 'published' },
  ] } };
  assert.deepEqual(releasedFromResult(result), { commit: sha, slugs: ['a', 'c'] });
  assert.equal(releasedFromResult({ publication: { commit: sha } }).commit, sha);
  assert.deepEqual(releasedFromResult({ status: 'committed' }), { commit: null, slugs: [] });
  assert.equal(releasedFromResult({ delivery: { publication: { commit: 'not-a-sha' } } }).commit, null);
});

test('фраза проверки: заголовок или простой фрагмент, для рерайта — новая', () => {
  const fm = '---\ntitle: "T"\ndraft: false\n---\n';
  const fresh = `${fm}import X from 'y';\n\nКороткий.\n\n## Шаг 1. Соберите данные магазина\n\nТекст про **жирное** и [ссылку](https://x.ru), без длинных простых кусков.\n`;
  assert.equal(requiredText(fresh), 'Шаг 1. Соберите данные магазина');
  const quoted = `${fm}## Что такое "кавычки" в заголовке\n\nЧтобы подключить маркировку воды в магазине, подготовьте подпись и проверьте поставщика заранее.\n`;
  assert.equal(requiredText(quoted), 'Чтобы подключить маркировку воды в магазине, подготовьте подпись и');
  const old = `${fm}## Шаг 1. Соберите данные магазина\n\nСтарый текст.\n`;
  const rewritten = `${fm}## Шаг 1. Соберите данные магазина\n\n## Исправленный порядок снятия кассы\n`;
  assert.equal(requiredText(rewritten, old), 'Исправленный порядок снятия кассы');
  assert.equal(requiredText(old, old), null);
  assert.equal(requiredText(`${fm}| таблица | только |\n- список\n`), null);
});

test('включённая автоматизация Codex распознаётся по статусу', () => {
  assert.equal(codexAutomationActive('id = "automation-2"\nstatus = "ACTIVE"\nrrule = "x"'), true);
  assert.equal(codexAutomationActive('status = "PAUSED"'), false);
  assert.equal(codexAutomationActive('prompt = "status = \\"ACTIVE\\""'), false);
  assert.equal(codexAutomationActive(''), false);
});

test('пути изменённых файлов не теряют первую букву', () => {
  assert.deepEqual(changedPaths(' M autopilot/data/backlog.json\0?? autopilot/data/week-plan.json\0M  src/x.md\0'), ['autopilot/data/backlog.json', 'autopilot/data/week-plan.json', 'src/x.md']);
  assert.deepEqual(changedPaths(''), []);
});
