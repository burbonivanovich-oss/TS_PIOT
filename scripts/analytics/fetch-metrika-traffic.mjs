#!/usr/bin/env node
// Тянет данные Яндекс.Метрики (Stat API) по трафику страниц за N
// последних дней. Возвращает по каждому URL: визиты, просмотры,
// уникальных пользователей, среднюю длительность визита.
//
// Окружение:
//   METRIKA_OAUTH_TOKEN — тот же токен, что для sync-goals (scope
//     metrika:write включает metrika:read).
//   METRIKA_COUNTER_ID=109130279 — счётчик (по умолчанию наш).
//   DAYS=28 — окно по умолчанию.
//   DRY_RUN=1 — печатает план и выходит.
//
// Запись: src/data/analytics/metrika.json
//   { fetchedAt, days, byPage: { "/blog/...": { visits, pageviews, users, avgDuration } } }

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'analytics');
const OUT_FILE = join(OUT_DIR, 'metrika.json');

const TOKEN = process.env.METRIKA_OAUTH_TOKEN || '';
const COUNTER = process.env.METRIKA_COUNTER_ID || '109130279';
const DAYS = parseInt(process.env.DAYS || '28', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

if (!TOKEN && !DRY_RUN) {
  console.error('METRIKA_OAUTH_TOKEN не задан. Используйте тот же токен, что для sync-goals.');
  process.exit(1);
}

const today = new Date();
const startDate = new Date(today);
startDate.setDate(startDate.getDate() - DAYS);
const fmt = (d) => d.toISOString().slice(0, 10);

console.log(`Метрика: счётчик ${COUNTER}`);
console.log(`Окно: ${fmt(startDate)} → ${fmt(today)} (${DAYS} дней)`);
console.log(`Режим: ${DRY_RUN ? 'DRY_RUN' : 'боевой'}\n`);

if (DRY_RUN) {
  console.log('DRY_RUN — выход без сетевых запросов.');
  process.exit(0);
}

// ─── Stat API ─────────────────────────────────────────────────────────────────
// Документация: https://yandex.ru/dev/metrika/doc/api2/api_v1/data.html
// Группировка по ym:pv:URLPathFull даёт нам трафик по path статьи.
const params = new URLSearchParams({
  ids: COUNTER,
  metrics: 'ym:pv:pageviews,ym:s:visits,ym:s:users,ym:s:avgVisitDurationSeconds',
  dimensions: 'ym:pv:URLPathFull',
  date1: fmt(startDate),
  date2: fmt(today),
  limit: '5000',
  sort: '-ym:pv:pageviews',
  accuracy: 'medium',
});

const url = `https://api-metrika.yandex.net/stat/v1/data?${params.toString()}`;
const res = await fetch(url, {
  headers: { 'Authorization': `OAuth ${TOKEN}` },
});
const text = await res.text();
if (!res.ok) {
  console.error(`Метрика Stat API ${res.status}: ${text.slice(0, 400)}`);
  process.exit(1);
}
const data = JSON.parse(text);

const byPage = {};
let totalPv = 0;
let totalVisits = 0;

for (const row of data.data || []) {
  const path = row.dimensions?.[0]?.name;
  if (!path) continue;
  // отсекаем query/hash и редкие хвосты
  const clean = path.split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) continue;
  const [pageviews, visits, users, avgDuration] = row.metrics;
  byPage[clean] = {
    pageviews: Math.round(pageviews),
    visits: Math.round(visits),
    users: Math.round(users),
    avgDuration: Math.round(avgDuration),
  };
  totalPv += pageviews;
  totalVisits += visits;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  JSON.stringify(
    {
      fetchedAt: today.toISOString(),
      days: DAYS,
      counterId: COUNTER,
      totals: {
        pages: Object.keys(byPage).length,
        pageviews: Math.round(totalPv),
        visits: Math.round(totalVisits),
      },
      byPage,
    },
    null,
    2,
  ),
);

console.log(`Готово. Страниц с трафиком: ${Object.keys(byPage).length}, просмотров: ${Math.round(totalPv)}, визитов: ${Math.round(totalVisits)}`);
console.log(`Записано в ${OUT_FILE}`);
