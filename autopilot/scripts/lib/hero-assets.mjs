// Проверка локальных изображений без сети и без зависимости от сборщика.
// Проверяет путь, файл и метаданные; не оценивает смысл изображения.
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export function imageSize(bytes) {
  if (bytes.length < 24) throw new Error('файл слишком короткий');
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(8) !== 13 || bytes.length < 45 || bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND') throw new Error('повреждён контейнер PNG');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: 'png' };
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    if (bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('повреждён контейнер WebP');
    const type = bytes.toString('ascii', 12, 16);
    if (type === 'VP8X' && bytes.length >= 30) return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3), format: 'webp' };
    if (type === 'VP8 ' && bytes.length >= 30 && bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff, format: 'webp' };
    if (type === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) {
      const bits = bytes.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff), format: 'webp' };
    }
    throw new Error('неизвестные метаданные WebP');
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    if (bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new Error('нет конца JPEG');
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('повреждён маркер JPEG');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error('повреждён сегмент JPEG');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) throw new Error('повреждён размер JPEG');
        return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5), format: 'jpeg' };
      }
      offset += length;
    }
  }
  throw new Error('не найден размер поддерживаемого растрового изображения');
}

export function checkHeroAssets({ data, contentRoot }) {
  const failures = [];
  if (typeof data.heroImage !== 'string' || !data.heroImage.trim()) failures.push('нет heroImage');
  for (const field of ['heroImage', 'previewImage']) {
    if (data[field] === undefined && field === 'previewImage') continue;
    if (typeof data[field] !== 'string' || !data[field]) continue;
    try {
      const url = data[field];
      if (!url.startsWith('/') || url.startsWith('//') || /[?#%\\\x00]/.test(url) || url.split('/').some(part => part === '..' || part === '.')) throw new Error('нужен локальный путь /images/... без переходов и параметров');
      const publicRoot = realpathSync(path.join(contentRoot, 'public'));
      const file = realpathSync(path.join(publicRoot, url.slice(1)));
      if (!file.startsWith(publicRoot + path.sep)) throw new Error('изображение выходит за public');
      if (!statSync(file).isFile()) throw new Error('путь не является файлом');
      const size = imageSize(readFileSync(file));
      if (size.width < 1 || size.height < 1) throw new Error('нулевой размер изображения');
      const ext = path.extname(file).toLowerCase();
      if (!(size.format === 'jpeg' ? ['.jpg', '.jpeg'].includes(ext) : ext === '.' + size.format)) throw new Error('расширение не соответствует формату');
    } catch (error) { failures.push(`${field}: ${error.message}`); }
  }
  return { ok: failures.length === 0, detail: failures.length ? failures.join('; ') : 'локальные файлы обложки и превью найдены, метаданные корректны' };
}
