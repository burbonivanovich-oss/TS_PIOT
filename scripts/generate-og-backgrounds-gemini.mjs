/**
 * Генерирует OG-фоны через Gemini image-модели.
 * Поддерживает:
 *   - imagen-4.0-generate-001        (predict API, платный)
 *   - gemini-2.5-flash-image         (generateContent API, платный)
 *
 * Запуск: GEMINI_MODEL=gemini-2.5-flash-image node scripts/generate-og-backgrounds-gemini.mjs
 * По умолчанию: imagen-4.0-generate-001
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/og-backgrounds');
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('GEMINI_API_KEY не задан'); process.exit(1); }

const MODEL = process.env.GEMINI_MODEL ?? 'imagen-4.0-generate-001';
console.log(`Модель: ${MODEL}`);

const BACKGROUNDS = [
  {
    slug: 'ts-piot',
    prompt:
      'Dark abstract digital background, deep navy and dark blue tones, ' +
      'subtle glowing circuit-board lines and grid, very low contrast texture, ' +
      'photorealistic, 16:9, no text, no people, no logos, dark moody atmosphere, ' +
      'suitable as overlay background for white typography',
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

// Imagen 4 — predict API
async function generateImagen(prompt, outputPath) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9', outputOptions: { mimeType: 'image/jpeg' } },
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Нет данных: ' + JSON.stringify(data));
  fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
}

// Gemini Flash Image — generateContent API
async function generateFlashImage(prompt, outputPath) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) throw new Error('Нет изображения в ответе: ' + JSON.stringify(data).slice(0, 200));
  const { mimeType, data: b64 } = part.inlineData;
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const finalPath = outputPath.replace(/\.\w+$/, `.${ext}`);
  fs.writeFileSync(finalPath, Buffer.from(b64, 'base64'));
  return finalPath;
}

const isFlash = MODEL.startsWith('gemini-');

for (const bg of BACKGROUNDS) {
  const outPath = path.join(OUT_DIR, `${bg.slug}.jpg`);
  process.stdout.write(`Генерирую ${bg.slug}... `);
  try {
    const saved = isFlash
      ? await generateFlashImage(bg.prompt, outPath)
      : (await generateImagen(bg.prompt, outPath), outPath);
    const size = (fs.statSync(saved).size / 1024).toFixed(0);
    console.log(`✓ ${saved} (${size} KB)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}

console.log('\nГотово.');
