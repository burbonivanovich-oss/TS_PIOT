#!/usr/bin/env node
// Отправляет URL'ы в IndexNow для ускоренной индексации в Яндексе
// (и параллельно Bing, если индексируется).
//
// Документация: https://yandex.com/support/webmaster/indexnow/
// API endpoint: https://api.indexnow.org/indexnow (агрегирует поисковики)
//               или https://yandex.com/indexnow (только Яндекс)
//
// Окружение:
//   DAYS=2       — за сколько последних дней брать статьи (по pubDate/updatedDate)
//   URLS=...     — список URL через запятую, переопределяет режим по датам
//   DRY_RUN=1    — печатает план без HTTP-запроса
//   ALL=1        — отправить ВСЕ опубликованные URL (одноразовая массовая)
//
// Запуск:
//   node scripts/indexnow.mjs                            # за последние 2 дня
//   DAYS=7 node scripts/indexnow.mjs                     # за неделю
//   URLS=https://...,https://... node scripts/indexnow.mjs  # точечно
//   ALL=1 node scripts/indexnow.mjs                      # все опубликованные
//   DRY_RUN=1 node scripts/indexnow.mjs                  # без отправки

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, 'src', 'content', 'blog');

const HOST = 'etiketka-media.ru';
const SITE = `https://${HOST}`;
const KEY = '1d6d18d60df70390942afa4027dca91f';
const KEY_LOCATION = `${SITE}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const DAYS = parseInt(process.env.DAYS || '2', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const ALL = process.env.ALL === '1';
const URLS_OVERRIDE = (process.env.URLS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function frontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"]+)"?$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function collectUrls() {
  if (URLS_OVERRIDE.length > 0) return URLS_OVERRIDE;

  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - DAYS);

  const files = readdirSync(BLOG).filter(f => /\.(md|mdx)$/.test(f));
  const urls = [];
  for (const f of files) {
    const fm = frontmatter(readFileSync(join(BLOG, f), 'utf8'));
    if (!fm) continue;
    if (fm.draft === 'true' || fm.draft === true) continue;
    const pub = new Date(fm.pubDate || '1970-01-01');
    if (pub > now) continue; // будущие статьи ещё не опубликованы
    const upd = fm.updatedDate ? new Date(fm.updatedDate) : null;
    const refDate = upd && upd > pub ? upd : pub;
    if (!ALL && refDate < threshold) continue;
    const slug = f.replace(/\.(md|mdx)$/, '');
    urls.push(`${SITE}/blog/${slug}/`);
  }

  // Плюс ключевые статические маршруты — если меняли их недавно,
  // ALL=1 их захватит. В режиме по датам не отправляем — они и так
  // меняются редко.
  if (ALL) {
    urls.push(
      `${SITE}/`,
      `${SITE}/blog/`,
      `${SITE}/category/ts-piot/`,
      `${SITE}/category/markirovka/`,
      `${SITE}/category/zakonodatelstvo/`,
      `${SITE}/category/kkt/`,
      `${SITE}/category/egais/`,
      `${SITE}/instrumenty/`,
      `${SITE}/kak-rabotaet-ts-piot/`,
      `${SITE}/test-ts-piot/`,
      `${SITE}/test-tsepochka-edo/`,
      `${SITE}/scenario/kofeynya-za-30-dney/`,
      `${SITE}/scenario/perekhod-ip-na-ooo-za-60-dney/`,
      `${SITE}/zakon-2026/`,
      `${SITE}/kalkulyator-shtrafov/`,
      `${SITE}/kalendar-markirovki/`,
      `${SITE}/slovar/`,
    );
  }

  return urls;
}

const urls = collectUrls();

console.log(`IndexNow → ${HOST}`);
console.log(`Endpoint: ${ENDPOINT}`);
console.log(`Key file: ${KEY_LOCATION}`);
console.log(`Режим: ${ALL ? 'ALL (все опубликованные)' : URLS_OVERRIDE.length ? 'URLS-override' : `последние ${DAYS} дней`}`);
console.log(`URL'ов: ${urls.length}`);
if (urls.length === 0) {
  console.log('Нет URL для отправки — выход.');
  process.exit(0);
}
for (const u of urls.slice(0, 20)) console.log(`  - ${u}`);
if (urls.length > 20) console.log(`  ... и ещё ${urls.length - 20}`);

if (DRY_RUN) {
  console.log('\nDRY_RUN — выход без отправки.');
  process.exit(0);
}

// Bulk-формат IndexNow: один POST до 10 000 URL'ов
const body = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: urls,
};

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

const text = await res.text();

// Статус-коды IndexNow:
//  200 OK            — URL'ы приняты в индексацию
//  202 Accepted      — приняты, проверка ключа пока не завершена
//  400 Bad Request   — невалидный формат
//  403 Forbidden     — ключ не валиден (проверьте keyLocation)
//  422 Unprocessable — URL не принадлежит указанному host
//  429 Too Many      — лимит на ваш хост
console.log(`\nHTTP ${res.status} ${res.statusText}`);
if (text) console.log(`Ответ: ${text.slice(0, 400)}`);

if (res.status === 200 || res.status === 202) {
  console.log(`Готово: ${urls.length} URL'ов отправлено.`);
  process.exit(0);
}
console.error('Ошибка отправки.');
process.exit(1);
