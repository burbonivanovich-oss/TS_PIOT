#!/usr/bin/env node
// Собирает очередь тем для автопилота из content-plan-2026.md.
// Для каждой «planned» темы (нет файла в blog/) вычисляет приоритет и
// проверяет риск каннибализации по seo.keywords опубликованных статей.
// Существующие статусы done/in_progress/failed из queue.json сохраняются.
//
// Запуск: node scripts/autopilot/build-queue.mjs
// Вывод:  src/data/autopilot/queue.json

import {
  readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOG_DIR = join(ROOT, 'src', 'content', 'blog');
const PLAN_FILE = join(ROOT, 'src', 'content', 'wiki', 'content-plan-2026.md');
const QUEUE_FILE = join(ROOT, 'src', 'data', 'autopilot', 'queue.json');

// Кластер → категория сайта
function clusterToCategory(name) {
  if (/ТС ПИоТ/i.test(name)) return 'ts-piot';
  if (/Маркировка|Честный знак/i.test(name)) return 'markirovka';
  if (/ЕГАИС/i.test(name)) return 'egais';
  if (/Меркурий/i.test(name)) return 'egais';
  if (/ОФД|ФН|ФФД/i.test(name)) return 'kkt';
  if (/ККТ|касс/i.test(name)) return 'kkt';
  if (/HoReCa/i.test(name)) return 'kkt';
  return 'zakonodatelstvo';
}

// Парсит строки таблиц из content-plan-2026.md
function parsePlan(content) {
  const items = [];
  let cluster = '';
  let category = 'zakonodatelstvo';

  for (const line of content.split('\n')) {
    const clusterMatch = line.match(/^### Кластер \d+\.\s+(.+)/);
    if (clusterMatch) {
      cluster = clusterMatch[1].trim();
      category = clusterToCategory(cluster);
      continue;
    }
    // Пропускаем строки-сепараторы и заголовки таблиц
    if (!line.startsWith('|') || /^\|[-\s|]+\|$/.test(line) || line.includes('Slug')) continue;

    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 7) continue;

    const [slug, title, priority, cpa, targetQuery, status, blocker] = cols;
    if (!slug || slug.startsWith('---')) continue;

    items.push({
      slug,
      title,
      priority,
      cpa,
      targetQuery,
      planStatus: status,
      blocker: blocker === '—' ? null : blocker,
      cluster,
      category,
    });
  }
  return items;
}

// Извлекает seo.keywords из frontmatter статьи
function extractKeywords(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const kwMatch = fmMatch[1].match(/keywords:\s*\n((?:[ \t]+-[ \t]+.+\n?)*)/);
  if (!kwMatch) return [];
  return kwMatch[1]
    .split('\n')
    .filter(l => /^\s+-\s/.test(l))
    .map(l => l.replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, '').toLowerCase().trim())
    .filter(Boolean);
}

// Стоп-слова для токенизации (русский)
const STOP = new Set([
  'для', 'с', 'в', 'и', 'или', 'на', 'по', 'что', 'как', 'кому', 'какой',
  'когда', 'чем', 'при', 'за', 'от', 'об', 'а', 'о', 'не', 'до', 'под',
  'над', 'это', 'его', 'её', 'их', 'нет', 'ни', 'же', 'так', 'к', 'у', 'из',
  'без', 'между', 'через', 'после', 'перед', 'во', 'со', 'ли', 'бы', 'чтобы',
  'если', 'то', 'кто', 'кем', 'нужен', 'нужна', 'нужны', 'нужно',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP.has(t));
}

// Проверка каннибализации: целевой запрос vs ключевые фразы опубликованных статей
function checkCannibalization(targetQuery, publishedKwSets) {
  const tTokens = tokenize(targetQuery);
  if (!tTokens.length) return { risk: 'LOW', overlapPct: 0 };

  let maxRatio = 0;
  for (const kwTokens of publishedKwSets) {
    if (!kwTokens.length) continue;
    const kwSet = new Set(kwTokens);
    const overlap = tTokens.filter(t => kwSet.has(t)).length;
    const ratio = overlap / tTokens.length;
    if (ratio > maxRatio) maxRatio = ratio;
  }

  return {
    risk: maxRatio > 0.5 ? 'HIGH' : 'LOW',
    overlapPct: Math.round(maxRatio * 100),
  };
}

// Балл темы: P0=100, P1=60, P2=20; без блокера +20
function scoreItem(item) {
  const base = { P0: 100, P1: 60, P2: 20 }[item.priority] ?? 0;
  return base + (item.blocker ? 0 : 20);
}

async function main() {
  if (!existsSync(PLAN_FILE)) throw new Error(`${PLAN_FILE} не найден`);

  // Все темы из контент-плана
  const planItems = parsePlan(readFileSync(PLAN_FILE, 'utf8'));

  // Опубликованные slugs (убираем дату-префикс из имени файла)
  const blogFiles = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  const publishedSlugs = new Set(
    blogFiles.map(f => f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '')),
  );

  // Ключевые токены опубликованных статей для проверки каннибализации
  const publishedKwSets = blogFiles.flatMap(f => {
    const content = readFileSync(join(BLOG_DIR, f), 'utf8');
    return extractKeywords(content).map(kw => tokenize(kw));
  });

  // Загружаем существующую очередь
  let existing = { items: [] };
  if (existsSync(QUEUE_FILE)) {
    try { existing = JSON.parse(readFileSync(QUEUE_FILE, 'utf8')); } catch { /* ignore */ }
  }
  const existingBySlug = Object.fromEntries(existing.items.map(i => [i.slug, i]));

  // Строим новую очередь
  const newItems = [];
  for (const item of planItems) {
    // Уже опубликована — пропускаем
    if (publishedSlugs.has(item.slug)) continue;

    const ex = existingBySlug[item.slug];

    // Сохраняем терминальный статус done (на случай если файл был удалён)
    if (ex?.status === 'done') {
      newItems.push(ex);
      continue;
    }
    // in_progress переживает rebuild
    if (ex?.status === 'in_progress') {
      newItems.push(ex);
      continue;
    }

    const { risk, overlapPct } = checkCannibalization(item.targetQuery, publishedKwSets);
    const itemScore = scoreItem(item);

    newItems.push({
      slug: item.slug,
      title: item.title,
      targetQuery: item.targetQuery,
      cluster: item.cluster,
      category: item.category,
      cpa: item.cpa,
      priority: item.priority,
      score: itemScore,
      cannibalizationRisk: risk,
      overlapPct,
      // failed → retry (сброс в pending)
      status: (ex?.status === 'failed') ? 'pending' : (ex?.status ?? 'pending'),
      addedAt: ex?.addedAt ?? new Date().toISOString(),
      startedAt: ex?.startedAt ?? null,
      completedAt: ex?.completedAt ?? null,
      lastError: ex?.status === 'failed' ? ex.lastError : null,
    });
  }

  // Сортировка: сначала по score desc, затем алфавитно
  newItems.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

  const stats = {
    total: newItems.length,
    pending: newItems.filter(i => i.status === 'pending').length,
    in_progress: newItems.filter(i => i.status === 'in_progress').length,
    done: newItems.filter(i => i.status === 'done').length,
    failed: newItems.filter(i => i.status === 'failed').length,
    highRisk: newItems.filter(i => i.cannibalizationRisk === 'HIGH').length,
  };

  const queueDir = dirname(QUEUE_FILE);
  if (!existsSync(queueDir)) mkdirSync(queueDir, { recursive: true });

  writeFileSync(
    QUEUE_FILE,
    JSON.stringify({ schemaVersion: '1.0', updatedAt: new Date().toISOString(), stats, items: newItems }, null, 2) + '\n',
  );

  console.log(
    `build-queue: ${stats.total} тем (${stats.pending} pending, ` +
    `${stats.highRisk} high-risk, ${stats.done} done, ${stats.failed} failed)`,
  );
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
