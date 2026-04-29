/**
 * Генерирует фоновые PNG-текстуры для OG-картинок с помощью SVG-фильтров + Resvg.
 * Не требует API-ключей или интернета.
 * Запуск: node scripts/generate-og-backgrounds-local.mjs
 * Результат: public/og-backgrounds/*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/og-backgrounds');
fs.mkdirSync(OUT_DIR, { recursive: true });

const W = 1200;
const H = 630;

// ts-piot: тёмно-синяя тема с цифровыми схемами
const svgTsPiot = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="noise" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.65 0.75" numOctaves="4" seed="12" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
      <feBlend in="SourceGraphic" in2="gray" mode="overlay" result="blend"/>
      <feComposite in="blend" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="circuit" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="turbulence" baseFrequency="0.015 0.025" numOctaves="2" seed="5" result="turb"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.2  0 0 0 0 0.5  0 0 0 12 -5" in="turb" result="circuit"/>
    </filter>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030818"/>
      <stop offset="50%" stop-color="#060d2e"/>
      <stop offset="100%" stop-color="#040c20"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1e3a8a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#030818" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="75%" cy="70%" r="40%">
      <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#030818" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- base gradient -->
  <rect width="${W}" height="${H}" fill="url(#grad)"/>
  <!-- glow spots -->
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <!-- circuit texture layer -->
  <rect width="${W}" height="${H}" fill="transparent" filter="url(#circuit)" opacity="0.18"/>
  <!-- grid lines -->
  <g stroke="#3b82f6" stroke-width="0.5" opacity="0.08">
    ${Array.from({length: 25}, (_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="${H}"/>`).join('')}
    ${Array.from({length: 14}, (_, i) => `<line x1="0" y1="${i*50}" x2="${W}" y2="${i*50}"/>`).join('')}
  </g>
  <!-- dot grid accent -->
  <g fill="#60a5fa" opacity="0.12">
    ${Array.from({length: 13}, (_, row) =>
      Array.from({length: 25}, (_, col) =>
        `<circle cx="${col*50 + 25}" cy="${row*50 + 25}" r="1.5"/>`
      ).join('')
    ).join('')}
  </g>
  <!-- diagonal lines -->
  <g stroke="#2563eb" stroke-width="0.4" opacity="0.06">
    ${Array.from({length: 20}, (_, i) => `<line x1="${i*100 - 200}" y1="0" x2="${i*100 + 400}" y2="${H}"/>`).join('')}
  </g>
  <!-- noise overlay -->
  <rect width="${W}" height="${H}" fill="#1e40af" opacity="0.04" filter="url(#noise)"/>
  <!-- subtle vignette -->
  <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="transparent"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.5"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;

// markirovka: тёмно-зелёная тема с QR-паттерном
const svgMarkirovka = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8 0.9" numOctaves="3" seed="77" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="g2"/>
    </filter>
    <filter id="qr" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="turbulence" baseFrequency="0.04 0.04" numOctaves="1" seed="99" result="t"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 15 -6" in="t" result="qr"/>
    </filter>
    <linearGradient id="gBase" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#021208"/>
      <stop offset="50%" stop-color="#041a0d"/>
      <stop offset="100%" stop-color="#031510"/>
    </linearGradient>
    <radialGradient id="gGlow1" cx="25%" cy="60%" r="50%">
      <stop offset="0%" stop-color="#14532d" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#021208" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gGlow2" cx="80%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#065f46" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#021208" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#gBase)"/>
  <rect width="${W}" height="${H}" fill="url(#gGlow1)"/>
  <rect width="${W}" height="${H}" fill="url(#gGlow2)"/>
  <!-- QR-like squares pattern -->
  <g fill="#10b981" opacity="0.07">
    ${Array.from({length: 120}, (_, i) => {
      const x = (Math.floor(i / 10) * 130 + (i % 3) * 40 + 10) % W;
      const y = ((i * 57) % H);
      const s = [6, 10, 14, 8][i % 4];
      return `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
    }).join('')}
  </g>
  <!-- grid -->
  <g stroke="#10b981" stroke-width="0.5" opacity="0.06">
    ${Array.from({length: 25}, (_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="${H}"/>`).join('')}
    ${Array.from({length: 14}, (_, i) => `<line x1="0" y1="${i*50}" x2="${W}" y2="${i*50}"/>`).join('')}
  </g>
  <!-- data matrix fragments -->
  <g fill="#34d399" opacity="0.05">
    ${Array.from({length: 8}, (_, row) =>
      Array.from({length: 16}, (_, col) => {
        const filled = ((row * 16 + col) * 7 + 3) % 5 !== 0;
        return filled ? `<rect x="${col*75 + 2}" y="${row*80 + 2}" width="6" height="6"/>` : '';
      }).join('')
    ).join('')}
  </g>
  <rect width="${W}" height="${H}" fill="transparent" filter="url(#qr)" opacity="0.15"/>
  <!-- vignette -->
  <radialGradient id="v2" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="transparent"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#v2)"/>
</svg>`;

// zakonodatelstvo: тёмно-янтарная тема с мраморной текстурой
const svgZakonodatelstvo = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="marble" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.008" numOctaves="5" seed="34" result="t"/>
      <feColorMatrix type="matrix"
        values="0.3 0.1 0 0 0.05
                0.2 0.05 0 0 0.02
                0 0 0.05 0 0
                0 0 0 3 -0.5"
        in="t" result="marble"/>
    </filter>
    <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0a06"/>
      <stop offset="40%" stop-color="#14100a"/>
      <stop offset="100%" stop-color="#0a0807"/>
    </linearGradient>
    <radialGradient id="amber1" cx="70%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#78350f" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#0c0a06" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="amber2" cx="20%" cy="75%" r="45%">
      <stop offset="0%" stop-color="#92400e" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0c0a06" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#amber1)"/>
  <rect width="${W}" height="${H}" fill="url(#amber2)"/>
  <!-- marble texture -->
  <rect width="${W}" height="${H}" fill="#d97706" opacity="0.25" filter="url(#marble)"/>
  <!-- subtle diagonal veins -->
  <g stroke="#f59e0b" stroke-width="1" opacity="0.04" fill="none">
    ${Array.from({length: 12}, (_, i) => {
      const x1 = i * 110;
      const cp1x = x1 + 60;
      const cp1y = 180;
      const cp2x = x1 - 30;
      const cp2y = H - 150;
      return `<path d="M${x1},0 C${cp1x},${cp1y} ${cp2x},${cp2y} ${x1 + 20},${H}"/>`;
    }).join('')}
  </g>
  <!-- gold dots -->
  <g fill="#f59e0b" opacity="0.08">
    ${Array.from({length: 80}, (_, i) => {
      const x = ((i * 151) % W);
      const y = ((i * 83 + 40) % H);
      return `<circle cx="${x}" cy="${y}" r="${1 + (i % 3)}"/>`;
    }).join('')}
  </g>
  <!-- geometric lines -->
  <g stroke="#b45309" stroke-width="0.5" opacity="0.07">
    ${Array.from({length: 8}, (_, i) => `<line x1="0" y1="${i*90}" x2="${W}" y2="${i*90 + 30}"/>`).join('')}
  </g>
  <!-- vignette -->
  <radialGradient id="v3" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="transparent"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.6"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#v3)"/>
</svg>`;

const BACKGROUNDS = [
  { slug: 'ts-piot',         svg: svgTsPiot },
  { slug: 'markirovka',      svg: svgMarkirovka },
  { slug: 'zakonodatelstvo', svg: svgZakonodatelstvo },
];

for (const bg of BACKGROUNDS) {
  const outPath = path.join(OUT_DIR, `${bg.slug}.png`);
  process.stdout.write(`Генерирую ${bg.slug}... `);
  try {
    const resvg = new Resvg(bg.svg, { fitTo: { mode: 'width', value: W } });
    const png = resvg.render().asPng();
    fs.writeFileSync(outPath, png);
    const size = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`✓ ${outPath} (${size} KB)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово. Файлы в public/og-backgrounds/');
