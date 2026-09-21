import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ETK-P0-02: тест проверяет КОРНЕВОЙ workflow принимающего репозитория —
// GitHub запускает только .github/workflows из корня, вложенный
// autopilot/.github/workflows/autopilot.yml не исполняется. Путь считаем
// от autopilot/scripts вверх на два уровня (корень сайта).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = readFileSync(path.join(ROOT, '.github', 'workflows', 'autopilot.yml'), 'utf8');

test('AP-P2-01: все uses зафиксированы по commit SHA', () => {
  const uses = [...WORKFLOW.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
  assert.ok(uses.length >= 3, 'ожидались шаги actions/checkout и setup-node');
  for (const ref of uses) {
    const [action, sha] = ref.split('@');
    assert.match(sha || '', /^[0-9a-f]{40}$/, `${action} не зафиксирован по SHA: ${ref}`);
  }
});

test('AP-P2-01: минимальные permissions и concurrency включены', () => {
  assert.match(WORKFLOW, /^permissions:\n\s+contents: read$/m);
  assert.match(WORKFLOW, /^concurrency:\n\s+group: auto-publish/m);
  assert.match(WORKFLOW, /cancel-in-progress: false/);
});

test('AP-P2-01: Dependabot настроен на github-actions', () => {
  const dependabot = readFileSync(path.join(ROOT, '.github', 'dependabot.yml'), 'utf8');
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /interval: weekly/);
});

test('AP-P2-01: мажорные теги actions в workflow не используются', () => {
  assert.ok(!/@v\d/.test(WORKFLOW), 'перемещаемый major tag недопустим');
});

test('ETK-P0-02: расписание выключено до canary', () => {
  const lines = WORKFLOW.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue; // закомментированное расписание — можно
    assert.ok(!/^\s*schedule\s*:/.test(line), `активный блок schedule запрещён: ${line.trim()}`);
    assert.ok(!line.includes('- cron:'), `активный cron запрещён: ${line.trim()}`);
  }
});

test('ETK-P0-02: feature flag AUTOPILOT_ENABLED гейтит мутирующие шаги', () => {
  assert.ok(WORKFLOW.includes('AUTOPILOT_ENABLED'), 'в workflow нет упоминания AUTOPILOT_ENABLED');
  assert.match(WORKFLOW, /vars\.AUTOPILOT_ENABLED/, 'флаг должен читаться из vars.AUTOPILOT_ENABLED');
  // Гейт обязан касаться именно мутирующих шагов plan/settle.
  assert.ok(WORKFLOW.includes('plan') && WORKFLOW.includes('settle'), 'в workflow нет шагов plan/settle');
  assert.match(
    WORKFLOW,
    /AUTOPILOT_ENABLED[\s\S]*plan[\s\S]*settle|plan[\s\S]*settle[\s\S]*AUTOPILOT_ENABLED/,
    'флаг AUTOPILOT_ENABLED должен гейтить шаги plan/settle',
  );
});

test('ETK-P0-02: preflight fail-closed, без глушения || true', () => {
  const lines = WORKFLOW.split('\n').filter((line) => line.includes('preflight.mjs'));
  assert.ok(lines.length > 0, 'в workflow нет вызовов preflight.mjs');
  for (const line of lines) {
    assert.ok(!line.includes('|| true'), `preflight заглушен: ${line.trim()}`);
  }
});

test('ETK-P0-02: все пути node autopilot/scripts/*.mjs существуют', () => {
  const refs = [...WORKFLOW.matchAll(/node\s+autopilot\/scripts\/([\w-]+\.mjs)/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, 'в workflow нет вызовов autopilot/scripts');
  assert.ok(!WORKFLOW.includes('github-run'), 'ссылка на несуществующий github-run.mjs запрещена');
  for (const name of new Set(refs)) {
    const file = path.join(ROOT, 'autopilot', 'scripts', name);
    assert.ok(existsSync(file), `скрипт из workflow отсутствует на диске: autopilot/scripts/${name}`);
  }
});

test('ETK-P0-02: permissions на уровне workflow не шире contents: read', () => {
  assert.match(WORKFLOW, /^permissions:\n\s+contents: read$/m);
  // contents: write допустим только в job (с отступом), но не на уровне workflow (с колонки 0).
  assert.ok(!/^permissions:\n\s+contents: write/m.test(WORKFLOW), 'workflow-уровень не должен иметь contents: write');
});
