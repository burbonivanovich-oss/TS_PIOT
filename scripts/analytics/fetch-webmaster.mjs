#!/usr/bin/env node
// Тянет данные Яндекс.Вебмастера: SQI хоста + топ поисковых
// запросов с показами/кликами/средней позицией/CTR за последние
// N дней. Использует API v4.1.
//
// В отличие от Google Search Console, Вебмастер не отдаёт
// разбивку по URL для произвольного периода в открытом API.
// Но топ-запросов вполне хватает для понимания «по чему нас
// находят в Яндексе и на каких позициях».
//
// Окружение:
//   WEBMASTER_OAUTH_TOKEN — OAuth с oauth.yandex.ru, scope
//     `webmaster:hostinfo` (см. docs/analytics.md).
//   WEBMASTER_HOST — точная hostname как зарегистрирована в
//     Вебмастере, например "etiketka-media.ru" (без https://, без
//     завершающего /). Скрипт сам найдёт host_id по списку.
//   DAYS=28 — окно по умолчанию.
//   DRY_RUN=1 — печатает план и выходит.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'analytics');
const OUT_FILE = join(OUT_DIR, 'webmaster.json');

const TOKEN = process.env.WEBMASTER_OAUTH_TOKEN || '';
const HOST = (process.env.WEBMASTER_HOST || 'etiketka-media.ru').trim();
const DAYS = parseInt(process.env.DAYS || '28', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

if (!TOKEN && !DRY_RUN) {
  console.error('WEBMASTER_OAUTH_TOKEN не задан. Гайд: docs/analytics.md');
  process.exit(1);
}

const today = new Date();
const startDate = new Date(today);
startDate.setDate(startDate.getDate() - DAYS);
const fmtDate = (d) => d.toISOString().slice(0, 10);

console.log(`Webmaster: host ${HOST}`);
console.log(`Окно: ${fmtDate(startDate)} → ${fmtDate(today)} (${DAYS} дней)`);
console.log(`Режим: ${DRY_RUN ? 'DRY_RUN' : 'боевой'}\n`);

if (DRY_RUN) {
  console.log('DRY_RUN — выход без сетевых запросов.');
  process.exit(0);
}

const API_BASE = 'https://api.webmaster.yandex.net/v4.1';

async function api(path, params) {
  const url = params
    ? `${API_BASE}${path}?${new URLSearchParams(params).toString()}`
    : `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `OAuth ${TOKEN}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

// ─── 1. Получаем user_id ──────────────────────────────────────────────────────
const user = await api('/user');
const userId = user.user_id;
if (!userId) {
  console.error('Не удалось получить user_id. Ответ API:', JSON.stringify(user).slice(0, 200));
  process.exit(1);
}
console.log(`user_id: ${userId}`);

// ─── 2. Находим host_id по hostname ────────────────────────────────────────────
const hostsResp = await api(`/user/${userId}/hosts`);
const hosts = hostsResp.hosts || [];
const matched = hosts.find(h => {
  // host_id для подтверждённых хостов выглядит как "https:etiketka-media.ru:443"
  const u = h.unicode_host_url || h.ascii_host_url || '';
  return u.includes(HOST);
});
if (!matched) {
  console.error(`Хост "${HOST}" не найден среди подтверждённых. Доступны:`);
  for (const h of hosts) console.error(`  - ${h.unicode_host_url || h.ascii_host_url}`);
  process.exit(1);
}
const hostId = matched.host_id;
console.log(`host_id: ${hostId}`);

// ─── 3. SQI и краткая статистика ───────────────────────────────────────────────
let summary = {};
try {
  const sum = await api(`/user/${userId}/hosts/${hostId}/summary`);
  summary = {
    sqi: sum?.sqi ?? null,
    iks: sum?.iks ?? null,
    siteProblems: (sum?.site_problems || []).length,
  };
} catch (e) {
  console.warn(`Summary не получен: ${e.message}`);
}

// ─── 4. Топ запросов ──────────────────────────────────────────────────────────
const popularResp = await api(
  `/user/${userId}/hosts/${hostId}/search-queries/popular/`,
  {
    order_by: 'TOTAL_SHOWS',
    query_indicator: 'TOTAL_SHOWS,TOTAL_CLICKS,AVG_SHOW_POSITION,AVG_CLICK_POSITION,AVG_CTR',
    device_type_indicator: 'ALL',
    date_from: fmtDate(startDate),
    date_to: fmtDate(today),
    limit: '500',
  },
);

const queries = (popularResp.queries || []).map(q => {
  const ind = q.indicators || {};
  return {
    query: q.query_text,
    shows: ind.TOTAL_SHOWS ?? 0,
    clicks: ind.TOTAL_CLICKS ?? 0,
    avgShowPosition: ind.AVG_SHOW_POSITION ? Number(ind.AVG_SHOW_POSITION.toFixed(2)) : null,
    avgClickPosition: ind.AVG_CLICK_POSITION ? Number(ind.AVG_CLICK_POSITION.toFixed(2)) : null,
    avgCtr: ind.AVG_CTR ? Number((ind.AVG_CTR * 100).toFixed(2)) : null,
  };
});

const totalShows = queries.reduce((s, q) => s + q.shows, 0);
const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  JSON.stringify(
    {
      fetchedAt: today.toISOString(),
      days: DAYS,
      host: HOST,
      hostId,
      summary,
      totals: {
        queries: queries.length,
        totalShows,
        totalClicks,
      },
      queries,
    },
    null,
    2,
  ),
);

console.log(`Готово. Запросов в выгрузке: ${queries.length}, показов: ${totalShows}, кликов: ${totalClicks}`);
if (summary.sqi != null) console.log(`SQI: ${summary.sqi}, проблем сайта: ${summary.siteProblems ?? '?'}`);
console.log(`Записано в ${OUT_FILE}`);
