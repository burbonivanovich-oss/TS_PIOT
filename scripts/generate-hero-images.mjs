/**
 * Генерирует hero-изображения для статей через OpenRouter.
 * Для каждой статьи без heroImage создаёт картинку и прописывает путь во frontmatter.
 *
 * Запуск:
 *   OPENROUTER_API_KEY=... node scripts/generate-hero-images.mjs           # все без hero
 *   OPENROUTER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node ...     # одна статья
 *   OPENROUTER_API_KEY=... HERO_MODEL=black-forest-labs/flux.2-pro node ... # другая модель
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const BLOG_DIR  = path.join(ROOT, 'src/content/blog');
const HERO_DIR  = path.join(ROOT, 'public/images/hero');
const MODEL     = process.env.HERO_MODEL ?? 'google/gemini-3-pro-image-preview';

fs.mkdirSync(HERO_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

// Цветовые темы по категории
const CAT_STYLE = {
  'ts-piot':
    'deep navy blue, electric blue accents, circuit board patterns, digital technology, ' +
    'very dark background (90% dark), cinematic lighting',
  'markirovka':
    'deep forest green, teal accents, barcode and data matrix patterns, logistics, ' +
    'very dark background (90% dark), cinematic lighting',
  'zakonodatelstvo':
    'dark charcoal, warm amber gold accents, marble texture, formal documents, ' +
    'very dark background (90% dark), cinematic lighting',
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
  const style = CAT_STYLE[category] ?? 'dark abstract, professional, cinematic lighting';
  return (
    `Editorial photo illustration for a Russian business article. ` +
    `Topic: "${title}". ` +
    `Visual style: ${style}, subtle abstract composition, photorealistic, ` +
    `16:9 aspect ratio, no text, no people, no logos, ` +
    `suitable for white typography overlay`
  );
}

async function generateImage(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://reglament.business',
      'X-Title': 'Reglament Business',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: '16:9' },
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();

  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new Error('Нет message: ' + JSON.stringify(data).slice(0, 400));

  // Gemini-style: images в отдельном поле message.images
  if (Array.isArray(msg.images) && msg.images.length > 0) {
    const imgUrl = msg.images[0]?.image_url?.url;
    if (imgUrl) {
      if (imgUrl.startsWith('data:')) return Buffer.from(imgUrl.split(',')[1], 'base64');
      const r = await fetch(imgUrl);
      if (!r.ok) throw new Error(`Скачивание ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    }
  }

  // FLUX-style: content — строка с URL или base64 data URI
  const content = msg.content;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('data:')) return Buffer.from(trimmed.split(',')[1], 'base64');
    if (/^https?:\/\//.test(trimmed)) {
      const r = await fetch(trimmed);
      if (!r.ok) throw new Error(`Скачивание ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    }
  }

  // content — массив частей (multimodal)
  if (Array.isArray(content)) {
    for (const part of content) {
      const url = part?.image_url?.url ?? (part?.type === 'image_url' ? part.url : null);
      if (!url) continue;
      if (url.startsWith('data:')) return Buffer.from(url.split(',')[1], 'base64');
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Скачивание ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    }
  }

  throw new Error('Нет изображения. message: ' + JSON.stringify(msg).slice(0, 400));
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
