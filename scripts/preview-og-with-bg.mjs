/**
 * Рендерит тестовые OG-карточки с AI-фонами.
 * Запуск: node scripts/preview-og-with-bg.mjs
 * Результат: scripts/og-previews/with-bg-*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { html } from 'satori-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'og-previews');
fs.mkdirSync(OUT_DIR, { recursive: true });

const fontsDir = path.join(ROOT, 'public/fonts');
const fontCyrRegular = fs.readFileSync(path.join(fontsDir, 'inter-regular.woff'));
const fontCyrBold = fs.readFileSync(path.join(fontsDir, 'inter-bold.woff'));
const fontLatRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff'));
const fontLatBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff'));
const fontLatExtRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff'));
const fontLatExtBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff'));

const CAT_ACCENT = {
  'ts-piot':        '#3b82f6',
  'markirovka':     '#10b981',
  'zakonodatelstvo':'#f59e0b',
};
const CATEGORIES = {
  'ts-piot':        'ТС ПИоТ',
  'markirovka':     'Маркировка',
  'zakonodatelstvo':'Законодательство',
};

function loadBg(cat) {
  for (const [ext, mime] of [['jpg', 'image/jpeg'], ['png', 'image/png']]) {
    const p = path.join(ROOT, `public/og-backgrounds/${cat}.${ext}`);
    if (fs.existsSync(p)) return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
  }
  return null;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const TESTS = [
  { cat: 'ts-piot', title: 'ТС ПИоТ: что это такое и кому нужен программный модуль с 28 декабря 2025 года' },
  { cat: 'markirovka', title: 'Маркировка молочной продукции: сроки, требования и штрафы для производителей' },
  { cat: 'zakonodatelstvo', title: 'Изменения в налоговом законодательстве для МСБ в 2026 году: ЕНС, ЕНП и новые ставки' },
  { cat: 'ts-piot', title: 'Как подключить ТС ПИоТ к онлайн-кассе: пошаговая инструкция' },
];

const fontStack = "'InterCyr', 'InterLat', 'InterLatExt'";
const SITE_TITLE = 'Этикетка';

for (const test of TESTS) {
  const { cat, title } = test;
  const accent = CAT_ACCENT[cat];
  const catLabel = CATEGORIES[cat].toUpperCase();
  const bgDataUri = loadBg(cat);

  const titleLen = title.length;
  const titleSize = titleLen > 80 ? 48 : titleLen > 55 ? 56 : 64;

  const catTag = `<div style="display:flex; padding:6px 18px; background:${accent}22; color:${accent}; border:1px solid ${accent}44; border-radius:4px; font-size:20px; font-weight:700; letter-spacing:2px; margin-bottom:28px; align-self:flex-start;">${escapeHtml(catLabel)}</div>`;

  const outerBg = bgDataUri
    ? `background-image:url(${bgDataUri}); background-size:cover; background-position:center;`
    : `background:#0d0d0d;`;
  const overlayBg = bgDataUri ? `background:rgba(0,0,0,0.60);` : '';

  const markupString = `
    <div style="display:flex; width:100%; height:100%; ${outerBg} font-family:${fontStack};">
      <div style="display:flex; flex-direction:row; width:100%; height:100%; ${overlayBg}">
        <div style="display:flex; width:8px; background:${accent}; flex-shrink:0;"></div>
        <div style="display:flex; flex-direction:column; flex:1; padding:56px 64px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; width:52px; height:52px; border-radius:10px; background:${accent}; color:#fff; align-items:center; justify-content:center; font-size:20px; font-weight:700; letter-spacing:-0.5px;">Р·Б</div>
            <div style="display:flex; font-size:22px; font-weight:700; color:rgba(255,255,255,0.5); letter-spacing:0.5px;">${escapeHtml(SITE_TITLE)}</div>
          </div>
          <div style="display:flex; flex-direction:column; flex:1; justify-content:center; padding:32px 0 24px;">
            ${catTag}
            <div style="display:flex; font-size:${titleSize}px; font-weight:700; color:#ffffff; line-height:1.15; letter-spacing:-0.5px;">${escapeHtml(title)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; font-size:20px; color:rgba(255,255,255,0.25);">
            <div style="display:flex;">reglament-biznes.ru</div>
            <div style="display:flex; width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,0.2);"></div>
            <div style="display:flex;">Для малого и среднего бизнеса</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const markup = html(markupString);
  const svg = await satori(markup, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'InterCyr', data: fontCyrRegular, weight: 400, style: 'normal' },
      { name: 'InterCyr', data: fontCyrBold, weight: 700, style: 'normal' },
      { name: 'InterLat', data: fontLatRegular, weight: 400, style: 'normal' },
      { name: 'InterLat', data: fontLatBold, weight: 700, style: 'normal' },
      { name: 'InterLatExt', data: fontLatExtRegular, weight: 400, style: 'normal' },
      { name: 'InterLatExt', data: fontLatExtBold, weight: 700, style: 'normal' },
    ],
  });

  const png = new Resvg(svg).render().asPng();
  const outFile = path.join(OUT_DIR, `with-bg-${cat}-${TESTS.indexOf(test)}.png`);
  fs.writeFileSync(outFile, png);
  const size = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`✓ ${path.basename(outFile)} (${size} KB)`);
}

console.log(`\nПревью в ${OUT_DIR}`);
