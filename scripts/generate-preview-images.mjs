/**
 * Генерирует превью-изображения для карточек статей через OpenRouter.
 * Единый editorial-стиль на все статьи, тематические объекты по содержанию.
 *
 * Запуск:
 *   OPENROUTER_API_KEY=... node scripts/generate-preview-images.mjs           # все без previewImage
 *   OPENROUTER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node ...        # одна статья
 *   OPENROUTER_API_KEY=... PREVIEW_MODEL=black-forest-labs/flux.2-pro node ... # другая модель
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, '..');
const BLOG_DIR    = path.join(ROOT, 'src/content/blog');
const PREVIEW_DIR = path.join(ROOT, 'public/images/preview');
const MODEL       = process.env.PREVIEW_MODEL ?? 'google/gemini-2.5-flash-image';

fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

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
