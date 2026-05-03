/**
 * Satori capability explorer — генерирует PNG-превью разных шаблонов OG-картинок.
 * Запуск: node scripts/explore-satori.mjs
 * Результат: scripts/og-previews/explore-*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { html } from 'satori-html';

const fontsDir = path.resolve('./public/fonts');
const fontCyrRegular = fs.readFileSync(path.join(fontsDir, 'inter-regular.woff'));
const fontCyrBold    = fs.readFileSync(path.join(fontsDir, 'inter-bold.woff'));
const fontLatRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff'));
const fontLatBold    = fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff'));
const fontLatExtRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff'));
const fontLatExtBold    = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff'));

const FONTS = [
  { name: 'InterCyr',    data: fontCyrRegular,    weight: 400, style: 'normal' },
  { name: 'InterCyr',    data: fontCyrBold,        weight: 700, style: 'normal' },
  { name: 'InterLat',    data: fontLatRegular,     weight: 400, style: 'normal' },
  { name: 'InterLat',    data: fontLatBold,        weight: 700, style: 'normal' },
  { name: 'InterLatExt', data: fontLatExtRegular,  weight: 400, style: 'normal' },
  { name: 'InterLatExt', data: fontLatExtBold,     weight: 700, style: 'normal' },
];
const FONT_STACK = "'InterCyr', 'InterLat', 'InterLatExt'";

const ACCENT = {
  'ts-piot':        '#3b82f6',
  'markirovka':     '#10b981',
  'zakonodatelstvo':'#f59e0b',
};

const SAMPLE = {
  cat:      'ts-piot',
  label:    'ТС ПИОТ',
  title:    'Что такое ТС ПИоТ и как его подключить к онлайн-кассе',
  tags:     ['онлайн-касса', 'честный знак', 'маркировка'],
  date:     '29 апреля 2026',
  readTime: '9 мин',
};

fs.mkdirSync('./scripts/og-previews', { recursive: true });

async function render(name, markupString) {
  const markup = html(markupString);
  const svg = await satori(markup, { width: 1200, height: 630, fonts: FONTS });
  const png = new Resvg(svg).render().asPng();
  const out = `./scripts/og-previews/${name}.png`;
  fs.writeFileSync(out, png);
  console.log(`✓ ${out}`);
}

// ─── ШАБЛОН 1: текущий «Dark Editorial» ──────────────────────────────────────
// Уже знаем как выглядит — пропускаем.

// ─── ШАБЛОН 2: Gradient Accent ───────────────────────────────────────────────
// Фон: тёмный с радиальным градиентом из угла в цвет категории.
// Показывает: backgroundImage: linear-gradient / radial-gradient
await render('t2-gradient', `
  <div style="display:flex; width:100%; height:100%; font-family:${FONT_STACK};
    background: radial-gradient(ellipse at 0% 0%, ${ACCENT[SAMPLE.cat]}33 0%, #0d0d0d 55%);">
    <div style="display:flex; flex-direction:column; flex:1; padding:56px 72px;">

      <!-- шапка -->
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="display:flex; width:44px; height:44px; border-radius:8px;
          background:${ACCENT[SAMPLE.cat]}; color:#fff; align-items:center;
          justify-content:center; font-size:16px; font-weight:700;">РБ</div>
        <div style="display:flex; font-size:20px; font-weight:600;
          color:rgba(255,255,255,0.45);">Этикетка</div>
      </div>

      <!-- тело -->
      <div style="display:flex; flex-direction:column; flex:1; justify-content:center; gap:20px;">
        <div style="display:flex; font-size:13px; font-weight:700; letter-spacing:3px;
          color:${ACCENT[SAMPLE.cat]}; text-transform:uppercase;">${SAMPLE.label}</div>
        <div style="display:flex; font-size:60px; font-weight:700; color:#fff;
          line-height:1.15; max-width:900px;">${SAMPLE.title}</div>
      </div>

      <!-- футер -->
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.3);">
          ${SAMPLE.date}
        </div>
        <div style="display:flex; width:3px; height:3px; border-radius:50%;
          background:rgba(255,255,255,0.15);"></div>
        <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.3);">
          ${SAMPLE.readTime} чтения
        </div>
      </div>
    </div>
  </div>
`);

// ─── ШАБЛОН 3: Split (левая колонка — цвет категории) ────────────────────────
// Показывает: многоколоночный flexbox, вертикальный текст, box модель
await render('t3-split', `
  <div style="display:flex; width:100%; height:100%; font-family:${FONT_STACK};">

    <!-- левая панель -->
    <div style="display:flex; flex-direction:column; width:340px; background:${ACCENT[SAMPLE.cat]};
      padding:56px 40px; justify-content:space-between; flex-shrink:0;">
      <div style="display:flex; font-size:16px; font-weight:700; color:rgba(0,0,0,0.5);
        letter-spacing:3px; text-transform:uppercase; writing-mode:vertical-rl;
        transform:rotate(180deg);">${SAMPLE.label}</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${SAMPLE.tags.map(t => `
          <div style="display:flex; font-size:14px; font-weight:600; color:rgba(0,0,0,0.55);
            background:rgba(0,0,0,0.12); padding:5px 12px; border-radius:4px;">${t}</div>
        `).join('')}
      </div>
    </div>

    <!-- правая панель -->
    <div style="display:flex; flex-direction:column; flex:1; background:#0d0d0d;
      padding:56px 60px;">
      <div style="display:flex; font-size:20px; font-weight:700;
        color:rgba(255,255,255,0.4);">Этикетка</div>
      <div style="display:flex; flex:1; align-items:center;">
        <div style="display:flex; font-size:58px; font-weight:700; color:#fff;
          line-height:1.2;">${SAMPLE.title}</div>
      </div>
      <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.25);">
        ${SAMPLE.date} · ${SAMPLE.readTime} чтения
      </div>
    </div>
  </div>
`);

// ─── ШАБЛОН 4: Bold Top Band ──────────────────────────────────────────────────
// Верхняя треть — цвет категории, нижние две трети — тёмный.
// Показывает: фиксированная высота секций, смешение светлого и тёмного
await render('t4-band', `
  <div style="display:flex; flex-direction:column; width:100%; height:100%;
    font-family:${FONT_STACK};">

    <!-- верхняя полоса -->
    <div style="display:flex; align-items:center; justify-content:space-between;
      background:${ACCENT[SAMPLE.cat]}; padding:32px 64px; height:180px; flex-shrink:0;">
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="display:flex; width:48px; height:48px; border-radius:10px;
          background:rgba(0,0,0,0.2); color:#fff; align-items:center;
          justify-content:center; font-size:18px; font-weight:700;">РБ</div>
        <div style="display:flex; font-size:22px; font-weight:700;
          color:rgba(0,0,0,0.6);">Этикетка</div>
      </div>
      <div style="display:flex; font-size:14px; font-weight:700; letter-spacing:3px;
        color:rgba(0,0,0,0.5); text-transform:uppercase; border:1.5px solid rgba(0,0,0,0.2);
        padding:6px 16px; border-radius:4px;">${SAMPLE.label}</div>
    </div>

    <!-- нижняя тёмная часть -->
    <div style="display:flex; flex-direction:column; flex:1; background:#111;
      padding:48px 64px; justify-content:space-between;">
      <div style="display:flex; font-size:58px; font-weight:700; color:#fff;
        line-height:1.2; max-width:950px;">${SAMPLE.title}</div>
      <div style="display:flex; align-items:center; gap:12px;
        font-size:18px; color:rgba(255,255,255,0.25);">
        <span>${SAMPLE.date}</span>
        <span>·</span>
        <span>${SAMPLE.readTime} чтения</span>
        <span>·</span>
        <span>reglament-biznes.ru</span>
      </div>
    </div>
  </div>
`);

// ─── ШАБЛОН 5: Minimal Light ──────────────────────────────────────────────────
// Белый фон, минимализм. Для категории zakonodatelstvo может быть уместно.
// Показывает: светлые темы, работу с тенями (box-shadow не поддерживается,
//   но border работает), разные весовые акценты
await render('t5-minimal-light', `
  <div style="display:flex; flex-direction:column; width:100%; height:100%;
    font-family:${FONT_STACK}; background:#f8f8f6;">

    <!-- цветная черта сверху -->
    <div style="display:flex; width:100%; height:6px; background:${ACCENT['zakonodatelstvo']};
      flex-shrink:0;"></div>

    <div style="display:flex; flex-direction:column; flex:1; padding:60px 72px;">
      <!-- шапка -->
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; font-size:20px; font-weight:700; color:#888;">
          Этикетка
        </div>
        <div style="display:flex; font-size:13px; font-weight:700; letter-spacing:2px;
          color:${ACCENT['zakonodatelstvo']}; text-transform:uppercase;">ЗАКОНОДАТЕЛЬСТВО</div>
      </div>

      <!-- заголовок -->
      <div style="display:flex; flex:1; align-items:center;">
        <div style="display:flex; font-size:62px; font-weight:700; color:#111;
          line-height:1.2; max-width:950px;">
          Налоги и отчётность для МСБ в 2026 году: УСН, патент, ЕНС, КЭДО
        </div>
      </div>

      <!-- линия + мета -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; width:64px; height:3px; background:${ACCENT['zakonodatelstvo']};
          border-radius:2px;"></div>
        <div style="display:flex; font-size:18px; color:#999; gap:12px;">
          <span>29 апреля 2026</span>
          <span>·</span>
          <span>8 мин чтения</span>
          <span>·</span>
          <span>reglament-biznes.ru</span>
        </div>
      </div>
    </div>
  </div>
`);

// ─── ШАБЛОН 6: Dot Grid (текстурный фон) ─────────────────────────────────────
// Показывает: backgroundImage с repeating-linear-gradient для имитации сетки
// (SVG pattern не поддерживается, но CSS repeating-gradient — работает)
await render('t6-dot-grid', `
  <div style="display:flex; width:100%; height:100%; font-family:${FONT_STACK};
    background-color:#0d0d0d;
    background-image: radial-gradient(circle, rgba(59,130,246,0.15) 1px, transparent 1px);
    background-size: 32px 32px;">

    <!-- затемнение снизу для читаемости -->
    <div style="display:flex; flex-direction:column; flex:1;
      background: linear-gradient(to bottom, transparent 0%, #0d0d0d 65%);
      padding:56px 72px;">

      <div style="display:flex; align-items:center; gap:14px;">
        <div style="display:flex; width:44px; height:44px; border-radius:8px;
          background:#3b82f6; color:#fff; align-items:center; justify-content:center;
          font-size:16px; font-weight:700;">РБ</div>
        <div style="display:flex; font-size:20px; font-weight:600;
          color:rgba(255,255,255,0.4);">Этикетка</div>
      </div>

      <div style="display:flex; flex:1; align-items:flex-end; padding-bottom:24px;">
        <div style="display:flex; flex-direction:column; gap:18px;">
          <div style="display:flex; font-size:13px; font-weight:700; letter-spacing:3px;
            color:#3b82f6;">ТС ПИОТ</div>
          <div style="display:flex; font-size:60px; font-weight:700; color:#fff;
            line-height:1.2;">${SAMPLE.title}</div>
        </div>
      </div>

      <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.25); gap:10px;">
        <span>${SAMPLE.date}</span>
        <span>·</span>
        <span>${SAMPLE.readTime} чтения</span>
      </div>
    </div>
  </div>
`);

// ─── ШАБЛОН 7: Tags visible ───────────────────────────────────────────────────
// Показывает теги из frontmatter как визуальный элемент
await render('t7-tags', `
  <div style="display:flex; flex-direction:column; width:100%; height:100%;
    font-family:${FONT_STACK}; background:#0d0d0d;">
    <div style="display:flex; width:100%; height:5px; background:${ACCENT[SAMPLE.cat]};
      flex-shrink:0;"></div>

    <div style="display:flex; flex-direction:column; flex:1; padding:52px 64px;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; font-size:20px; font-weight:600;
          color:rgba(255,255,255,0.35);">Этикетка</div>
        <div style="display:flex; font-size:13px; font-weight:700; letter-spacing:2px;
          color:${ACCENT[SAMPLE.cat]};">${SAMPLE.label}</div>
      </div>

      <div style="display:flex; flex:1; align-items:center;">
        <div style="display:flex; font-size:58px; font-weight:700; color:#fff;
          line-height:1.2; max-width:980px;">${SAMPLE.title}</div>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- теги -->
        <div style="display:flex; gap:10px; flex-wrap:nowrap;">
          ${SAMPLE.tags.map(t => `
            <div style="display:flex; font-size:15px; font-weight:600;
              color:rgba(255,255,255,0.5);
              background:rgba(255,255,255,0.07);
              padding:6px 14px; border-radius:4px;">${t}</div>
          `).join('')}
        </div>
        <div style="display:flex; font-size:18px; color:rgba(255,255,255,0.2); gap:10px;">
          <span>${SAMPLE.date}</span><span>·</span><span>${SAMPLE.readTime} чтения</span>
        </div>
      </div>
    </div>
  </div>
`);

console.log('\nЧто поддерживает Satori:');
console.log('  ✓ flexbox (display:flex, flex-direction, align-items, justify-content, gap, flex:1)');
console.log('  ✓ backgroundImage: linear-gradient, radial-gradient, repeating-linear-gradient');
console.log('  ✓ border-radius, border (color, width, style)');
console.log('  ✓ font-size, font-weight, letter-spacing, line-height, text-transform');
console.log('  ✓ color, background-color, opacity');
console.log('  ✓ padding, margin, width, height, min/max variants');
console.log('  ✓ writing-mode (вертикальный текст)');
console.log('  ✓ flex-shrink, flex-wrap');
console.log('  ✓ img (src с data URI / внешний URL — только https)');
console.log('');
console.log('Что НЕ поддерживается:');
console.log('  ✗ box-shadow (игнорируется)');
console.log('  ✗ SVG <pattern> внутри разметки');
console.log('  ✗ CSS grid (display:grid не работает — только flex)');
console.log('  ✗ position: absolute/fixed (поддержка ограничена)');
console.log('  ✗ CSS transitions/animations');
console.log('  ✗ clip-path, filter, backdrop-filter');
console.log('  ✗ text-overflow: ellipsis (нужно обрезать вручную в JS)');
console.log('  ✗ @font-face (шрифты загружаются через API, не CSS)');
console.log('');
console.log('Что можно делать разным для каждой статьи (из frontmatter):');
console.log('  • Шаблон (template: "split" | "band" | "minimal" | "grid" | "default")');
console.log('  • Акцент по категории (уже реализовано)');
console.log('  • Показ/скрытие тегов');
console.log('  • Дата и время чтения (вычисляется при сборке)');
console.log('  • Специфическая подпись (subtitle из frontmatter)');
