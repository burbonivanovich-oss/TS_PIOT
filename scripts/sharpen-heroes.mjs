/**
 * Постобработка hero-изображений: unsharp mask + апскейл до 2x.
 * Решает «мыльность» AI-генерации без перегенерации.
 *
 * Запуск: node scripts/sharpen-heroes.mjs
 * Опции:
 *   FILE=<slug>       — обработать только один файл
 *   DRY_RUN=1         — показать, что будет сделано, без записи
 *   BACKUP=1          — сохранить оригиналы в public/images/hero/_orig/
 *   NO_UPSCALE=1      — только sharpen, без апскейла (быстрее)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const HERO_DIR  = path.join(ROOT, 'public/images/hero');
const BACKUP_DIR = path.join(HERO_DIR, '_orig');

const ONLY      = process.env.FILE ?? '';
const DRY_RUN   = process.env.DRY_RUN === '1';
const BACKUP    = process.env.BACKUP === '1';
const NO_UP     = process.env.NO_UPSCALE === '1';

if (BACKUP && !DRY_RUN) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const files = fs.readdirSync(HERO_DIR)
  .filter(f => f.endsWith('.jpg'))
  .filter(f => !ONLY || f.startsWith(ONLY))
  .map(f => path.join(HERO_DIR, f));

if (files.length === 0) {
  console.log('Нет файлов для обработки.');
  process.exit(0);
}

console.log(`Файлов: ${files.length}${DRY_RUN ? ' (DRY RUN)' : ''}${NO_UP ? ' [no upscale]' : ' [2x upscale + sharpen]'}`);

for (const file of files) {
  const name = path.basename(file);
  try {
    const input = sharp(file);
    const meta  = await input.metadata();
    const targetW = NO_UP ? meta.width : meta.width * 2;
    const targetH = NO_UP ? meta.height : meta.height * 2;

    let pipeline = sharp(file);
    if (!NO_UP) {
      pipeline = pipeline.resize(targetW, targetH, {
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false,
      });
    }
    pipeline = pipeline
      // Unsharp mask: усиливаем границы и микроконтраст
      .sharpen({ sigma: 1.2, m1: 0.6, m2: 2.5, x1: 2, y2: 12, y3: 18 })
      // Лёгкая коррекция: чуть больше контраста
      .modulate({ saturation: 1.04 })
      .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' });

    if (DRY_RUN) {
      console.log(`  ${name}  ${meta.width}×${meta.height} → ${targetW}×${targetH}`);
      continue;
    }

    if (BACKUP) {
      const backupPath = path.join(BACKUP_DIR, name);
      if (!fs.existsSync(backupPath)) fs.copyFileSync(file, backupPath);
    }

    const tmp = file + '.tmp';
    await pipeline.toFile(tmp);
    const oldSize = fs.statSync(file).size;
    const newSize = fs.statSync(tmp).size;
    fs.renameSync(tmp, file);

    const pct = ((newSize - oldSize) / oldSize * 100).toFixed(0);
    console.log(`✓ ${name}  ${meta.width}×${meta.height} → ${targetW}×${targetH}  ${(oldSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (${pct > 0 ? '+' : ''}${pct}%)`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
  }
}

console.log('\nГотово.');
