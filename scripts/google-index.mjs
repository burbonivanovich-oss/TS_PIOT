#!/usr/bin/env node
// Уведомляет Google о новых/обновлённых страницах через
// Indexing API (https://developers.google.com/search/apis/indexing-api).
//
// Внимание: официально API предназначен для JobPosting и
// BroadcastEvent schema. Для обычных статей он часто работает, но
// Google формально может ограничить квоту или игнорировать запросы.
// Серая зона — используем «на свой риск».
//
// Лимиты по дефолту: 200 запросов/сутки на проект. Чтобы поднять
// до 600 — нужно подтвердить домен в GSC и попросить увеличение
// (форма https://support.google.com/webmasters/contact/i_quota).
//
// Окружение (один из двух способов аутентификации):
//
// Способ A — Service Account (рекомендуется официально, но GSC UI
// часто отказывает добавлять service-account email как Owner):
//   GOOGLE_INDEXING_KEY — JSON service account credentials (raw или
//     base64). Email service-account должен быть Owner property в GSC.
//
// Способ B — OAuth2 refresh_token (обходной путь, если GSC UI
// отказался принять service-account email):
//   GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN — те же
//     креды, что для fetch-gsc, но refresh_token должен быть
//     получен с дополнительным scope:
//     https://www.googleapis.com/auth/indexing
//   Refresh_token переполучается тем же URL'ом implicit-flow:
//     https://accounts.google.com/o/oauth2/v2/auth?
//       client_id=...&
//       redirect_uri=urn:ietf:wg:oauth:2.0:oob&
//       response_type=code&
//       scope=https://www.googleapis.com/auth/webmasters.readonly%20https://www.googleapis.com/auth/indexing&
//       access_type=offline&prompt=consent
//   После — code обменивается на refresh_token (curl-команда — в docs/analytics.md).
//
// Скрипт автоматически выбирает: сначала service account,
// если ключа нет — пробует refresh_token.
//
// Лимиты по дефолту: 200 запросов/сутки на проект.
//
// Дополнительные ENV:
//   DAYS=2       — окно по pubDate/updatedDate (по умолчанию)
//   URLS=...     — список через запятую, переопределяет режим
//   ALL=1        — все опубликованные + ключевые маршруты
//   DRY_RUN=1    — план без запросов
//   LIMIT=200    — максимум запросов за прогон
//
// Запуск:
//   node scripts/google-index.mjs
//   ALL=1 LIMIT=200 node scripts/google-index.mjs
//   URLS=https://... node scripts/google-index.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSign } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, 'src', 'content', 'blog');
const SITE = 'https://etiketka-media.ru';

const DAYS = parseInt(process.env.DAYS || '2', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const ALL = process.env.ALL === '1';
const LIMIT = parseInt(process.env.LIMIT || '200', 10);
const URLS_OVERRIDE = (process.env.URLS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const RAW_KEY = process.env.GOOGLE_INDEXING_KEY || '';
const OAUTH_CLIENT_ID = process.env.GSC_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GSC_CLIENT_SECRET || '';
const OAUTH_REFRESH_TOKEN = process.env.GSC_REFRESH_TOKEN || '';

const HAS_SA = !!RAW_KEY;
const HAS_OAUTH = !!(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REFRESH_TOKEN);

if (!HAS_SA && !HAS_OAUTH && !DRY_RUN) {
  console.error('Нужен один из вариантов:');
  console.error('  A) GOOGLE_INDEXING_KEY (service account JSON или base64)');
  console.error('  B) GSC_CLIENT_ID + GSC_CLIENT_SECRET + GSC_REFRESH_TOKEN (refresh_token с scope indexing)');
  console.error('Гайд: docs/SECRETS.md → раздел GOOGLE_INDEXING_KEY');
  process.exit(1);
}

function parseKey(raw) {
  if (!raw) return null;
  // Поддерживаем и сырой JSON, и base64
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  try {
    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
  } catch (e) {
    throw new Error(`GOOGLE_INDEXING_KEY не распарсился ни как JSON, ни как base64: ${e.message}`);
  }
}

// ─── JWT для service account ───────────────────────────────────────────────
function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessTokenFromServiceAccount(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(creds.private_key);
  const sig = signature.toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth (SA) ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text).access_token;
}

async function getAccessTokenFromRefreshToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      refresh_token: OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth (refresh) ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  // Если scope не включает indexing — сразу предупредим
  if (data.scope && !data.scope.includes('indexing')) {
    console.warn(`⚠ refresh_token не содержит scope "indexing". Получили: ${data.scope}`);
    console.warn('  Переполучите токен с расширенным scope. Гайд: docs/SECRETS.md');
  }
  return data.access_token;
}

// ─── Сбор URL ──────────────────────────────────────────────────────────────
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
    if (pub > now) continue;
    const upd = fm.updatedDate ? new Date(fm.updatedDate) : null;
    const refDate = upd && upd > pub ? upd : pub;
    if (!ALL && refDate < threshold) continue;
    const slug = f.replace(/\.(md|mdx)$/, '');
    urls.push(`${SITE}/blog/${slug}/`);
  }

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

// ─── Публикация ────────────────────────────────────────────────────────────
async function publish(accessToken, url) {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

// ─── Main ──────────────────────────────────────────────────────────────────
const urls = collectUrls().slice(0, LIMIT);

console.log(`Google Indexing API`);
console.log(`Режим: ${ALL ? 'ALL' : URLS_OVERRIDE.length ? 'URLS-override' : `последние ${DAYS} дней`}`);
console.log(`URL'ов: ${urls.length} (LIMIT=${LIMIT})`);
if (urls.length === 0) {
  console.log('Нет URL — выход.');
  process.exit(0);
}
for (const u of urls.slice(0, 20)) console.log(`  - ${u}`);
if (urls.length > 20) console.log(`  ... и ещё ${urls.length - 20}`);

if (DRY_RUN) {
  console.log('\nDRY_RUN — выход без запросов.');
  process.exit(0);
}

let accessToken;
if (HAS_SA) {
  const creds = parseKey(RAW_KEY);
  if (!creds?.client_email || !creds?.private_key) {
    console.error('Service-account JSON некорректен (нет client_email или private_key).');
    process.exit(1);
  }
  console.log(`Auth: Service Account (${creds.client_email})\n`);
  accessToken = await getAccessTokenFromServiceAccount(creds);
} else {
  console.log(`Auth: OAuth2 refresh_token (client_id=${OAUTH_CLIENT_ID.slice(0, 20)}…)\n`);
  accessToken = await getAccessTokenFromRefreshToken();
}

let ok = 0;
let failed = 0;
const errors = [];

// Indexing API не поддерживает bulk — шлём по одному. Без параллельности
// (Google не любит spike, лимит общий по проекту).
for (const url of urls) {
  const r = await publish(accessToken, url);
  if (r.ok) {
    ok++;
    if (ok % 10 === 0) console.log(`  ${ok}/${urls.length}…`);
  } else {
    failed++;
    errors.push({ url, status: r.status, body: r.body.slice(0, 200) });
    if (r.status === 429) {
      console.error(`  429 квота превышена — останавливаюсь`);
      break;
    }
  }
}

console.log(`\nГотово. Успешно: ${ok}, ошибок: ${failed}.`);
if (errors.length) {
  console.log('\nОшибки:');
  for (const e of errors.slice(0, 10)) {
    console.log(`  ${e.status} ${e.url}\n    ${e.body}`);
  }
  if (errors.length > 10) console.log(`  ... и ещё ${errors.length - 10}`);
}

// exit 0 при частичном успехе — main URL'ы отправлены
if (ok === 0 && failed > 0) process.exit(1);
