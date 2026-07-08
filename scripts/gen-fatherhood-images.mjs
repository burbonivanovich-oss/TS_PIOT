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

const PROMPTS = [
  {
    name: '01-compact-full-load',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, drawn with ink and grey wash and confident linework. ' +
      'A father seen in three-quarter view, walking forward and carrying everything by himself: he pushes a folded stroller ahead of him, ' +
      'holds a kick-scooter in his other hand, wears a backpack with a toy sticking out of it, and has a shopping bag hanging from his wrist. ' +
      'A small boy rides on his shoulders, delighted, one arm raised. The father looks exhausted but determined, with a tired, wry half-smile — ' +
      'not angry, not happy. The composition is compact and centred so it fits inside a circle, with the father\'s head and the boy in the upper third ' +
      'as the focal point and all the gear clustered along the lower arc. Everything is black and white except one small spot of colour on the boy\'s helmet. ' +
      'Square 1:1, important elements kept away from the edges for a circular crop.',
  },
  {
    name: '02-tight-crop',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, drawn with ink and grey wash. ' +
      'Close crop on a father\'s head and shoulders with his small son riding on top, the two of them filling the whole frame. ' +
      'The father is seen in three-quarter view, walking; his face is exhausted but determined, with a tired, wry half-smile — not angry, brows relaxed. ' +
      'The boy on his shoulders is delighted and full of energy, one arm raised. At the very bottom edges you can just glimpse a stroller handle and the top ' +
      'of a kick-scooter, hinting that he is carrying much more. Bold, simple shapes that stay readable when the image is shrunk very small. ' +
      'Everything is black and white except one small spot of colour on the boy\'s helmet. ' +
      'Square 1:1 composition, with the faces kept in the upper centre so nothing important is lost to a circular crop.',
  },
  {
    name: '03-emotion-contrast',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, ink with grey wash and loose expressive linework. ' +
      'A father walks forward, seen in three-quarter view, with the face of a worn-out workhorse — deeply tired, a wry half-smile, brows relaxed rather than angry. ' +
      'On his shoulders his small son is bursting with joy, laughing, both arms thrown up. The contrast between the exhausted father below and the delighted boy above ' +
      'is the whole point of the picture. He carries only a little: a folded stroller pushed ahead of him and a kick-scooter in one hand. ' +
      'One small spot of colour on the boy, everything else black and white. Square 1:1, both faces in the upper centre, composed to sit inside a circular crop.',
  },
  {
    name: '04-caravan-dense',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, ink and grey wash, busy but still clear. ' +
      'A single father hauling an absurd amount all by himself: he pushes a folded stroller, holds a kick-scooter, wears a backpack with a toy poking out, ' +
      'has a shopping bag swinging from his wrist, a balloon tied on, and a water bottle in a side pocket. A small boy is perched on his shoulders, thrilled, waving. ' +
      'The father is tired but marching on, with a wry half-smile. Every object stays readable by its silhouette rather than turning into a messy blob. ' +
      'The composition is compact and centred for a circle, with the boy and the father\'s head at the top. One small spot of colour on the helmet only, ' +
      'everything else black and white. Square 1:1, important elements kept clear of the edges.',
  },
  {
    name: '05-pure-bw',
    prompt:
      'A pure black-and-white editorial cartoon in the New Yorker style, no colour at all, drawn with ink and grey wash and economical, confident linework. ' +
      'A father seen in three-quarter view, walking forward and carrying it all himself: a stroller pushed ahead of him, a kick-scooter in one hand, a backpack, ' +
      'and a bag on his wrist. A small boy rides on his shoulders, delighted, one arm raised. The father is exhausted but determined, with a tired half-smile. ' +
      'The composition is compact and fits inside a circle, with the father\'s head and the boy in the upper third. ' +
      'Square 1:1, faces kept in the upper centre for a circular crop.',
  },
  {
    name: '06-juice-accent',
    prompt:
      'A black-and-white editorial cartoon in the New Yorker style, drawn with ink and grey wash and thick linework. ' +
      'A father walks in three-quarter view, carrying everything himself: a stroller pushed ahead of him, a kick-scooter in one hand, and a backpack with a toy sticking out. ' +
      'On his shoulders sits a delighted small boy holding up a juice box — the single spot of colour in the whole image. ' +
      'The father is worn out but marching on, with a wry half-smile. The composition is compact and centred for a circle, with the faces in the upper third ' +
      'and the gear along the lower arc. Square 1:1, important elements kept away from the edges.',
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
