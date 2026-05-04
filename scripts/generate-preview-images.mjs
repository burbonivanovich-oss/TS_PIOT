/**
 * Генерирует пул превью-изображений для карточек статей.
 * Пул: 3 варианта × 5 категорий = 15 файлов.
 * Файлы: public/images/preview/{category}-{0,1,2}.jpg
 *
 * Статьи НЕ трогаются — карточки выбирают изображение из пула
 * по формуле: slugHash(post.id) % 3.
 *
 * Запуск: Actions → Generate Preview Pool → Run workflow
 *
 * Переменные окружения:
 *   CATEGORY   — сгенерировать только одну категорию (ts-piot, markirovka, …)
 *   FORCE=1    — перегенерировать даже если файл уже существует
 *   PREVIEW_MODEL — модель (по умолчанию google/gemini-3.1-flash-image-preview)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, '..');
const PREVIEW_DIR = path.join(ROOT, 'public/images/preview');
const MODEL       = process.env.PREVIEW_MODEL ?? 'google/gemini-3.1-flash-image-preview';
const FORCE       = process.env.FORCE === '1';
const ONLY_CAT    = process.env.CATEGORY ?? '';

fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

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

const STYLE_SUFFIX =
  'flat graphic design, bold minimal icon, 2–3 solid colors, no gradients, no photography, ' +
  'no text overlays, no people, clean vector-style illustration, 4:3 aspect ratio';

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

const categories = ONLY_CAT
  ? (CAT_VARIANTS[ONLY_CAT] ? [ONLY_CAT] : (() => { console.error(`Неизвестная категория: ${ONLY_CAT}`); process.exit(1); })())
  : Object.keys(CAT_VARIANTS);

console.log(`Модель: ${MODEL}`);
console.log(`Категории: ${categories.join(', ')}`);
console.log(`Режим: ${FORCE ? 'перегенерация' : 'только новые'}\n`);

let generated = 0;
let skipped   = 0;

for (const cat of categories) {
  const variants = CAT_VARIANTS[cat];
  for (let n = 0; n < variants.length; n++) {
    const outPath = path.join(PREVIEW_DIR, `${cat}-${n}.jpg`);
    const label   = `${cat}-${n}`;

    if (!FORCE && fs.existsSync(outPath)) {
      console.log(`↷ ${label} — уже есть, пропуск`);
      skipped++;
      continue;
    }

    process.stdout.write(`${label}... `);
    const prompt = `${variants[n]}. ${STYLE_SUFFIX}`;
    try {
      const buffer = await generateImage(prompt);
      fs.writeFileSync(outPath, buffer);
      const size = (fs.statSync(outPath).size / 1024).toFixed(0);
      console.log(`✓ ${size} KB`);
      generated++;
    } catch (e) {
      console.error(`✗ ${e.message}`);
    }
  }
}

console.log(`\nГотово. Сгенерировано: ${generated}, пропущено: ${skipped}.`);
