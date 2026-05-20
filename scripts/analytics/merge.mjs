#!/usr/bin/env node
// Сводит данные GSC + Метрики + frontmatter статей в единый
// articles.json для дашборда /dashboard/.
//
// Читает: src/data/analytics/{gsc,metrika}.json + src/content/blog/*.{md,mdx}
// Пишет:  src/data/analytics/articles.json
//
// Каждая запись:
//   { slug, url, title, pubDate, updatedDate, category, draft,
//     factchecked, gsc: { clicks, impressions, position, ctr }?,
//     metrika: { pageviews, visits, users, avgDuration }? }

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOG_DIR = join(ROOT, 'src', 'content', 'blog');
const FC_DIR = join(ROOT, '.claude', 'factchecked');
const ANALYTICS_DIR = join(ROOT, 'src', 'data', 'analytics');
const OUT_FILE = join(ANALYTICS_DIR, 'articles.json');

const gsc = readJsonSafe(join(ANALYTICS_DIR, 'gsc.json'));
const metrika = readJsonSafe(join(ANALYTICS_DIR, 'metrika.json'));

function readJsonSafe(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.warn(`Не смог прочитать ${path}: ${e.message}`);
    return null;
  }
}

// Парсим frontmatter в стиле «достаточно для нашего use case».
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  const lines = m[1].split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      let val = kv[2].trim();
      if (val === '' && i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
        const arr = [];
        i++;
        while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
          arr.push(lines[i].replace(/^\s+-\s+/, '').replace(/^"|"$/g, '').trim());
          i++;
        }
        fm[key] = arr;
        continue;
      }
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      fm[key] = val;
    }
    i++;
  }
  return fm;
}

const articles = [];
const files = readdirSync(BLOG_DIR).filter(f => /\.(md|mdx)$/.test(f));

for (const file of files) {
  const slug = file.replace(/\.(md|mdx)$/, '');
  const fm = parseFrontmatter(readFileSync(join(BLOG_DIR, file), 'utf8')) || {};
  const url = `/blog/${slug}/`;
  const gscRow = gsc?.byPage?.[url] || null;
  const metrikaRow = metrika?.byPage?.[url] || null;
  const factchecked = existsSync(join(FC_DIR, slug));
  articles.push({
    slug,
    url,
    title: fm.title || slug,
    pubDate: fm.pubDate || null,
    updatedDate: fm.updatedDate || null,
    reviewDate: fm.reviewDate || null,
    category: Array.isArray(fm.categories) ? fm.categories[0] : null,
    draft: fm.draft === 'true' || fm.draft === true,
    factchecked,
    gsc: gscRow,
    metrika: metrikaRow,
  });
}

articles.sort((a, b) => {
  // Сортировка по приоритету для дашборда: сначала с трафиком, потом по дате
  const aTraffic = (a.metrika?.pageviews || 0) + (a.gsc?.clicks || 0) * 5;
  const bTraffic = (b.metrika?.pageviews || 0) + (b.gsc?.clicks || 0) * 5;
  if (aTraffic !== bTraffic) return bTraffic - aTraffic;
  return (b.pubDate || '').localeCompare(a.pubDate || '');
});

const out = {
  generatedAt: new Date().toISOString(),
  source: {
    gsc: gsc?.fetchedAt || null,
    metrika: metrika?.fetchedAt || null,
    days: gsc?.days || metrika?.days || null,
  },
  totals: {
    articles: articles.length,
    withGsc: articles.filter(a => a.gsc).length,
    withMetrika: articles.filter(a => a.metrika).length,
    totalClicks: articles.reduce((s, a) => s + (a.gsc?.clicks || 0), 0),
    totalImpressions: articles.reduce((s, a) => s + (a.gsc?.impressions || 0), 0),
    totalPageviews: articles.reduce((s, a) => s + (a.metrika?.pageviews || 0), 0),
  },
  articles,
};

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`Слиты данные по ${articles.length} статьям`);
console.log(`  с GSC: ${out.totals.withGsc}`);
console.log(`  с Метрикой: ${out.totals.withMetrika}`);
console.log(`  всего кликов GSC: ${out.totals.totalClicks}`);
console.log(`  всего просмотров Метрики: ${out.totals.totalPageviews}`);
console.log(`Записано в ${OUT_FILE}`);
