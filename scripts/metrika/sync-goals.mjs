#!/usr/bin/env node
// Синхронизация целей Яндекс.Метрики с декларативным конфигом.
//
// Источник истины: src/data/metrika/goals.json
// Через Management API создаёт недостающие цели и обновляет имена
// существующих. Идемпотентно. Цели, которых нет в JSON, оставляет
// нетронутыми (не удаляет — может сломать историческую аналитику)
// и выводит как ORPHAN — решение принимает человек вручную.
//
// Окружение:
//   METRIKA_OAUTH_TOKEN — OAuth-токен с oauth.yandex.ru, scope metrika:write
//   DRY_RUN=1           — не делает POST/PUT, печатает план и выходит
//
// Документация API:
//   https://yandex.ru/dev/metrika/doc/api2/management/goals/goals.html

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOALS_FILE = join(ROOT, 'src', 'data', 'metrika', 'goals.json');

const TOKEN = process.env.METRIKA_OAUTH_TOKEN || '';
const DRY_RUN = process.env.DRY_RUN === '1';

if (!TOKEN && !DRY_RUN) {
  console.error('METRIKA_OAUTH_TOKEN не задан. Запустите с DRY_RUN=1, чтобы посмотреть план без API.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(GOALS_FILE, 'utf8'));
const { counterId, goals: declared } = config;

if (!counterId || !Array.isArray(declared)) {
  console.error('Некорректный goals.json: ожидаются поля counterId и goals[].');
  process.exit(1);
}

const API_BASE = 'https://api-metrika.yandex.net/management/v1';

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `OAuth ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

// Payload для разных типов целей:
//   action: JavaScript-событие через reachGoal.
//           conditions[0]: { type: 'exact', url: <id> }
//   number: количество просмотров за визит.
//           conditions[0]: { type: <operator>, url: <число> }
//   time:   время на сайте, в секундах.
//           conditions[0]: { type: <operator>, url: <секунды> }
function buildPayload(g) {
  if (g.type === 'action') {
    return {
      goal: {
        name: g.name,
        type: 'action',
        conditions: [{ type: 'exact', url: g.id }],
      },
    };
  }
  if (g.type === 'number' || g.type === 'time') {
    if (!g.operator || !g.value) {
      throw new Error(`Цель ${g.id} типа ${g.type} требует operator и value`);
    }
    return {
      goal: {
        name: g.name,
        type: g.type,
        conditions: [{ type: g.operator, url: String(g.value) }],
      },
    };
  }
  throw new Error(`Неподдерживаемый тип цели: ${g.type} (id=${g.id})`);
}

// Ключ идентификации, по которому сравниваем декларацию и существующее.
// Для action — стабильный id из reachGoal.
// Для number/time — комбинация type+operator+value (это уникально для цели,
// и id в Метрике мы при этом сохраняем для PUT при изменении name).
function declaredKey(g) {
  if (g.type === 'action') return `action:${g.id}`;
  return `${g.type}:${g.operator}:${g.value}`;
}

function remoteKey(r) {
  const cond = (r.conditions || [])[0];
  if (!cond) return null;
  if (r.type === 'action') return `action:${cond.url}`;
  if (r.type === 'number' || r.type === 'time') {
    return `${r.type}:${cond.type}:${cond.url}`;
  }
  return null;
}

console.log(`Счётчик: ${counterId}`);
console.log(`Целей в конфиге: ${declared.length}`);
console.log(`Режим: ${DRY_RUN ? 'DRY_RUN (без записи)' : 'боевой'}\n`);

// ─── Чтение существующих ──────────────────────────────────────────────────────
// GET безопасен — делаем его и в DRY_RUN тоже, чтобы план был точным.
// Без токена пропускаем (например, локальный прогон для проверки парсинга
// goals.json), но честно предупреждаем, что план неполный.
let remote = [];
if (TOKEN) {
  const resp = await api(`/counter/${counterId}/goals`);
  remote = resp?.goals || [];
  console.log(`Существующих целей на счётчике: ${remote.length}\n`);
} else {
  console.log('Без METRIKA_OAUTH_TOKEN пропускаю чтение счётчика — план будет показывать «создать всё».\n');
}

const remoteByKey = new Map();
for (const r of remote) {
  const key = remoteKey(r);
  if (key) remoteByKey.set(key, r);
}

const declaredKeys = new Set(declared.map(declaredKey));

// ─── План ─────────────────────────────────────────────────────────────────────
const toCreate = [];
const toUpdate = [];
const orphans = [];

for (const g of declared) {
  const key = declaredKey(g);
  const existing = remoteByKey.get(key);
  if (!existing) {
    toCreate.push(g);
    continue;
  }
  if (existing.name !== g.name) {
    toUpdate.push({ remote: existing, declared: g });
  }
}

for (const r of remote) {
  const key = remoteKey(r);
  if (!key) continue;
  if (!declaredKeys.has(key)) orphans.push({ key, name: r.name, remoteId: r.id, type: r.type });
}

console.log(`План:`);
console.log(`  создать:    ${toCreate.length}`);
console.log(`  обновить:   ${toUpdate.length}`);
console.log(`  без правок: ${declared.length - toCreate.length - toUpdate.length}`);
console.log(`  ORPHAN (есть на счётчике, нет в конфиге): ${orphans.length}\n`);

if (toCreate.length) {
  console.log('Создать:');
  for (const g of toCreate) console.log(`  + [${g.type}] ${g.id} → "${g.name}"`);
  console.log('');
}
if (toUpdate.length) {
  console.log('Обновить (изменилось имя):');
  for (const { remote, declared } of toUpdate) {
    console.log(`  ~ [${declared.type}] ${declared.id}: "${remote.name}" → "${declared.name}" (remoteId=${remote.id})`);
  }
  console.log('');
}
if (orphans.length) {
  console.log('ORPHAN (не трогаем — решение за человеком):');
  for (const o of orphans) console.log(`  ? [${o.type}] remoteId=${o.remoteId} "${o.name}"`);
  console.log('');
}

if (DRY_RUN) {
  console.log('DRY_RUN — выход без записи.');
  process.exit(0);
}

// ─── Выполнение ───────────────────────────────────────────────────────────────
let created = 0, updated = 0, failed = 0;

for (const g of toCreate) {
  try {
    const resp = await api(`/counter/${counterId}/goals`, {
      method: 'POST',
      body: buildPayload(g),
    });
    console.log(`OK создал: [${g.type}] ${g.id} (remoteId=${resp?.goal?.id ?? '?'})`);
    created++;
  } catch (err) {
    console.error(`FAIL создание ${g.id}: ${err.message}`);
    failed++;
  }
}

for (const { remote, declared } of toUpdate) {
  try {
    await api(`/counter/${counterId}/goal/${remote.id}`, {
      method: 'PUT',
      body: buildPayload(declared),
    });
    console.log(`OK обновил: [${declared.type}] ${declared.id} (remoteId=${remote.id})`);
    updated++;
  } catch (err) {
    console.error(`FAIL обновление ${declared.id}: ${err.message}`);
    failed++;
  }
}

console.log(`\nГотово. Создано: ${created}, обновлено: ${updated}, ошибок: ${failed}.`);
if (orphans.length) {
  console.log(`Напоминание: ${orphans.length} ORPHAN-целей остались на счётчике. Удалите вручную в UI Метрики, если они не нужны.`);
}
if (failed) process.exit(1);
