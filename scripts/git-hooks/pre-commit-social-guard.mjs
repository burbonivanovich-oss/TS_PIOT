#!/usr/bin/env node
// pre-commit гейт: проверяет, что для каждой публикуемой статьи
// (которую переключают draft: true → false в этом коммите) есть
// соцпосты в src/content/wiki/social/ или src/content/social/.
//
// Без соцпостов коммит блокируется. Это закрывает пробел, когда
// статья выходила в прод без черновиков для Telegram/VK/Дзен.
//
// Bypass: SKIP_SOCIAL_GUARD=1 git commit -m '...'
// (для исключительных случаев типа срочной правки опечатки)

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.SKIP_SOCIAL_GUARD === '1') {
	console.log('[social-guard] SKIP_SOCIAL_GUARD=1 — пропускаю.');
	process.exit(0);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function staged() {
	return execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: ROOT })
		.toString().split('\n').filter(Boolean);
}

function stagedContent(file) {
	try { return execSync(`git show :${file}`, { cwd: ROOT }).toString(); }
	catch { return ''; }
}

const blogFiles = staged().filter(
	(f) => f.startsWith('src/content/blog/') && /\.(md|mdx)$/.test(f),
);

if (blogFiles.length === 0) process.exit(0);

const missing = [];
for (const file of blogFiles) {
	const content = stagedContent(file);
	// Только статьи с draft: false (или без draft вообще) — публикуются
	const isDraftTrue = /^draft:\s*true\s*$/m.test(content);
	if (isDraftTrue) continue;

	const slug = file.replace(/^src\/content\/blog\//, '').replace(/\.(md|mdx)$/, '');
	const wikiPath = join(ROOT, 'src', 'content', 'wiki', 'social', `${slug}.md`);
	const wikiMdxPath = join(ROOT, 'src', 'content', 'wiki', 'social', `${slug}.mdx`);
	const contentPath = join(ROOT, 'src', 'content', 'social', `${slug}-social.md`);
	const contentMdxPath = join(ROOT, 'src', 'content', 'social', `${slug}-social.mdx`);

	if (!existsSync(wikiPath) && !existsSync(wikiMdxPath) &&
	    !existsSync(contentPath) && !existsSync(contentMdxPath)) {
		missing.push(slug);
	}
}

if (missing.length === 0) process.exit(0);

console.error('\n❌ social-guard: коммит заблокирован.\n');
console.error('Следующие статьи публикуются (draft: false), но соцпостов нет:');
for (const s of missing) console.error(`  - ${s}`);
console.error('\nЧто сделать:');
console.error('  1. Запустить /release-article <slug> — он позовёт social-media-manager');
console.error('     и создаст src/content/wiki/social/<slug>.md');
console.error('  2. Или создать соцпосты вручную в одной из двух коллекций:');
console.error('     - src/content/wiki/social/<slug>.md');
console.error('     - src/content/social/<slug>-social.md');
console.error('  3. Затем git add и повторный коммит.\n');
console.error('Bypass (срочные правки): SKIP_SOCIAL_GUARD=1 git commit ...\n');
process.exit(1);
