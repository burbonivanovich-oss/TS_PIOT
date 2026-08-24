/**
 * Редполитика в исполняемом виде: единственный источник правды о том, что
 * считается годной статьёй. Используется и генератором черновиков
 * (scripts/content/generate-drafts.mjs), и шлюзом публикации
 * (scripts/content/qa-gate.mjs) — правила не расходятся между ними.
 *
 * Правила взяты из docs/content-rules.md и CLAUDE.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..');

export const CATEGORIES = ['ts-piot', 'markirovka', 'zakonodatelstvo', 'kkt', 'egais'];

export const LIMITS = {
	titleMin: 40,
	titleMax: 95,
	descMin: 110,
	descMax: 175,
	wordsMin: 900,
	wordsMax: 2600,
	tagsMin: 4,
	tagsMax: 7,
	h2Min: 4,
	faqMin: 3,
	internalLinksMin: 3,
	aiScoreMax: 6,
};

/**
 * Слова-паразиты из docs/content-rules.md. Любое вхождение — блокер.
 *
 * Границы слова заданы явными lookaround'ами, а не `\b`: в JS `\b` считает
 * словом только [A-Za-z0-9_], поэтому вокруг кириллицы он не срабатывает.
 */
const wordRe = (source) =>
	new RegExp(`(?<![а-яёА-ЯЁa-zA-Z])(?:${source})(?![а-яёА-ЯЁa-zA-Z])`, 'gi');

export const FORBIDDEN = [
	[wordRe('явля[ею]тся'), 'является/являются'],
	[wordRe('осуществля[ею]тся'), 'осуществляется'],
	[wordRe('осуществля(?:ет|ют)'), 'осуществляет'],
	[wordRe('следует\\s+отметить'), 'следует отметить'],
	[wordRe('необходимо\\s+отметить'), 'необходимо отметить'],
	[wordRe('таким\\s+образом'), 'таким образом'],
	[wordRe('в\\s+данном\\s+контексте'), 'в данном контексте'],
	[wordRe('выглядит\\s+следующим\\s+образом'), 'выглядит следующим образом'],
	[wordRe('с\\s+точки\\s+зрения'), 'с точки зрения'],
	[wordRe('предпринимателям\\s+(?:стоит|необходимо|следует)'), 'предпринимателям стоит/необходимо'],
	[wordRe('в\\s+целях'), 'в целях'],
	[wordRe('каков[аыо]?'), 'каков/каковы'],
	[wordRe('молочка'), 'молочка'],
	[wordRe('насыщенн[ыоа][йем]'), 'насыщенный'],
	[wordRe('подводя\\s+итог'), 'подводя итог'],
	[wordRe('в\\s+заключени[ие]'), 'в заключение'],
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2460}-\u{25FF}\u{2600}-\u{27BF}\u{FE0F}]/u;

// ─── Frontmatter ─────────────────────────────────────────────────────────────

/**
 * Разбор подмножества YAML, которым пользуется проект: плоские ключи,
 * списки скаляров и один уровень вложенности (`seo:`).
 */
export function parseFrontmatter(raw) {
	const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!m) return { fm: null, body: raw };

	const fm = {};
	let currentKey = null;
	let nested = null;
	let nestedKey = null;

	const unquote = (v) => v.trim().replace(/^["'](.*)["']$/s, '$1');

	for (const line of m[1].split('\n')) {
		if (!line.trim() || line.trim().startsWith('#')) continue;

		const listItem = line.match(/^(\s+)-\s+(.*)$/);
		if (listItem) {
			const target = listItem[1].length >= 4 && nested ? nested[nestedKey] : fm[currentKey];
			if (Array.isArray(target)) target.push(unquote(listItem[2]));
			continue;
		}

		const nestedPair = line.match(/^\s{2,}([\w-]+):\s*(.*)$/);
		if (nestedPair && nested) {
			nestedKey = nestedPair[1];
			nested[nestedKey] = nestedPair[2] === '' ? [] : unquote(nestedPair[2]);
			continue;
		}

		const pair = line.match(/^([\w-]+):\s*(.*)$/);
		if (!pair) continue;

		const [, key, rawValue] = pair;
		currentKey = key;
		nested = null;
		nestedKey = null;

		if (rawValue === '') {
			// Либо список на следующих строках, либо вложенный объект.
			fm[key] = [];
			nested = fm;
			nestedKey = key;
			if (key === 'seo') {
				fm[key] = {};
				nested = fm[key];
				nestedKey = null;
			}
			continue;
		}

		if (rawValue === 'true' || rawValue === 'false') fm[key] = rawValue === 'true';
		else fm[key] = unquote(rawValue);
	}

	return { fm, body: m[2] };
}

// ─── Вспомогательное ─────────────────────────────────────────────────────────

/** Тело без frontmatter, import'ов MDX, кода и JSX-компонентов. */
function proseOf(body) {
	return body
		.replace(/^import\s+.*$/gm, '')
		.replace(/```[\s\S]*?```/g, '')
		.replace(/<[^>]+>/g, ' ');
}

export function wordCount(body) {
	return proseOf(body).split(/\s+/).filter((w) => /[а-яёa-z0-9]/i.test(w)).length;
}

export const AUTO_NPA_PATH = path.join(ROOT, 'src/data/factcheck/auto-verified-npa.json');

/**
 * Известные НПА: ручной whitelist из sources.json плюс номера, подтверждённые
 * онлайн-фактчеком автопилота (auto-verified-npa.json). Второй файл наполняется
 * автоматически и хранит ссылку на источник по каждому номеру.
 */
export function loadNpaWhitelist() {
	const sources = JSON.parse(
		fs.readFileSync(path.join(ROOT, 'src/data/factcheck/sources.json'), 'utf8'),
	);
	let auto = { fz: {}, pp: {}, prikaz: {} };
	if (fs.existsSync(AUTO_NPA_PATH)) {
		try {
			auto = { ...auto, ...JSON.parse(fs.readFileSync(AUTO_NPA_PATH, 'utf8')) };
		} catch {
			/* повреждённый файл не должен ронять валидацию */
		}
	}
	return {
		fz: new Set([...Object.keys(sources.npaWhitelist.fz), ...Object.keys(auto.fz ?? {})]),
		pp: new Set([...Object.keys(sources.npaWhitelist.pp), ...Object.keys(auto.pp ?? {})]),
		prikaz: new Set([...Object.keys(sources.npaWhitelist.prikaz), ...Object.keys(auto.prikaz ?? {})]),
	};
}

export function loadCpaIds() {
	const src = fs.readFileSync(path.join(ROOT, 'src/data/cpa-banners.ts'), 'utf8');
	return new Set([...src.matchAll(/^\t*id:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1]));
}

/** Имена Astro/React-компонентов, которые разрешено использовать в MDX. */
export function componentNames() {
	const dirs = [
		path.join(ROOT, 'src/components'),
		path.join(ROOT, 'src/components/interactive'),
	];
	const names = new Set();
	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir)) {
			const m = f.match(/^([A-Z][\w-]*)\.(astro|tsx|jsx)$/);
			if (m) names.add(m[1]);
		}
	}
	return names;
}

/** Карта slug → путь файла для проверки внутренних ссылок. */
export function blogIndex(blogDir = path.join(ROOT, 'src/content/blog')) {
	const index = new Map();
	for (const f of fs.readdirSync(blogDir).filter((f) => /\.(md|mdx)$/.test(f))) {
		index.set(f.replace(/\.(md|mdx)$/, ''), path.join(blogDir, f));
	}
	return index;
}

// Регулярки НПА — синхронизированы с scripts/factcheck/audit-npa-references.mjs
const FZ_RE = /(?<!\d)(\d{1,4})[-‑]ФЗ/g;
const PP_RE = /(?:[Пп]остановлен[а-я]+\s+[Пп]равительства(?:\s+РФ)?|ПП(?:\s+РФ)?)\s*(?:от\s+\d{1,2}[.\/]\d{1,2}[.\/]\d{4}\s+)?№\s*(\d{1,4})/giu;
const PRIKAZ_RE = /[Пп]риказ[а-я]*\s+(?:Минфина|ФНС|Минпромторга|Роспотребнадзора|Минцифры|Минтруда|ЦБ\s+РФ|Минсельхоза)[а-я\s]*(?:№|N)\s*([\w\-\/]+)/giu;

// ─── Валидация ───────────────────────────────────────────────────────────────

/**
 * Проверяет статью по редполитике.
 *
 * @param {object}  opts
 * @param {string}  opts.raw     — содержимое файла целиком
 * @param {string}  opts.slug    — YYYY-MM-DD-slug
 * @param {object=} opts.topic   — строка контент-плана (keyword, cpa, category)
 * @returns {{errors: string[], warnings: string[], stats: object}}
 */
export function validateArticle({ raw, slug, topic = null }) {
	const errors = [];
	const warnings = [];
	const { fm, body } = parseFrontmatter(raw);

	if (!fm) return { errors: ['frontmatter не распарсился'], warnings, stats: {} };

	const prose = proseOf(body);
	const words = wordCount(body);
	const h2 = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
	const h3 = [...body.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1].trim());

	// — Frontmatter —
	const need = ['title', 'description', 'pubDate', 'tags', 'categories'];
	for (const key of need) if (fm[key] === undefined) errors.push(`нет поля ${key}`);

	const title = String(fm.title ?? '');
	if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax)
		errors.push(`title ${title.length} символов, нужно ${LIMITS.titleMin}–${LIMITS.titleMax}`);

	const desc = String(fm.description ?? '');
	if (desc.length < LIMITS.descMin || desc.length > LIMITS.descMax)
		errors.push(`description ${desc.length} символов, нужно ${LIMITS.descMin}–${LIMITS.descMax}`);
	else if (desc.length < 140 || desc.length > 160)
		warnings.push(`description ${desc.length} символов, идеал 140–160`);

	const category = Array.isArray(fm.categories) ? fm.categories[0] : fm.categories;
	if (!CATEGORIES.includes(category)) errors.push(`категория «${category}» не из ${CATEGORIES.join(', ')}`);
	if (topic?.category && category !== topic.category)
		warnings.push(`категория ${category} не совпадает с планом (${topic.category})`);

	const tags = Array.isArray(fm.tags) ? fm.tags : [];
	if (tags.length < LIMITS.tagsMin || tags.length > LIMITS.tagsMax)
		errors.push(`тегов ${tags.length}, нужно ${LIMITS.tagsMin}–${LIMITS.tagsMax}`);
	if (tags.some((t) => t !== t.toLowerCase())) errors.push('теги должны быть в нижнем регистре');

	const keywords = Array.isArray(fm.seo?.keywords) ? fm.seo.keywords : [];
	if (keywords.length === 0) errors.push('нет seo.keywords');

	if (fm.pubDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(fm.pubDate)))
		errors.push(`pubDate «${fm.pubDate}» не в формате YYYY-MM-DD`);
	if (fm.reviewDate === undefined) warnings.push('нет reviewDate');

	// — Объём и структура —
	if (words < LIMITS.wordsMin) errors.push(`${words} слов, минимум ${LIMITS.wordsMin}`);
	else if (words > LIMITS.wordsMax) warnings.push(`${words} слов, потолок ${LIMITS.wordsMax}`);

	if (h2.length < LIMITS.h2Min) errors.push(`${h2.length} H2-секций, минимум ${LIMITS.h2Min}`);
	const faqIndex = h2.findIndex((h) => /^(?:FAQ|частые\s+вопросы|часто\s+задаваемые\s+вопросы)/i.test(h));
	if (faqIndex === -1) errors.push('нет секции «## Частые вопросы» (или «## FAQ»)');
	else if (h3.length < LIMITS.faqMin) errors.push(`в FAQ ${h3.length} вопросов, минимум ${LIMITS.faqMin}`);

	// Заголовки до FAQ должны называть тему. Формы «Каков…», «Что такое…» —
	// блокер по редполитике, прочие вопросительные H2 — замечание.
	const bodyH2 = faqIndex === -1 ? h2 : h2.slice(0, faqIndex);
	for (const heading of bodyH2) {
		if (/^(?:как[оа]в|что\s+так[оа]е)/i.test(heading))
			errors.push(`H2 «${heading}» в форме «Каков/Что такое» — запрещено редполитикой`);
		else if (heading.endsWith('?')) warnings.push(`H2 «${heading}» — вопрос, лучше назвать тему`);
	}

	if (/^---\s*$/m.test(body.replace(/^---\n[\s\S]*?\n---/, ''))) warnings.push('горизонтальные разделители в теле');

	// — Внутренние ссылки —
	const index = blogIndex();
	const links = [...body.matchAll(/\]\((\/(?:blog|category|slovar|instrumenty)\/[^)\s]*)\)/g)].map((m) => m[1]);
	const blogLinks = links.filter((l) => l.startsWith('/blog/'));
	if (links.length < LIMITS.internalLinksMin)
		errors.push(`${links.length} внутренних ссылок, минимум ${LIMITS.internalLinksMin}`);

	for (const link of blogLinks) {
		const target = link.replace(/^\/blog\//, '').replace(/\/$/, '');
		if (!index.has(target)) errors.push(`ссылка на несуществующую статью: ${link}`);
	}
	for (const link of links.filter((l) => l.startsWith('/category/'))) {
		const cat = link.replace(/^\/category\//, '').replace(/\/$/, '');
		if (!CATEGORIES.includes(cat)) errors.push(`ссылка на несуществующую категорию: ${link}`);
	}

	// — Стиль —
	for (const [re, label] of FORBIDDEN) {
		const hits = prose.match(re);
		if (hits) errors.push(`слово-паразит «${label}» (${hits.length}×)`);
	}
	if (EMOJI.test(prose)) errors.push('эмодзи в тексте');
	const bangs = (prose.match(/!(?!=)/g) ?? []).length;
	if (bangs > 0) errors.push(`восклицательных знаков: ${bangs}`);

	// — НПА. Номера вне whitelist сами по себе не блокер: их досматривает
	//   онлайн-фактчек (scripts/content/factcheck-draft.mjs) и либо подтверждает
	//   источником, либо возвращает статью на переписывание.
	const npa = loadNpaWhitelist();
	const npaUnknown = [];
	for (const [re, kind, set] of [
		[FZ_RE, 'фз', npa.fz],
		[PP_RE, 'пп', npa.pp],
		[PRIKAZ_RE, 'прикаэ', npa.prikaz],
	]) {
		re.lastIndex = 0;
		for (const m of body.matchAll(re)) {
			if (set.has(m[1])) continue;
			const kindKey = kind === 'прикаэ' ? 'prikaz' : kind === 'пп' ? 'pp' : 'fz';
			const label = { fz: 'ФЗ', pp: 'ПП', prikaz: 'Приказ' }[kindKey];
			if (!npaUnknown.some((u) => u.kind === kindKey && u.number === m[1]))
				npaUnknown.push({ kind: kindKey, number: m[1], label: `${label} № ${m[1]}` });
		}
	}
	for (const u of npaUnknown) warnings.push(`${u.label} не подтверждён whitelist — нужен онлайн-фактчек`);

	// — Синтаксис MDX. Самые частые причины падения сборки: фигурная скобка
	//   в тексте (MDX читает её как выражение) и незакрытый JSX-тег.
	const mdxProse = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
	const braces = mdxProse.match(/[{}]/g);
	if (braces) errors.push(`фигурные скобки в тексте MDX (${braces.length}) — сборка упадёт`);

	const openDivs = (mdxProse.match(/<div\b/g) ?? []).length;
	const closeDivs = (mdxProse.match(/<\/div>/g) ?? []).length;
	if (openDivs !== closeDivs) errors.push(`незакрытые <div>: открыто ${openDivs}, закрыто ${closeDivs}`);

	const usedTags = [...mdxProse.matchAll(/<\/?([A-Za-z][\w-]*)/g)].map((m) => m[1]);
	const allowedTags = new Set([
		'div', 'br', 'strong', 'em', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
		...componentNames(),
	]);
	for (const tag of new Set(usedTags)) {
		if (!allowedTags.has(tag)) errors.push(`тег <${tag}> вне белого списка MDX`);
	}

	// — CPA-врезка —
	const callouts = [...body.matchAll(/<CpaCallout\s+id=["']([a-z0-9-]+)["']/g)].map((m) => m[1]);
	const cpaIds = loadCpaIds();
	if (callouts.length !== 1) errors.push(`<CpaCallout> встречается ${callouts.length} раз, нужен ровно 1`);
	for (const id of callouts) if (!cpaIds.has(id)) errors.push(`неизвестный CPA id: ${id}`);
	if (callouts.length && !/^import\s+CpaCallout\s+from/m.test(body))
		errors.push('нет import CpaCallout в шапке MDX');
	if (fm.cpa && !cpaIds.has(String(fm.cpa))) errors.push(`неизвестный cpa во frontmatter: ${fm.cpa}`);

	// — SEO —
	const key = (topic?.keyword ?? keywords[0] ?? '').toLowerCase();
	if (key) {
		const keyWords = key.split(/\s+/).filter((w) => w.length > 3);
		const inText = (haystack) =>
			keyWords.length > 0 && keyWords.every((w) => haystack.toLowerCase().includes(w.slice(0, -1)));
		const lead = prose.trim().split('\n\n')[0] ?? '';
		if (!inText(title)) warnings.push(`целевой ключ «${key}» не считывается в title`);
		if (!inText(lead)) warnings.push(`целевой ключ «${key}» не считывается в лиде`);
		if (!h2.some((h) => inText(h))) warnings.push(`целевой ключ «${key}» не считывается ни в одном H2`);
	}

	// — Технические инварианты —
	if (fm.draft !== true && fm.draft !== false) errors.push('нет поля draft');
	if (slug && fm.title && index.has(slug) === false && !/^\d{4}-\d{2}-\d{2}-/.test(slug))
		errors.push(`slug «${slug}» без префикса даты`);

	return {
		errors,
		warnings,
		npaUnknown,
		stats: {
			words,
			h2: h2.length,
			faq: h3.length,
			links: links.length,
			title: title.length,
			desc: desc.length,
			npaUnknown: npaUnknown.length,
		},
	};
}
