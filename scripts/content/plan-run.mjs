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
 * Чего проверка НЕ умеет: она сравнивает слова, а не смысл. «Признаки
 * фирмы-однодневки» и «Проверка контрагента перед сделкой» — один и тот же
 * материал разными словами, и никакой счёт по токенам этого не покажет.
 * Поэтому пустой `similarExisting` не означает «дубля нет»: после research
 * brief тему всё равно надо сверить с кластером глазами.
 */
const STOP_WORDS = new Set([
	'для', 'и', 'в', 'на', 'с', 'по', 'что', 'как', 'это', 'году', 'год', 'года',
	'при', 'от', 'до', 'или', 'не', 'кому', 'чем', 'кто', 'где', 'а', 'к', 'о',
	'без', 'про', 'его', 'её', 'кого',
	'2024', '2025', '2026', '2027', 'dlya', 'kak', 'chto', 'eto',
	'ili', 'kogda', 'nuzhno', 'novye', 'vse', 'chem', 'komu', 'gde', 'vs',
]);

/**
 * Слова, означающие одно и то же: аббревиатура и расшифровка, кириллица и
 * транслит. Без них «КЭДО» и «кадровые документы» — два непересекающихся
 * набора слов, хотя это одна тема.
 */
const SYNONYM_GROUPS = [
	['кэдо', 'kedo', 'кадровый', 'кадровые', 'кадровых', 'kadrovye', 'kadrovyj', 'kadrovyh'],
	['честный', 'честного', 'чз', 'chestny', 'chestnyj', 'chz'],
	['маркировка', 'маркировки', 'маркировке', 'markirovka', 'markirovki'],
	['самозанятый', 'самозанятому', 'самозанятых', 'нпд', 'samozanyatyj', 'samozanyatomu', 'npd'],
	['календарь', 'сроки', 'срок', 'kalendar', 'sroki', 'srok'],
	['разрешительный', 'разрешительного', 'razreshitelnyj', 'razreshitelnogo'],
	['касса', 'кассы', 'ккт', 'kassa', 'kassy', 'kkt'],
	['общепит', 'общепита', 'кафе', 'ресторан', 'ресторана', 'obschepit', 'obschepita', 'kafe', 'restoran'],
	['штраф', 'штрафы', 'штрафов', 'shtraf', 'shtrafy', 'shtrafov'],
	['бухгалтерия', 'бухучёт', 'бухучет', 'buh', 'buhgalteriya'],
	['контрагент', 'контрагента', 'однодневка', 'однодневки', 'kontragent', 'kontragenta', 'odnodevki', 'odnodnevki'],
	['документооборот', 'эдо', 'edo', 'dokumentooborot'],
	['персональные', 'пдн', 'personalnye', 'pdn'],
	['маркетплейс', 'маркетплейсы', 'marketplace', 'wb', 'ozon', 'wildberries'],
];
const CANON = new Map();
for (const group of SYNONYM_GROUPS) for (const word of group) CANON.set(word, group[0]);

/** Двухбуквенные токены оставляем: «ИП», «ФН», «ЧЗ» — значимые слова темы. */
function significantTokens(text) {
	return new Set(
		text
			.toLowerCase()
			.replace(/[«»"'(),.:;—–_-]/g, ' ')
			.split(/\s+/)
			.filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
			.map((w) => CANON.get(w) ?? w),
	);
}

const deDate = (slug) => slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');

/** Порог редкости: слово из стольких статей и меньше считаем говорящим. */
const RARE_DF = 3;

function makeSimilarityScorer(articles) {
	const df = new Map();
	for (const a of articles) {
		const all = new Set([...significantTokens(deDate(a.slug)), ...significantTokens(a.title)]);
		for (const t of all) df.set(t, (df.get(t) ?? 0) + 1);
	}
	const total = articles.length || 1;
	const idf = (t) => Math.log((total + 1) / ((df.get(t) ?? 0) + 1)) + 1;

	const overlap = (a, b) => {
		if (!a.size || !b.size) return 0;
		const shared = [...a].filter((t) => b.has(t));
		// Одно общее слово — это общий кластер, а не общая тема: «маркетплейс»
		// роднит возврат товара с кассой, «личный кабинет» — WB с ТС ПИоТ.
		// Исключение — редкое слово: «кэдо» есть в двух статьях блога, и его
		// одного достаточно, чтобы заподозрить пересказ.
		if (shared.length < 2 && !shared.some((t) => (df.get(t) ?? 0) <= RARE_DF)) return 0;
		const weight = (set) => [...set].reduce((acc, t) => acc + idf(t), 0);
		return shared.reduce((acc, t) => acc + idf(t), 0) / Math.min(weight(a), weight(b));
	};

	// Латиница слага и кириллица заголовка живут в разных алфавитах и никогда
	// не пересекутся. В одном мешке они лишь раздували знаменатель: пара
	// «разрешительный режим» ↔ «разрешительный режим» давала 0.40 вместо 0.79,
	// а «самозанятый → ИП» ↔ «самозанятый или ИП» — 0.25 вместо 1.00 и молча
	// уходила в работу. Считаем каналы отдельно и берём лучший.
	return (topic, article) => Math.max(
		overlap(significantTokens(deDate(topic.slug)), significantTokens(deDate(article.slug))),
		overlap(significantTokens(topic.title), significantTokens(article.title)),
	);
}

/** Ниже этого счёта пара — соседи по кластеру, а не дубль. */
const SIMILAR_THRESHOLD = 0.45;

function similarExistingFor(topic, articles, score) {
	return articles
		.map((a) => ({
			url: `/blog/${a.slug}/`,
			title: a.title,
			draft: a.draft,
			score: Number(score(topic, a).toFixed(2)),
		}))
		.filter((a) => a.score >= SIMILAR_THRESHOLD)
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

/**
 * Статьи КоАП, которые всплывают в каждой второй статье кластера.
 *
 * Записи по ним лежали в `npaWhitelist.koap` мёртвым грузом: подсказки
 * собирались только по ФЗ, ПП и приказам, и до писателя описание частей не
 * доходило вовсе. Итог — за одну пачку пять перепутанных вилок: ч. 2 вместо
 * ч. 4 ст. 15.12 для табака, ставка «гражданин» вместо должностного лица для
 * ИП, дисквалификация по ч. 3 ст. 14.5, которую к ИП применить нельзя.
 */
const CATEGORY_KOAP = {
	'ts-piot': ['15.12', '14.5'],
	markirovka: ['15.12', '14.5'],
	kkt: ['14.5', '15.6'],
	egais: ['14.16', '14.17', '14.19'],
	zakonodatelstvo: ['13.11', '15.6'],
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
	for (const number of CATEGORY_KOAP[category] ?? []) {
		const meta = sources.npaWhitelist.koap?.[number];
		if (meta) hints.push(`ст. ${number} КоАП — ${meta}`);
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
const similarityScore = makeSimilarityScorer(articles);
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
		similarExisting: similarExistingFor(topic, articles, similarityScore),
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
