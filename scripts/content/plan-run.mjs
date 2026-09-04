#!/usr/bin/env node
/**
 * План прогона для сессии Claude: какие темы писать, с какими датами публикации
 * и с каким контекстом.
 *
 * Статьи пишет Claude — агентами research-specialist → content-writer →
 * seo-optimizer → social-media-manager (скилл `/create-article`). Этот скрипт
 * не пишет текст: он готовит задание, чтобы сессия не тратила шаги на разбор
 * контент-плана, расстановку дат и поиск статей для перелинковки.
 *
 *   node scripts/content/plan-run.mjs              # человекочитаемо
 *   node scripts/content/plan-run.mjs --json       # для скриптов
 *   node scripts/content/plan-run.mjs --count=5 --start=2026-09-01
 *
 * Без --count очередь добивается до месячной нормы: по одной статье на каждый
 * оставшийся будний день месяца, не больше QUOTA, минус уже запланированное.
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, buildQueue } from './lib/content-plan.mjs';
import { parseFrontmatter } from './lib/article-rules.mjs';

const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const QUOTA = Number(process.env.QUOTA ?? 22);

const flag = (name) => {
	const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.split('=')[1] : null;
};

// ─── Расписание ──────────────────────────────────────────────────────────────

const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

function scheduleDates(count, start, taken) {
	const dates = [];
	const cursor = new Date(start);
	let guard = 0;
	while (dates.length < count && guard++ < 400) {
		const iso = cursor.toISOString().slice(0, 10);
		if (!isWeekend(cursor) && !taken.has(iso)) dates.push(iso);
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return dates;
}

function weekdaysLeftInMonth(start) {
	const cursor = new Date(start);
	const month = cursor.getUTCMonth();
	let n = 0;
	while (cursor.getUTCMonth() === month) {
		if (!isWeekend(cursor)) n++;
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return n;
}

// ─── Контекст ────────────────────────────────────────────────────────────────

function allArticles() {
	return fs
		.readdirSync(BLOG_DIR)
		.filter((f) => /\.(md|mdx)$/.test(f))
		.map((f) => {
			const { fm } = parseFrontmatter(fs.readFileSync(path.join(BLOG_DIR, f), 'utf8'));
			return {
				slug: f.replace(/\.(md|mdx)$/, ''),
				title: fm?.title ?? '',
				category: (Array.isArray(fm?.categories) ? fm.categories[0] : fm?.categories) ?? '',
				tags: Array.isArray(fm?.tags) ? fm.tags : [],
				draft: fm?.draft === true,
				pubDate: fm?.pubDate ?? null,
			};
		})
		.filter((a) => a.title);
}

/** Кандидаты на перелинковку: своя категория вперёд, потом пересечение по словам. */
function linkCandidatesFor(topic, articles) {
	const published = articles.filter((a) => !a.draft);
	const sameCategory = published.filter((a) => a.category === topic.category);
	const words = new Set(topic.slug.split('-'));
	const related = published
		.filter((a) => a.category !== topic.category)
		.map((a) => ({
			...a,
			score: a.tags.filter((t) => words.has(t)).length + (a.slug.split('-').some((w) => words.has(w)) ? 1 : 0),
		}))
		.filter((a) => a.score > 0)
		.sort((a, b) => b.score - a.score);

	return [...sameCategory.slice(-8), ...related.slice(0, 4)].map((a) => ({
		url: `/blog/${a.slug}/`,
		title: a.title,
		category: a.category,
	}));
}

/**
 * Похожие статьи, которые уже есть в блоге.
 *
 * `buildQueue` отсекает точные совпадения по slug, но контент-план писали
 * руками, и в нём встречаются темы, пересказывающие уже вышедший материал
 * другими словами: «Касса для кафе и общепита» при живой «Касса для кафе
 * 2026». Такую пару надо ловить до написания, иначе получим каннибализацию
 * выдачи — две страницы под один запрос.
 *
 * Считаем долю общих значимых слов (slug + заголовок). Порог 0.34 подобран
 * так, чтобы ловить «kassa-dlya-obschepita» ↔ «kassa-dlya-kafe-2026» и не
 * шуметь на статьях, у которых совпадает только тема кластера.
 */
const STOP_WORDS = new Set([
	'для', 'и', 'в', 'на', 'с', 'по', 'что', 'как', 'это', 'году', 'год', 'года',
	'при', 'от', 'до', 'или', 'не', 'кому', 'чем', 'кто', 'где', 'а', 'к', 'о',
	'2024', '2025', '2026', '2027', 'dlya', 'kak', 'chto', 'eto',
]);

function significantTokens(...parts) {
	return new Set(
		parts
			.join(' ')
			.toLowerCase()
			.replace(/[«»"'(),.:;—–-]/g, ' ')
			.split(/\s+/)
			.filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
	);
}

function similarExistingFor(topic, articles) {
	const topicTokens = significantTokens(topic.slug.replace(/-/g, ' '), topic.title);
	if (topicTokens.size === 0) return [];

	return articles
		.map((a) => {
			const tokens = significantTokens(
				a.slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' '),
				a.title,
			);
			let shared = 0;
			for (const t of topicTokens) if (tokens.has(t)) shared++;
			// Доля от меньшего множества: короткий заголовок не должен занижать счёт.
			const score = shared / Math.min(topicTokens.size, tokens.size || 1);
			return { url: `/blog/${a.slug}/`, title: a.title, draft: a.draft, score: Number(score.toFixed(2)) };
		})
		.filter((a) => a.score >= 0.34)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3);
}

const CATEGORY_TOPICS = {
	'ts-piot': ['ts-piot', 'kkt', 'markirovka'],
	markirovka: ['markirovka', 'ts-piot'],
	kkt: ['kkt', 'ts-piot'],
	egais: ['egais', 'merkuriy'],
	zakonodatelstvo: ['nalogi', 'kadry', 'edo-kedo', 'personal-data', 'banki'],
};

function npaHintsFor(category) {
	const sources = JSON.parse(
		fs.readFileSync(path.join(ROOT, 'src/data/factcheck/sources.json'), 'utf8'),
	);
	const topics = CATEGORY_TOPICS[category] ?? [];
	const hints = [];
	for (const [kind, label] of [['fz', 'ФЗ'], ['pp', 'ПП РФ'], ['prikaz', 'Приказ']]) {
		for (const [number, meta] of Object.entries(sources.npaWhitelist[kind])) {
			if (topics.includes(meta.topic)) hints.push(`${label} № ${number} от ${meta.date} — ${meta.title}`);
		}
	}
	return hints;
}

// ─── План ────────────────────────────────────────────────────────────────────

const startRaw = flag('start');
const start = startRaw
	? new Date(`${startRaw}T00:00:00Z`)
	: (() => {
			const d = new Date();
			d.setUTCDate(d.getUTCDate() + 1);
			return new Date(d.toISOString().slice(0, 10) + 'T00:00:00Z');
	  })();

const articles = allArticles();
const taken = new Set(articles.map((a) => (a.slug.match(/^(\d{4}-\d{2}-\d{2})/) ?? [])[1]).filter(Boolean));
const scheduled = articles.filter((a) => a.draft && (!a.pubDate || a.pubDate >= start.toISOString().slice(0, 10))).length;

const norm = Math.min(QUOTA, weekdaysLeftInMonth(start));
const requested = Number(flag('count') ?? Math.max(0, norm - scheduled));
// Без --count потолок в 40 страхует от случайного гигантского прогона.
// Явный --count — осознанное решение редактора (например, пачка на квартал
// вперёд), поэтому он ограничен только здравым смыслом: 120 тем.
const ceiling = flag('count') ? 120 : 40;
const count = Number.isFinite(requested) && requested > 0 ? Math.min(requested, ceiling) : 0;

const queue = buildQueue({ count });
const dates = scheduleDates(queue.length, start, taken);

const plan = {
	generatedAt: new Date().toISOString().slice(0, 10),
	quota: QUOTA,
	alreadyScheduled: scheduled,
	planPending: buildQueue().length,
	items: queue.map((topic, i) => ({
		slug: `${dates[i]}-${topic.slug}`,
		pubDate: dates[i],
		reviewDate: (() => {
			const d = new Date(`${dates[i]}T00:00:00Z`);
			d.setUTCMonth(d.getUTCMonth() + 6);
			return d.toISOString().slice(0, 10);
		})(),
		title: topic.title,
		keyword: topic.keyword,
		category: topic.category,
		cpa: topic.cpa ?? `default-${topic.category}`,
		priority: topic.priority,
		linkCandidates: linkCandidatesFor(topic, articles),
		similarExisting: similarExistingFor(topic, articles),
		npaHints: npaHintsFor(topic.category),
	})),
};

if (process.argv.includes('--json')) {
	console.log(JSON.stringify(plan, null, 2));
	process.exit(0);
}

if (plan.items.length === 0) {
	console.log(
		`Очередь уже закрывает норму: ${scheduled} черновиков запланировано, норма ${norm}. Писать нечего.`,
	);
	process.exit(0);
}

console.log(`План прогона на ${plan.items.length} статей (квота ${QUOTA}, уже запланировано ${scheduled})`);
console.log(`Запас тем в контент-плане: ${plan.planPending}\n`);
for (const item of plan.items) {
	console.log(`${item.pubDate}  ${item.priority} ${item.category.padEnd(15)} ${item.slug}`);
	console.log(`            «${item.title}»`);
	console.log(`            ключ: ${item.keyword} · CPA: ${item.cpa} · ссылок-кандидатов: ${item.linkCandidates.length}`);
	for (const dupe of item.similarExisting) {
		console.log(`            ⚠ похоже на ${dupe.url} «${dupe.title}» (${dupe.score})`);
	}
}

const withDupes = plan.items.filter((i) => i.similarExisting.length);
if (withDupes.length) {
	console.log(
		`\n⚠ Тем с риском дубля: ${withDupes.length}. Перед написанием сравните с указанной статьёй:`,
	);
	console.log('  тема раскрыта — пропустите её, тема шире или уже — сузьте заголовок и ключ.');
}
console.log('\nПолный контекст по каждой теме — с флагом --json.');
