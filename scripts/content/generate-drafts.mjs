/**
 * Автопилот контента: генерация месячной нормы черновиков.
 *
 * Один прогон: берёт незакрытые темы контент-плана, по каждой проходит цикл
 * research (веб) → write → шлюз качества → починка → фактчек (веб) → соцпосты,
 * и кладёт статью в `src/content/blog/` с `draft: true` и будущим pubDate.
 * Публикацией занимается auto-publish.yml — он выпускает черновик в день,
 * указанный в pubDate.
 *
 * Env:
 *   OPENROUTER_API_KEY  — обязателен (тот же ключ, что у генераторов картинок)
 *   DRAFT_MODEL         — модель; по умолчанию первая доступная из кандидатов
 *   COUNT               — сколько статей писать; по умолчанию очередь добивается
 *                         до нормы: по одной статье на каждый оставшийся будний
 *                         день месяца, не больше QUOTA, минус уже запланированное
 *   QUOTA               — месячный потолок (по умолчанию 22)
 *   START_DATE          — с какой даты расставлять pubDate (по умолчанию завтра)
 *   CONCURRENCY         — сколько статей писать параллельно (по умолчанию 3)
 *   SKIP_FACTCHECK=1    — пропустить онлайн-фактчек (для отладки)
 *   DRY_RUN=1           — показать план прогона и выйти, без обращений к API
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, buildQueue } from './lib/content-plan.mjs';
import {
	AUTO_NPA_PATH,
	parseFrontmatter,
	validateArticle,
} from './lib/article-rules.mjs';
import {
	chat,
	chatJson,
	CreditsError,
	credits,
	extractMarkdown,
	resolveModel,
	usageTotals,
} from './lib/openrouter.mjs';
import {
	factcheckPrompt,
	repairPrompt,
	researchPrompt,
	socialPrompt,
	writePrompt,
} from './lib/prompts.mjs';

const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const SOCIAL_DIR = path.join(ROOT, 'src/content/wiki/social');
const RESEARCH_DIR = path.join(ROOT, '.claude/research');
const FACTCHECK_DIR = path.join(ROOT, 'src/data/factcheck/results');
const MARKER_DIR = path.join(ROOT, '.claude/factchecked');
const REPORT_PATH = path.join(ROOT, 'src/content/wiki/autopilot-log.md');

const QUOTA = Number(process.env.QUOTA ?? 22);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const MAX_REPAIRS = 2;
/** Жёсткий потолок статей за один прогон — страховка от опечатки в COUNT. */
const HARD_CAP = Number(process.env.HARD_CAP ?? 40);
const DRY_RUN = process.env.DRY_RUN === '1';

// ─── Расписание ──────────────────────────────────────────────────────────────

const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** Даты публикации: будние дни, начиная со start, без пересечений с занятыми. */
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

/** Черновики с датой публикации не раньше start — то, чем очередь уже закрыта. */
function pendingDrafts(start) {
	const from = start.toISOString().slice(0, 10);
	return fs
		.readdirSync(BLOG_DIR)
		.filter((f) => /\.(md|mdx)$/.test(f))
		.filter((f) => {
			const fm = (fs.readFileSync(path.join(BLOG_DIR, f), 'utf8').match(/^---\n([\s\S]*?)\n---/) ?? [])[1] ?? '';
			if (!/^draft:\s*true\s*$/m.test(fm)) return false;
			const pubDate = (fm.match(/^pubDate:\s*"?(\d{4}-\d{2}-\d{2})/m) ?? [])[1];
			return pubDate ? pubDate >= from : true;
		}).length;
}

/** Сколько будних дней осталось до конца месяца, начиная со start. */
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

// ─── Контекст для промптов ───────────────────────────────────────────────────

function publishedArticles() {
	return fs
		.readdirSync(BLOG_DIR)
		.filter((f) => /\.(md|mdx)$/.test(f))
		.map((f) => {
			const raw = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8');
			const { fm } = parseFrontmatter(raw);
			return {
				slug: f.replace(/\.(md|mdx)$/, ''),
				title: fm?.title ?? '',
				category: (Array.isArray(fm?.categories) ? fm.categories[0] : fm?.categories) ?? '',
				tags: Array.isArray(fm?.tags) ? fm.tags : [],
				draft: fm?.draft === true,
			};
		})
		.filter((a) => a.title && !a.draft);
}

/** Кандидаты на перелинковку: своя категория вперёд, потом пересечение тегов. */
function linkCandidatesFor(topic, articles) {
	const sameCategory = articles.filter((a) => a.category === topic.category);
	const topicWords = new Set(topic.slug.split('-'));
	const scored = articles
		.filter((a) => a.category !== topic.category)
		.map((a) => ({
			...a,
			score: a.tags.filter((t) => topicWords.has(t)).length + (a.slug.split('-').some((w) => topicWords.has(w)) ? 1 : 0),
		}))
		.filter((a) => a.score > 0)
		.sort((a, b) => b.score - a.score);

	return [...sameCategory.slice(-8), ...scored.slice(0, 4)];
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
	const lines = [];

	for (const [kind, label] of [['fz', 'ФЗ'], ['pp', 'ПП РФ'], ['prikaz', 'Приказ']]) {
		for (const [number, meta] of Object.entries(sources.npaWhitelist[kind])) {
			if (!topics.includes(meta.topic)) continue;
			lines.push(`- ${label} № ${number} от ${meta.date} — ${meta.title}`);
		}
	}
	return lines.length ? lines.join('\n') : '- (по этой категории проект пока не фиксировал НПА)';
}

// ─── Запись результатов ──────────────────────────────────────────────────────

function writeResearchBrief(slug, topic, research) {
	const sources = (research.facts ?? [])
		.filter((f) => f.source)
		.map((f) => `  - url: "${f.source}"\n    claim: ${JSON.stringify(f.claim ?? '')}\n    verified: ${(f.confidence ?? 0) >= 0.7}`);

	const body = `---
title: "Research brief: ${topic.title}"
createdDate: "${new Date().toISOString().slice(0, 10)}"
type: research
status: draft
generatedBy: autopilot
sources:
${sources.join('\n') || '  []'}
---

## Сводка

${research.summary ?? ''}

## Факты

${(research.facts ?? []).map((f) => `- ${f.claim}${f.npa ? ` (${f.npa})` : ''} — ${f.source ?? 'без источника'} — confidence ${f.confidence ?? '?'}`).join('\n')}

## Сроки

${(research.deadlines ?? []).map((d) => `- ${d.date} — ${d.event}`).join('\n') || '—'}

## Штрафы

${(research.penalties ?? []).map((p) => `- ${p.who}: ${p.amount} (${p.norm})`).join('\n') || '—'}

## Не подтверждено (в статью не идёт)

${(research.uncertain ?? []).map((u) => `- ${u}`).join('\n') || '—'}
`;

	fs.mkdirSync(RESEARCH_DIR, { recursive: true });
	fs.writeFileSync(path.join(RESEARCH_DIR, `${slug}-brief.md`), body);
}

function writeSocial(slug, topic, markdown) {
	const body = `---
title: "Соцпосты: ${topic.title}"
slug: "${slug}"
articleUrl: "/blog/${slug}/"
status: draft
createdDate: "${new Date().toISOString().slice(0, 10)}"
generatedBy: autopilot
---

${markdown.trim()}
`;
	fs.mkdirSync(SOCIAL_DIR, { recursive: true });
	fs.writeFileSync(path.join(SOCIAL_DIR, `${slug}.md`), body);
}

function writeFactcheck(slug, model, report, validation) {
	fs.mkdirSync(FACTCHECK_DIR, { recursive: true });
	const claims = report.claims ?? [];
	const payload = {
		slug,
		checkedAt: new Date().toISOString(),
		checkedBy: `${model}+websearch`,
		method: 'autopilot',
		summary: {
			totalClaims: claims.length,
			checked: claims.length,
			match: claims.filter((c) => c.status === 'match').length,
			mismatch: claims.filter((c) => c.status === 'mismatch').length,
			uncertain: claims.filter((c) => c.status === 'unverified').length,
			overallStatus: report.verdict ?? 'unknown',
			criticalIssues: claims.filter((c) => c.severity === 'critical' && c.status !== 'match').length,
			npaChecked: (report.npa ?? []).length,
			validatorWarnings: validation.warnings,
		},
		npa: report.npa ?? [],
		claims,
		fixes: report.fixes ?? [],
	};
	fs.writeFileSync(path.join(FACTCHECK_DIR, `${slug}.json`), JSON.stringify(payload, null, 2));

	fs.mkdirSync(MARKER_DIR, { recursive: true });
	fs.writeFileSync(
		path.join(MARKER_DIR, slug),
		`${new Date().toISOString().slice(0, 10)} autopilot ${model}+websearch\n`,
	);
}

/** Подтверждённые онлайн-фактчеком номера НПА — в авто-whitelist. */
function extendAutoNpa(npaEntries) {
	if (!npaEntries?.length) return;
	let auto = { fz: {}, pp: {}, prikaz: {} };
	if (fs.existsSync(AUTO_NPA_PATH)) {
		try {
			auto = { ...auto, ...JSON.parse(fs.readFileSync(AUTO_NPA_PATH, 'utf8')) };
		} catch {
			/* повреждённый файл перезапишем */
		}
	}
	let changed = false;
	for (const entry of npaEntries) {
		if (!entry.exists || !entry.number || !['fz', 'pp', 'prikaz'].includes(entry.kind)) continue;
		auto[entry.kind] ??= {};
		if (auto[entry.kind][entry.number]) continue;
		auto[entry.kind][entry.number] = {
			title: entry.title ?? '',
			source: entry.source ?? '',
			verifiedAt: new Date().toISOString().slice(0, 10),
			verifiedBy: 'autopilot-websearch',
		};
		changed = true;
	}
	if (changed) fs.writeFileSync(AUTO_NPA_PATH, JSON.stringify(auto, null, 2) + '\n');
}

// ─── Пайплайн одной статьи ───────────────────────────────────────────────────

async function produceArticle({ topic, dateStr, model, articles, log }) {
	const slug = `${dateStr}-${topic.slug}`;
	const reviewDate = new Date(`${dateStr}T00:00:00Z`);
	reviewDate.setUTCMonth(reviewDate.getUTCMonth() + 6);

	// 1. Research с веб-поиском
	const research = await chatJson({
		model,
		messages: researchPrompt(topic, npaHintsFor(topic.category)),
		temperature: 0.2,
		maxTokens: 8000,
		web: true,
	});
	if (!research.facts?.length) throw new Error('research не вернул фактов');
	log(`${slug}: фактов ${research.facts.length}`);

	// 2. Черновик
	let article = extractMarkdown(
		(
			await chat({
				model,
				messages: writePrompt({
					topic,
					research,
					linkCandidates: linkCandidatesFor(topic, articles),
					dateStr,
					reviewDate: reviewDate.toISOString().slice(0, 10),
				}),
				temperature: 0.5,
				maxTokens: 9000,
			})
		).content,
	);

	// 3. Шлюз качества + починка
	let validation = validateArticle({ raw: article, slug, topic });
	for (let attempt = 0; attempt < MAX_REPAIRS && validation.errors.length; attempt++) {
		log(`${slug}: починка ${attempt + 1}/${MAX_REPAIRS} — ${validation.errors.length} претензий`);
		article = extractMarkdown(
			(
				await chat({
					model,
					messages: repairPrompt({ article, problems: validation.errors }),
					temperature: 0.3,
					maxTokens: 9000,
				})
			).content,
		);
		validation = validateArticle({ raw: article, slug, topic });
	}
	if (validation.errors.length) {
		throw new Error(`не прошла шлюз: ${validation.errors.slice(0, 5).join('; ')}`);
	}

	// 4. Онлайн-фактчек: номера НПА и цифры сверяются с первоисточниками
	let report = { verdict: 'skipped', claims: [], npa: [], fixes: [] };
	if (process.env.SKIP_FACTCHECK !== '1') {
		report = await chatJson({
			model,
			messages: factcheckPrompt({ article, npaUnknown: validation.npaUnknown }),
			temperature: 0.1,
			maxTokens: 8000,
			web: true,
		});

		const ghostNpa = (report.npa ?? []).filter((n) => n.exists === false);
		const criticalMismatch = (report.claims ?? []).filter(
			(c) => c.status === 'mismatch' && c.severity === 'critical',
		);

		if (report.verdict === 'needs-fix' || ghostNpa.length || criticalMismatch.length) {
			log(`${slug}: фактчек вернул правки (${ghostNpa.length} НПА, ${criticalMismatch.length} критичных)`);
			const problems = [
				...ghostNpa.map((n) => `${n.label}: такого документа не существует — убрать ссылку на него или заменить на подтверждённую норму`),
				...criticalMismatch.map((c) => `«${c.quote}» — неверно, правильно: ${c.expected}`),
				...(report.fixes ?? []),
			];
			article = extractMarkdown(
				(await chat({ model, messages: repairPrompt({ article, problems }), temperature: 0.2, maxTokens: 9000 })).content,
			);
			validation = validateArticle({ raw: article, slug, topic });
			if (validation.errors.length) throw new Error(`после фактчека не прошла шлюз: ${validation.errors.slice(0, 5).join('; ')}`);
		}

		const stillUnverified = validation.npaUnknown.filter(
			(u) => !(report.npa ?? []).some((n) => n.number === u.number && n.kind === u.kind && n.exists),
		);
		if (stillUnverified.length) {
			throw new Error(`НПА без подтверждения: ${stillUnverified.map((u) => u.label).join(', ')}`);
		}
		extendAutoNpa(report.npa);
	}

	// 5. Соцчерновики
	let social = null;
	try {
		social = extractMarkdown((await chat({ model, messages: socialPrompt({ article, topic, slug }), temperature: 0.6, maxTokens: 5000 })).content);
	} catch (e) {
		log(`${slug}: соцпосты не сгенерировались (${e.message})`);
	}

	// 6. Запись
	fs.writeFileSync(path.join(BLOG_DIR, `${slug}.mdx`), article.endsWith('\n') ? article : article + '\n');
	writeResearchBrief(slug, topic, research);
	if (social) writeSocial(slug, topic, social);
	if (process.env.SKIP_FACTCHECK !== '1') writeFactcheck(slug, model, report, validation);

	return { slug, words: validation.stats.words, warnings: validation.warnings.length };
}

// ─── Прогон ──────────────────────────────────────────────────────────────────

/** Пустая строка из workflow-инпута — это «не задано», а не 0 и не Invalid Date. */
const envValue = (name) => {
	const value = process.env[name]?.trim();
	return value ? value : null;
};

async function main() {
	const tomorrow = () => {
		const d = new Date();
		d.setUTCDate(d.getUTCDate() + 1);
		return new Date(d.toISOString().slice(0, 10) + 'T00:00:00Z');
	};

	const startRaw = envValue('START_DATE');
	let start = startRaw ? new Date(`${startRaw}T00:00:00Z`) : tomorrow();
	if (Number.isNaN(start.getTime())) {
		console.warn(`START_DATE «${startRaw}» не разобрался — беру завтрашний день.`);
		start = tomorrow();
	}

	const taken = new Set(
		fs
			.readdirSync(BLOG_DIR)
			.map((f) => (f.match(/^(\d{4}-\d{2}-\d{2})-/) ?? [])[1])
			.filter(Boolean),
	);

	// Прогон добивает очередь до нормы, а не подсыпает норму поверх уже
	// запланированного: иначе ручной запуск плюс месячный cron надували бы
	// очередь до бесконечности.
	const scheduled = pendingDrafts(start);
	const norm = Math.min(QUOTA, weekdaysLeftInMonth(start));
	const requested = Number(envValue('COUNT') ?? Math.max(0, norm - scheduled));
	const count = Number.isFinite(requested) && requested > 0 ? Math.min(requested, HARD_CAP) : 0;
	if (requested > HARD_CAP) console.warn(`COUNT=${requested} обрезан до потолка ${HARD_CAP}.`);

	if (count === 0) {
		console.log(
			`Очередь уже закрывает норму: ${scheduled} черновиков запланировано, норма ${norm}. Ничего не пишу.`,
		);
		return;
	}

	const queue = buildQueue({ count });
	const dates = scheduleDates(queue.length, start, taken);

	console.log(`Модель-кандидаты: разрешаю…`);
	const model = DRY_RUN ? '(dry-run)' : await resolveModel(process.env.DRAFT_MODEL);

	console.log(`Модель:      ${model}`);
	console.log(`Статей:      ${queue.length} (квота ${QUOTA}, уже запланировано ${scheduled})`);
	console.log(`Расписание:  ${dates[0]} … ${dates[dates.length - 1]}`);
	console.log(`Запас тем:   ${buildQueue().length} шт.\n`);

	const plan = queue.map((topic, i) => ({ topic, dateStr: dates[i] }));
	for (const { topic, dateStr } of plan) {
		console.log(`  ${dateStr}  ${topic.priority} ${topic.category.padEnd(15)} ${topic.slug}`);
	}
	console.log('');

	if (DRY_RUN) {
		console.log('DRY_RUN=1 — на этом всё, к API не обращаюсь.');
		return;
	}

	try {
		const balance = await credits();
		if (balance.left != null) {
			console.log(`Баланс OpenRouter: осталось $${balance.left.toFixed(2)} из $${balance.total.toFixed(2)}\n`);
			if (balance.left <= 0) {
				console.error('Кредиты кончились. Пополнить: https://openrouter.ai/settings/credits');
				process.exit(1);
			}
		}
	} catch (e) {
		console.warn(`Баланс проверить не удалось: ${e.message}\n`);
	}

	const articles = publishedArticles();
	const done = [];
	const failed = [];
	let stopped = null;
	const log = (m) => console.log(`  ${m}`);

	// Небольшой пул воркеров: не упираемся в rate limit и не ждём час на sequential.
	let cursor = 0;
	async function worker() {
		while (cursor < plan.length && !stopped) {
			const { topic, dateStr } = plan[cursor++];
			try {
				const result = await produceArticle({ topic, dateStr, model, articles, log });
				done.push(result);
				console.log(`✓ ${result.slug} — ${result.words} слов, замечаний ${result.warnings}`);
			} catch (e) {
				// Деньги кончились — дальше идти некуда: останавливаем весь прогон,
				// чтобы не гонять оставшиеся темы в заведомо провальные попытки.
				if (e instanceof CreditsError) {
					stopped = e.message;
					console.error(`✗ ${dateStr}-${topic.slug}: ${e.message}`);
					console.error('Останавливаю прогон.');
					return;
				}
				failed.push({ slug: `${dateStr}-${topic.slug}`, reason: e.message });
				console.error(`✗ ${dateStr}-${topic.slug}: ${e.message}`);
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.length) }, worker));

	// Отчёт прогона — чтобы после автономного запуска было что читать.
	const usage = usageTotals();
	const report = `\n## Прогон ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n\n` +
		`Модель: ${model}. Готово: ${done.length}, не вышло: ${failed.length}. ` +
		`Запросов к модели: ${usage.requests}, токенов на выходе: ${usage.completionTokens}. ` +
		`Запас тем в плане: ${buildQueue().length}.` +
		(stopped ? `\n\n**Прогон остановлен:** ${stopped}` : '') + `\n\n` +
		done.map((d) => `- ✓ ${d.slug} — ${d.words} слов`).join('\n') +
		(failed.length ? '\n' + failed.map((f) => `- ✗ ${f.slug} — ${f.reason}`).join('\n') : '') +
		'\n';

	if (!fs.existsSync(REPORT_PATH)) {
		fs.writeFileSync(
			REPORT_PATH,
			`---\ntitle: "Журнал автопилота контента"\ncreatedDate: "${new Date().toISOString().slice(0, 10)}"\ntype: note\nstatus: draft\n---\n\nЖурнал прогонов \`content-autopilot.yml\`. Пишется автоматически.\n`,
		);
	}
	fs.appendFileSync(REPORT_PATH, report);

	console.log(`\nГотово: ${done.length}. Не вышло: ${failed.length}.`);
	console.log(`Запросов к модели: ${usage.requests}, токенов на выходе: ${usage.completionTokens}.`);
	if (stopped) console.error(`Прогон остановлен: ${stopped}`);
	if (done.length === 0) process.exit(1);
}

await main();
