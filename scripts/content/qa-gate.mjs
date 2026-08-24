#!/usr/bin/env node
/**
 * Шлюз публикации: единственная проверка, которую статья обязана пройти
 * перед `draft: false`. Запускается автоматически в release-next-draft.mjs
 * и вручную по слагу.
 *
 * Проверяет:
 *   1. Редполитику и структуру (scripts/content/lib/article-rules.mjs)
 *   2. Наличие и свежесть маркера фактчека (.claude/factchecked/<slug>)
 *   3. Скор AI-маркеров (scripts/check-ai-markers.mjs, regex-режим)
 *   4. Наличие соцчерновика (src/content/wiki/social/<slug>.md)
 *
 * Использование:
 *   node scripts/content/qa-gate.mjs 2026-09-01-ffd-12-chto-eto
 *   node scripts/content/qa-gate.mjs src/content/blog/…​.mdx --json
 *
 * Выход: 0 — можно публиковать, 1 — нельзя.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, validateArticle } from './lib/article-rules.mjs';

const FACTCHECK_MAX_AGE_DAYS = 180;
const AI_SCORE_MAX = 6;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
	console.error('Использование: node scripts/content/qa-gate.mjs <slug|путь> [--json]');
	process.exit(2);
}

function resolveFile(target) {
	if (target.includes('/') && fs.existsSync(target)) return path.resolve(target);
	for (const ext of ['.mdx', '.md']) {
		const candidate = path.join(ROOT, 'src/content/blog', target + ext);
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

const file = resolveFile(target);
if (!file) {
	console.error(`Статья не найдена: ${target}`);
	process.exit(2);
}

const slug = path.basename(file).replace(/\.(md|mdx)$/, '');
const raw = fs.readFileSync(file, 'utf8');

const { errors, warnings, stats, npaUnknown } = validateArticle({ raw, slug });
const blockers = [...errors];

// — Фактчек —
const marker = path.join(ROOT, '.claude/factchecked', slug);
if (!fs.existsSync(marker)) {
	blockers.push('нет маркера фактчека .claude/factchecked/' + slug);
} else {
	const ageDays = (Date.now() - fs.statSync(marker).mtimeMs) / 86_400_000;
	if (ageDays > FACTCHECK_MAX_AGE_DAYS)
		blockers.push(`маркер фактчека старше ${FACTCHECK_MAX_AGE_DAYS} дней (${Math.round(ageDays)})`);
}
if (npaUnknown.length) {
	const results = path.join(ROOT, 'src/data/factcheck/results', `${slug}.json`);
	const confirmed = fs.existsSync(results)
		? (JSON.parse(fs.readFileSync(results, 'utf8')).npa ?? []).filter((n) => n.exists)
		: [];
	for (const u of npaUnknown) {
		if (!confirmed.some((c) => c.number === u.number && c.kind === u.kind))
			blockers.push(`${u.label} не подтверждён ни whitelist'ом, ни фактчеком`);
	}
}

// — AI-маркеры —
let aiScore = null;
try {
	const out = execFileSync(
		process.execPath,
		[path.join(ROOT, 'scripts/check-ai-markers.mjs'), file, '--json', `--threshold=${AI_SCORE_MAX}`],
		{ encoding: 'utf8' },
	);
	aiScore = JSON.parse(out)[0]?.finalScore ?? null;
} catch (e) {
	// exit 1 = порог превышен, вывод всё равно JSON
	try {
		aiScore = JSON.parse(e.stdout ?? '[]')[0]?.finalScore ?? null;
	} catch {
		warnings.push('не удалось прогнать check-ai-markers.mjs');
	}
}
if (aiScore !== null && aiScore >= AI_SCORE_MAX) blockers.push(`скор AI-маркеров ${aiScore}/10 (потолок ${AI_SCORE_MAX})`);

// — Соцчерновик —
const socialPaths = [
	path.join(ROOT, 'src/content/wiki/social', `${slug}.md`),
	path.join(ROOT, 'src/content/social', `${slug}-social.md`),
];
if (!socialPaths.some((p) => fs.existsSync(p))) warnings.push('нет соцчерновика');

const verdict = { slug, pass: blockers.length === 0, blockers, warnings, stats: { ...stats, aiScore } };

if (asJson) {
	console.log(JSON.stringify(verdict, null, 2));
} else {
	console.log(`${verdict.pass ? '✓' : '✗'} ${slug}`);
	console.log(
		`  слов ${stats.words}, H2 ${stats.h2}, FAQ ${stats.faq}, ссылок ${stats.links}, AI-скор ${aiScore ?? '—'}`,
	);
	for (const b of blockers) console.log(`  ✗ ${b}`);
	for (const w of warnings) console.log(`  ⚠ ${w}`);
}

process.exit(verdict.pass ? 0 : 1);
