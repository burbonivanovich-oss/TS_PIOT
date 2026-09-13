/**
 * Выпускает очередной черновик: берёт статью с наступившей датой публикации,
 * прогоняет её через шлюз качества и флипает `draft: true → false`.
 * Slug выпущенной статьи уходит в stdout.
 *
 * Используется в GitHub Actions auto-publish.yml.
 * Запуск: node scripts/release-next-draft.mjs
 *
 * Env:
 *   FORCE_DATE=1   — игнорировать pubDate (выпустить самый ранний черновик)
 *   SKIP_GATE=1    — пропустить шлюз качества (только для отладки)
 *
 * Выход 0 + slug в stdout — статья опубликована.
 * Выход 0 + пустой stdout — публиковать нечего.
 *
 * Черновик, не прошедший шлюз, не блокирует очередь: причина пишется в
 * `.claude/blocked/<slug>`, скрипт переходит к следующему кандидату.
 *
 * Контракт autopilotHold (AP-P0-15): статья с `autopilotHold: true` (или с
 * неразбираемым значением поля) не выбирается никогда, даже при SKIP_GATE=1.
 * Отсутствие поля сохраняет прежнее поведение: статья может быть выпущена.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const blogDir = join(ROOT, 'src/content/blog');
const blockedDir = join(ROOT, '.claude/blocked');

/**
 * Разбирает управляющие поля frontmatter. Чистая функция: ничего не пишет.
 * `isHeld` консервативен — поле, значение которого не ровно `false`,
 * считается удержанием. Отсутствие поля — не удержание.
 */
export function parseFlags(content) {
	const fm = (content.match(/^---\r?\n([\s\S]*?)\r?\n---/) ?? [])[1] ?? '';
	const holdMatch = fm.match(/^autopilotHold\s*:\s*(.*)$/m);
	return {
		isDraft: /^draft:\s*true\s*$/m.test(fm),
		isHeld: holdMatch ? holdMatch[1].trim() !== 'false' : false,
		pubDate: (fm.match(/^pubDate:\s*"?(\d{4}-\d{2}-\d{2})/m) ?? [])[1] ?? '9999-12-31',
	};
}

/**
 * Выбирает следующий черновик. Held-статьи исключаются до любых проверок,
 * поэтому публикатор физически не может выпустить отклонённый автопилотом
 * текст.
 */
export function selectCandidate(articles, { today, forceDate = false } = {}) {
	return (
		articles
			.filter((a) => a.isDraft)
			.filter((a) => !a.isHeld)
			.filter((a) => forceDate || a.pubDate <= today)
			.sort((a, b) => a.pubDate.localeCompare(b.pubDate) || a.slug.localeCompare(b.slug))[0] ?? null
	);
}

/** Читает корпус и возвращает статьи с разобранными полями. */
export function readCandidates(dir = blogDir) {
	return readdirSync(dir)
		.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
		.map((file) => {
			const content = readFileSync(join(dir, file), 'utf8');
			return {
				file,
				content,
				slug: basename(file, file.endsWith('.mdx') ? '.mdx' : '.md'),
				...parseFlags(content),
			};
		});
}

function main() {
	const today = new Date().toISOString().slice(0, 10);
	const forceDate = process.env.FORCE_DATE === '1';
	const candidates = readCandidates()
		.filter((a) => a.isDraft && !a.isHeld)
		.filter((a) => forceDate || a.pubDate <= today)
		.sort((a, b) => a.pubDate.localeCompare(b.pubDate) || a.slug.localeCompare(b.slug));

	const held = readCandidates().filter((a) => a.isDraft && a.isHeld);
	if (held.length) {
		process.stderr.write(`Удержано автопилотом (не публикуются): ${held.map((a) => a.slug).join(', ')}\n`);
	}

	if (candidates.length === 0) {
		process.stderr.write(`Нет черновиков с наступившей датой публикации (сегодня ${today}).\n`);
		process.exit(0);
	}

	for (const candidate of candidates) {
		if (process.env.SKIP_GATE !== '1') {
			const gate = spawnSync(
				process.execPath,
				[join(ROOT, 'scripts/content/qa-gate.mjs'), candidate.slug, '--json'],
				{ encoding: 'utf8' },
			);
			let verdict = null;
			try {
				verdict = JSON.parse(gate.stdout);
			} catch {
				/* шлюз не смог отработать — трактуем как отказ */
			}

			if (!verdict?.pass) {
				const reasons = verdict?.blockers ?? [gate.stderr?.trim() || 'шлюз качества не отработал'];
				mkdirSync(blockedDir, { recursive: true });
				writeFileSync(
					join(blockedDir, candidate.slug),
					`${today}\n${reasons.map((r) => `- ${r}`).join('\n')}\n`,
				);
				process.stderr.write(`✗ ${candidate.slug} не прошёл шлюз:\n${reasons.map((r) => `  - ${r}`).join('\n')}\n`);
				continue;
			}
		}

		const updated = candidate.content.replace(/^(draft:\s*)true(\s*)$/m, '$1false$2');
		writeFileSync(join(blogDir, candidate.file), updated, 'utf8');
		process.stdout.write(candidate.slug);
		process.exit(0);
	}

	process.stderr.write('Ни один черновик не прошёл шлюз качества.\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main();
