import { writeFileSync } from 'fs';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const KEEP = new Set(['latin','latin-ext','cyrillic','cyrillic-ext']);
const url = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@500&display=swap";
const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();

// Разбиваем на блоки по комментарию-подмножеству
const parts = css.split(/\/\* ([a-z-]+) \*\//).slice(1); // [subset, block, subset, block, ...]
const slug = s => s.toLowerCase().replace(/\s+/g,'-');
let out = "/* Автогенерация (scripts) — self-host Google Fonts, подмножества latin+cyrillic. */\n";
let files = [];
for (let i=0;i<parts.length;i+=2){
  const subset = parts[i];
  const block = parts[i+1];
  if (!KEEP.has(subset)) continue;
  const fam = (block.match(/font-family:\s*'([^']+)'/)||[])[1];
  const wght = (block.match(/font-weight:\s*(\d+)/)||[])[1] || '400';
  const woff2 = (block.match(/url\((https:\/\/[^)]+\.woff2)\)/)||[])[1];
  const range = (block.match(/unicode-range:\s*([^;]+);/)||[])[1];
  if (!fam || !woff2) continue;
  const name = `${slug(fam)}-${wght}-${subset}.woff2`;
  files.push({ woff2, name });
  out += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wght};font-display:swap;src:url('/fonts/${name}') format('woff2');unicode-range:${range};}\n`;
}
// Скачиваем файлы
for (const f of files){
  const buf = Buffer.from(await (await fetch(f.woff2, { headers:{'User-Agent':UA} })).arrayBuffer());
  writeFileSync(`public/fonts/${f.name}`, buf);
}
writeFileSync('src/styles/fonts.css', out);
console.log(`Скачано файлов: ${files.length}`);
console.log(files.map(f=>f.name).join('\n'));
