/**
 * Берёт старейший черновик из src/content/blog/ (draft: true),
 * флипает его в draft: false и выводит slug в stdout.
 *
 * Используется в GitHub Actions auto-publish.yml.
 * Запуск: node scripts/release-next-draft.mjs
 *
 * Выход 0 + slug в stdout — статья опубликована.
 * Выход 0 + пустой stdout — черновиков не осталось.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const blogDir = join(__dirname, '../src/content/blog');

const files = readdirSync(blogDir)
	.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
	.sort(); // сортировка по имени = по дате YYYY-MM-DD-slug

let published = null;

for (const file of files) {
	const path = join(blogDir, file);
	const content = readFileSync(path, 'utf8');

	// Ищем строку "draft: true" в frontmatter
	if (!/^draft:\s*true\s*$/m.test(content)) continue;

	// Флипаем draft: true → draft: false
	const updated = content.replace(/^(draft:\s*)true(\s*)$/m, '$1false$2');
	writeFileSync(path, updated, 'utf8');

	published = basename(file, file.endsWith('.mdx') ? '.mdx' : '.md');
	break;
}

if (published) {
	process.stdout.write(published);
} else {
	process.stderr.write('No draft articles found.\n');
}
