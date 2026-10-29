#!/usr/bin/env node
// Цели счётчика Вакандии (vakandia.ru, 112539872) — отдельно от целей Этикетки.
//
// Только создаёт недостающие JS-цели из goals.json. Существующие цели не
// переименовывает и не удаляет: у восьми целей Вакандии от 13.09.2026 уже
// есть история. Ключ — тот же METRIKA_OAUTH_TOKEN, что у Этикетки: он
// сработает, только если у его аккаунта есть доступ к счётчику Вакандии.
//
// Окружение:
//   METRIKA_OAUTH_TOKEN — OAuth-токен, scope metrika:write
//   DRY_RUN=1           — прочитать счётчик и показать план, ничего не создавать

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPayload, declaredKey, remoteKey } from '../goal-contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { counterId, goals: declared } = JSON.parse(readFileSync(join(HERE, 'goals.json'), 'utf8'));
const TOKEN = process.env.METRIKA_OAUTH_TOKEN || '';
const DRY_RUN = process.env.DRY_RUN !== '0';
const API_BASE = 'https://api-metrika.yandex.net/management/v1';

if (counterId !== 112539872) throw new Error(`Чужой счётчик в goals.json: ${counterId}`);
if (!TOKEN) {
  console.error('METRIKA_OAUTH_TOKEN не задан.');
  process.exit(1);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `OAuth ${TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

console.log(`Счётчик: ${counterId} · целей в списке: ${declared.length} · режим: ${DRY_RUN ? 'план' : 'запись'}`);

let remote;
try {
  remote = (await api(`/counter/${counterId}/goals`))?.goals || [];
} catch (error) {
  console.error(`Нет доступа к счётчику Вакандии этим ключом: ${error.message}`);
  console.error('Нужен ключ аккаунта, у которого есть доступ к счётчику 112539872.');
  process.exit(2);
}
console.log(`На счётчике уже целей: ${remote.length}`);
// Как устроены существующие цели: без этого не понять, почему цель не узнана.
for (const goal of remote) {
  const conditions = (goal.conditions || []).map((c) => `${c.type}:${c.url}`).join(', ');
  console.log(`  = ${goal.id} · ${goal.type} · ${conditions || '—'} · ${goal.name}`);
}

// JS-цель узнаётся по идентификатору события при любом типе совпадения:
// цели 13.09.2026 могли завести не через «exact». Дубли хуже пропуска.
const knownIds = new Set();
for (const goal of remote) {
  if (goal.type !== 'action') continue;
  for (const condition of goal.conditions || []) knownIds.add(condition.url);
}
const existing = new Set(remote.map(remoteKey).filter(Boolean));
const missing = declared.filter((goal) => !existing.has(declaredKey(goal)) && !knownIds.has(goal.id));
console.log(`Есть: ${declared.length - missing.length} · создать: ${missing.length}`);
for (const goal of missing) console.log(`  + ${goal.id} — ${goal.name}`);

if (DRY_RUN || missing.length === 0) process.exit(0);

let created = 0;
for (const goal of missing) {
  const result = await api(`/counter/${counterId}/goals`, { method: 'POST', body: buildPayload(goal) });
  created += 1;
  console.log(`  создана ${goal.id} → id ${result?.goal?.id ?? '?'}`);
}
console.log(`Создано: ${created} из ${missing.length}`);
