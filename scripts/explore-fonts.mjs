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
    name: 'Geologica',
    slug: 'geologica',
    pkg: 'geologica',
    note: 'Variable font. Индивидуальный характер. ← текущий выбор',
    regular: 'geologica-cyrillic-400-normal.woff',
    bold:    'geologica-cyrillic-700-normal.woff',
  },
  {
    name: 'Unbounded',
    slug: 'unbounded',
    pkg: 'unbounded',
    note: 'Широкий, технологичный. Современный российский дизайн.',
    regular: 'unbounded-cyrillic-400-normal.woff',
    bold:    'unbounded-cyrillic-700-normal.woff',
  },
  {
    name: 'Playfair Display',
    slug: 'playfair-display',
    pkg: 'playfair-display',
    note: 'Редакционный serif. The Bell, качественные издания.',
    regular: 'playfair-display-cyrillic-400-normal.woff',
    bold:    'playfair-display-cyrillic-700-normal.woff',
  },
  {
    name: 'Montserrat',
    slug: 'montserrat',
    pkg: 'montserrat',
    note: 'Сильный геометрик. Классика современного дизайна.',
    regular: 'montserrat-cyrillic-400-normal.woff',
    bold:    'montserrat-cyrillic-700-normal.woff',
  },
  {
    name: 'Lora',
    slug: 'lora',
    pkg: 'lora',
    note: 'Тёплый serif. Журнальное ощущение, держит длинный текст.',
    regular: 'lora-cyrillic-400-normal.woff',
    bold:    'lora-cyrillic-700-normal.woff',
  },
];

const HEADING = 'ТС ПИоТ: что это и кому нужен программный модуль';
const BODY    = 'С 28 декабря 2025 года все розничные продавцы маркированных товаров обязаны подключить ТС ПИоТ к онлайн-кассе. Без этого модуля касса не сможет проверить подлинность товара в «Честном знаке» и откажет в продаже.';
const META    = 'ТС ПИОТ  ·  15 января 2026  ·  reglament-biznes.ru';

async function renderCard(font) {
  const fonts = [
    { name: font.name, data: loadFont(font.pkg, font.regular, 400), weight: 400, style: 'normal' },
    { name: font.name, data: loadFont(font.pkg, font.bold,    700), weight: 700, style: 'normal' },
    // латиница — fallback из Inter
    { name: 'Inter', data: fs.readFileSync(path.join(ROOT, 'public/fonts/inter-latin-regular.woff')), weight: 400, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(ROOT, 'public/fonts/inter-latin-bold.woff')),    weight: 700, style: 'normal' },
  ];

  const markup = `
    <div style="display:flex; flex-direction:column; width:${W}px; height:${H}px;
      background:#fff; font-family:'${font.name}', 'Inter';">

      <!-- шапка с названием шрифта -->
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

      <!-- контент карточки -->
      <div style="display:flex; flex:1; flex-direction:column; padding:36px 40px 32px;">

        <!-- категория-тег -->
        <div style="display:flex; margin-bottom:16px;">
          <div style="display:flex; padding:4px 14px; background:#dbeafe; color:#1d4ed8;
            border-radius:999px; font-size:13px; font-weight:700; letter-spacing:0.03em;">
            ТС ПИОТ
          </div>
        </div>

        <!-- заголовок -->
        <div style="display:flex; font-size:28px; font-weight:700; color:#0f172a;
          line-height:1.25; margin-bottom:20px;">${HEADING}</div>

        <!-- тело текста -->
        <div style="display:flex; font-size:16px; font-weight:400; color:#1e293b;
          line-height:1.65; flex:1;">${BODY}</div>

        <!-- мета -->
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
