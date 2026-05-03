/**
 * Генерирует 6 вариантов стилей OG-фонов для выбора направления.
 * Запуск: node scripts/explore-og-styles.mjs
 * Результат: scripts/og-previews/style-*.png
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
  { name: 'InterCyr', data: fs.readFileSync(path.join(fontsDir, 'inter-regular.woff')),     weight: 400, style: 'normal' },
  { name: 'InterCyr', data: fs.readFileSync(path.join(fontsDir, 'inter-bold.woff')),         weight: 700, style: 'normal' },
  { name: 'InterLat', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff')),weight: 400, style: 'normal' },
  { name: 'InterLat', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff')),   weight: 700, style: 'normal' },
  { name: 'InterLatExt', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff')), weight: 400, style: 'normal' },
  { name: 'InterLatExt', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff')),    weight: 700, style: 'normal' },
];

const TITLE   = 'ТС ПИоТ: что это такое и кому нужен программный модуль с 28 декабря 2025';
const CAT     = 'ТС ПИОТ';
const FONT    = "'InterCyr', 'InterLat', 'InterLatExt'";
const SITE    = 'Этикетка';

// ─────────────────────────────────────────────────────────────────
// SVG-фоны: 6 стилей
// ─────────────────────────────────────────────────────────────────

const STYLES = [

  // 1. MIDNIGHT GRADIENT — чистый тёмный градиент, минимализм
  {
    name: '1-midnight-gradient',
    label: 'Midnight Gradient',
    accent: '#6366f1',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f0c29"/>
          <stop offset="50%" stop-color="#302b63"/>
          <stop offset="100%" stop-color="#0f0c29"/>
        </linearGradient>
        <radialGradient id="r" cx="70%" cy="30%" r="50%">
          <stop offset="0%" stop-color="#6366f1" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#r)"/>
    </svg>`,
  },

  // 2. NOISE FILM — тёмный + зернистость как плёнка
  {
    name: '2-noise-film',
    label: 'Noise Film',
    accent: '#3b82f6',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" seed="9" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feBlend in="SourceGraphic" mode="overlay" result="b"/>
          <feComposite in="b" in2="SourceGraphic" operator="in"/>
        </filter>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#070b14"/>
          <stop offset="100%" stop-color="#0d1424"/>
        </linearGradient>
        <radialGradient id="spot1" cx="20%" cy="80%" r="45%">
          <stop offset="0%" stop-color="#1e3a8a" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="spot2" cx="85%" cy="25%" r="40%">
          <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#spot1)"/>
      <rect width="${W}" height="${H}" fill="url(#spot2)"/>
      <rect width="${W}" height="${H}" fill="#3b82f6" opacity="0.06" filter="url(#grain)"/>
    </svg>`,
  },

  // 3. MESH GRADIENT — мягкие цветовые пятна (как в Figma)
  {
    name: '3-mesh-gradient',
    label: 'Mesh Gradient',
    accent: '#8b5cf6',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <radialGradient id="m1" cx="15%" cy="85%" r="55%">
          <stop offset="0%" stop-color="#4c1d95" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="m2" cx="80%" cy="20%" r="55%">
          <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="m3" cx="50%" cy="50%" r="40%">
          <stop offset="0%" stop-color="#312e81" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="m4" cx="90%" cy="80%" r="40%">
          <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="#080612"/>
      <rect width="${W}" height="${H}" fill="url(#m1)"/>
      <rect width="${W}" height="${H}" fill="url(#m2)"/>
      <rect width="${W}" height="${H}" fill="url(#m3)"/>
      <rect width="${W}" height="${H}" fill="url(#m4)"/>
    </svg>`,
  },

  // 4. TOPOGRAPHIC — контурные линии как карта высот
  {
    name: '4-topographic',
    label: 'Topographic',
    accent: '#10b981',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <filter id="topo">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.008" numOctaves="3" seed="42"/>
          <feColorMatrix type="matrix"
            values="0 0 0 0 0.02
                    0 0 0 0 0.08
                    0 0 0 0 0.04
                    0 0 0 20 -8"/>
        </filter>
        <linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#020c06"/>
          <stop offset="100%" stop-color="#041408"/>
        </linearGradient>
        <radialGradient id="tglow" cx="35%" cy="60%" r="50%">
          <stop offset="0%" stop-color="#065f46" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#tbg)"/>
      <rect width="${W}" height="${H}" fill="url(#tglow)"/>
      <rect width="${W}" height="${H}" fill="#10b981" opacity="0.2" filter="url(#topo)"/>
    </svg>`,
  },

  // 5. AURORA — северное сияние, волновые переливы
  {
    name: '5-aurora',
    label: 'Aurora',
    accent: '#06b6d4',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <filter id="aurora">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.004" numOctaves="2" seed="17"/>
          <feColorMatrix type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0.15
                    0 0 0 0 0.2
                    0 0 0 8 -2"/>
        </filter>
        <linearGradient id="abg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#020d14"/>
          <stop offset="100%" stop-color="#050f18"/>
        </linearGradient>
        <radialGradient id="ag1" cx="30%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#0e7490" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="ag2" cx="70%" cy="60%" r="50%">
          <stop offset="0%" stop-color="#164e63" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="ag3" cx="55%" cy="20%" r="40%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#abg)"/>
      <rect width="${W}" height="${H}" fill="url(#ag1)"/>
      <rect width="${W}" height="${H}" fill="url(#ag2)"/>
      <rect width="${W}" height="${H}" fill="url(#ag3)"/>
      <rect width="${W}" height="${H}" fill="#06b6d4" opacity="0.12" filter="url(#aurora)"/>
    </svg>`,
  },

  // 6. EMBER — тёмное с янтарно-бронзовым, теплее
  {
    name: '6-ember',
    label: 'Ember',
    accent: '#f59e0b',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <filter id="emb">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.015" numOctaves="3" seed="55"/>
          <feColorMatrix type="matrix"
            values="0.15 0 0 0 0.05
                    0.05 0 0 0 0.02
                    0    0 0 0 0
                    0    0 0 6  -2"/>
        </filter>
        <linearGradient id="ebg" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0d0a04"/>
          <stop offset="100%" stop-color="#130e06"/>
        </linearGradient>
        <radialGradient id="eg1" cx="75%" cy="30%" r="55%">
          <stop offset="0%" stop-color="#78350f" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="eg2" cx="15%" cy="75%" r="45%">
          <stop offset="0%" stop-color="#92400e" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="eg3" cx="50%" cy="50%" r="30%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#ebg)"/>
      <rect width="${W}" height="${H}" fill="url(#eg1)"/>
      <rect width="${W}" height="${H}" fill="url(#eg2)"/>
      <rect width="${W}" height="${H}" fill="url(#eg3)"/>
      <rect width="${W}" height="${H}" fill="#b45309" opacity="0.15" filter="url(#emb)"/>
    </svg>`,
  },
];

// ─────────────────────────────────────────────────────────────────
// Рендер OG-карточки с фоном
// ─────────────────────────────────────────────────────────────────
function bgToDataUri(svg) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: W } });
  const buf = resvg.render().asPng();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function renderCard(style) {
  const bgUri  = bgToDataUri(style.svg);
  const accent = style.accent;
  const markup = `
    <div style="display:flex; width:100%; height:100%;
      background-image:url(${bgUri}); background-size:cover; font-family:${FONT};">
      <div style="display:flex; flex-direction:row; width:100%; height:100%; background:rgba(0,0,0,0.55);">
        <div style="display:flex; width:8px; background:${accent}; flex-shrink:0;"></div>
        <div style="display:flex; flex-direction:column; flex:1; padding:56px 64px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; width:52px; height:52px; border-radius:10px; background:${accent};
              color:#fff; align-items:center; justify-content:center; font-size:18px; font-weight:700;">Р·Б</div>
            <div style="display:flex; font-size:22px; font-weight:700; color:rgba(255,255,255,0.5);">${SITE}</div>
          </div>
          <div style="display:flex; flex-direction:column; flex:1; justify-content:center; padding:28px 0 20px;">
            <div style="display:flex; padding:6px 18px; background:${accent}22; color:${accent};
              border:1px solid ${accent}44; border-radius:4px; font-size:20px; font-weight:700;
              letter-spacing:2px; margin-bottom:24px; align-self:flex-start;">${CAT}</div>
            <div style="display:flex; font-size:52px; font-weight:700; color:#fff; line-height:1.15;">${TITLE}</div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; font-size:20px; color:rgba(255,255,255,0.25);">
            <div style="display:flex;">reglament-biznes.ru</div>
            <div style="display:flex; width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,0.2);"></div>
            <div style="display:flex;">Для малого и среднего бизнеса</div>
          </div>
        </div>
      </div>
    </div>`;

  const svg = await satori(html(markup), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg).render().asPng();
}

// ─────────────────────────────────────────────────────────────────
// Запуск
// ─────────────────────────────────────────────────────────────────
for (const style of STYLES) {
  process.stdout.write(`${style.label}... `);
  try {
    const png  = await renderCard(style);
    const file = path.join(OUT, `style-${style.name}.png`);
    fs.writeFileSync(file, png);
    console.log(`✓ style-${style.name}.png`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log(`\nВсе варианты в ${OUT}`);
