/**
 * Серия 2: яркие, светлые, иллюстративные стили карточек.
 * Запуск: node scripts/explore-og-styles-v2.mjs
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

const W = 1200, H = 630;
const fontsDir = path.join(ROOT, 'public/fonts');
const FONTS = [
  { name: 'InterCyr',    data: fs.readFileSync(path.join(fontsDir, 'inter-regular.woff')),          weight: 400, style: 'normal' },
  { name: 'InterCyr',    data: fs.readFileSync(path.join(fontsDir, 'inter-bold.woff')),              weight: 700, style: 'normal' },
  { name: 'InterLat',    data: fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff')),     weight: 400, style: 'normal' },
  { name: 'InterLat',    data: fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff')),        weight: 700, style: 'normal' },
  { name: 'InterLatExt', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff')), weight: 400, style: 'normal' },
  { name: 'InterLatExt', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff')),    weight: 700, style: 'normal' },
];

const FONT  = "'InterCyr', 'InterLat', 'InterLatExt'";
const TITLE = 'ТС ПИоТ: что это такое и кому нужен программный модуль с 28 декабря 2025';
const CAT   = 'ТС ПИОТ';
const SITE  = 'Регламент.Бизнес';

function bgPng(svg) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: W } });
  return `data:image/png;base64,${r.render().asPng().toString('base64')}`;
}

async function render(markup) {
  const svg = await satori(html(markup), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg).render().asPng();
}

// ──────────────────────────────────────────────────────────────────────
const CARDS = [

  // A. SOLID BLUE — Tinkoff-стиль: насыщенный синий, текст слева, большой акцент
  {
    name: 'A-solid-blue',
    label: 'A · Solid Blue (Tinkoff-style)',
    async markup() {
      return `<div style="display:flex; width:100%; height:100%; background:#0066FF; font-family:${FONT};">
        <div style="display:flex; flex-direction:column; flex:1; padding:60px 72px; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; width:44px; height:44px; border-radius:8px; background:rgba(255,255,255,0.2);
              color:#fff; align-items:center; justify-content:center; font-size:16px; font-weight:700;">Р·Б</div>
            <div style="display:flex; font-size:20px; font-weight:600; color:rgba(255,255,255,0.7);">${SITE}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:24px;">
            <div style="display:flex; padding:6px 16px; background:rgba(255,255,255,0.2); border-radius:20px;
              font-size:18px; font-weight:700; color:#fff; letter-spacing:1.5px; align-self:flex-start;">${CAT}</div>
            <div style="display:flex; font-size:58px; font-weight:800; color:#fff; line-height:1.1; letter-spacing:-1px;">${TITLE}</div>
          </div>
          <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.45);">reglament-biznes.ru</div>
        </div>
        <div style="display:flex; width:320px; flex-shrink:0; align-items:center; justify-content:center;
          background:rgba(255,255,255,0.08);">
          <div style="display:flex; font-size:160px; opacity:0.15;">📋</div>
        </div>
      </div>`;
    },
  },

  // B. PASTEL + GEOMETRY — светлый лавандовый, Точка Банк-стиль
  {
    name: 'B-pastel-geometry',
    label: 'B · Pastel + Geometry (Tochka-style)',
    async markup() {
      const bg = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="#f0edff"/>
        <circle cx="950" cy="200" r="280" fill="#7c3aed" opacity="0.12"/>
        <circle cx="1050" cy="500" r="200" fill="#4f46e5" opacity="0.1"/>
        <circle cx="750" cy="350" r="350" fill="#8b5cf6" opacity="0.08"/>
        <rect x="820" y="80" width="300" height="300" rx="40" fill="#6d28d9" opacity="0.07" transform="rotate(20 970 230)"/>
      </svg>`);
      return `<div style="display:flex; width:100%; height:100%;
        background-image:url(${bg}); background-size:cover; font-family:${FONT};">
        <div style="display:flex; flex-direction:column; flex:1; padding:60px 72px; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; width:44px; height:44px; border-radius:8px; background:#7c3aed;
              color:#fff; align-items:center; justify-content:center; font-size:16px; font-weight:700;">Р·Б</div>
            <div style="display:flex; font-size:20px; font-weight:600; color:#6d28d9;">${SITE}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:20px;">
            <div style="display:flex; padding:6px 16px; background:#7c3aed; border-radius:20px;
              font-size:18px; font-weight:700; color:#fff; letter-spacing:1.5px; align-self:flex-start;">${CAT}</div>
            <div style="display:flex; font-size:54px; font-weight:800; color:#1e1b4b; line-height:1.1; letter-spacing:-1px;">${TITLE}</div>
          </div>
          <div style="display:flex; font-size:18px; color:#7c6fcd;">reglament-biznes.ru</div>
        </div>
      </div>`;
    },
  },

  // C. SPLIT — левая половина цветная, правая белая с большим декором
  {
    name: 'C-split',
    label: 'C · Color Split',
    async markup() {
      return `<div style="display:flex; width:100%; height:100%; background:#fff; font-family:${FONT};">
        <div style="display:flex; width:480px; flex-shrink:0; background:#0f172a; flex-direction:column;
          padding:56px 52px; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="display:flex; width:40px; height:40px; border-radius:8px; background:#3b82f6;
              color:#fff; align-items:center; justify-content:center; font-size:14px; font-weight:700;">Р·Б</div>
            <div style="display:flex; font-size:18px; font-weight:600; color:rgba(255,255,255,0.5);">${SITE}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; padding:5px 14px; background:#3b82f6; border-radius:16px;
              font-size:16px; font-weight:700; color:#fff; letter-spacing:1.5px; align-self:flex-start;">${CAT}</div>
            <div style="display:flex; font-size:36px; font-weight:800; color:#fff; line-height:1.2;">${TITLE}</div>
          </div>
          <div style="display:flex; font-size:16px; color:rgba(255,255,255,0.25);">reglament-biznes.ru</div>
        </div>
        <div style="display:flex; flex:1; align-items:center; justify-content:center; background:#f8fafc;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:24px; opacity:0.12;">
            <div style="display:flex; width:180px; height:180px; border:12px solid #0f172a; border-radius:24px;"></div>
            <div style="display:flex; width:120px; height:12px; background:#0f172a; border-radius:6px;"></div>
            <div style="display:flex; width:160px; height:12px; background:#0f172a; border-radius:6px;"></div>
            <div style="display:flex; width:100px; height:12px; background:#0f172a; border-radius:6px;"></div>
          </div>
        </div>
      </div>`;
    },
  },

  // D. GRADIENT VIVID — яркий диагональный градиент с абстрактными кругами
  {
    name: 'D-gradient-vivid',
    label: 'D · Vivid Gradient',
    async markup() {
      const bg = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e40af"/>
            <stop offset="50%" stop-color="#4338ca"/>
            <stop offset="100%" stop-color="#0369a1"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#g)"/>
        <circle cx="900" cy="100" r="300" fill="white" opacity="0.05"/>
        <circle cx="200" cy="600" r="250" fill="white" opacity="0.05"/>
        <circle cx="1100" cy="550" r="180" fill="white" opacity="0.07"/>
        <line x1="0" y1="420" x2="${W}" y2="420" stroke="white" stroke-width="1" opacity="0.1"/>
        <line x1="0" y1="210" x2="${W}" y2="210" stroke="white" stroke-width="1" opacity="0.07"/>
      </svg>`);
      return `<div style="display:flex; width:100%; height:100%;
        background-image:url(${bg}); background-size:cover; font-family:${FONT};">
        <div style="display:flex; flex-direction:column; width:100%; height:100%; padding:60px 72px; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; width:44px; height:44px; border-radius:10px; background:rgba(255,255,255,0.25);
              color:#fff; align-items:center; justify-content:center; font-size:16px; font-weight:700;">Р·Б</div>
            <div style="display:flex; font-size:20px; font-weight:600; color:rgba(255,255,255,0.75);">${SITE}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:22px; max-width:800px;">
            <div style="display:flex; padding:6px 18px; background:rgba(255,255,255,0.2); border-radius:20px;
              font-size:18px; font-weight:700; color:#fff; letter-spacing:1.5px; align-self:flex-start;">${CAT}</div>
            <div style="display:flex; font-size:58px; font-weight:800; color:#fff; line-height:1.1; letter-spacing:-1px;">${TITLE}</div>
          </div>
          <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.4);">reglament-biznes.ru · Для малого и среднего бизнеса</div>
        </div>
      </div>`;
    },
  },

  // E. LIGHT EDITORIAL — белый фон, жирный текст, цветная полоса сверху
  {
    name: 'E-light-editorial',
    label: 'E · Light Editorial',
    async markup() {
      return `<div style="display:flex; flex-direction:column; width:100%; height:100%; background:#ffffff; font-family:${FONT};">
        <div style="display:flex; height:12px; background:#2563eb; flex-shrink:0;"></div>
        <div style="display:flex; flex:1; padding:52px 72px; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="display:flex; width:40px; height:40px; border-radius:8px; background:#2563eb;
                color:#fff; align-items:center; justify-content:center; font-size:14px; font-weight:700;">Р·Б</div>
              <div style="display:flex; font-size:20px; font-weight:600; color:#94a3b8;">${SITE}</div>
            </div>
            <div style="display:flex; padding:6px 18px; background:#eff6ff; border-radius:20px;
              font-size:16px; font-weight:700; color:#2563eb; letter-spacing:1.5px;">${CAT}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; font-size:62px; font-weight:800; color:#0f172a; line-height:1.05; letter-spacing:-2px;">${TITLE}</div>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; font-size:18px; color:#94a3b8;">reglament-biznes.ru</div>
            <div style="display:flex; width:80px; height:4px; background:#2563eb; border-radius:2px;"></div>
          </div>
        </div>
      </div>`;
    },
  },

  // F. DARK + BIG ICON — тёмный, но с крупным SVG-значком справа как у Точки
  {
    name: 'F-dark-icon',
    label: 'F · Dark + Big Icon',
    async markup() {
      const bg = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="#0f172a"/>
        <circle cx="950" cy="315" r="260" fill="#1e3a5f" opacity="0.8"/>
        <circle cx="950" cy="315" r="180" fill="#1d4ed8" opacity="0.15"/>
      </svg>`);
      return `<div style="display:flex; width:100%; height:100%;
        background-image:url(${bg}); background-size:cover; font-family:${FONT};">
        <div style="display:flex; flex-direction:column; width:680px; flex-shrink:0; padding:60px 64px; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; width:44px; height:44px; border-radius:8px; background:#3b82f6;
              color:#fff; align-items:center; justify-content:center; font-size:16px; font-weight:700;">Р·Б</div>
            <div style="display:flex; font-size:20px; font-weight:600; color:rgba(255,255,255,0.5);">${SITE}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:22px;">
            <div style="display:flex; padding:6px 18px; background:#1d4ed8; border-radius:20px;
              font-size:18px; font-weight:700; color:#fff; letter-spacing:1.5px; align-self:flex-start;">${CAT}</div>
            <div style="display:flex; font-size:50px; font-weight:800; color:#fff; line-height:1.1; letter-spacing:-1px;">${TITLE}</div>
          </div>
          <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.25);">reglament-biznes.ru</div>
        </div>
        <div style="display:flex; flex:1; align-items:center; justify-content:center;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
            <div style="display:flex; width:160px; height:160px; border-radius:28px; background:rgba(59,130,246,0.2);
              border:3px solid rgba(59,130,246,0.4); align-items:center; justify-content:center;">
              <div style="display:flex; flex-direction:column; gap:10px; padding:24px;">
                <div style="display:flex; width:90px; height:10px; background:rgba(255,255,255,0.5); border-radius:4px;"></div>
                <div style="display:flex; width:70px; height:10px; background:rgba(59,130,246,0.8); border-radius:4px;"></div>
                <div style="display:flex; width:80px; height:10px; background:rgba(255,255,255,0.3); border-radius:4px;"></div>
                <div style="display:flex; width:60px; height:10px; background:rgba(255,255,255,0.2); border-radius:4px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    },
  },
];

for (const card of CARDS) {
  process.stdout.write(`${card.label}... `);
  try {
    const markup = await card.markup();
    const png    = await render(markup);
    const file   = path.join(OUT, `v2-${card.name}.png`);
    fs.writeFileSync(file, png);
    console.log(`✓`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log(`\nВсе варианты в ${OUT}`);
