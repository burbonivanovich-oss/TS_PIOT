#!/usr/bin/env node
// Тянет данные Google Search Console по статьям блога за N последних
// дней. Использует Search Analytics API: получает по каждому URL
// клики, показы, среднюю позицию и CTR.
//
// Окружение:
//   GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN — OAuth2 credentials.
//     Получение: docs/analytics.md, раздел «Google Search Console».
//   GSC_SITE_URL — точное значение из консоли, например:
//     "https://etiketka-media.ru/" (URL-prefix) или "sc-domain:etiketka-media.ru" (domain property).
//   DAYS=28 — окно по умолчанию.
//   DRY_RUN=1 — печатает план и выходит.
//
// Запись: src/data/analytics/gsc.json
//   { fetchedAt, days, byPage: { "/blog/...": { clicks, impressions, position, ctr } } }

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'analytics');
const OUT_FILE = join(OUT_DIR, 'gsc.json');

const CLIENT_ID = process.env.GSC_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GSC_CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.GSC_REFRESH_TOKEN || '';
const SITE_URL = process.env.GSC_SITE_URL || '';
const DAYS = parseInt(process.env.DAYS || '28', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

if (!SITE_URL) {
  console.error('GSC_SITE_URL не задан (например "https://etiketka-media.ru/" или "sc-domain:etiketka-media.ru")');
  process.exit(1);
}

if (!DRY_RUN && (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN)) {
  console.error('Нужны GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN. Гайд: docs/analytics.md');
  process.exit(1);
}

const today = new Date();
const startDate = new Date(today);
startDate.setDate(startDate.getDate() - DAYS);
const fmt = (d) => d.toISOString().slice(0, 10);

console.log(`GSC: ${SITE_URL}`);
console.log(`Окно: ${fmt(startDate)} → ${fmt(today)} (${DAYS} дней)`);
console.log(`Режим: ${DRY_RUN ? 'DRY_RUN' : 'боевой'}\n`);

if (DRY_RUN) {
  console.log('DRY_RUN — выход без сетевых запросов.');
  process.exit(0);
}

// ─── Refresh access_token ─────────────────────────────────────────────────────
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth refresh ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text).access_token;
}

// ─── Search Analytics API ─────────────────────────────────────────────────────
async function searchAnalytics(accessToken, body) {
  const encoded = encodeURIComponent(SITE_URL);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GSC API ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const accessToken = await getAccessToken();

const data = await searchAnalytics(accessToken, {
  startDate: fmt(startDate),
  endDate: fmt(today),
  dimensions: ['page'],
  rowLimit: 5000,
});

const byPage = {};
let totalClicks = 0;
let totalImpr = 0;

for (const row of data.rows || []) {
  const page = row.keys[0];
  // нормализуем URL → path
  let path;
  try {
    path = new URL(page).pathname;
  } catch {
    path = page;
  }
  byPage[path] = {
    clicks: row.clicks,
    impressions: row.impressions,
    position: Number(row.position.toFixed(2)),
    ctr: Number((row.ctr * 100).toFixed(2)),
  };
  totalClicks += row.clicks;
  totalImpr += row.impressions;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  JSON.stringify(
    {
      fetchedAt: today.toISOString(),
      days: DAYS,
      siteUrl: SITE_URL,
      totals: { pages: Object.keys(byPage).length, clicks: totalClicks, impressions: totalImpr },
      byPage,
    },
    null,
    2,
  ),
);

console.log(`Готово. Страниц с трафиком: ${Object.keys(byPage).length}, кликов: ${totalClicks}, показов: ${totalImpr}`);
console.log(`Записано в ${OUT_FILE}`);
