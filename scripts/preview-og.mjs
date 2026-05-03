import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { html } from 'satori-html';

const fontsDir = path.resolve('./public/fonts');
const fontCyrRegular = fs.readFileSync(path.join(fontsDir, 'inter-regular.woff'));
const fontCyrBold = fs.readFileSync(path.join(fontsDir, 'inter-bold.woff'));
const fontLatRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff'));
const fontLatBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff'));
const fontLatExtRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff'));
const fontLatExtBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff'));

const fontStack = "'InterCyr', 'InterLat', 'InterLatExt'";

const CAT_ACCENT = {
  'ts-piot':        '#3b82f6',
  'markirovka':     '#10b981',
  'zakonodatelstvo':'#f59e0b',
};

const SAMPLES = [
  {
    slug: 'preview-ts-piot',
    cat: 'ts-piot',
    catLabel: 'ТС ПИОТ',
    title: 'Что такое ТС ПИоТ и как его подключить к онлайн-кассе',
  },
  {
    slug: 'preview-markirovka',
    cat: 'markirovka',
    catLabel: 'МАРКИРОВКА',
    title: 'Категории маркировки «Честный знак» в 2026 году: полный список и сроки',
  },
  {
    slug: 'preview-zakon',
    cat: 'zakonodatelstvo',
    catLabel: 'ЗАКОНОДАТЕЛЬСТВО',
    title: 'Налоги и отчётность для МСБ в 2026 году: УСН, патент, ЕНС, КЭДО',
  },
  {
    slug: 'preview-long',
    cat: 'ts-piot',
    catLabel: 'ТС ПИОТ',
    title: 'Разрешительный режим на кассе: почему касса не пробивает чек на маркированный товар и что делать кассиру прямо сейчас',
  },
];

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

fs.mkdirSync('./scripts/og-previews', { recursive: true });

for (const sample of SAMPLES) {
  const accent = CAT_ACCENT[sample.cat] ?? '#3b82f6';
  const titleLen = sample.title.length;
  const titleSize = titleLen > 80 ? 48 : titleLen > 55 ? 56 : 64;
  const titleText = escapeHtml(sample.title);
  const catText = escapeHtml(sample.catLabel);
  const siteText = 'Этикетка';

  const catTag = `<div style="display:flex; padding:6px 18px; background:${accent}22; color:${accent}; border:1px solid ${accent}44; border-radius:4px; font-size:20px; font-weight:700; letter-spacing:2px; margin-bottom:28px; align-self:flex-start;">${catText}</div>`;

  const markupString = `
    <div style="display:flex; flex-direction:row; height:100%; width:100%; background:#0d0d0d; font-family:${fontStack};">
      <div style="display:flex; width:8px; background:${accent}; flex-shrink:0;"></div>
      <div style="display:flex; flex-direction:column; flex:1; padding:56px 64px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="display:flex; width:52px; height:52px; border-radius:10px; background:${accent}; color:#fff; align-items:center; justify-content:center; font-size:20px; font-weight:700; letter-spacing:-0.5px;">РБ</div>
          <div style="display:flex; font-size:22px; font-weight:700; color:rgba(255,255,255,0.5); letter-spacing:0.5px;">${siteText}</div>
        </div>
        <div style="display:flex; flex-direction:column; flex:1; justify-content:center; padding:32px 0 24px;">
          ${catTag}
          <div style="display:flex; font-size:${titleSize}px; font-weight:700; color:#ffffff; line-height:1.15; letter-spacing:-0.5px;">${titleText}</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; font-size:20px; color:rgba(255,255,255,0.25);">
          <div style="display:flex;">reglament-biznes.ru</div>
          <div style="display:flex; width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,0.2);"></div>
          <div style="display:flex;">Для малого и среднего бизнеса</div>
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
  const outPath = `./scripts/og-previews/${sample.slug}.png`;
  fs.writeFileSync(outPath, png);
  console.log(`Generated: ${outPath} (title length: ${titleLen}, font-size: ${titleSize}px)`);
}

console.log('\nDone. Check scripts/og-previews/');
