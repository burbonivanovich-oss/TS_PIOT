/**
 * Генерирует превью-изображения для карточек статей через FLUX Schnell (Together.ai).
 * Единый editorial-стиль на все статьи, тематические объекты по содержанию.
 *
 * Запуск:
 *   TOGETHER_API_KEY=... node scripts/generate-preview-images.mjs           # все без previewImage
 *   TOGETHER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node ...        # одна статья
 *   TOGETHER_API_KEY=... FLUX_MODEL=black-forest-labs/FLUX.1-dev node ...   # другая модель
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, '..');
const BLOG_DIR    = path.join(ROOT, 'src/content/blog');
const PREVIEW_DIR = path.join(ROOT, 'public/images/preview');
const MODEL       = process.env.FLUX_MODEL ?? 'black-forest-labs/FLUX.1-schnell-Free';

fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const API_KEY = process.env.TOGETHER_API_KEY;
if (!API_KEY) { console.error('TOGETHER_API_KEY не задан'); process.exit(1); }

// Единый визуальный стиль — editorial flat illustration, consistent across articles
const BASE_STYLE =
  'bold flat editorial illustration, minimalist geometric shapes, ' +
  'clean vector aesthetic, muted professional color palette, ' +
  'no text, no people, no faces, no logos, ' +
  'Tinkoff Journal style, 16:9 aspect ratio';

// Акцентные цвета и тематические элементы по категории
const CAT_STYLE = {
  'ts-piot':
    'navy blue and electric blue tones, cash register, QR code, digital receipt, ' +
    'circuit board fragments, software interface elements',
  'markirovka':
    'forest green and teal tones, barcode, data matrix code, product packaging, ' +
    'supply chain icons, warehouse shelving',
  'zakonodatelstvo':
    'warm amber and charcoal tones, legal documents, scales of justice, ' +
    'official stamps, calendar pages, tax forms',
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
  const catStyle = CAT_STYLE[category] ?? 'neutral tones, business documents, abstract shapes';
  return `${BASE_STYLE}, ${catStyle}. Topic context: ${title}`;
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

const targetSlug = process.env.SLUG;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

const targets = files.filter(file => {
  if (targetSlug && !file.startsWith(targetSlug) && file !== targetSlug + '.md') return false;
  const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  if (/^previewImage:/m.test(content)) return false;
  if (!targetSlug && /^draft:\s*true/m.test(content)) return false;
  return true;
});

if (targets.length === 0) {
  console.log('Нет статей для генерации (все уже имеют previewImage или являются черновиками).');
  process.exit(0);
}

console.log(`Модель: ${MODEL}`);
console.log(`Буду генерировать превью для ${targets.length} статьи(й)...\n`);

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
    const buffer      = await generateImage(prompt);
    const previewPath = `/images/preview/${slug}.jpg`;
    const outputPath  = path.join(PREVIEW_DIR, `${slug}.jpg`);
    fs.writeFileSync(outputPath, buffer);
    const size = (fs.statSync(outputPath).size / 1024).toFixed(0);

    const updated = content.replace(
      /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
      `$1$2previewImage: "${previewPath}"\n`
    );
    fs.writeFileSync(filePath, updated);
    console.log(`✓ ${size} KB → ${previewPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово.');
