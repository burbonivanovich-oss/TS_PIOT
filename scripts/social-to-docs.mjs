#!/usr/bin/env node
// Выгружает социальные черновики в Google Drive как многотабовые
// Google Docs. Один Doc на одну статью. Структура вкладок:
//   1. Чек-лист публикации (интерактивные чекбоксы)
//   2. Telegram
//   3. VK
//   4. Дзен
//   5. Email
//
// Каждая платформа — отдельная вкладка (Tab) Google Docs. Чек-лист —
// настоящий interactive checklist через CreateParagraphBullets с
// BULLET_CHECKBOX preset.
//
// Идемпотентно: если Doc с тем же именем уже есть в папке —
// удаляется и пересоздаётся (чтобы пересобрать вкладки чисто).
//
// API:
// - Drive  POST /v3/files                 — создание пустого Doc
// - Drive  GET  /v3/files?q=...           — поиск существующих
// - Drive  DELETE /v3/files/{id}          — удаление перед пересборкой
// - Docs   GET  /v1/documents/{id}        — получение tabId
// - Docs   POST /v1/documents/{id}:batchUpdate — заполнение вкладок
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

// ─── Markdown → Docs requests ────────────────────────────────────────────────
// Преобразует markdown в массив { text, isHeading, isBullet } сегментов
// для последовательной вставки. Поддерживает: ### заголовки, **bold**,
// [text](url), маркеры "—" в начале строки = bullet.
function mdToSegments(md) {
	const segments = [];
	const lines = md.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '---' || trimmed === '') {
			segments.push({ type: 'blank' });
			continue;
		}
		const h3 = trimmed.match(/^###\s+(.+)$/);
		if (h3) {
			segments.push({ type: 'heading', text: h3[1] });
			continue;
		}
		// Маркер "—" в начале — буллет
		const bullet = trimmed.match(/^—\s+(.+)$/);
		if (bullet) {
			segments.push({ type: 'bullet', text: bullet[1] });
			continue;
		}
		segments.push({ type: 'para', text: trimmed });
	}
	return segments;
}

// Сегменты → массив текстовых блоков (для вставки одним InsertText + стилей)
function segmentsToInserts(segments) {
	// Возвращаем: { text, styles: [{startOffset, endOffset, kind}], ... }
	const out = [];
	let text = '';
	const styles = [];
	let bulletStart = -1;

	function flush() {
		if (text) out.push({ text, styles: styles.slice() });
		text = '';
		styles.length = 0;
		bulletStart = -1;
	}

	for (const seg of segments) {
		if (seg.type === 'blank') {
			text += '\n';
			continue;
		}
		const start = text.length;
		const line = seg.text + '\n';
		text += line;
		const end = text.length;
		if (seg.type === 'heading') {
			styles.push({ kind: 'heading', start, end });
		} else if (seg.type === 'bullet') {
			styles.push({ kind: 'bullet', start, end });
		}
	}
	flush();
	return out;
}

// Сборка batchUpdate-запросов для вставки контента в указанную вкладку
function buildContentRequests(tabId, md) {
	const segments = mdToSegments(md);
	if (segments.length === 0) return [];

	// Собираем единый текст с метаданными для последующего стилирования
	let text = '';
	const headingRanges = [];
	const bulletRanges = [];
	const boldRanges = [];
	const linkRanges = [];

	for (const seg of segments) {
		if (seg.type === 'blank') {
			text += '\n';
			continue;
		}
		const start = text.length;
		// Inline markdown: **bold**, [text](url) — извлекаем и сохраняем диапазоны
		const inline = processInline(seg.text);
		const segStart = text.length;
		text += inline.text;
		for (const b of inline.bold) {
			boldRanges.push({ start: segStart + b.start, end: segStart + b.end });
		}
		for (const l of inline.links) {
			linkRanges.push({ start: segStart + l.start, end: segStart + l.end, url: l.url });
		}
		text += '\n';
		const end = text.length; // включает \n
		if (seg.type === 'heading') headingRanges.push({ start, end });
		else if (seg.type === 'bullet') bulletRanges.push({ start, end });
	}

	if (!text.trim()) return [];

	const requests = [];
	// Вставка текста в начало body вкладки (index 1)
	requests.push({
		insertText: {
			location: { tabId, index: 1 },
			text,
		},
	});

	// Заголовки → HEADING_2
	for (const r of headingRanges) {
		requests.push({
			updateParagraphStyle: {
				range: { tabId, startIndex: 1 + r.start, endIndex: 1 + r.end },
				paragraphStyle: { namedStyleType: 'HEADING_2' },
				fields: 'namedStyleType',
			},
		});
	}

	// Bullets — обычные маркированные списки (для буллетов "—" из соцпостов)
	for (const r of bulletRanges) {
		requests.push({
			createParagraphBullets: {
				range: { tabId, startIndex: 1 + r.start, endIndex: 1 + r.end },
				bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
			},
		});
	}

	// Bold
	for (const r of boldRanges) {
		requests.push({
			updateTextStyle: {
				range: { tabId, startIndex: 1 + r.start, endIndex: 1 + r.end },
				textStyle: { bold: true },
				fields: 'bold',
			},
		});
	}

	// Links
	for (const l of linkRanges) {
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
async function upsertArticle(token, { slug, fm, body }) {
	const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
	const datePart = dateMatch ? ` · ${dateMatch[1]}` : '';
	const docName = fm.title ? `${fm.title}${datePart}` : slug;

	// Удаляем старую версию, если есть — чтобы пересобрать вкладки чисто
	const existing = await findExisting(token, docName);
	if (existing) {
		await deleteDoc(token, existing.id);
	}

	// Создаём пустой Doc
	const created = await createEmptyDoc(token, docName);
	const docId = created.id;

	// Получаем tabId дефолтной вкладки
	const doc = await getDocument(token, docId);
	const defaultTabId = doc.tabs?.[0]?.tabProperties?.tabId;
	if (!defaultTabId) throw new Error(`У документа ${docId} не получили tabId дефолтной вкладки`);

	// Шапка с ссылкой на статью — в первый абзац дефолтной вкладки
	const articleUrl = fm.articleUrl ? `https://etiketka-media.ru${fm.articleUrl}` : '';

	// ── Дефолтная вкладка → переименовываем в «Чек-лист публикации» ──────────
	// + вставляем интерактивный чек-лист
	const checklistItems = [
		'Telegram — опубликовано',
		'VK — опубликовано',
		'Дзен — опубликовано (с CPA-врезкой и erid)',
		'Email — отправлено в рассылку',
	];
	const checklistText = checklistItems.map(s => s + '\n').join('');
	const articleLineText = articleUrl ? `Статья на сайте: ${articleUrl}\n\n` : '';

	const renameReqs = [{
		updateTabProperties: {
			tabId: defaultTabId,
			tabProperties: { title: 'Чек-лист публикации' },
			fields: 'title',
		},
	}];
	await batchUpdate(token, docId, renameReqs);

	const checklistReqs = [];
	let cursor = 1;
	if (articleLineText) {
		checklistReqs.push({
			insertText: { location: { tabId: defaultTabId, index: cursor }, text: articleLineText },
		});
		// Ссылка как hyperlink на article URL внутри строки
		const linkStart = cursor + 'Статья на сайте: '.length;
		const linkEnd = linkStart + articleUrl.length;
		checklistReqs.push({
			updateTextStyle: {
				range: { tabId: defaultTabId, startIndex: linkStart, endIndex: linkEnd },
				textStyle: { link: { url: articleUrl } },
				fields: 'link',
			},
		});
		cursor += articleLineText.length;
	}
	checklistReqs.push({
		insertText: { location: { tabId: defaultTabId, index: cursor }, text: checklistText },
	});
	const checklistStart = cursor;
	const checklistEnd = cursor + checklistText.length;
	checklistReqs.push({
		createParagraphBullets: {
			range: { tabId: defaultTabId, startIndex: checklistStart, endIndex: checklistEnd },
			bulletPreset: 'BULLET_CHECKBOX',
		},
	});
	await batchUpdate(token, docId, checklistReqs);

	// ── Платформенные вкладки ────────────────────────────────────────────────
	const sections = splitPlatforms(body);
	const platforms = ['Telegram', 'VK', 'Дзен', 'Email'];

	for (const name of platforms) {
		const md = sections[name] || '';
		if (!md.trim()) continue;

		// Создаём вкладку
		const createResp = await batchUpdate(token, docId, [{
			createTab: {
				tabProperties: { title: name },
			},
		}]);
		const newTabId = createResp.replies?.[0]?.createTab?.tabProperties?.tabId;
		if (!newTabId) throw new Error(`Не получили tabId для вкладки ${name}`);

		// Заполняем
		const contentReqs = buildContentRequests(newTabId, md);
		if (contentReqs.length > 0) {
			await batchUpdate(token, docId, contentReqs);
		}
	}

	return created;
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
