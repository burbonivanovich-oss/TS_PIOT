/**
 * Генерирует фоновые изображения для OG-картинок через Pollinations.ai.
 * Бесплатно, без ключа. Запуск: node scripts/generate-og-backgrounds-free.mjs
 * Результат: public/og-backgrounds/*.png
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = './public/og-backgrounds';
fs.mkdirSync(OUT_DIR, { recursive: true });

const BACKGROUNDS = [
  {
    slug: 'ts-piot',
    prompt:
      'Dark abstract digital background, deep navy and dark blue tones, ' +
      'subtle glowing circuit-board lines and grid, very low contrast texture, ' +
      'photorealistic, 16:9 aspect ratio, no text, no people, no logos, ' +
      'dark moody atmosphere, suitable as overlay background for white typography',
    seed: 42,
  },
  {
    slug: 'markirovka',
    prompt:
      'Dark abstract background, very deep green and teal tones, ' +
      'subtle organic texture resembling QR code fragments or data matrix patterns, ' +
      'low contrast, photorealistic, 16:9 aspect ratio, no text, no people, no logos, ' +
      'suitable as overlay background for white typography',
    seed: 137,
  },
  {
    slug: 'zakonodatelstvo',
    prompt:
      'Dark abstract background, deep charcoal with very subtle warm amber and gold tones, ' +
      'texture resembling dark marble or aged paper with faint geometric lines, ' +
      'low contrast, photorealistic, 16:9 aspect ratio, no text, no people, no logos, ' +
      'suitable as overlay background for white typography',
    seed: 256,
  },
];

async function generateImage(prompt, seed, outputPath) {
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&seed=${seed}&model=flux&nologo=true`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'reglament-biznes-og-generator/1.0' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

for (const bg of BACKGROUNDS) {
  const outPath = path.join(OUT_DIR, `${bg.slug}.png`);
  process.stdout.write(`Генерирую ${bg.slug}... `);
  try {
    await generateImage(bg.prompt, bg.seed, outPath);
    const size = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`✓ ${outPath} (${size} KB)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово. Файлы в public/og-backgrounds/');
