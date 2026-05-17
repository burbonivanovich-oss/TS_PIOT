/**
 * Генерирует OG-фоны через OpenRouter (FLUX.1-schnell — бесплатно).
 * Запуск: OPENROUTER_API_KEY=... node scripts/generate-og-backgrounds-openrouter.mjs
 * Результат: public/og-backgrounds/*.jpg
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/og-backgrounds');
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('OPENROUTER_API_KEY не задан');
  process.exit(1);
}

// FLUX.1-schnell — бесплатная модель на OpenRouter
const MODEL = 'black-forest-labs/flux-1-schnell';

const BACKGROUNDS = [
  {
    slug: 'ts-piot',
    prompt:
      'Dark abstract digital background, deep navy and dark blue tones, ' +
      'subtle glowing circuit-board lines and grid patterns, very low contrast texture, ' +
      'photorealistic, 16:9, no text, no people, no logos, ' +
      'dark moody atmosphere, suitable as overlay background for white typography',
  },
  {
    slug: 'markirovka',
    prompt:
      'Dark abstract background, very deep green and teal tones, ' +
      'subtle organic texture resembling QR code fragments or data matrix patterns, ' +
      'low contrast, photorealistic, 16:9, no text, no people, no logos, ' +
      'suitable as overlay background for white typography',
  },
  {
    slug: 'zakonodatelstvo',
    prompt:
      'Dark abstract background, deep charcoal with very subtle warm amber and gold tones, ' +
      'texture resembling dark marble or aged paper with faint geometric lines, ' +
      'low contrast, photorealistic, 16:9, no text, no people, no logos, ' +
      'suitable as overlay background for white typography',
  },
];

async function generateImage(prompt, outputPath) {
  const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://reglament-biznes.ru',
      'X-Title': 'Этикетка OG Generator',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      size: '1792x1024', // ближайший к 1200×630 формат 16:9
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (b64) {
    fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
  } else if (url) {
    const imgRes = await fetch(url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(outputPath, buf);
  } else {
    throw new Error('Нет данных в ответе: ' + JSON.stringify(data));
  }
}

for (const bg of BACKGROUNDS) {
  const outPath = path.join(OUT_DIR, `${bg.slug}.jpg`);
  process.stdout.write(`Генерирую ${bg.slug}... `);
  try {
    await generateImage(bg.prompt, outPath);
    const size = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`✓ ${outPath} (${size} KB)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}

console.log('\nГотово. Фоны лежат в public/og-backgrounds/, OG-картинки доступны по /og/<slug>.png.');
