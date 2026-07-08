/**
 * Разовая генерация 6 изображений для тг-канала про отцовство.
 * НЕ связано с контентом etiketka — отдельная задача.
 * Запуск: GitHub Actions (workflow gen-fatherhood-images.yml) с OPENROUTER_API_KEY.
 *
 * Env:
 *   OPENROUTER_API_KEY — обязателен
 *   IMG_MODEL          — модель (по умолчанию google/gemini-3.1-flash-image-preview)
 *   ONLY               — сгенерировать только один вариант по номеру (1..6)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'fatherhood-images');
const MODEL = process.env.IMG_MODEL ?? 'google/gemini-3.1-flash-image-preview';
const ONLY = process.env.ONLY ? parseInt(process.env.ONLY, 10) : 0;

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

fs.mkdirSync(OUT_DIR, { recursive: true });

const DNA =
  'A young father, late twenties to early thirties, modern and casual — wearing a hoodie, slim joggers and sneakers. ' +
  'He carries everything himself: a child\'s bicycle held in one hand, a bulging grocery bag in the other, and a backpack with a toy sticking out. ' +
  'On his shoulders sits his small son, delighted, holding up a juice box — the single spot of colour in the whole image. ' +
  'No stroller anywhere. No text, no caption, no signature, no logo anywhere. ' +
  'Square 1:1, important elements kept clear of the edges for a circular crop.';

const PROMPTS = [
  {
    name: 'v2-01-base',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, drawn with ink and grey wash and confident linework. ' +
      'A young father, late twenties to early thirties, modern and casual — wearing a hoodie, slim joggers and sneakers — walks forward in three-quarter view, ' +
      'worn out but marching on, with a tired, wry half-smile that is not angry and not sad. He carries everything himself: a child\'s bicycle held in one hand, ' +
      'a bulging grocery bag in the other, and a backpack with a toy sticking out. On his shoulders sits his small son, delighted, holding up a juice box — ' +
      'the single spot of colour in the whole image. No stroller anywhere. The composition is compact and centred for a circle, with the two faces in the upper third ' +
      'as the focal point so they stay readable when the image is shrunk very small. No text, no caption, no signature, no logo anywhere. ' +
      'Square 1:1, important elements kept clear of the edges for a circular crop.',
  },
  {
    name: 'v2-02-tight-crop',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, ink and grey wash, confident linework. ' +
      'Close crop on a young father\'s head and shoulders — late twenties, wearing a hoodie — with his small son riding on top, the two faces filling the frame. ' +
      'The father is worn out but marching on, tired wry half-smile, not angry, brows relaxed. The son is delighted, holding up a juice box that is the single spot of colour. ' +
      'At the very bottom edges you can just glimpse a child\'s bicycle and a bulging grocery bag, hinting he carries much more. ' +
      'Bold simple shapes that stay readable when the image is shrunk very small. No stroller. No text, caption, signature or logo. ' +
      'Square 1:1, the faces kept in the upper centre, clear of the edges for a circular crop.',
  },
  {
    name: 'v2-03-emotion-contrast',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, ink with grey wash and loose expressive linework. ' +
      'A young casual father — hoodie, slim joggers, sneakers — walks forward in three-quarter view with the face of a worn-out workhorse: deeply tired, ' +
      'a wry half-smile, brows relaxed rather than angry. On his shoulders his small son bursts with joy, laughing, holding up a juice box — the single spot of colour. ' +
      'The contrast between the exhausted father and the delighted boy is the whole point of the picture. He carries only a little: a child\'s bicycle in one hand ' +
      'and a bulging grocery bag in the other. No stroller. No text, caption or logo anywhere. ' +
      'Square 1:1, both faces in the upper centre, composed to sit inside a circular crop.',
  },
  {
    name: 'v2-04-marching-motion',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, ink and grey wash with confident dynamic linework. ' +
      'A young father in a hoodie strides forward in three-quarter view, mid-step, leaning slightly into the walk as if he has been going for hours — ' +
      'worn out but marching on, tired wry half-smile. ' + DNA.replace('Square 1:1', 'A clear sense of forward motion and momentum. Square 1:1'),
  },
  {
    name: 'v2-05-loose-sketch',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, drawn with loose spontaneous ink lines and generous grey wash, a lively sketchbook feel. ' +
      'A young modern father — hoodie, slim joggers, sneakers — walks forward in three-quarter view, worn out but marching on, with a tired wry half-smile. ' +
      DNA + ' The two faces sit in the upper third as the focal point.',
  },
  {
    name: 'v2-06-caravan-dense',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, ink and grey wash, busy but still clear. ' +
      'A young father in a hoodie hauling an absurd amount by himself: a child\'s bicycle in one hand, a bulging grocery bag in the other, a backpack with a toy sticking out, ' +
      'a water bottle in a side pocket and a small balloon tied on. His small son is perched on his shoulders, thrilled, holding up a juice box — the single spot of colour. ' +
      'The father is tired but marching on, with a wry half-smile. Every object stays readable by its silhouette rather than turning into a messy blob. No stroller. ' +
      'No text, caption, signature or logo anywhere. Square 1:1, the boy and the father\'s head at the top, important elements kept clear of the edges for a circular crop.',
  },
];

async function generateImage(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://etiketka-media.ru',
      'X-Title': 'fatherhood-tg',
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
  if (!r.ok) throw new Error(`Скачивание ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

console.log(`Модель: ${MODEL}`);
const targets = ONLY ? PROMPTS.filter((_, i) => i + 1 === ONLY) : PROMPTS;
console.log(`Генерирую ${targets.length} изображени(й).\n`);

let ok = 0;
for (const { name, prompt } of targets) {
  process.stdout.write(`${name}\n  → ${prompt.slice(0, 80)}...\n  `);
  try {
    const buffer = await generateImage(prompt);
    const outPath = path.join(OUT_DIR, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    const size = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`✓ ${size} KB → fatherhood-images/${name}.png`);
    ok++;
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log(`\nГотово: ${ok}/${targets.length}.`);
if (ok === 0) process.exit(1);
