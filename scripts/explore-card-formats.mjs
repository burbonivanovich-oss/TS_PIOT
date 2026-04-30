/**
 * Показывает формат карточки: AI-изображение сверху + текст снизу.
 * Верхняя часть — заглушки с разными стилями (здесь будут AI-картинки).
 * Запуск: node scripts/explore-card-formats.mjs
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

const W = 800, H = 560; // пропорции карточки на сайте
const fontsDir = path.join(ROOT, 'public/fonts');
const FONTS = [
  { name: 'InterCyr',    data: fs.readFileSync(path.join(fontsDir, 'inter-regular.woff')),          weight: 400, style: 'normal' },
  { name: 'InterCyr',    data: fs.readFileSync(path.join(fontsDir, 'inter-bold.woff')),              weight: 700, style: 'normal' },
  { name: 'InterLat',    data: fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff')),     weight: 400, style: 'normal' },
  { name: 'InterLat',    data: fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff')),        weight: 700, style: 'normal' },
  { name: 'InterLatExt', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff')), weight: 400, style: 'normal' },
  { name: 'InterLatExt', data: fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff')),    weight: 700, style: 'normal' },
];

const FONT = "'InterCyr', 'InterLat', 'InterLatExt'";

function bgPng(svg, w = W, h = 340) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: w } });
  return `data:image/png;base64,${r.render().asPng().toString('base64')}`;
}

async function renderCard(imageUri, opts = {}) {
  const {
    cat    = 'ТС ПИОТ',
    title  = 'ТС ПИоТ: что это такое и кому нужен программный модуль с 28 декабря 2025',
    accent = '#2563eb',
    bg     = '#ffffff',
    textColor = '#0f172a',
  } = opts;

  const markup = `
    <div style="display:flex; flex-direction:column; width:${W}px; height:${H}px;
      background:${bg}; font-family:${FONT}; border-radius:0px; overflow:hidden;">

      <!-- Картинка сверху -->
      <div style="display:flex; width:${W}px; height:340px; flex-shrink:0; overflow:hidden;">
        <img src="${imageUri}" width="${W}" height="340"
          style="width:${W}px; height:340px; object-fit:cover;"/>
      </div>

      <!-- Текст снизу -->
      <div style="display:flex; flex-direction:column; flex:1; padding:20px 28px 24px; gap:10px; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="display:flex; padding:3px 12px; background:${accent}15; border-radius:12px;
            font-size:13px; font-weight:700; color:${accent}; letter-spacing:1px;">${cat}</div>
        </div>
        <div style="display:flex; font-size:22px; font-weight:700; color:${textColor}; line-height:1.3;">${title}</div>
        <div style="display:flex; font-size:13px; color:#94a3b8;">reglament-biznes.ru</div>
      </div>
    </div>`;

  const svg = await satori(html(markup), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg).render().asPng();
}

// ─────────────────────────────────────────────────────────
// Генерируем изображения для верхней части карточек
// Это заглушки — при реальном использовании их заменит AI
// ─────────────────────────────────────────────────────────

const IW = W, IH = 340;

// 1. Синяя: касса и QR-код — для ТС ПИоТ
const img1 = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${IW}" height="${IH}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="${IW}" height="${IH}" fill="url(#g)"/>
  <!-- Силуэт кассового аппарата -->
  <rect x="280" y="50" width="240" height="200" rx="16" fill="white" opacity="0.12"/>
  <rect x="295" y="65" width="210" height="120" rx="8" fill="white" opacity="0.15"/>
  <rect x="305" y="75" width="190" height="100" rx="4" fill="#1e3a8a" opacity="0.8"/>
  <!-- Экран кассы -->
  <rect x="315" y="85" width="170" height="80" rx="3" fill="#dbeafe" opacity="0.9"/>
  <rect x="325" y="92" width="80" height="8" rx="2" fill="#1e40af" opacity="0.6"/>
  <rect x="325" y="106" width="120" height="6" rx="2" fill="#1e40af" opacity="0.4"/>
  <rect x="325" y="118" width="100" height="6" rx="2" fill="#1e40af" opacity="0.4"/>
  <rect x="325" y="130" width="130" height="6" rx="2" fill="#1e40af" opacity="0.3"/>
  <rect x="325" y="145" width="60" height="14" rx="3" fill="#1e40af" opacity="0.7"/>
  <!-- Клавиши -->
  ${Array.from({length:3}, (_,r) => Array.from({length:4}, (_,c) =>
    `<rect x="${308+c*52}" y="${198+r*22}" width="44" height="16" rx="3" fill="white" opacity="0.15"/>`
  ).join('')).join('')}
  <!-- QR-код справа -->
  <rect x="560" y="80" width="120" height="120" rx="8" fill="white" opacity="0.18"/>
  ${Array.from({length:5}, (_,r) => Array.from({length:5}, (_,c) => {
    const fill = ((r+c*3+r*c) % 3 === 0) ? 'fill="white" opacity="0.6"' : 'fill="#1e40af" opacity="0.4"';
    return `<rect x="${572+c*22}" y="${92+r*22}" width="18" height="18" rx="2" ${fill}/>`;
  }).join('')).join('')}
  <!-- Полосы -->
  <rect x="0" y="${IH-60}" width="${IW}" height="1" fill="white" opacity="0.1"/>
  <rect x="0" y="${IH-30}" width="${IW}" height="1" fill="white" opacity="0.07"/>
  <!-- Декоративные круги -->
  <circle cx="80" cy="270" r="60" fill="white" opacity="0.04"/>
  <circle cx="720" cy="50" r="80" fill="white" opacity="0.04"/>
</svg>`, IW, IH);

// 2. Зелёная: маркировка, штрихкод
const img2 = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${IW}" height="${IH}">
  <defs>
    <linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="${IW}" height="${IH}" fill="url(#g)"/>
  <!-- Продукт с этикеткой -->
  <rect x="220" y="60" width="360" height="220" rx="20" fill="white" opacity="0.1"/>
  <!-- Штрихкод -->
  <rect x="260" y="100" width="280" height="140" rx="8" fill="white" opacity="0.15"/>
  ${Array.from({length:30}, (_,i) => {
    const x = 270 + i * 8.5;
    const h = 60 + (i%5)*15;
    const y = 110 + (110-h)/2;
    return `<rect x="${x}" y="${y}" width="${i%3===0?4:2}" height="${h}" fill="#064e3b" opacity="0.7"/>`;
  }).join('')}
  <rect x="260" y="198" width="280" height="16" rx="3" fill="white" opacity="0.08"/>
  <rect x="310" y="201" width="180" height="10" rx="2" fill="#064e3b" opacity="0.5"/>
  <!-- Значок "Честный знак" стилизованный -->
  <circle cx="600" cy="110" r="55" fill="white" opacity="0.15"/>
  <circle cx="600" cy="110" r="42" fill="none" stroke="white" stroke-width="3" opacity="0.4"/>
  <path d="M580 110 L595 125 L622 95" stroke="white" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.7"/>
  <!-- Фоновые элементы -->
  <circle cx="120" cy="80" r="100" fill="white" opacity="0.03"/>
  <circle cx="700" cy="280" r="120" fill="white" opacity="0.03"/>
</svg>`, IW, IH);

// 3. Янтарная: документы, законодательство
const img3 = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${IW}" height="${IH}">
  <defs>
    <linearGradient id="g" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#78350f"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="${IW}" height="${IH}" fill="url(#g)"/>
  <!-- Стопка документов -->
  <rect x="230" y="90" width="220" height="170" rx="6" fill="white" opacity="0.08" transform="rotate(-8 340 175)"/>
  <rect x="240" y="80" width="220" height="170" rx="6" fill="white" opacity="0.1" transform="rotate(-4 350 165)"/>
  <rect x="250" y="70" width="220" height="170" rx="6" fill="white" opacity="0.18"/>
  <!-- Строки текста на документе -->
  ${Array.from({length:7}, (_,i) => `
    <rect x="268" y="${88+i*18}" width="${130+Math.sin(i)*20}" height="7" rx="2" fill="#78350f" opacity="${0.3+i*0.05}"/>
  `).join('')}
  <rect x="268" y="${88+3*18}" width="100" height="7" rx="2" fill="#d97706" opacity="0.6"/>
  <!-- Печать -->
  <circle cx="430" cy="195" r="40" fill="none" stroke="white" stroke-width="3" opacity="0.3"/>
  <circle cx="430" cy="195" r="30" fill="none" stroke="white" stroke-width="1.5" opacity="0.2"/>
  <text x="430" y="200" text-anchor="middle" font-size="12" fill="white" opacity="0.25" font-family="serif">ГОСТ</text>
  <!-- Весы правосудия стилизованные -->
  <line x1="590" y1="80" x2="590" y2="220" stroke="white" stroke-width="3" opacity="0.25"/>
  <line x1="540" y1="120" x2="640" y2="120" stroke="white" stroke-width="3" opacity="0.25"/>
  <circle cx="545" cy="165" r="28" fill="none" stroke="white" stroke-width="2" opacity="0.2"/>
  <circle cx="635" cy="155" r="28" fill="none" stroke="white" stroke-width="2" opacity="0.2"/>
  <line x1="540" y1="120" x2="545" y2="165" stroke="white" stroke-width="1.5" opacity="0.2"/>
  <line x1="640" y1="120" x2="635" y2="155" stroke="white" stroke-width="1.5" opacity="0.2"/>
  <!-- Декор -->
  <circle cx="100" cy="300" r="150" fill="white" opacity="0.03"/>
</svg>`, IW, IH);

// 4. Светлая: минимализм, просто и ясно (как Tinkoff верхние карточки)
const img4 = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${IW}" height="${IH}">
  <rect width="${IW}" height="${IH}" fill="#EEF2FF"/>
  <!-- Большой абстрактный элемент по центру -->
  <circle cx="${IW/2}" cy="${IH/2-10}" r="110" fill="#6366f1" opacity="0.12"/>
  <circle cx="${IW/2}" cy="${IH/2-10}" r="80" fill="#6366f1" opacity="0.1"/>
  <!-- Иконка приложения / телефона -->
  <rect x="330" y="60" width="140" height="220" rx="20" fill="white" opacity="0.9"
    style="filter:drop-shadow(0 8px 24px rgba(99,102,241,0.3))"/>
  <rect x="345" y="80" width="110" height="160" rx="6" fill="#eef2ff"/>
  <!-- Элементы на экране -->
  <rect x="355" y="90" width="90" height="10" rx="3" fill="#6366f1" opacity="0.7"/>
  <rect x="355" y="108" width="70" height="7" rx="2" fill="#a5b4fc" opacity="0.8"/>
  <rect x="355" y="122" width="80" height="7" rx="2" fill="#a5b4fc" opacity="0.6"/>
  <rect x="355" y="142" width="90" height="30" rx="6" fill="#6366f1" opacity="0.15"/>
  <rect x="365" y="150" width="70" height="14" rx="3" fill="#6366f1" opacity="0.5"/>
  <rect x="355" y="182" width="40" height="40" rx="6" fill="#6366f1" opacity="0.1"/>
  <rect x="403" y="182" width="40" height="40" rx="6" fill="#6366f1" opacity="0.1"/>
  <!-- Нотификации / бейджи -->
  <circle cx="460" cy="72" r="14" fill="#ef4444" opacity="0.8"/>
  <rect x="454" y="68" width="12" height="8" rx="1" fill="white" opacity="0.9"/>
  <!-- Фоновые элементы -->
  <circle cx="150" cy="100" r="60" fill="#818cf8" opacity="0.08"/>
  <circle cx="650" cy="250" r="80" fill="#6366f1" opacity="0.06"/>
</svg>`, IW, IH);

// 5. Фото-стиль: тёмная с реалистичными элементами
const img5 = bgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${IW}" height="${IH}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <radialGradient id="spotlight" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="${IW}" height="${IH}" fill="url(#g)"/>
  <rect width="${IW}" height="${IH}" fill="url(#spotlight)"/>
  <!-- Стилизованная касса ОФД/онлайн -->
  <rect x="200" y="50" width="400" height="240" rx="20" fill="#0f172a" opacity="0.8"
    stroke="#4f46e5" stroke-width="1.5" stroke-opacity="0.4"/>
  <!-- Дисплей -->
  <rect x="220" y="70" width="360" height="140" rx="10" fill="#1e1b4b"/>
  <rect x="232" y="82" width="336" height="116" rx="6" fill="#0d0d1a"/>
  <!-- Данные на экране -->
  <rect x="245" y="94" width="120" height="8" rx="2" fill="#6366f1" opacity="0.8"/>
  <rect x="245" y="110" width="200" height="6" rx="2" fill="white" opacity="0.3"/>
  <rect x="245" y="124" width="160" height="6" rx="2" fill="white" opacity="0.2"/>
  <rect x="245" y="138" width="180" height="6" rx="2" fill="white" opacity="0.2"/>
  <!-- Сумма -->
  <rect x="430" y="156" width="120" height="30" rx="6" fill="#4f46e5" opacity="0.3"/>
  <rect x="440" y="162" width="100" height="18" rx="3" fill="#818cf8" opacity="0.6"/>
  <!-- Кнопки -->
  ${Array.from({length:4}, (_,c) =>
    `<rect x="${220+c*92}" y="${220}" width="80" height="52" rx="8" fill="#1e1b4b" stroke="#4f46e5" stroke-width="0.5" stroke-opacity="0.3"/>`
  ).join('')}
  <!-- QR внизу справа -->
  <rect x="570" y="200" width="80" height="80" rx="6" fill="white" opacity="0.1"/>
  ${Array.from({length:4}, (_,r) => Array.from({length:4}, (_,c) => {
    const on = (r+c+r*c) % 2 === 0;
    return `<rect x="${576+c*18}" y="${206+r*18}" width="14" height="14" rx="1" fill="white" opacity="${on?0.5:0.1}"/>`;
  }).join('')).join('')}
  <!-- Световые акценты -->
  <line x1="0" y1="${IH-1}" x2="${IW}" y2="${IH-1}" stroke="#4f46e5" stroke-width="2" opacity="0.4"/>
</svg>`, IW, IH);

// Рендерим карточки
const CARDS = [
  { file: 'card-1-ts-piot-dark',     img: img1, cat: 'ТС ПИОТ',         accent: '#2563eb', bg: '#ffffff', title: 'ТС ПИоТ: что это такое и кому нужен программный модуль с 28 декабря 2025' },
  { file: 'card-2-markirovka-dark',  img: img2, cat: 'МАРКИРОВКА',       accent: '#059669', bg: '#ffffff', title: 'Категории маркировки «Честного знака» в 2026 году: полный список товаров' },
  { file: 'card-3-zakon-dark',       img: img3, cat: 'ЗАКОНОДАТЕЛЬСТВО', accent: '#d97706', bg: '#ffffff', title: 'Изменения в налоговом законодательстве для МСБ в 2026 году: ЕНС, ЕНП и новые ставки' },
  { file: 'card-4-light-app',        img: img4, cat: 'ТС ПИОТ',         accent: '#6366f1', bg: '#ffffff', title: 'Как подключить ТС ПИоТ к онлайн-кассе: пошаговая инструкция для розницы' },
  { file: 'card-5-dark-screen',      img: img5, cat: 'ТС ПИОТ',         accent: '#6366f1', bg: '#f8fafc', title: 'ТС ПИоТ: что это такое и кому нужен программный модуль с 28 декабря 2025' },
];

for (const c of CARDS) {
  process.stdout.write(`${c.file}... `);
  try {
    const png = await renderCard(c.img, { cat: c.cat, title: c.title, accent: c.accent, bg: c.bg });
    fs.writeFileSync(path.join(OUT, `${c.file}.png`), png);
    console.log('✓');
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log(`\nКарточки в ${OUT}`);
