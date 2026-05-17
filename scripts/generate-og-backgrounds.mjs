/**
 * Генерирует фоновые изображения для OG-картинок через Gemini Imagen 3.
 * Запуск: node scripts/generate-og-backgrounds.mjs
 * Результат: public/og-backgrounds/*.png
 *
 * Требует GEMINI_API_KEY в окружении (или .claude/settings.local.json).
 */
import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY не задан');
  process.exit(1);
}

const OUT_DIR = './public/og-backgrounds';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Промпты: тёмные абстрактные текстуры, минимум деталей, текст поверх читаем.
// Формат 16:9 (ближайший к нашему 1200×630).
const BACKGROUNDS = [
  {
    slug: 'ts-piot',
    prompt:
      'Dark abstract digital background, deep navy and dark blue tones, ' +
      'subtle glowing circuit-board lines and grid, very low contrast texture, ' +
      'photorealistic, 16:9, no text, no people, dark moody atmosphere, ' +
      'suitable as an overlay background for white typography',
  },
  {
    slug: 'markirovka',
    prompt:
      'Dark abstract background, very deep green and teal tones, ' +
      'subtle organic texture resembling QR code fragments or data matrix patterns, ' +
      'low contrast, photorealistic, 16:9, no text, no people, ' +
      'suitable as an overlay background for white typography',
  },
  {
    slug: 'zakonodatelstvo',
    prompt:
      'Dark abstract background, deep charcoal with very subtle warm amber and gold tones, ' +
      'texture resembling dark marble or aged paper with faint geometric lines, ' +
      'low contrast, photorealistic, 16:9, no text, no people, ' +
      'suitable as an overlay background for white typography',
  },
];

async function generateImage(prompt, outputPath) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `imagen-3.0-generate-002:predict?key=${API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '16:9',
        outputOptions: { mimeType: 'image/png' },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Нет данных в ответе: ' + JSON.stringify(data));

  fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
}

for (const bg of BACKGROUNDS) {
  const outPath = path.join(OUT_DIR, `${bg.slug}.png`);
  process.stdout.write(`Генерирую ${bg.slug}... `);
  try {
    await generateImage(bg.prompt, outPath);
    console.log(`✓ ${outPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово. Фоны лежат в public/og-backgrounds/, OG-картинки доступны по /og/<slug>.png.');
