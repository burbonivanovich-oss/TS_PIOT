/**
 * Сжимает PNG-фоны в JPEG (качество 80, 1200×630).
 * Результат: public/og-backgrounds/*.jpg
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../public/og-backgrounds');

for (const slug of ['ts-piot', 'markirovka', 'zakonodatelstvo']) {
  const src = path.join(DIR, `${slug}.png`);
  const dst = path.join(DIR, `${slug}.jpg`);
  const before = (fs.statSync(src).size / 1024).toFixed(0);
  await sharp(src)
    .resize(1200, 630, { fit: 'cover' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(dst);
  const after = (fs.statSync(dst).size / 1024).toFixed(0);
  console.log(`${slug}: ${before} KB PNG → ${after} KB JPEG`);
}
