#!/usr/bin/env node
/**
 * Экспорт секций «Дзен» из социальных черновиков.
 *
 * Использование:
 *   node scripts/export-dzen.mjs              # все файлы
 *   node scripts/export-dzen.mjs ts-piot      # фильтр по slug
 *   node scripts/export-dzen.mjs --list       # список всех черновиков
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = [
  join(ROOT, 'src/content/social'),
  join(ROOT, 'src/content/wiki/social'),
];

const filter = process.argv[2];
const listOnly = filter === '--list';

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) fm[key.trim()] = rest.join(':').trim().replace(/^"|"$/g, '');
  }
  return fm;
}

function extractDzen(content) {
  // Убираем frontmatter
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Ищем секцию Дзен
  const dzenMatch = body.match(/## Дзен\n([\s\S]*?)(?=\n## |\n---\s*$|$)/);
  if (!dzenMatch) return null;

  const raw = dzenMatch[1].trim();

  // Вытаскиваем заголовок если есть строка «**Заголовок Дзен:**»
  const titleMatch = raw.match(/^\*\*Заголовок Дзен:\*\*\s*(.+)/);
  let title = null;
  let body_text = raw;

  if (titleMatch) {
    title = titleMatch[1].trim();
    body_text = raw.slice(titleMatch[0].length).trim();
  }

  return { title, body: body_text };
}

function collectFiles() {
  const files = [];
  for (const dir of DIRS) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith('.md')) continue;
      files.push({ path: join(dir, name), slug: basename(name, '.md') });
    }
  }
  // Сортировка по дате (slug начинается с YYYY-MM-DD)
  files.sort((a, b) => a.slug.localeCompare(b.slug));
  return files;
}

const files = collectFiles();

if (listOnly) {
  console.log(`Найдено черновиков: ${files.length}\n`);
  for (const { slug, path } of files) {
    const content = readFileSync(path, 'utf8');
    const fm = parseFrontmatter(content);
    const status = fm.status ?? '—';
    const hasDzen = content.includes('## Дзен') ? '✓' : '✗';
    const title = fm.title ?? slug;
    console.log(`[${status.padEnd(5)}] Дзен:${hasDzen}  ${slug}`);
    if (fm.title) console.log(`         ${title}`);
  }
  process.exit(0);
}

const matched = files.filter(f =>
  !filter || f.slug.includes(filter)
);

if (matched.length === 0) {
  console.error(`Файлы с «${filter}» не найдены.`);
  process.exit(1);
}

for (const { path, slug } of matched) {
  const content = readFileSync(path, 'utf8');
  const fm = parseFrontmatter(content);
  const dzen = extractDzen(content);

  if (!dzen) {
    console.log(`⚠  ${slug}: секция Дзен не найдена\n`);
    continue;
  }

  const articleUrl = fm.articleUrl ?? '';
  const sep = '═'.repeat(72);

  console.log(sep);
  console.log(`SLUG:    ${slug}`);
  console.log(`СТАТУС:  ${fm.status ?? '—'}`);
  if (articleUrl) console.log(`URL:     этикетка.рф${articleUrl}`);
  console.log('');

  if (dzen.title) {
    console.log('── ЗАГОЛОВОК ──────────────────────────────────────────────────────');
    console.log(dzen.title);
    console.log('');
  }

  console.log('── ТЕКСТ ──────────────────────────────────────────────────────────');
  console.log(dzen.body);
  console.log('');
}

if (matched.length > 1) {
  console.log(`${'═'.repeat(72)}`);
  console.log(`Итого: ${matched.length} статей`);
}
