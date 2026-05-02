/**
 * Генерирует preview + hero изображения для статей через Pollinations.ai.
 * Бесплатно, без API-ключей. FLUX-модель.
 *
 * Запуск:
 *   node scripts/generate-article-images-free.mjs          # все статьи без изображений
 *   SLUG=2026-01-15-chto-takoe-ts-piot node ...            # одна статья
 *   MODE=preview node ...                                   # только превью
 *   MODE=hero node ...                                      # только hero
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const BLOG_DIR   = path.join(ROOT, 'src/content/blog');
const PREVIEW_DIR = path.join(ROOT, 'public/images/preview');
const HERO_DIR   = path.join(ROOT, 'public/images/hero');

fs.mkdirSync(PREVIEW_DIR, { recursive: true });
fs.mkdirSync(HERO_DIR, { recursive: true });

const TARGET_SLUG = process.env.SLUG;
const MODE = process.env.MODE ?? 'both'; // 'preview' | 'hero' | 'both'

// ─── Стили по категориям ────────────────────────────────────────────────────

// Preview: плоская editorial-иллюстрация (единый стиль блога)
const PREVIEW_BASE =
  'bold flat editorial illustration, minimalist geometric shapes, ' +
  'clean vector aesthetic, muted professional color palette, ' +
  'no text, no people, no faces, no logos, 16:9 aspect ratio';

const PREVIEW_CAT = {
  'ts-piot':
    'navy blue and electric blue tones, cash register, QR code, ' +
    'circuit board fragments, software interface elements, digital receipt',
  'markirovka':
    'forest green and teal tones, barcode, data matrix code, ' +
    'product packaging, supply chain icons, warehouse shelving',
  'zakonodatelstvo':
    'warm amber and charcoal tones, legal documents, scales of justice, ' +
    'official stamps, calendar pages, tax forms',
};

// Hero: фотореалистичная тематическая иллюстрация
const HERO_CAT = {
  'ts-piot':
    'deep navy blue, electric blue accents, circuit board patterns, ' +
    'digital technology, very dark background (90% dark), cinematic lighting',
  'markirovka':
    'deep forest green, teal accents, barcode and data matrix patterns, ' +
    'logistics, very dark background (90% dark), cinematic lighting',
  'zakonodatelstvo':
    'dark charcoal, warm amber gold accents, marble texture, ' +
    'formal documents, very dark background (90% dark), cinematic lighting',
};

// ─── Вспомогательные функции ────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"]*)"?/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function getCategory(content) {
  return (content.match(/categories:\s*\n\s*-\s*(\S+)/) || [])[1] ?? 'zakonodatelstvo';
}

function hashSeed(str) {
  let h = 0;
  for (const c of str) h = Math.imul(31, h) + c.charCodeAt(0) | 0;
  return Math.abs(h) % 99999;
}

function buildPreviewPrompt(title, category) {
  const cat = PREVIEW_CAT[category] ?? 'neutral tones, business documents, abstract shapes';
  return `${PREVIEW_BASE}, ${cat}. Topic context: ${title}`;
}

function buildHeroPrompt(title, category) {
  const cat = HERO_CAT[category] ?? 'dark abstract, professional, cinematic lighting';
  return (
    `Editorial photo illustration for a Russian business article. ` +
    `Topic: "${title}". ` +
    `Visual style: ${cat}, subtle abstract composition, photorealistic, ` +
    `no text, no people, no logos, suitable for white typography overlay`
  );
}

async function downloadImage(prompt, seed, width = 1792, height = 1024) {
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'reglament-biznes-image-generator/1.0' },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Фильтрация статей ──────────────────────────────────────────────────────

const allFiles = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

const targets = allFiles.filter(file => {
  if (TARGET_SLUG && !file.startsWith(TARGET_SLUG) && file !== TARGET_SLUG + '.md') return false;
  const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  if (!TARGET_SLUG && /^draft:\s*true/m.test(content)) return false;
  const needPreview = MODE !== 'hero'  && !/^previewImage:/m.test(content);
  const needHero    = MODE !== 'preview' && !/^heroImage:/m.test(content);
  return needPreview || needHero;
});

if (targets.length === 0) {
  console.log('Нет статей для генерации — все уже имеют изображения.');
  process.exit(0);
}

console.log(`Режим: ${MODE} | Статей: ${targets.length}\n`);

// ─── Основной цикл ──────────────────────────────────────────────────────────

for (let i = 0; i < targets.length; i++) {
  const file     = targets[i];
  const filePath = path.join(BLOG_DIR, file);
  let content    = fs.readFileSync(filePath, 'utf8');
  const fm       = parseFrontmatter(content);
  if (!fm) { console.warn(`Пропуск ${file}: не распарсился frontmatter`); continue; }

  const slug     = file.replace(/\.md$/, '');
  const title    = fm.title ?? slug;
  const category = getCategory(content);

  console.log(`[${i + 1}/${targets.length}] ${slug}`);

  // ── Preview ──────────────────────────────────────────────────────────────
  if (MODE !== 'hero' && !/^previewImage:/m.test(content)) {
    const prompt = buildPreviewPrompt(title, category);
    const seed   = hashSeed('preview:' + slug);
    process.stdout.write(`  preview (seed ${seed})... `);
    try {
      const buf  = await downloadImage(prompt, seed, 1792, 1024);
      const dest = path.join(PREVIEW_DIR, `${slug}.jpg`);
      fs.writeFileSync(dest, buf);
      const kb   = (fs.statSync(dest).size / 1024).toFixed(0);
      console.log(`✓ ${kb} KB`);

      const previewPath = `/images/preview/${slug}.jpg`;
      content = content.replace(
        /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
        `$1$2previewImage: "${previewPath}"\n`,
      );
      fs.writeFileSync(filePath, content);
    } catch (e) {
      console.error(`✗ ${e.message}`);
    }
    if (MODE === 'both') await sleep(2000);
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  if (MODE !== 'preview' && !/^heroImage:/m.test(content)) {
    // перечитываем: preview уже мог добавить поле
    content = fs.readFileSync(filePath, 'utf8');
    const prompt = buildHeroPrompt(title, category);
    const seed   = hashSeed('hero:' + slug);
    process.stdout.write(`  hero    (seed ${seed})... `);
    try {
      const buf  = await downloadImage(prompt, seed, 1792, 1024);
      const dest = path.join(HERO_DIR, `${slug}.jpg`);
      fs.writeFileSync(dest, buf);
      const kb   = (fs.statSync(dest).size / 1024).toFixed(0);
      console.log(`✓ ${kb} KB`);

      const heroPath = `/images/hero/${slug}.jpg`;
      content = content.replace(
        /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
        `$1$2heroImage: "${heroPath}"\n`,
      );
      fs.writeFileSync(filePath, content);
    } catch (e) {
      console.error(`✗ ${e.message}`);
    }
  }

  // Пауза между статьями (кроме последней)
  if (i < targets.length - 1) await sleep(3000);
}

console.log('\nГотово.');
