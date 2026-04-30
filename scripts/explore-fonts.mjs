/**
 * Генерирует сравнительные превью 4 шрифтов для выбора.
 * Запуск: node scripts/explore-fonts.mjs
 * Результат: scripts/og-previews/font-*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { html } from 'satori-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(__dirname, 'og-previews');
fs.mkdirSync(OUT, { recursive: true });

const W = 900, H = 540;

function loadFont(pkg, file, weight) {
  return fs.readFileSync(
    path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file)
  );
}

const FONTS_DEF = [
  {
    name: 'Raleway + Geologica',
    slug: 'pair-raleway-geologica',
    headingPkg: 'raleway',
    headingName: 'Raleway',
    headingR: 'raleway-cyrillic-400-normal.woff',
    headingB: 'raleway-cyrillic-700-normal.woff',
    bodyPkg: 'geologica',
    bodyName: 'Geologica',
    bodyR: 'geologica-cyrillic-400-normal.woff',
    bodyB: 'geologica-cyrillic-700-normal.woff',
    note: 'Raleway — заголовки / Geologica — тело',
  },
  // для сравнения — монофонтовые варианты
  {
    name: 'Raleway (везде)',
    slug: 'pair-raleway-only',
    headingPkg: 'raleway',
    headingName: 'Raleway',
    headingR: 'raleway-cyrillic-400-normal.woff',
    headingB: 'raleway-cyrillic-700-normal.woff',
    bodyPkg: 'raleway',
    bodyName: 'Raleway',
    bodyR: 'raleway-cyrillic-400-normal.woff',
    bodyB: 'raleway-cyrillic-700-normal.woff',
    note: 'Raleway везде — для сравнения',
  },
  {
    name: 'Geologica (везде)',
    slug: 'pair-geologica-only',
    headingPkg: 'geologica',
    headingName: 'Geologica',
    headingR: 'geologica-cyrillic-400-normal.woff',
    headingB: 'geologica-cyrillic-700-normal.woff',
    bodyPkg: 'geologica',
    bodyName: 'Geologica',
    bodyR: 'geologica-cyrillic-400-normal.woff',
    bodyB: 'geologica-cyrillic-700-normal.woff',
    note: 'Geologica везде — для сравнения',
  },
];

const HEADING = 'ТС ПИоТ: что это и кому нужен программный модуль';
const BODY    = 'С 28 декабря 2025 года все розничные продавцы маркированных товаров обязаны подключить ТС ПИоТ к онлайн-кассе. Без этого модуля касса не сможет проверить подлинность товара в «Честном знаке» и откажет в продаже.';
const META    = 'ТС ПИОТ  ·  15 января 2026  ·  reglament-biznes.ru';

async function renderCard(font) {
  const fonts = [
    { name: font.headingName, data: loadFont(font.headingPkg, font.headingR), weight: 400, style: 'normal' },
    { name: font.headingName, data: loadFont(font.headingPkg, font.headingB), weight: 700, style: 'normal' },
    { name: font.bodyName,    data: loadFont(font.bodyPkg,    font.bodyR),    weight: 400, style: 'normal' },
    { name: font.bodyName,    data: loadFont(font.bodyPkg,    font.bodyB),    weight: 700, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(ROOT, 'public/fonts/inter-latin-regular.woff')), weight: 400, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(ROOT, 'public/fonts/inter-latin-bold.woff')),    weight: 700, style: 'normal' },
  ];

  const markup = `
    <div style="display:flex; flex-direction:column; width:${W}px; height:${H}px;
      background:#fff; font-family:'${font.bodyName}', 'Inter';">

      <!-- шапка -->
      <div style="display:flex; align-items:center; justify-content:space-between;
        padding:18px 32px; border-bottom:1px solid #e2e8f0; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="display:flex; width:36px; height:36px; border-radius:7px;
            background:linear-gradient(135deg,#1d4ed8,#0ea5e9); align-items:center;
            justify-content:center; font-size:13px; font-weight:700; color:#fff;
            font-family:'Inter';">Р·Б</div>
          <div style="display:flex; font-size:15px; font-weight:700; color:#0f172a;
            font-family:'Inter';">${font.name}</div>
        </div>
        <div style="display:flex; font-size:13px; color:#94a3b8; font-family:'Inter';">${font.note}</div>
      </div>

      <!-- контент -->
      <div style="display:flex; flex:1; flex-direction:column; padding:36px 40px 32px;">
        <div style="display:flex; margin-bottom:16px;">
          <div style="display:flex; padding:4px 14px; background:#dbeafe; color:#1d4ed8;
            border-radius:999px; font-size:13px; font-weight:700; letter-spacing:0.03em;
            font-family:'${font.bodyName}', 'Inter';">ТС ПИОТ</div>
        </div>

        <!-- заголовок — шрифт заголовка -->
        <div style="display:flex; font-size:28px; font-weight:700; color:#0f172a;
          line-height:1.25; margin-bottom:20px;
          font-family:'${font.headingName}', 'Inter';">${HEADING}</div>

        <!-- тело — шрифт тела -->
        <div style="display:flex; font-size:16px; font-weight:400; color:#1e293b;
          line-height:1.65; flex:1;
          font-family:'${font.bodyName}', 'Inter';">${BODY}</div>

        <div style="display:flex; font-size:13px; color:#94a3b8; margin-top:20px;
          font-family:'Inter';">${META}</div>
      </div>
    </div>`;

  const svg = await satori(html(markup), { width: W, height: H, fonts });
  return new Resvg(svg).render().asPng();
}

for (const font of FONTS_DEF) {
  process.stdout.write(`${font.name}... `);
  try {
    const png  = await renderCard(font);
    const file = path.join(OUT, `font-${font.slug}.png`);
    fs.writeFileSync(file, png);
    console.log(`✓ font-${font.slug}.png`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log(`\nГотово: ${OUT}`);
