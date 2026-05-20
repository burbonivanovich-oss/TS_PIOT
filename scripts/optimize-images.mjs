#!/usr/bin/env node
// Конвертирует изображения public/images/{hero,flagship,preview}/ в WebP.
// Оригиналы оставляем — шаблоны рендерят <picture> с WebP source и
// jpg/png fallback. Это даёт ~50–65% экономии веса при том же
// визуальном качестве.
//
// Окружение:
//   FORCE=1 — перезаписать существующие .webp
//   QUALITY=80 — quality для cwebp (по умолчанию 80, разумный
//     компромисс между качеством и весом)
//   DIRS — список папок через запятую от public/, по умолчанию
//     "hero,flagship,preview"
//
// Использование:
//   node scripts/optimize-images.mjs
//   FORCE=1 QUALITY=82 node scripts/optimize-images.mjs

import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const FORCE = process.env.FORCE === '1';
const QUALITY = parseInt(process.env.QUALITY || '80', 10);
const DIRS = (process.env.DIRS || 'hero,flagship,preview').split(',').map(s => s.trim()).filter(Boolean);

const EXTENSIONS = ['.jpg', '.jpeg', '.png'];

console.log(`Оптимизация изображений → WebP`);
console.log(`Quality: ${QUALITY}, FORCE: ${FORCE ? 'да' : 'нет'}`);
console.log(`Папки: ${DIRS.join(', ')}\n`);

let processed = 0;
let skipped = 0;
let failed = 0;
let totalSrcBytes = 0;
let totalDstBytes = 0;

for (const dir of DIRS) {
  const fullDir = join(IMG_DIR, dir);
  if (!existsSync(fullDir)) {
    console.warn(`Пропускаю ${dir}: папка не существует`);
    continue;
  }

  const files = readdirSync(fullDir).filter(f => EXTENSIONS.includes(extname(f).toLowerCase()));
  if (files.length === 0) {
    console.log(`${dir}: пусто`);
    continue;
  }

  console.log(`${dir} (${files.length} файлов):`);

  for (const file of files) {
    const srcPath = join(fullDir, file);
    const dstPath = join(fullDir, basename(file, extname(file)) + '.webp');

    const srcStat = statSync(srcPath);
    totalSrcBytes += srcStat.size;

    if (!FORCE && existsSync(dstPath)) {
      const dstStat = statSync(dstPath);
      if (dstStat.mtimeMs >= srcStat.mtimeMs) {
        totalDstBytes += dstStat.size;
        skipped++;
        continue;
      }
    }

    try {
      const buffer = readFileSync(srcPath);
      const webp = await sharp(buffer).webp({ quality: QUALITY, effort: 4 }).toBuffer();
      writeFileSync(dstPath, webp);
      totalDstBytes += webp.length;
      const pct = ((1 - webp.length / srcStat.size) * 100).toFixed(0);
      console.log(`  ✓ ${file} (${(srcStat.size / 1024).toFixed(0)} KB → ${(webp.length / 1024).toFixed(0)} KB · −${pct}%)`);
      processed++;
    } catch (err) {
      console.log(`  ✗ ${file}: ${err.message}`);
      failed++;
    }
  }
}

const totalSrcMb = (totalSrcBytes / 1024 / 1024).toFixed(1);
const totalDstMb = (totalDstBytes / 1024 / 1024).toFixed(1);
const savings = totalSrcBytes > 0 ? ((1 - totalDstBytes / totalSrcBytes) * 100).toFixed(0) : 0;
console.log(`\nИтого: обработано ${processed}, пропущено ${skipped}, ошибок ${failed}.`);
console.log(`Размер: оригиналы ${totalSrcMb} MB → WebP ${totalDstMb} MB (−${savings}%)`);

if (failed > 0) process.exit(1);
