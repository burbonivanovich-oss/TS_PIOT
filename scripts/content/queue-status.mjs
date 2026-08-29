#!/usr/bin/env node
/**
 * Состояние конвейера контента: сколько черновиков ждёт выпуска, на сколько
 * дней хватит запаса, сколько тем осталось в контент-плане.
 *
 *   node scripts/content/queue-status.mjs          # человекочитаемо
 *   node scripts/content/queue-status.mjs --json   # для workflow и health-check
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, buildQueue } from './lib/content-plan.mjs';

const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const BLOCKED_DIR = path.join(ROOT, '.claude/blocked');

const today = new Date().toISOString().slice(0, 10);

const drafts = fs
	.readdirSync(BLOG_DIR)
	.filter((f) => /\.(md|mdx)$/.test(f))
	.map((f) => {
		const fm = (fs.readFileSync(path.join(BLOG_DIR, f), 'utf8').match(/^---\n([\s\S]*?)\n---/) ?? [])[1] ?? '';
		return {
			slug: f.replace(/\.(md|mdx)$/, ''),
			isDraft: /^draft:\s*true\s*$/m.test(fm),
			pubDate: (fm.match(/^pubDate:\s*"?(\d{4}-\d{2}-\d{2})/m) ?? [])[1] ?? null,
		};
	})
	.filter((a) => a.isDraft)
	.sort((a, b) => String(a.pubDate).localeCompare(String(b.pubDate)));

const blocked = fs.existsSync(BLOCKED_DIR)
	? fs.readdirSync(BLOCKED_DIR).filter((f) => drafts.some((d) => d.slug === f))
	: [];

const ready = drafts.filter((d) => d.pubDate && d.pubDate <= today);
const scheduled = drafts.filter((d) => d.pubDate && d.pubDate > today);
const last = drafts[drafts.length - 1]?.pubDate ?? null;

const status = {
	today,
	drafts: drafts.length,
	readyToday: ready.length,
	scheduled: scheduled.length,
	blocked: blocked.length,
	coverUntil: last,
	runwayDays: last ? Math.round((new Date(last) - new Date(today)) / 86_400_000) : 0,
	planPending: buildQueue().length,
	nextUp: drafts.slice(0, 5).map((d) => `${d.pubDate} ${d.slug}`),
	blockedSlugs: blocked,
};

if (process.argv.includes('--json')) {
	console.log(JSON.stringify(status, null, 2));
} else {
	console.log(`Черновиков в очереди:   ${status.drafts} (заблокировано шлюзом: ${status.blocked})`);
	console.log(`Готовы к выпуску:       ${status.readyToday}`);
	console.log(`Запас публикаций:       до ${status.coverUntil ?? '—'} (${status.runwayDays} дн.)`);
	console.log(`Тем в контент-плане:    ${status.planPending}`);
	if (status.nextUp.length) {
		console.log('\nБлижайшие:');
		for (const line of status.nextUp) console.log(`  ${line}`);
	}
	if (blocked.length) {
		console.log('\nЗаблокированы шлюзом:');
		for (const slug of blocked) console.log(`  ${slug} — .claude/blocked/${slug}`);
	}
}
