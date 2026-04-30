/**
 * Генерирует hero-изображения для статей через OpenRouter (FLUX.1-schnell).
 * Для каждой статьи без heroImage создаёт картинку и прописывает путь во frontmatter.
 *
 * Запуск:
 *   OPENROUTER_API_KEY=... node scripts/generate-hero-images.mjs           # все статьи без hero
 *   OPENROUTER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node ...     # одна статья
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const BLOG_DIR   = path.join(ROOT, 'src/content/blog');
const HERO_DIR   = path.join(ROOT, 'public/images/hero');
const MODEL      = 'black-forest-labs/flux-1-schnell';

fs.mkdirSync(HERO_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

// Цветовые темы по категории
const CAT_STYLE = {
  'ts-piot':        'deep navy blue, electric blue accents, circuit board patterns, digital technology',
  'markirovka':     'deep forest green, teal accents, barcode and data matrix patterns, logistics',
  'zakonodatelstvo':'dark charcoal, warm amber gold accents, marble texture, formal documents',
};

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"]*)"?/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  fm._raw = match[1];
  fm._body = content.slice(match[0].length);
  return fm;
}

function buildPrompt(title, category) {
  const style = CAT_STYLE[category] ?? 'dark abstract, professional';
  return (
    `Editorial photo illustration for a Russian business article. ` +
    `Topic: "${title}". ` +
    `Visual style: ${style}, very dark background (90% dark), ` +
    `subtle abstract composition, photorealistic, cinematic lighting, ` +
    `16:9 aspect ratio, no text, no people, no logos, ` +
    `suitable for white typography overlay`
  );
}

async function generateImage(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://reglament-biznes.ru',
      'X-Title': 'Регламент.Бизнес Hero Generator',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      size: '1792x1024',
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const b64  = data?.data?.[0]?.b64_json;
  const url  = data?.data?.[0]?.url;

  if (b64) return { buffer: Buffer.from(b64, 'base64'), ext: 'jpg' };
  if (url) {
    const imgRes = await fetch(url);
    return { buffer: Buffer.from(await imgRes.arrayBuffer()), ext: 'jpg' };
  }
  throw new Error('Нет данных в ответе: ' + JSON.stringify(data).slice(0, 300));
}

// Собираем список статей для обработки
const targetSlug = process.env.SLUG;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

const targets = files.filter(file => {
  if (targetSlug && !file.startsWith(targetSlug) && file !== targetSlug + '.md') return false;
  const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  if (/^heroImage:/m.test(content)) return false;
  if (!targetSlug && /^draft:\s*true/m.test(content)) return false;
  return true;
});

if (targets.length === 0) {
  console.log('Нет статей для генерации (все уже имеют heroImage или являются черновиками).');
  process.exit(0);
}

console.log(`Буду генерировать hero для ${targets.length} статьи(й)...\n`);

for (const file of targets) {
  const filePath = path.join(BLOG_DIR, file);
  const content  = fs.readFileSync(filePath, 'utf8');
  const fm       = parseFrontmatter(content);
  if (!fm) { console.warn(`Пропуск ${file}: не распарсился frontmatter`); continue; }

  const slug     = file.replace(/\.md$/, '');
  const title    = fm.title ?? slug;
  const category = (content.match(/categories:\s*\n\s*-\s*(\S+)/) || [])[1] ?? 'zakonodatelstvo';
  const prompt   = buildPrompt(title, category);

  process.stdout.write(`${slug}... `);
  try {
    const { buffer, ext } = await generateImage(prompt);
    const heroPath   = `/images/hero/${slug}.${ext}`;
    const outputPath = path.join(HERO_DIR, `${slug}.${ext}`);
    fs.writeFileSync(outputPath, buffer);
    const size = (fs.statSync(outputPath).size / 1024).toFixed(0);

    // Вставляем heroImage в frontmatter после pubDate
    const updated = content.replace(
      /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
      `$1$2heroImage: "${heroPath}"\n`
    );
    fs.writeFileSync(filePath, updated);
    console.log(`✓ ${size} KB → ${heroPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово.');
