#!/usr/bin/env node
// Выгружает социальные черновики из src/content/wiki/social/ в
// Google Drive как Google Docs. Один Doc на одну статью с
// секциями Telegram / VK / Дзен / Email. Идемпотентно: если Doc
// с тем же именем уже есть в указанной папке — обновляется,
// иначе создаётся.
//
// Использует Drive API v3:
// - POST /upload/drive/v3/files?uploadType=multipart — создание
//   с конвертацией HTML → Google Doc (mimeType=application/vnd.google-apps.document)
// - PATCH /upload/drive/v3/files/{id}?uploadType=media — апдейт контента
// - GET  /drive/v3/files?q=... — поиск существующих
//
// Аутентификация (один из двух способов):
//
// A) Service Account (рекомендуется — отдельная «учётка для бота»):
//   GOOGLE_DOCS_KEY = JSON или base64 service account credentials.
//   Email service account нужно поделиться доступом «Редактор» с
//   папкой в Google Drive.
//
// B) OAuth2 refresh_token (через те же GSC_* секреты с расширенным
//    scope `https://www.googleapis.com/auth/drive.file`):
//   GSC_CLIENT_ID + GSC_CLIENT_SECRET + GSC_REFRESH_TOKEN.
//
// Окружение:
//   GOOGLE_DOCS_FOLDER_ID — обязателен, ID папки в Drive.
//     Берётся из URL папки: drive.google.com/drive/folders/<ID>
//   SLUG=<slug>           — конкретная статья или список через запятую
//                           (slug может быть с префиксом даты или без).
//                           Пример: SLUG=ts-piot-shtrafy,proverki-2026,usn-nds
//   ALL=1                 — все файлы (рекомендованный режим)
//   DRY_RUN=1             — план без запросов

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSign } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Два источника соцпостов с разной схемой именования:
// 1. src/content/wiki/social/<slug>.md (37 файлов) — новый формат
// 2. src/content/social/<slug>-social.md (22 файла) — параллельная
//    коллекция Astro, суффикс -social. Создавалась ранее под другой
//    скилл, но содержит полноценные посты для статей от 01.05.2026.
//
// Покрытие на момент написания: 59 из 83 опубликованных статей.
const SOURCES = [
	{ dir: join(ROOT, 'src', 'content', 'wiki', 'social'), suffix: '' },
	{ dir: join(ROOT, 'src', 'content', 'social'),         suffix: '-social' },
];

const FOLDER_ID = process.env.GOOGLE_DOCS_FOLDER_ID || '';
const RAW_KEY = process.env.GOOGLE_DOCS_KEY || '';
const OAUTH_CLIENT_ID = process.env.GSC_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GSC_CLIENT_SECRET || '';
const OAUTH_REFRESH_TOKEN = process.env.GSC_REFRESH_TOKEN || '';

const DRY_RUN = process.env.DRY_RUN === '1';
const ALL = process.env.ALL === '1';
const SLUG_FILTER_LIST = (process.env.SLUG || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const HAS_SLUG_FILTER = SLUG_FILTER_LIST.length > 0;

const HAS_SA = !!RAW_KEY;
const HAS_OAUTH = !!(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REFRESH_TOKEN);

if (!FOLDER_ID && !DRY_RUN) {
  console.error('GOOGLE_DOCS_FOLDER_ID не задан. ID папки берётся из URL drive.google.com/drive/folders/<ID>');
  process.exit(1);
}
if (!HAS_SA && !HAS_OAUTH && !DRY_RUN) {
  console.error('Нужно одно из: GOOGLE_DOCS_KEY (service account) или GSC_CLIENT_ID/SECRET/REFRESH_TOKEN со scope drive.file');
  process.exit(1);
}

// ─── Аутентификация ──────────────────────────────────────────────────────────
function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function parseKey(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
}

async function getAccessTokenSA(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents',
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

async function getAccessTokenOAuth() {
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
  if (data.scope && !data.scope.includes('drive')) {
    console.warn(`⚠ refresh_token не содержит scope "drive". Получили: ${data.scope}`);
    console.warn('  Переполучите токен со scope https://www.googleapis.com/auth/drive.file');
  }
  return data.access_token;
}

// ─── Markdown → HTML (упрощённо, для соцпостов хватает) ──────────────────────
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inPara = false;

  function flushPara() {
    if (inPara) {
      out.push('</p>');
      inPara = false;
    }
  }

  function inline(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  for (const line of lines) {
    if (/^---\s*$/.test(line)) {
      flushPara();
      out.push('<hr/>');
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushPara();
      out.push(`<h2>${inline(h2[1])}</h2>`);
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushPara();
      out.push(`<h3>${inline(h3[1])}</h3>`);
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      continue;
    }
    if (!inPara) {
      out.push('<p>');
      inPara = true;
    } else {
      out.push('<br/>');
    }
    out.push(inline(line));
  }
  flushPara();
  return out.join('\n');
}

// ─── Парсер frontmatter ──────────────────────────────────────────────────────
function parseFM(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"]+)"?$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: m[2] };
}

// ─── Drive API ───────────────────────────────────────────────────────────────
async function findExisting(token, name) {
  const q = `name='${name}' and '${FOLDER_ID}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive list ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  return data.files?.[0] ?? null;
}

async function createDoc(token, name, html) {
  const boundary = '---boundary-etiketka-' + Date.now();
  const meta = {
    name,
    parents: [FOLDER_ID],
    mimeType: 'application/vnd.google-apps.document',
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=utf-8\r\n\r\n` +
    JSON.stringify(meta) + '\r\n' +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset=utf-8\r\n\r\n` +
    html + '\r\n' +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive create ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function updateDoc(token, fileId, html) {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: html,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive update ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

// ─── Сбор файлов ─────────────────────────────────────────────────────────────
function collectFiles() {
	const out = [];
	const seenSlugs = new Set();

	for (const { dir, suffix } of SOURCES) {
		if (!existsSync(dir)) continue;
		const files = readdirSync(dir).filter(f => /\.(md|mdx)$/.test(f));
		for (const f of files) {
			const fullPath = join(dir, f);
			const content = readFileSync(fullPath, 'utf8');
			const { fm, body } = parseFM(content);
			let slug = f.replace(/\.(md|mdx)$/, '');
			// Срезаем суффикс «-social» у файлов из content/social/
			if (suffix && slug.endsWith(suffix)) slug = slug.slice(0, -suffix.length);

			if (HAS_SLUG_FILTER) {
				// Совпадение по любому из перечисленных slug (точное или
				// подстрока — чтобы можно было писать без префикса даты).
				const matches = SLUG_FILTER_LIST.some(
					s => slug === s || slug.includes(s),
				);
				if (!matches) continue;
			} else if (!ALL) {
				if (fm.status !== 'ready') continue;
			}

			// Анти-коллизия: если slug уже встречался — берём более свежий по mtime
			if (seenSlugs.has(slug)) {
				const existingIdx = out.findIndex(x => x.slug === slug);
				const existingMtime = statSync(out[existingIdx].fullPath).mtimeMs;
				const currentMtime = statSync(fullPath).mtimeMs;
				if (currentMtime > existingMtime) {
					out[existingIdx] = { slug, fm, body, fullPath };
				}
				continue;
			}
			seenSlugs.add(slug);
			out.push({ slug, fm, body, fullPath });
		}
	}
	return out;
}

// ─── Main ────────────────────────────────────────────────────────────────────
const files = collectFiles();

console.log(`Social → Google Docs`);
console.log(`Папка Drive: ${FOLDER_ID || '(не задано)'}`);
console.log(`Auth: ${HAS_SA ? 'Service Account' : HAS_OAUTH ? 'OAuth refresh_token' : '—'}`);
console.log(`Режим: ${HAS_SLUG_FILTER ? `slug=${SLUG_FILTER_LIST.join(',')}` : ALL ? 'ALL (без фильтра по status)' : 'только status: ready'}`);
console.log(`Файлов: ${files.length}\n`);

if (files.length === 0) {
  console.log('Нет файлов под условие — выход.');
  process.exit(0);
}

if (DRY_RUN) {
  for (const f of files.slice(0, 20)) {
    console.log(`  - ${f.slug} (status: ${f.fm.status || '—'})`);
  }
  if (files.length > 20) console.log(`  ... и ещё ${files.length - 20}`);
  console.log('\nDRY_RUN — выход без запросов.');
  process.exit(0);
}

let token;
let authMode;
if (HAS_SA) {
  token = await getAccessTokenSA(parseKey(RAW_KEY));
  authMode = 'sa';
} else {
  token = await getAccessTokenOAuth();
  authMode = 'oauth';
}

async function maybeFallbackToOAuth(err) {
  // Service-account не имеет своей Drive-квоты; создание файлов
  // упирается в storageQuotaExceeded даже на расшаренной папке.
  // Если OAuth-креды есть — переключаемся на них автоматически.
  if (authMode === 'sa' && HAS_OAUTH && /storageQuotaExceeded|storage quota/i.test(err.message)) {
    console.warn('\n⚠ Service Account упёрся в storageQuotaExceeded (у SA нет своей Drive-квоты).');
    console.warn('  Переключаюсь на OAuth refresh_token (личный аккаунт, 15 ГБ).\n');
    token = await getAccessTokenOAuth();
    authMode = 'oauth';
    return true;
  }
  return false;
}

let created = 0;
let updated = 0;
let failed = 0;

for (const { slug, fm, body } of files) {
  // Имя файла в Drive: русское название статьи + дата как суффикс для
  // уникальности (одинаковые title встречаются у обновлений). Slug
  // в имени больше не используется — читать неудобно.
  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  const datePart = dateMatch ? ` · ${dateMatch[1]}` : '';
  const docName = fm.title ? `${fm.title}${datePart}` : slug;

  // Структура для outline-навигации (View → Document outline, Ctrl+Alt+A):
  // H1 = название статьи, H2 = чек-лист публикации + каждая платформа.
  // Каждый ## из исходного md станет H2 и попадёт в боковую панель
  // навигации как «вкладка». Чек-лист идёт первым блоком — это статус
  // публикации, который удобно держать перед глазами.
  const checklist = `<h2>Чек-лист публикации</h2>\n` +
    `<ul>\n` +
    `<li><input type="checkbox"/> Telegram — опубликовано</li>\n` +
    `<li><input type="checkbox"/> VK — опубликовано</li>\n` +
    `<li><input type="checkbox"/> Дзен — опубликовано (с CPA-врезкой и erid)</li>\n` +
    `<li><input type="checkbox"/> Email — отправлено в рассылку</li>\n` +
    `</ul>\n`;

  const html = `<h1>${(fm.title || slug).replace(/</g, '&lt;')}</h1>\n` +
    `<p style="color:#666;font-size:11pt">` +
    `Ctrl+Alt+A — открыть панель навигации по разделам.` +
    (fm.articleUrl ? ` · <a href="https://etiketka-media.ru${fm.articleUrl}">Статья на сайте</a>` : '') +
    `</p>\n` +
    checklist +
    mdToHtml(body);

  async function tryUpsert() {
    const existing = await findExisting(token, docName);
    if (existing) {
      const r = await updateDoc(token, existing.id, html);
      console.log(`UPD ${slug} → ${r.webViewLink || existing.webViewLink}`);
      updated++;
    } else {
      const r = await createDoc(token, docName, html);
      console.log(`NEW ${slug} → ${r.webViewLink}`);
      created++;
    }
  }

  try {
    await tryUpsert();
  } catch (err) {
    if (await maybeFallbackToOAuth(err)) {
      try {
        await tryUpsert();
        continue;
      } catch (err2) {
        console.error(`FAIL ${slug}: ${err2.message}`);
        failed++;
        continue;
      }
    }
    console.error(`FAIL ${slug}: ${err.message}`);
    failed++;
  }
}

console.log(`\nГотово. Создано: ${created}, обновлено: ${updated}, ошибок: ${failed}.`);
if (failed > 0 && created + updated === 0) process.exit(1);
