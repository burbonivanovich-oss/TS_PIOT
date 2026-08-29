/**
 * Парсер контент-плана: `src/content/wiki/content-plan-2026.md` → очередь тем.
 *
 * Источник истины по статусу — не колонка Status в плане (она устаревает),
 * а наличие файла `src/content/blog/YYYY-MM-DD-<slug>.md(x)`. Тема считается
 * незакрытой, если файла с таким slug нет ни среди опубликованных, ни среди
 * черновиков.
 *
 * Экспортирует:
 *   parsePlan()      — все строки кластерных таблиц
 *   existingSlugs()  — slug'и статей в блоге (без префикса даты)
 *   buildQueue(opts) — приоритизированная очередь незакрытых тем
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..');

const PLAN_PATH = path.join(ROOT, 'src/content/wiki/content-plan-2026.md');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');

/** Категория по умолчанию для каждого кластера плана. */
const CLUSTER_CATEGORY = {
	1: 'ts-piot',
	2: 'markirovka',
	3: 'markirovka',
	4: 'zakonodatelstvo',
	5: 'kkt',
	6: 'egais',
	7: 'kkt',
	8: 'egais',
	9: 'zakonodatelstvo',
	10: 'zakonodatelstvo',
	11: 'kkt',
	12: 'zakonodatelstvo',
	13: 'zakonodatelstvo',
	14: 'zakonodatelstvo',
	15: 'zakonodatelstvo',
	16: 'zakonodatelstvo',
	17: 'zakonodatelstvo',
};

/** Уточнение категории по slug'у — важнее дефолта кластера. Порядок значим. */
const SLUG_CATEGORY_RULES = [
	[['ts-piot'], 'ts-piot'],
	[['markirovka', 'chestny-znak', 'data-matrix', 'gis-mt', 'poexzemplyarnyj', 'obyemno-sortovoy', 'vyvod-iz-oborota', 'razreshitelnyj-rezhim'], 'markirovka'],
	[['egais', 'merkuriy', 'alkogol', 'vsd', 'aktsizn', 'kokteyli', 'vetdokumenty'], 'egais'],
	[['kassa', 'kkt', 'ofd', 'ffd', 'mspos', 'atol', 'fiskal', 'chek', '-fn-', 'fn-dlya'], 'kkt'],
];

function categoryFor(slug, cluster) {
	for (const [keys, category] of SLUG_CATEGORY_RULES) {
		if (keys.some((k) => slug.includes(k))) return category;
	}
	return CLUSTER_CATEGORY[cluster] ?? 'zakonodatelstvo';
}

/** Все строки кластерных таблиц контент-плана. */
export function parsePlan(planPath = PLAN_PATH) {
	const md = fs.readFileSync(planPath, 'utf8');
	const rows = [];
	let cluster = 0;

	for (const line of md.split('\n')) {
		const heading = line.match(/^###\s+Кластер\s+(\d+)\./);
		if (heading) {
			cluster = Number(heading[1]);
			continue;
		}
		if (!line.startsWith('|')) continue;

		const cells = line
			.split('|')
			.slice(1, -1)
			.map((c) => c.trim());
		if (cells.length < 7) continue;

		const [slug, title, priority, cpa, keyword, status, blocker] = cells;
		// Отсекаем шапку и разделитель таблицы.
		if (!/^[a-z0-9][a-z0-9-]+$/.test(slug)) continue;

		rows.push({
			slug,
			title,
			priority: /^P[012]$/.test(priority) ? priority : 'P2',
			cpa: cpa === '—' ? null : cpa,
			keyword,
			planStatus: status,
			blocker: blocker === '—' ? null : blocker,
			cluster,
			category: categoryFor(slug, cluster),
		});
	}

	return rows;
}

/** Slug'и всех статей блога без префикса даты (и опубликованных, и черновиков). */
export function existingSlugs(blogDir = BLOG_DIR) {
	return new Set(
		fs
			.readdirSync(blogDir)
			.filter((f) => /\.(md|mdx)$/.test(f))
			.map((f) => f.replace(/\.(md|mdx)$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')),
	);
}

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 };

/**
 * Очередь незакрытых тем.
 *
 * Сортировка: сначала приоритет (P0 → P1 → P2), внутри приоритета — round-robin
 * по категориям, чтобы месяц публикаций не состоял из одной маркировки подряд.
 *
 * opts.count — сколько тем вернуть (0 = все).
 */
export function buildQueue({ count = 0, planPath, blogDir } = {}) {
	const done = existingSlugs(blogDir);
	const pending = parsePlan(planPath).filter((r) => !done.has(r.slug));

	// Группируем по приоритету, внутри — по категориям, затем разворачиваем
	// round-robin'ом: ts-piot → markirovka → kkt → egais → zakonodatelstvo → ...
	const queue = [];
	for (const priority of ['P0', 'P1', 'P2']) {
		const byCategory = new Map();
		for (const row of pending.filter((r) => r.priority === priority)) {
			if (!byCategory.has(row.category)) byCategory.set(row.category, []);
			byCategory.get(row.category).push(row);
		}
		const buckets = [...byCategory.values()];
		let taken = true;
		while (taken) {
			taken = false;
			for (const bucket of buckets) {
				const next = bucket.shift();
				if (next) {
					queue.push(next);
					taken = true;
				}
			}
		}
	}

	queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
	return count > 0 ? queue.slice(0, count) : queue;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2);
	const count = Number((args.find((a) => a.startsWith('--count=')) ?? '').split('=')[1] ?? 0);
	const queue = buildQueue({ count });

	if (args.includes('--json')) {
		console.log(JSON.stringify(queue, null, 2));
	} else {
		const total = buildQueue().length;
		console.log(`Незакрытых тем в контент-плане: ${total}`);
		console.log(`Запас при 22 статьях в месяц: ${(total / 22).toFixed(1)} мес.\n`);
		for (const [i, t] of queue.entries()) {
			console.log(
				`${String(i + 1).padStart(3)}. ${t.priority} ${t.category.padEnd(15)} ${t.slug}`,
			);
		}
	}
}
