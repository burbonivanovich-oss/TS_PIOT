/**
 * Генерирует превью-изображения для карточек статей через OpenRouter (FLUX).
 * Использует OpenAI-совместимый endpoint /v1/images/generations.
 *
 * Запуск через GitHub Actions (стандартный способ):
 *   Actions → Generate Article Images → Run workflow
 *
 * Модель по умолчанию: google/gemini-3.1-flash-image-preview
 * Переопределить: PREVIEW_MODEL=google/gemini-2.5-flash-image (дешевле)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, '..');
const BLOG_DIR    = path.join(ROOT, 'src/content/blog');
const PREVIEW_DIR = path.join(ROOT, 'public/images/preview');
const MODEL       = process.env.PREVIEW_MODEL ?? 'google/gemini-3.1-flash-image-preview';

fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

/* Превью — простой графический паттерн, читается на карточке ~300px.
   3 варианта на категорию; выбор детерминирован по хэшу слага. */
const CAT_VARIANTS = {
  'ts-piot': [
    'flat graphic icon of a POS terminal, bold solid silhouette, charcoal #111 background, lime-green #AFCC00 accent lines, centered composition, large single symbol',
    'flat graphic icon of a receipt tape unrolling from a printer, bold minimal lines, charcoal #111 background, lime-green #AFCC00 accent, centered large symbol',
    'flat graphic icon of a chip card inserted into a terminal slot, bold geometric silhouette, charcoal #111 background, lime-green #AFCC00 highlight, centered composition',
  ],
  'markirovka': [
    'flat graphic QR code pattern as bold geometric tile, cream-beige #EDE8DF background, dark #111 graphic elements, large centered motif',
    'flat graphic icon of a product tag with a barcode, bold solid shapes, cream-beige #EDE8DF background, dark #111 lines, centered large symbol',
    'flat graphic icon of a scanning beam over a label, bold minimal composition, cream-beige #EDE8DF background, dark #111 elements, centered motif',
  ],
  'zakonodatelstvo': [
    'flat graphic icon of a document with a pen, bold solid silhouette, deep navy #1E4A7A background, white accent, centered composition, large single symbol',
    'flat graphic icon of legal scales (balance), bold minimal silhouette, deep navy #1E4A7A background, white accent lines, centered large symbol',
    'flat graphic icon of a calendar page with a checkmark, bold solid shapes, deep navy #1E4A7A background, white graphic elements, centered composition',
  ],
  'kkt': [
    'flat graphic icon of a receipt printer with paper roll, bold solid silhouette, charcoal #111 background, warm amber accent, centered composition, large single symbol',
    'flat graphic icon of a cash register, bold minimal silhouette, charcoal #111 background, warm amber #E8A000 accent, centered large symbol',
    'flat graphic icon of a fiscal storage drive (small rectangle chip), bold geometric shape, charcoal #111 background, warm amber accent lines, centered composition',
  ],
  'egais': [
    'flat graphic icon of a wine bottle, bold solid silhouette, dark #111 background, burgundy #9E2B4F accent, centered composition, large single symbol',
    'flat graphic icon of a wine glass, bold minimal silhouette, dark #111 background, burgundy #9E2B4F fill, centered large symbol',
    'flat graphic icon of two spirits bottles side by side, bold solid shapes, dark #111 background, burgundy #9E2B4F and white accents, centered composition',
  ],
};

function pickVariant(slug, category) {
  const variants = CAT_VARIANTS[category] ?? [
    'flat graphic icon, dark background, bold silhouette, centered',
  ];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return variants[hash % variants.length];
}

const STYLE_SUFFIX =
  'flat graphic design, bold minimal icon, 2–3 solid colors, no gradients, no photography, ' +
  'no text overlays, no people, clean vector-style illustration, 4:3 aspect ratio';

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

function buildPrompt(slug, category) {
  const variant = pickVariant(slug, category);
  return `${variant}. ${STYLE_SUFFIX}`;
}

async function generateImage(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://etiketka.media',
      'X-Title': 'etiketka.media',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['text', 'image'],
    }),
  });

  const rawText = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${rawText.slice(0, 400)}`);
  let data;
  try { data = JSON.parse(rawText); }
  catch { throw new Error(`Не JSON (${res.status}): ${rawText.slice(0, 400)}`); }

  const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imgUrl) throw new Error('Нет изображения: ' + JSON.stringify(data).slice(0, 400));

  if (imgUrl.startsWith('data:image/')) {
    return Buffer.from(imgUrl.split(',')[1], 'base64');
  }

  const r = await fetch(imgUrl);
  if (!r.ok) throw new Error(`Скачивание ${r.status}: ${imgUrl}`);
  return Buffer.from(await r.arrayBuffer());
}

const targetSlug = process.env.SLUG;
const limit      = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;
const files      = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

let targets = files.filter(file => {
  if (targetSlug && !file.startsWith(targetSlug) && file !== targetSlug + '.md') return false;
  const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  if (/^previewImage:/m.test(content)) return false;
  if (!targetSlug && /^draft:\s*true/m.test(content)) return false;
  return true;
});

if (limit > 0) targets = targets.slice(0, limit);

if (targets.length === 0) {
  console.log('Нет статей для генерации (все уже имеют previewImage или являются черновиками).');
  process.exit(0);
}

console.log(`Модель: ${MODEL}`);
if (limit > 0) console.log(`Лимит: ${limit} статьи(й)`);
console.log(`Буду генерировать превью для ${targets.length} статьи(й)...\n`);

for (const file of targets) {
  const filePath = path.join(BLOG_DIR, file);
  const content  = fs.readFileSync(filePath, 'utf8');
  const fm       = parseFrontmatter(content);
  if (!fm) { console.warn(`Пропуск ${file}: не распарсился frontmatter`); continue; }

  const slug     = file.replace(/\.md$/, '');
  const category = (content.match(/categories:\s*\n\s*-\s*(\S+)/) || [])[1] ?? 'zakonodatelstvo';
  const prompt   = buildPrompt(slug, category);

  process.stdout.write(`${slug}... `);
  try {
    const buffer      = await generateImage(prompt);
    const previewPath = `/images/preview/${slug}.jpg`;
    const outputPath  = path.join(PREVIEW_DIR, `${slug}.jpg`);
    fs.writeFileSync(outputPath, buffer);
    const size = (fs.statSync(outputPath).size / 1024).toFixed(0);
    const updated = content.replace(
      /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
      `$1$2previewImage: "${previewPath}"\n`,
    );
    fs.writeFileSync(filePath, updated);
    console.log(`✓ ${size} KB → ${previewPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово.');
