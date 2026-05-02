/**
 * Генерирует hero-изображения для статей через FLUX Schnell (Together.ai).
 * Для каждой статьи без heroImage создаёт картинку и прописывает путь во frontmatter.
 *
 * Запуск:
 *   TOGETHER_API_KEY=... node scripts/generate-hero-images.mjs           # все без hero
 *   TOGETHER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node ...     # одна статья
 *   TOGETHER_API_KEY=... HERO_MODEL=black-forest-labs/FLUX.1-dev node ... # другая модель
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const BLOG_DIR  = path.join(ROOT, 'src/content/blog');
const HERO_DIR  = path.join(ROOT, 'public/images/hero');
const MODEL     = process.env.HERO_MODEL ?? 'black-forest-labs/FLUX.1-schnell-Free';

fs.mkdirSync(HERO_DIR, { recursive: true });

const API_KEY = process.env.TOGETHER_API_KEY;
if (!API_KEY) { console.error('TOGETHER_API_KEY не задан'); process.exit(1); }

// Цветовые темы по категории
const CAT_STYLE = {
  'ts-piot':
    'deep navy blue and electric blue color scheme, circuit board patterns, ' +
    'digital technology abstract, dark background, cinematic dramatic lighting, ' +
    'photorealistic render',
  'markirovka':
    'deep forest green and teal color scheme, barcode and data matrix patterns, ' +
    'logistics and supply chain abstract, dark background, cinematic dramatic lighting, ' +
    'photorealistic render',
  'zakonodatelstvo':
    'dark charcoal and warm amber gold color scheme, marble texture, ' +
    'formal documents abstract, dark background, cinematic dramatic lighting, ' +
    'photorealistic render',
};

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

function buildPrompt(title, category) {
  const style = CAT_STYLE[category] ?? 'dark abstract, professional, cinematic lighting, photorealistic';
  return (
    `Editorial photo illustration for a Russian business article. ` +
    `Topic: "${title}". ` +
    `Visual style: ${style}, subtle abstract composition, ` +
    `16:9 aspect ratio, no text, no people, no logos, ` +
    `suitable for white typography overlay`
  );
}

async function generateImage(prompt) {
  const res = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      width: 1344,
      height: 768,
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();

  const item = data?.data?.[0];
  if (!item) throw new Error('Нет данных: ' + JSON.stringify(data).slice(0, 400));

  // URL-формат
  if (item.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`Скачивание ${r.status}: ${item.url}`);
    return Buffer.from(await r.arrayBuffer());
  }

  // base64-формат
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');

  throw new Error('Нет изображения: ' + JSON.stringify(data).slice(0, 400));
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

console.log(`Модель: ${MODEL}`);
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
    const buffer   = await generateImage(prompt);
    const heroPath = `/images/hero/${slug}.jpg`;
    const outPath  = path.join(HERO_DIR, `${slug}.jpg`);
    fs.writeFileSync(outPath, buffer);
    const size = (fs.statSync(outPath).size / 1024).toFixed(0);

    const updated = content.replace(
      /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
      `$1$2heroImage: "${heroPath}"\n`,
    );
    fs.writeFileSync(filePath, updated);
    console.log(`✓ ${size} KB → ${heroPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово.');
