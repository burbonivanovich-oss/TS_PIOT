#!/usr/bin/env node
// Аудит покрытия блог-статей соцпостами. Проверяет, для каких
// статей в src/content/blog/ нет соответствующих файлов в
// src/content/wiki/social/ или src/content/social/.
//
// Запуск: node scripts/audit-social-coverage.mjs
//   --missing    показать только статьи без соцпостов
//   --json       вывести в JSON для дальнейшей обработки

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, 'src', 'content', 'blog');
const WIKI_SOCIAL = join(ROOT, 'src', 'content', 'wiki', 'social');
const CONTENT_SOCIAL = join(ROOT, 'src', 'content', 'social');
const AGGREGATED = join(ROOT, 'src', 'content', 'wiki', 'social-posts-2026-05-01.md');

const args = new Set(process.argv.slice(2));
const ONLY_MISSING = args.has('--missing');
const JSON_OUT = args.has('--json');

const blogSlugs = new Set(
	readdirSync(BLOG).filter(f => /\.(md|mdx)$/.test(f)).map(f => f.replace(/\.(md|mdx)$/, '')),
);

const wikiSocial = new Set(
	existsSync(WIKI_SOCIAL)
		? readdirSync(WIKI_SOCIAL).filter(f => /\.(md|mdx)$/.test(f)).map(f => f.replace(/\.(md|mdx)$/, ''))
		: [],
);
const contentSocial = new Set(
	existsSync(CONTENT_SOCIAL)
		? readdirSync(CONTENT_SOCIAL)
			.filter(f => /\.(md|mdx)$/.test(f))
			.map(f => f.replace(/\.(md|mdx)$/, '').replace(/-social$/, ''))
		: [],
);

let aggregated = new Set();
if (existsSync(AGGREGATED)) {
	const text = readFileSync(AGGREGATED, 'utf8');
	for (const slug of blogSlugs) if (text.includes(slug)) aggregated.add(slug);
}

const covered = new Set([...wikiSocial, ...contentSocial, ...aggregated]);
const missing = [...blogSlugs].filter(s => !covered.has(s)).sort();

if (JSON_OUT) {
	console.log(JSON.stringify({
		totals: {
			blog: blogSlugs.size,
			covered: blogSlugs.size - missing.length,
			missing: missing.length,
			wikiSocial: wikiSocial.size,
			contentSocial: contentSocial.size,
			aggregated: aggregated.size,
		},
		missing,
	}, null, 2));
	process.exit(0);
}

if (!ONLY_MISSING) {
	console.log(`Всего блог-статей:    ${blogSlugs.size}`);
	console.log(`Покрыто соцпостами:   ${blogSlugs.size - missing.length}`);
	console.log(`Из них:`);
	console.log(`  wiki/social/        ${[...wikiSocial].filter(s => blogSlugs.has(s)).length}`);
	console.log(`  content/social/     ${[...contentSocial].filter(s => blogSlugs.has(s)).length}`);
	console.log(`  агрегированный файл ${aggregated.size}`);
	console.log(`\nБЕЗ соцпостов: ${missing.length}`);
}

for (const s of missing) console.log(`  - ${s}`);

const orphansWiki = [...wikiSocial].filter(s => !blogSlugs.has(s));
const orphansContent = [...contentSocial].filter(s => !blogSlugs.has(s));
if (!ONLY_MISSING && (orphansWiki.length || orphansContent.length)) {
	console.log(`\nСироты (соцпост есть, статьи нет):`);
	for (const s of orphansWiki) console.log(`  wiki:    ${s}`);
	for (const s of orphansContent) console.log(`  content: ${s}`);
}
