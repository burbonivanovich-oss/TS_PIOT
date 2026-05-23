#!/usr/bin/env node
// Health-check проекта: проходит по ключевым системам и
// возвращает зелёный/жёлтый/красный статус. Один взгляд — и
// понятно, что в порядке, а что требует внимания.
//
// Запуск:
//   node scripts/health-check.mjs           — полный отчёт
//   node scripts/health-check.mjs --json    — для пайплайнов
//   node scripts/health-check.mjs --strict  — exit 1 при любых red
//
// Эту утилиту хорошо запускать:
//   - перед мержем PR в main
//   - в cron'е раз в неделю (отдельным workflow с уведомлением)
//   - вручную «что у меня вообще происходит?»

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has('--json');
const STRICT = args.has('--strict');

const checks = [];

function ok(name, detail = '')    { checks.push({ status: 'ok',    name, detail }); }
function warn(name, detail = '')  { checks.push({ status: 'warn',  name, detail }); }
function fail(name, detail = '')  { checks.push({ status: 'fail',  name, detail }); }

// ─── 1. Контент: блог и соцпосты ─────────────────────────────────────────────
const blogDir = join(ROOT, 'src', 'content', 'blog');
const blogFiles = readdirSync(blogDir).filter(f => /\.(md|mdx)$/.test(f));
const today = new Date();

let drafts = 0, future = 0, noFactcheck = 0;
const slugs = new Set();
for (const f of blogFiles) {
	const content = readFileSync(join(blogDir, f), 'utf8');
	const slug = f.replace(/\.(md|mdx)$/, '');
	slugs.add(slug);
	if (/^draft:\s*true/m.test(content)) drafts++;
	const pd = content.match(/^pubDate:\s*"?(\d{4}-\d{2}-\d{2})/m);
	if (pd && new Date(pd[1]) > today) future++;
	if (!existsSync(join(ROOT, '.claude', 'factchecked', slug))) noFactcheck++;
}
ok('Блог: статей всего', `${blogFiles.length}`);
if (drafts > 0) warn('Блог: черновики (draft: true)', `${drafts}`);
else ok('Блог: черновиков нет', '0');
if (future > 0) warn('Блог: статьи с будущим pubDate', `${future} (выйдут по auto-publish)`);
if (noFactcheck > 0) warn('Блог: без маркера factchecked', `${noFactcheck}/${blogFiles.length}`);
else ok('Блог: все статьи фактчекнуты', `${blogFiles.length}`);

// Соцпосты
const wikiSocialDir = join(ROOT, 'src', 'content', 'wiki', 'social');
const contentSocialDir = join(ROOT, 'src', 'content', 'social');
const wikiSocial = existsSync(wikiSocialDir) ? readdirSync(wikiSocialDir).filter(f => /\.(md|mdx)$/.test(f)).map(f => f.replace(/\.(md|mdx)$/, '')) : [];
const contentSocial = existsSync(contentSocialDir) ? readdirSync(contentSocialDir).filter(f => /\.(md|mdx)$/.test(f)).map(f => f.replace(/\.(md|mdx)$/, '').replace(/-social$/, '')) : [];
const covered = new Set([...wikiSocial, ...contentSocial]);
const missingSocial = [...slugs].filter(s => !covered.has(s));
if (missingSocial.length === 0) ok('Соцпосты: покрытие 100%', '');
else if (missingSocial.length < blogFiles.length * 0.1) warn('Соцпосты: пропуски', `${missingSocial.length}/${blogFiles.length}`);
else fail('Соцпосты: большие пробелы', `${missingSocial.length}/${blogFiles.length} без черновиков`);

// ─── 2. Workflows ────────────────────────────────────────────────────────────
const wfDir = join(ROOT, '.github', 'workflows');
const wfs = readdirSync(wfDir).filter(f => f.endsWith('.yml'));
ok('Workflows: всего', `${wfs.length}`);

// Проверяем что упомянутые в workflow скрипты существуют
const broken = [];
for (const wf of wfs) {
	const text = readFileSync(join(wfDir, wf), 'utf8');
	const scripts = [...text.matchAll(/node\s+(scripts\/[a-z0-9\-_/.]+\.mjs)/gi)].map(m => m[1]);
	for (const s of scripts) {
		if (!existsSync(join(ROOT, s))) broken.push({ wf, script: s });
	}
}
if (broken.length === 0) ok('Workflows: все script-ссылки целы', '');
else fail('Workflows: битые ссылки на скрипты', broken.map(b => `${b.wf} → ${b.script}`).join(', '));

// ─── 3. Скрипты ──────────────────────────────────────────────────────────────
const scriptsDir = join(ROOT, 'scripts');
function walkScripts(dir, acc = []) {
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		const s = statSync(p);
		if (s.isDirectory()) walkScripts(p, acc);
		else if (f.endsWith('.mjs')) acc.push(p);
	}
	return acc;
}
const allScripts = walkScripts(scriptsDir);
ok('Скрипты: всего .mjs', `${allScripts.length}`);

// ─── 4. Билд ─────────────────────────────────────────────────────────────────
try {
	const result = execSync('npm run build 2>&1', { cwd: ROOT, stdio: 'pipe' }).toString();
	if (/Error|error/i.test(result)) {
		fail('Билд: упал', result.split('\n').filter(l => /error/i.test(l)).slice(0, 3).join(' | '));
	} else {
		ok('Билд: проходит', '');
	}
} catch (e) {
	const out = (e.stdout || '').toString() + (e.stderr || '').toString();
	fail('Билд: упал', out.split('\n').slice(-5).join(' | '));
}

// ─── 5. Sitemap ──────────────────────────────────────────────────────────────
const sitemapPath = join(ROOT, 'dist', 'sitemap.xml');
if (existsSync(sitemapPath)) {
	const sitemap = readFileSync(sitemapPath, 'utf8');
	const urlCount = (sitemap.match(/<loc>/g) || []).length;
	ok('Sitemap: URL\'ов', `${urlCount}`);
	// Проверяем что нет утечек future статей
	let leaked = 0;
	for (const f of blogFiles) {
		const content = readFileSync(join(blogDir, f), 'utf8');
		const pd = content.match(/^pubDate:\s*"?(\d{4}-\d{2}-\d{2})/m);
		if (!pd || new Date(pd[1]) <= today) continue;
		const slug = f.replace(/\.(md|mdx)$/, '');
		if (sitemap.includes(`/blog/${slug}/`)) leaked++;
	}
	if (leaked > 0) fail('Sitemap: утечка будущих статей', `${leaked} URL'ов (битые ссылки для Google)`);
	else ok('Sitemap: нет утечек future-статей', '');
}

// ─── 6. Декларативные конфиги ────────────────────────────────────────────────
const metrikaGoals = join(ROOT, 'src', 'data', 'metrika', 'goals.json');
if (existsSync(metrikaGoals)) {
	try {
		const cfg = JSON.parse(readFileSync(metrikaGoals, 'utf8'));
		ok('Метрика: целей в goals.json', `${cfg.goals?.length || 0}`);
		if ((cfg.goals?.length || 0) > 200) {
			fail('Метрика: лимит 200 целей превышен', `${cfg.goals.length}/200`);
		} else if ((cfg.goals?.length || 0) > 180) {
			warn('Метрика: близко к лимиту', `${cfg.goals.length}/200`);
		}
	} catch (e) {
		fail('Метрика: goals.json не парсится', e.message);
	}
}

const ordConfig = join(ROOT, 'src', 'data', 'ord-config.json');
const ordErids = join(ROOT, 'src', 'data', 'ord-erids.json');
if (existsSync(ordConfig) && existsSync(ordErids)) {
	try {
		const cfg = JSON.parse(readFileSync(ordConfig, 'utf8'));
		const erids = JSON.parse(readFileSync(ordErids, 'utf8'));
		// Креативы лежат в cfg.creatives — массив с id
		const creativeIds = (cfg.creatives || []).map(c => c.id).filter(Boolean);
		const eridIds = Object.keys(erids).filter(k => !k.startsWith('$') && !k.startsWith('_'));
		const missingErids = creativeIds.filter(id => !eridIds.includes(id));
		if (creativeIds.length === 0) ok('ОРД: креативов в конфиге нет', '');
		else if (missingErids.length === 0) ok('ОРД: erid у всех креативов', `${creativeIds.length}/${creativeIds.length}`);
		else warn('ОРД: креативы без erid', missingErids.join(', '));
	} catch {}
}

// ─── 7. Картинки ─────────────────────────────────────────────────────────────
const heroDir = join(ROOT, 'public', 'images', 'hero');
if (existsSync(heroDir)) {
	const heroes = readdirSync(heroDir).filter(f => /\.(jpe?g|png)$/i.test(f));
	const webps = readdirSync(heroDir).filter(f => /\.webp$/i.test(f));
	const ratio = heroes.length > 0 ? webps.length / heroes.length : 1;
	if (ratio < 0.9) warn('Hero: WebP отстаёт', `${webps.length}/${heroes.length} (запустите optimize-images.mjs)`);
	else ok('Hero: WebP полное', `${webps.length}/${heroes.length}`);
}

// ─── 8. Документация ─────────────────────────────────────────────────────────
const requiredDocs = [
	'docs/architecture.md',
	'docs/content-rules.md',
	'docs/tools.md',
	'docs/SECRETS.md',
	'docs/analytics.md',
	'docs/metrika.md',
	'docs/images.md',
];
const missingDocs = requiredDocs.filter(d => !existsSync(join(ROOT, d)));
if (missingDocs.length === 0) ok('Документация: ключевые файлы на месте', `${requiredDocs.length}`);
else fail('Документация: пропущено', missingDocs.join(', '));

// ─── Вывод ───────────────────────────────────────────────────────────────────
if (JSON_OUT) {
	console.log(JSON.stringify({
		summary: {
			ok: checks.filter(c => c.status === 'ok').length,
			warn: checks.filter(c => c.status === 'warn').length,
			fail: checks.filter(c => c.status === 'fail').length,
		},
		checks,
	}, null, 2));
} else {
	const ICON = { ok: '✓', warn: '⚠', fail: '✗' };
	const COLOR = { ok: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[31m', reset: '\x1b[0m' };
	for (const c of checks) {
		console.log(`${COLOR[c.status]}${ICON[c.status]}${COLOR.reset} ${c.name}${c.detail ? ': ' + c.detail : ''}`);
	}
	const okN = checks.filter(c => c.status === 'ok').length;
	const warnN = checks.filter(c => c.status === 'warn').length;
	const failN = checks.filter(c => c.status === 'fail').length;
	console.log(`\nИтого: ${COLOR.ok}${okN} ok${COLOR.reset}, ${COLOR.warn}${warnN} warn${COLOR.reset}, ${COLOR.fail}${failN} fail${COLOR.reset}`);
}

if (STRICT && checks.some(c => c.status === 'fail')) process.exit(1);
