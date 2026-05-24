#!/usr/bin/env node
// Выгружает социальные черновики в Google Drive как многотабовые
// Google Docs. Один Doc на одну статью. Вкладки:
//   1. Чек-лист публикации (интерактивный, с чекбоксами)
//   2. Telegram
//   3. VK
//   4. Дзен
//   5. Email
//
// Используются недокументированные на главной странице, но рабочие
// request-типы Docs API v1:
//   - addDocumentTab            (создаёт вкладку)
//   - updateDocumentTabProperties (переименование, иконка)
//   - deleteTab                  (удаление)
//
// Идемпотентно: если Doc с тем же именем уже есть в папке — удаляется
// и пересоздаётся, чтобы вкладки пересобирались чисто.
//
// API:
// - Drive  POST /v3/files                 — создание пустого Doc
// - Drive  GET  /v3/files?q=...           — поиск существующих
// - Drive  DELETE /v3/files/{id}          — удаление перед пересборкой
// - Docs   POST /v1/documents/{id}:batchUpdate — заполнение содержимым
//
// Аутентификация — Service Account (GOOGLE_DOCS_KEY) или OAuth
// refresh_token (GSC_CLIENT_ID/SECRET/REFRESH_TOKEN).
//
// Окружение:
//   GOOGLE_DOCS_FOLDER_ID — ID папки в Drive (обязателен)
//   SLUG=<slug>           — один slug или список через запятую
//   ALL=1                 — все файлы
//   DRY_RUN=1             — план без запросов

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSign } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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
	console.error('GOOGLE_DOCS_FOLDER_ID не задан.');
	process.exit(1);
}
if (!HAS_SA && !HAS_OAUTH && !DRY_RUN) {
	console.error('Нужно одно из: GOOGLE_DOCS_KEY или GSC_CLIENT_ID/SECRET/REFRESH_TOKEN');
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
	return JSON.parse(text).access_token;
}

// ─── Парсер frontmatter и секций ─────────────────────────────────────────────
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

// Разбивает тело по платформенным секциям (## Telegram, ## VK, ## Дзен, ## Email)
function splitPlatforms(body) {
	const sections = { Telegram: '', VK: '', Дзен: '', Email: '' };
	const re = /^##\s+(Telegram|VK|Дзен|Email|ВКонтакте)\s*$/gm;
	const matches = [];
	let m;
	while ((m = re.exec(body)) !== null) {
		matches.push({ name: m[1] === 'ВКонтакте' ? 'VK' : m[1], start: m.index, headerEnd: re.lastIndex });
	}
	for (let i = 0; i < matches.length; i++) {
		const { name, headerEnd } = matches[i];
		const end = i + 1 < matches.length ? matches[i + 1].start : body.length;
		let content = body.slice(headerEnd, end).trim();
		// Убрать ведущие/конечные горизонтальные разделители ---
		content = content.replace(/^---\s*\n/gm, '').replace(/\n---\s*$/, '').trim();
		sections[name] = content;
	}
	return sections;
}

// ─── Drive API ───────────────────────────────────────────────────────────────
async function findExisting(token, name) {
	const safeName = name.replace(/'/g, "\\'");
	const q = `name='${safeName}' and '${FOLDER_ID}' in parents and trashed=false`;
	const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	const text = await res.text();
	if (!res.ok) throw new Error(`Drive list ${res.status}: ${text.slice(0, 400)}`);
	return JSON.parse(text).files?.[0] ?? null;
}

async function deleteDoc(token, fileId) {
	const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok && res.status !== 404) {
		const text = await res.text();
		throw new Error(`Drive delete ${res.status}: ${text.slice(0, 400)}`);
	}
}

async function createEmptyDoc(token, name) {
	const meta = {
		name,
		parents: [FOLDER_ID],
		mimeType: 'application/vnd.google-apps.document',
	};
	const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(meta),
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`Drive create ${res.status}: ${text.slice(0, 400)}`);
	return JSON.parse(text);
}

// ─── Docs API ────────────────────────────────────────────────────────────────
async function getDocument(token, docId, includeTabsContent = true) {
	const url = `https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=${includeTabsContent}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	const text = await res.text();
	if (!res.ok) throw new Error(`Docs get ${res.status}: ${text.slice(0, 400)}`);
	return JSON.parse(text);
}

async function batchUpdate(token, docId, requests) {
	const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ requests }),
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`Docs batchUpdate ${res.status}: ${text.slice(0, 400)}`);
	return JSON.parse(text);
}

// ─── Markdown → текст + диапазоны стилей ─────────────────────────────────────
// Inline: **bold** и [text](url). Возвращает чистый текст + диапазоны
function processInline(line) {
	let text = '';
	const bold = [];
	const links = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === '*' && line[i + 1] === '*') {
			const end = line.indexOf('**', i + 2);
			if (end > i + 2) {
				const start = text.length;
				text += line.slice(i + 2, end);
				bold.push({ start, end: text.length });
				i = end + 2;
				continue;
			}
		}
		if (line[i] === '[') {
			const closeBracket = line.indexOf(']', i + 1);
			if (closeBracket > i && line[closeBracket + 1] === '(') {
				const closeParen = line.indexOf(')', closeBracket + 2);
				if (closeParen > closeBracket) {
					const start = text.length;
					text += line.slice(i + 1, closeBracket);
					links.push({ start, end: text.length, url: line.slice(closeBracket + 2, closeParen) });
					i = closeParen + 1;
					continue;
				}
			}
		}
		text += line[i];
		i++;
	}
	return { text, bold, links };
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
			if (suffix && slug.endsWith(suffix)) slug = slug.slice(0, -suffix.length);

			if (HAS_SLUG_FILTER) {
				const matches = SLUG_FILTER_LIST.some(s => slug === s || slug.includes(s));
				if (!matches) continue;
			} else if (!ALL) {
				if (fm.status !== 'ready') continue;
			}

			if (seenSlugs.has(slug)) {
				const idx = out.findIndex(x => x.slug === slug);
				if (statSync(fullPath).mtimeMs > statSync(out[idx].fullPath).mtimeMs) {
					out[idx] = { slug, fm, body, fullPath };
				}
				continue;
			}
			seenSlugs.add(slug);
			out.push({ slug, fm, body, fullPath });
		}
	}
	return out;
}

// ─── Основной upsert одной статьи ────────────────────────────────────────────
//
// Поток:
//   1. Если Doc с таким именем уже есть — удаляем (чистая пересборка).
//   2. Drive: создаём пустой Doc.
//   3. Docs GET с includeTabsContent=true → получаем tabId дефолтной вкладки.
//   4. Docs batchUpdate №1:
//        - updateDocumentTabProperties: переименовать дефолтную вкладку в «Чек-лист публикации».
//        - addDocumentTab × N: создать вкладки Telegram, VK, Дзен, Email.
//   5. Docs GET ещё раз — собрать tabId всех вкладок (через title).
//   6. Docs batchUpdate №2: вставить контент в каждую вкладку,
//      используя location.tabId.
async function upsertArticle(token, { slug, fm, body }) {
	const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
	const datePart = dateMatch ? ` · ${dateMatch[1]}` : '';
	const docName = fm.title ? `${fm.title}${datePart}` : slug;

	const existing = await findExisting(token, docName);
	if (existing) await deleteDoc(token, existing.id);

	const created = await createEmptyDoc(token, docName);
	const docId = created.id;

	const articleUrl = fm.articleUrl ? `https://etiketka-media.ru${fm.articleUrl}` : '';
	const sections = splitPlatforms(body);
	const platforms = ['Telegram', 'VK', 'Дзен', 'Email'].filter(p => sections[p]?.trim());

	// Получаем tabId дефолтной вкладки
	const doc1 = await getDocument(token, docId, true);
	const defaultTabId = doc1.tabs?.[0]?.tabProperties?.tabId;
	if (!defaultTabId) throw new Error(`У ${docId} нет tabId дефолтной вкладки`);

	// Структурные операции: переименование + создание вкладок
	const structReqs = [{
		updateDocumentTabProperties: {
			tabId: defaultTabId,
			tabProperties: { title: 'Чек-лист публикации' },
			fields: 'title',
		},
	}];
	for (const name of platforms) {
		structReqs.push({
			addDocumentTab: { tabProperties: { title: name } },
		});
	}
	await batchUpdate(token, docId, structReqs);

	// Перечитываем документ — собираем tabId по title
	const doc2 = await getDocument(token, docId, true);
	const tabIdByTitle = {};
	for (const t of doc2.tabs || []) {
		const title = t.tabProperties?.title;
		if (title) tabIdByTitle[title] = t.tabProperties.tabId;
	}

	// Контент по вкладкам
	const contentReqs = [];
	contentReqs.push(...buildChecklistRequests(tabIdByTitle['Чек-лист публикации'], fm.title || slug, articleUrl));
	for (const name of platforms) {
		const tabId = tabIdByTitle[name];
		if (!tabId) throw new Error(`Не нашли tabId для вкладки ${name}`);
		contentReqs.push(...buildPlatformRequests(tabId, sections[name]));
	}
	if (contentReqs.length > 0) {
		await batchUpdate(token, docId, contentReqs);
	}
	return created;
}

// Чек-лист публикации: TITLE + ссылка + HEADING_1 + чекбоксы.
function buildChecklistRequests(tabId, articleTitle, articleUrl) {
	const requests = [];
	let text = articleTitle + '\n';
	const titleEnd = text.length;
	let linkRange = null;
	if (articleUrl) {
		const before = 'Статья на сайте: ';
		const linkStart = text.length + before.length;
		text += before + articleUrl + '\n\n';
		linkRange = { start: linkStart, end: linkStart + articleUrl.length, url: articleUrl };
	}
	const checklistItems = [
		'Telegram — опубликовано',
		'VK — опубликовано',
		'Дзен — опубликовано (с CPA-врезкой и erid)',
		'Email — отправлено в рассылку',
	];
	const checklistStart = text.length;
	for (const item of checklistItems) text += item + '\n';
	const checklistEnd = text.length;

	requests.push({ insertText: { location: { tabId, index: 1 }, text } });
	requests.push({
		updateParagraphStyle: {
			range: { tabId, startIndex: 1, endIndex: 1 + titleEnd },
			paragraphStyle: { namedStyleType: 'TITLE' },
			fields: 'namedStyleType',
		},
	});
	if (linkRange) {
		requests.push({
			updateTextStyle: {
				range: { tabId, startIndex: 1 + linkRange.start, endIndex: 1 + linkRange.end },
				textStyle: { link: { url: linkRange.url } },
				fields: 'link',
			},
		});
	}
	requests.push({
		createParagraphBullets: {
			range: { tabId, startIndex: 1 + checklistStart, endIndex: 1 + checklistEnd },
			bulletPreset: 'BULLET_CHECKBOX',
		},
	});
	return requests;
}

// Контент одной платформенной вкладки: текст + стили из md (### → HEADING_2,
// **bold**, [text](url), буллеты «—»).
function buildPlatformRequests(tabId, md) {
	const inline = parseMdInline(md);
	if (!inline.text) return [];
	const requests = [];
	requests.push({ insertText: { location: { tabId, index: 1 }, text: inline.text } });
	for (const h of inline.headings) {
		requests.push({
			updateParagraphStyle: {
				range: { tabId, startIndex: 1 + h.start, endIndex: 1 + h.end },
				paragraphStyle: { namedStyleType: 'HEADING_2' },
				fields: 'namedStyleType',
			},
		});
	}
	for (const r of inline.bullets) {
		requests.push({
			createParagraphBullets: {
				range: { tabId, startIndex: 1 + r.start, endIndex: 1 + r.end },
				bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
			},
		});
	}
	for (const r of inline.bold) {
		requests.push({
			updateTextStyle: {
				range: { tabId, startIndex: 1 + r.start, endIndex: 1 + r.end },
				textStyle: { bold: true },
				fields: 'bold',
			},
		});
	}
	for (const l of inline.links) {
		requests.push({
			updateTextStyle: {
				range: { tabId, startIndex: 1 + l.start, endIndex: 1 + l.end },
				textStyle: { link: { url: l.url } },
				fields: 'link',
			},
		});
	}
	return requests;
}

// Парсер md-блока: возвращает плоский текст + диапазоны для headings/bullets/bold/links
function parseMdInline(md) {
	let text = '';
	const headings = [];
	const bullets = [];
	const bold = [];
	const links = [];

	const lines = md.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '---' || trimmed === '') {
			text += '\n';
			continue;
		}
		const h3 = trimmed.match(/^###\s+(.+)$/);
		if (h3) {
			const start = text.length;
			text += h3[1] + '\n';
			headings.push({ start, end: text.length });
			continue;
		}
		const bul = trimmed.match(/^—\s+(.+)$/);
		if (bul) {
			const start = text.length;
			text += bul[1] + '\n';
			bullets.push({ start, end: text.length });
			continue;
		}
		// Обычный абзац — обрабатываем inline **bold** и [text](url)
		const start = text.length;
		const inline = processInline(trimmed);
		text += inline.text + '\n';
		for (const r of inline.bold) bold.push({ start: start + r.start, end: start + r.end });
		for (const l of inline.links) links.push({ start: start + l.start, end: start + l.end, url: l.url });
	}
	return { text: text.replace(/\n+$/, ''), headings, bullets, bold, links };
}

// ─── Main ────────────────────────────────────────────────────────────────────
const files = collectFiles();

console.log(`Social → Google Docs (многотабовые)`);
console.log(`Папка Drive: ${FOLDER_ID || '(не задано)'}`);
console.log(`Auth: ${HAS_SA ? 'Service Account' : HAS_OAUTH ? 'OAuth refresh_token' : '—'}`);
console.log(`Режим: ${HAS_SLUG_FILTER ? `slug=${SLUG_FILTER_LIST.join(',')}` : ALL ? 'ALL' : 'только status: ready'}`);
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
	if (authMode === 'sa' && HAS_OAUTH && /storageQuotaExceeded|storage quota/i.test(err.message)) {
		console.warn('\n⚠ Service Account упёрся в storageQuotaExceeded. Переключаюсь на OAuth.\n');
		token = await getAccessTokenOAuth();
		authMode = 'oauth';
		return true;
	}
	return false;
}

let ok = 0;
let failed = 0;

for (const file of files) {
	try {
		const r = await upsertArticle(token, file);
		console.log(`OK  ${file.slug} → ${r.webViewLink}`);
		ok++;
	} catch (err) {
		if (await maybeFallbackToOAuth(err)) {
			try {
				const r = await upsertArticle(token, file);
				console.log(`OK  ${file.slug} → ${r.webViewLink}`);
				ok++;
				continue;
			} catch (err2) {
				console.error(`FAIL ${file.slug}: ${err2.message}`);
				failed++;
				continue;
			}
		}
		console.error(`FAIL ${file.slug}: ${err.message}`);
		failed++;
	}
}

console.log(`\nГотово. Успешно: ${ok}, ошибок: ${failed}.`);
if (failed > 0 && ok === 0) process.exit(1);
