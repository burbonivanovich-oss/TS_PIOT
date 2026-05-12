/**
 * Генерирует hero-изображения для статей через OpenRouter.
 * Запуск: GitHub Actions → Generate Article Images → Run workflow
 *
 * Env-переменные:
 *   OPENROUTER_API_KEY  — обязателен
 *   HERO_MODEL          — модель (по умолчанию google/gemini-3.1-flash-image-preview)
 *   SLUG                — slug конкретной статьи (без даты-пути)
 *   LIMIT               — не более N статей за запуск
 *   FORCE               — "1" чтобы перегенерировать статьи, у которых heroImage уже есть
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const BLOG_DIR  = path.join(ROOT, 'src/content/blog');
const HERO_DIR  = path.join(ROOT, 'public/images/hero');
const MODEL     = process.env.HERO_MODEL ?? 'google/gemini-3.1-flash-image-preview';
const FORCE     = process.env.FORCE === '1';

fs.mkdirSync(HERO_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

// ─── Суффикс стиля для всех промптов ──────────────────────────────────────────
const STYLE_SUFFIX =
  'editorial photography, professional Russian B2B media, ' +
  'no people faces visible, no laptop computers unless essential, ' +
  'no generic stock-photo clichés, 16:9 aspect ratio; ' +
  'SHARPNESS: tack-sharp focus on the primary subject, crisp clear edges, ' +
  'high-frequency detail visible on surfaces and textures, no soft-focus, no haze, no motion blur, ' +
  'no AI-generated softness, photorealistic with DSLR-grade clarity, natural commercial lighting; ' +
  'TEXT RULES: any text visible in the image must be large, naturally legible and look intentional — ' +
  'never render small text that appears artificially scaled up or blurry; ' +
  'if no text fits naturally at readable size, omit it entirely; ' +
  'device screens may show a simple receipt or POS UI but keep it minimal and sharp; ' +
  'DEVICE ACCURACY: render hardware devices with photorealistic accuracy matching their real-world industrial design; ' +
  'do not place brand names or model numbers on a device unless its visual form exactly matches that model';

// ─── Точные визуальные профили реальных устройств ─────────────────────────────
// Используются в slug-промптах для фотореалистичного воспроизведения формы
const DEV = {
  mspos_f20:
    'MSPOS-F20-Ф mobile Android POS terminal: portrait-oriented 5.5-inch HD IPS touchscreen (1280×720), ' +
    'slim rectangular pocketable body 212×79×52mm, weight ~430g, ' +
    'integrated 58mm thermal receipt printer at the bottom, ' +
    'matte black plastic finish, "MSPOS" lettering on front bezel, ' +
    'designed for mobile retail, courier delivery, and on-the-go sales',

  mspos_t:
    'MSPOS-T-Ф stationary smart POS terminal for retail counters: ' +
    'large 11.6-inch landscape touchscreen (1366×768 or higher), ' +
    'flat tablet-style body resting on the counter, no external stand needed, ' +
    'integrated 80mm thermal receipt printer at the side or back, ' +
    'matte black finish with visible "MSPOS" branding on the bezel, ' +
    'designed for mid-traffic shops, cafés, and salons',

  mspos_d3_mini:
    'MSPOS-T-Ф D3 Mini compact stationary smart POS terminal: ' +
    '10.1-inch capacitive landscape touchscreen, ' +
    'small all-in-one form factor that sits flat on a small counter, ' +
    'integrated 57mm thermal printer, built-in 2D scanner camera, ' +
    'matte black finish, "MSPOS" branding, designed for small shops and cafés ' +
    'where the cashier picks items from on-screen tile shortcuts',

  atol_27f:
    'ATOL 27F fiscal registrar (фискальный регистратор): standalone receipt printer, ' +
    '**black** high-strength plastic rectangular body, no screen, no keypad, ' +
    'three small coloured status LEDs (power, error, paper) on top, paper-feed button, ' +
    '80mm thermal paper roll slot with automatic guillotine cutter, ' +
    'USB / RS-232 / Ethernet ports on the rear, "ATOL 27F" label on the front, ' +
    'connects to an external PC or tablet — it prints receipts, it is not a POS terminal',

  atol_30f:
    'ATOL 30F fiscal registrar (фискальный регистратор): compact standalone receipt printer, ' +
    'dark-grey / charcoal plastic body, dimensions 88×160×79mm, no screen, no keypad, ' +
    '57mm thermal paper roll slot at the top, no auto-cutter, ' +
    'USB / Wi-Fi / Bluetooth connectivity (no Ethernet, no RS-232), ' +
    '"ATOL 30F" label on front, connects to a PC, tablet, or smartphone',

  atol_optima:
    'ATOL Optima 15F fiscal registrar: very compact standalone receipt printer ~105×105×75mm, ' +
    'no display, no keypad, 80mm thermal paper roll slot at the top, ' +
    '"ATOL" logo on the front face, USB port on the side, ' +
    'sits on a counter beside a PC or POS tablet',

  evotor_5:
    'Evotor 5 (Эвотор 5) mobile Android smart POS terminal: portrait-oriented 5.5-inch IPS touchscreen (1280×720, 267 DPI), ' +
    'slim pocketable body 208×86×50mm, weight ~400g, ' +
    'integrated 57mm thermal printer at the bottom, ' +
    'matte black finish with "Эвотор" branding on the bezel, subtle green accent on the logo, ' +
    'designed for delivery, market stalls, and on-the-go sales',

  fiskal_registrar:
    'standalone fiscal receipt printer / registrar (generic): compact rectangular unit ~150×130mm, ' +
    'no touchscreen, no keypad, thermal paper roll slot at the top, ' +
    'USB and serial ports on the side, meant to connect to a PC or tablet, ' +
    'minimal industrial design',
};

// ─── Пул промптов по категориям ───────────────────────────────────────────────
// Детерминированный выбор: slugHash(slug) % pool.length
const CAT_POOLS = {

  'ts-piot': [
    'Close-up of a sleek white compact POS terminal screen showing a digital receipt with QR code, retail counter, dramatic side lighting, dark background',
    'Overhead view of a cashier workstation: receipt thermal printer, card reader, wooden counter surface, warm shop ambient light',
    'Fiscal receipt printer spooling a paper roll, DataMatrix code printed clearly, isolated on dark background, macro lens shallow focus',
    'Modern smart touchscreen POS terminal mounted on a retail checkout counter, blurred store shelves in background, shallow depth of field',
    'Receipt paper roll and a compact fiscal register side by side, white studio background, clean commercial product shot',
    'Cash drawer partially open beside a POS terminal on a coffee shop counter, warm amber evening light',
    'Two different POS terminal models on a display stand in a tech retail environment, cool showroom lighting',
    'Close-up of a card payment terminal with tap-to-pay symbol glowing, customer hand slightly blurred in motion',
  ],

  'markirovka': [
    'Close-up of a DataMatrix 2D barcode being scanned on a food product package, cool white retail lighting, scanner beam visible',
    'Row of identical dairy product bottles on a refrigerated shelf, small DataMatrix stickers on caps, commercial refrigerator light',
    'Industrial label printer printing product stickers on a roll, sticker reel in foreground, factory setting',
    'Cosmetics products lined on a pharmacy shelf, DataMatrix codes clearly visible on packaging, clean retail lighting',
    'QR scanner gun pointed at a canned goods product on a warehouse shelf, bokeh background, industrial lighting',
    'Unboxing of a product shipment: cardboard box, individual items with visible compliance labels, warehouse light',
    'Toy packaging in a bright retail store, marking sticker on corner, child-friendly color palette background',
    'Clothing price tags and compliance labels hanging from garments on a rack, fashion retail atmosphere',
  ],

  'zakonodatelstvo': [
    'Flat-lay overhead: official tax return forms, a pen, and a calculator on cream-colored paper, natural window light',
    'Stack of stamped government documents on a wooden desk, warm desk lamp illumination, shallow depth of field',
    'Wall calendar with red circled deadline dates, blurred office background, close-up',
    'Hand signing an official document at a desk, pen in motion, natural office daylight from the side',
    'Filing cabinet drawer open, labeled hanging folders in alphabetical order, cool fluorescent office light',
    'Exterior of a modern glass government or tax authority building, overcast sky, clean architectural photo',
    'Open law reference book with a ruler and notepad beside it, library warm lighting, vintage wooden desk',
    'Official envelope with a government stamp lying on a desk, soft focus background of more documents',
  ],

  'kkt': [
    'Multiple POS terminal models arranged on a retail display shelf with price tags, showroom lighting',
    'Close-up of a thermal printer head and paper roll mechanism, macro photography, studio white background',
    'Checkout counter in a small grocery store: scanner, terminal, receipt printer, daytime warm light',
    'Technician hands using a screwdriver to service a POS register on a workbench, tools visible',
    'New POS terminal being unboxed: styrofoam packaging, cables, power adapter on a white table',
    'Receipt tape with printed transactions spilling out of a compact fiscal register, dark background',
    'Tax authority service window inside an administrative building, numbered queue system on wall',
    'Side-by-side comparison of a classic cash register and a modern smart terminal on a counter',
  ],

  'egais': [
    'Wine bottles with visible EGAIS excise duty stamps on labels, dark aged oak wine rack background',
    'Spirits shelf in a liquor store, bottles tightly packed, warm amber backlighting from shelf LEDs',
    'UTM EGAIS hardware module connected by USB to a POS terminal on a bar counter, moody pub light',
    'Craft beer bottles in a cool storage room with wooden crates, industrial warehouse lighting',
    'Wine glass and a bottle with regulatory QR label close-up, elegant dark restaurant table',
    'Alcohol products on a warehouse pallet, stretch wrap, barcode labels visible, overhead industrial light',
    'Bar taps in a craft brewery taproom, multiple beer handles, blurred background, warm evening light',
    'Vodka and spirits bottles in a licensed store display case, glass cabinet, cool shop lighting',
  ],
};

// ─── Промпты под конкретные slug-и ────────────────────────────────────────────
const SLUG_PROMPTS = {
  // ТС ПИоТ
  '2026-01-15-chto-takoe-ts-piot':
    'Hero shot of a modern compact POS terminal on a clean dark retail counter, green LED status light glowing, side rim lighting, no text',
  '2026-05-01-ts-piot-podklyuchenie-instrukciya':
    'USB and LAN cables being connected to a POS terminal and receipt printer on a desk, step-by-step technical setup atmosphere, overhead shot',
  '2026-05-01-ts-piot-shtrafy':
    'Official penalty notice document with a government stamp on a desk, red pen underlining a paragraph, natural window light',
  '2026-05-01-ts-piot-evotor-atol-shtrih':
    `Three Russian smart POS terminals side by side on a retail counter for brand comparison: ` +
    `left — ${DEV.evotor_5}; center — ${DEV.mspos_f20}; right — ${DEV.atol_30f}; ` +
    `soft studio lighting, slight angle, all three clearly distinct in design`,
  '2026-05-01-ofd-dlya-ts-piot':
    'Server rack with blinking status LEDs in a dark data center, shallow depth of field, blue-tinted ambient glow',
  '2026-05-01-registraciya-kkt-v-fns':
    'Close-up of a hands filling in a government registration form for equipment, official stamp nearby, warm office light',
  '2026-05-01-kak-vybrat-onlayn-kassu-2026':
    `Overhead flat-lay product comparison on a white surface — three different cash register form factors: ` +
    `left: ${DEV.atol_27f} (compact receipt printer, connects to tablet); ` +
    `center: ${DEV.mspos_f20} (slim all-in-one smart terminal with touchscreen); ` +
    `right: ${DEV.mspos_t} (large landscape tablet terminal on stand); ` +
    `clean studio lighting, professional product photography`,
  '2026-05-01-chto-takoe-fn':
    'Small rectangular fiscal storage module (FN) isolated on a dark surface, macro lens, metallic surface reflection',
  '2026-05-01-zamena-fn-poshagovo':
    'Technician hands carefully inserting a fiscal storage module into the open back panel of a POS terminal, workshop light',
  '2026-05-03-srok-fn-15-36':
    'Calendar page with "36 months" circled and a fiscal storage module placed next to it, shallow focus, dark background',
  '2026-05-03-atol-27f-obzor':
    `Product hero shot: ${DEV.atol_27f}; ` +
    `placed on a white studio surface beside a tablet showing POS software (to illustrate the connection), ` +
    `soft three-quarter studio lighting, sharp detail on paper slot and ports, bokeh white background`,

  '2026-05-03-atol-30f-obzor':
    `Product hero shot: ${DEV.atol_30f}; ` +
    `on a retail checkout counter next to a tablet, USB cable connecting them, ` +
    `warm shop ambient lighting, three-quarter angle, receipt paper visible at the top slot`,

  '2026-05-03-atol-30f-vs-27f':
    `Side-by-side product comparison on a white studio surface: ` +
    `left — ${DEV.atol_27f}; right — ${DEV.atol_30f}; ` +
    `both are standalone receipt printers with no screens, slightly different sizes and port configurations, ` +
    `spec sheets between them, even studio lighting, clean product photography`,

  '2026-05-03-mspos-f20-obzor':
    `Product hero shot: ${DEV.mspos_f20}; on a retail counter, ` +
    `screen displaying a simple POS checkout UI, shallow depth of field, bokeh store background, ` +
    `dramatic side rim lighting on the device body`,

  '2026-05-03-mspos-t-d3-mini-obzor':
    `Product hero shot: ${DEV.mspos_d3_mini}; sitting flat on a small café or shop counter, ` +
    `landscape screen lit with a simple POS tile UI, three-quarter angle, ` +
    `warm bokeh background of a small retail interior`,

  '2026-05-03-mspos-f20-vs-d3-mini':
    `Two MSPOS devices side by side on a white studio surface for comparison — ` +
    `left: ${DEV.mspos_f20} (slim mobile pocket-sized portrait terminal); ` +
    `right: ${DEV.mspos_d3_mini} (larger stationary landscape terminal that sits on a counter); ` +
    `the size difference is dramatic — mobile vs stationary form factors; ` +
    `overhead three-quarter angle, clean product photography`,

  '2026-05-03-vidy-kkt':
    `Five Russian fiscal devices arranged in a row on a clean retail counter showing different types: ` +
    `(1) ${DEV.atol_27f} — compact fiscal registrar/printer; ` +
    `(2) ${DEV.mspos_f20} — compact smart terminal; ` +
    `(3) ${DEV.mspos_t} — large tablet POS on stand; ` +
    `(4) ${DEV.mspos_d3_mini} — handheld mobile terminal; ` +
    `(5) ${DEV.evotor_5} — mid-size smart terminal; ` +
    `each clearly different in size and form factor, even studio lighting, product lineup photography`,
  '2026-05-03-chto-takoe-ofd':
    'Abstract visualization: data streams between a POS terminal and server icons, bokeh light background, blue and green tones',
  '2026-05-03-kak-vybrat-ofd-2026':
    'Comparison chart on paper beside a POS terminal and a cup of coffee on an office desk, pen ready to check boxes',
  '2026-05-03-smart-terminal-vs-fiskalnyj-registrator':
    `Side-by-side product comparison on white: left — ${DEV.mspos_f20}; right — ${DEV.fiskal_registrar}; ` +
    `clean studio lighting, three-quarter angle, both devices in sharp focus`,

  // Маркировка
  '2026-02-10-kategorii-markirovki-2026':
    'Grid of different product categories on a table: dairy, cosmetics, beer, clothing — each with a visible DataMatrix sticker, flat-lay editorial',
  '2026-05-01-markirovka-molochki-msb':
    'Close-up of dairy products (milk cartons and yogurt cups) on a refrigerator shelf, DataMatrix codes on each package, cool refrigerator light',
  '2026-05-01-markirovka-piva-roznica':
    'Beer bottles on a retail shelf at eye level, DataMatrix code stickers on the neck labels, warm store lighting',
  '2026-05-01-kalendar-markirovki-2026':
    'Flat-lay of product items from different marking categories — dairy carton, clothing tag, beer bottle, cosmetic tube — arranged in a circle on a neutral linen surface, each with a small DataMatrix sticker, soft natural daylight, no text visible anywhere',
  '2026-05-01-razreshitelnyj-rezhim-markirovka':
    'POS terminal scanner beeping on a product at checkout, screen showing "разрешено / blocked" status, retail lighting',
  '2026-05-01-shtraf-za-markirovku':
    'Official administrative penalty resolution document with a bold red stamp on a desk, warning atmosphere',
  '2026-05-01-markirovka-cherez-marketplace':
    'Cardboard shipping box with a DataMatrix label being sealed with tape, warehouse packing station, overhead light',
  '2026-05-03-markirovka-kosmetiki-2026':
    'Cosmetics and beauty products lined on a white retail shelf, small DataMatrix codes on each box bottom, bright clean light',
  '2026-05-03-markirovka-igrushek-2026':
    'Colorful toy boxes on a retail shelf, compliance marking stickers on packaging corners, bright toy store lighting',
  '2026-05-03-markirovka-bezalk-napitkov-2026':
    'Non-alcoholic beverages — sparkling water and juice bottles — on a store shelf, DataMatrix labels on caps, cool refrigerator light',
  '2026-05-03-markirovka-bakalei-2026':
    'Dry grocery products — cereals, pasta, canned goods — on a shelf with marking stickers visible, warm grocery store lighting',
  '2026-05-03-markirovka-konservov-2026':
    'Canned food products stacked on a metal shelf, marking labels on lids, industrial storage lighting',
  '2026-05-03-markirovka-bytovoy-himii-2026':
    'Household cleaning products and detergents on a drugstore shelf, compliance stickers on bottles, bright white store light',
  '2026-05-03-markirovka-avtozhidkostey-2026':
    'Motor oil bottles and automotive fluids on a store shelf, DataMatrix labels on containers, auto parts store atmosphere',
  '2026-05-03-markirovka-lichnoy-gigieny-2026':
    'Personal care products — shampoo bottles, toothpaste tubes — on a pharmacy shelf with marking stickers, clean white lighting',
  '2026-05-03-markirovka-sportpita-2026':
    'Sports nutrition products — protein powder tubs and supplement bottles — on a sports store shelf, DataMatrix codes visible',
  '2026-05-03-markirovka-importerov':
    'Import cargo shipment: boxes on a warehouse pallet with customs labels and DataMatrix marking stickers, loading dock light',
  '2026-05-03-obyemno-sortovoy-vs-poexzemplyarnyj':
    'Two product groups on a counter: one batch-labeled box vs individually stickered items, side-by-side comparison, studio light',
  '2026-05-03-vyvod-iz-oborota-cherez-kassu':
    'POS terminal checkout moment: product scanned, screen showing withdrawal confirmation, retail counter, warm light',
  '2026-05-03-merkuriy-i-chestnyj-znak':
    'Two mobile scanning devices side by side scanning different product types, dual-system concept, clean background',

  // Законодательство
  '2026-03-05-nalogi-msb-2026':
    'Overhead flat-lay: tax declaration forms, a calculator, and coins on a wooden desk, natural window daylight',
  '2026-05-01-ens-enp-uvedomleniya':
    'Paper notification form from tax authority with a deadline date circled in red, envelope visible, desk lamp light',
  '2026-05-01-edo-upd-markirovka':
    'Stack of official commercial transfer documents (УПД) with stamps and a seal on a wooden desk, warm office light',
  '2026-05-01-proverki-2026':
    'Inspector with a clipboard standing in front of a small retail store doorway, formal but non-threatening, natural daylight',
  '2026-05-01-usn-nds-rasschet':
    'Tax calculation worksheet with numbers, pen, and a small chart on a desk, soft window light, no laptop',
  '2026-05-03-mrot-2026-rabotodatel':
    'Payroll statement paper with salary figures and a stapler on a wooden desk, close-up overhead, warm office light',
  '2026-05-03-samozanyatye-riski-2026':
    'Self-employed worker\'s workbench — tools or craft materials with a phone showing "Мой налог" app — natural light',
  '2026-05-03-strahovye-vznosy-msp-2026':
    'Insurance contribution calculation table on paper beside an abacus or calculator, government document stamp visible',
  '2026-05-03-personalnye-dannye-shtrafy-2025':
    'A locked padlock on a folder labeled "персональные данные" on a desk, security concept, dark tones',
  '2026-05-03-zakon-o-marketpleysah-289-fz':
    'Smartphone displaying a marketplace app beside a document titled "289-ФЗ" on a desk, warm ambient light',
  '2026-05-03-etrn-2026':
    'Electronic consignment note on a tablet screen on a truck dashboard, logistics and transport context, daylight',

  // ККТ
  '2026-05-01-buh-dlya-marketplace':
    'Marketplace seller workspace: product boxes, a phone with seller dashboard, order papers on a desk, warm home-office light',
  '2026-05-01-onlayn-buhgalteriya-2026':
    'Close-up of financial dashboard charts on a tablet screen beside a cup of coffee and a pen, clean desk, warm light',
  '2026-05-03-sravnenie-onlayn-buhov':
    'Three phones side by side each showing a different accounting app interface, flat-lay on white background, overhead shot',
  '2026-05-03-buh-dlya-ip-usn':
    'Simplified tax (УСН) declaration form with a stamp, rubber stamp and ink pad on a desk, natural window light',

  // ЕГАИС
  '2026-05-01-egais-chto-eto':
    'Vodka and spirits bottles with EGAIS excise duty stamps visible on labels, dark oak bar cabinet background',
  '2026-05-01-gashenie-vsd-merkuriy':
    'Veterinary accompanying document being stamped at a receiving dock, clipboard, crates of goods, warehouse light',
  '2026-05-01-chto-takoe-merkuriy':
    'FSIS Mercury logo concept: veterinary certificate paper on a clipboard with food products (cheese, meat) nearby, cold storage light',
  '2026-05-03-registraciya-v-merkurii':
    'Computer registration form on screen (no face visible), FSIS government portal context, official desktop environment',
  '2026-05-03-deklaracii-po-alkogolyu':
    'Alcohol declaration form on a desk with a fountain pen, bottle of wine in soft focus in background, warm light',
  '2026-05-03-poshtuchnyj-uchyot-alkogolya':
    'Wine bottles being individually checked with a handheld scanner in a retail store, bottle-by-bottle counting concept',
  '2026-05-03-uchyot-razlivnogo-piva':
    'Beer on tap in a bar — kegs visible behind the counter, bar tap handles in foreground, moody pub evening light',
  '2026-05-03-uchyot-alkogolya-v-obschepite':
    'Restaurant bar station: spirits bottles arranged behind a counter, bartender tools, warm ambient dining light',
  '2026-05-03-utm-egais-podklyuchenie':
    'Small UTM EGAIS hardware device being connected to a POS terminal with a USB cable on a bar counter',
  '2026-05-03-egais-zhurnal-roznichnoy-prodazhi':
    'Retail sales journal ledger open on a desk beside a POS terminal receipt, pen on the page, warm shop light',
};

// ─── Утилиты ──────────────────────────────────────────────────────────────────
function slugHash(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"]*)"?/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function buildPrompt(slug, title, category) {
  if (SLUG_PROMPTS[slug]) {
    return `${SLUG_PROMPTS[slug]}. ${STYLE_SUFFIX}`;
  }
  const pool = CAT_POOLS[category] ?? CAT_POOLS['zakonodatelstvo'];
  const pick = pool[slugHash(slug) % pool.length];
  return `${pick}. ${STYLE_SUFFIX}`;
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function generateImage(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://etiketka-media.ru',
      'X-Title': 'etiketka-media',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['text', 'image'],
    }),
  });

  const rawText = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${rawText.slice(0, 400)}`);
  let data;
  try { data = JSON.parse(rawText); }
  catch { throw new Error(`Не JSON (${res.status}): ${rawText.slice(0, 400)}`); }

  const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imgUrl) throw new Error('Нет изображения: ' + JSON.stringify(data).slice(0, 400));

  if (imgUrl.startsWith('data:image/')) {
    return Buffer.from(imgUrl.split(',')[1], 'base64');
  }
  const r = await fetch(imgUrl);
  if (!r.ok) throw new Error(`Скачивание ${r.status}: ${imgUrl}`);
  return Buffer.from(await r.arrayBuffer());
}

// ─── Основной цикл ────────────────────────────────────────────────────────────
const targetSlug = process.env.SLUG;
const limit      = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;
const files      = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

let targets = files.filter(file => {
  const slug = file.replace(/\.md$/, '');
  if (targetSlug && slug !== targetSlug && !slug.startsWith(targetSlug)) return false;
  const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  if (!FORCE && /^heroImage:/m.test(content)) return false;
  if (!targetSlug && /^draft:\s*true/m.test(content)) return false;
  return true;
});

if (limit > 0) targets = targets.slice(0, limit);

if (targets.length === 0) {
  const reason = FORCE ? 'нет подходящих статей' : 'все статьи уже имеют heroImage (используйте FORCE=1 для перегенерации)';
  console.log(`Нет статей для генерации: ${reason}.`);
  process.exit(0);
}

console.log(`Модель: ${MODEL}`);
console.log(`FORCE: ${FORCE ? 'да (перезапись существующих)' : 'нет'}`);
if (limit > 0) console.log(`Лимит: ${limit}`);
console.log(`Буду генерировать hero для ${targets.length} статьи(й):\n`);

for (const file of targets) {
  const filePath = path.join(BLOG_DIR, file);
  const content  = fs.readFileSync(filePath, 'utf8');
  const fm       = parseFrontmatter(content);
  if (!fm) { console.warn(`Пропуск ${file}: не распарсился frontmatter`); continue; }

  const slug     = file.replace(/\.md$/, '');
  const title    = fm.title ?? slug;
  const category = (content.match(/categories:\s*\n\s*-\s*(\S+)/) || [])[1] ?? 'zakonodatelstvo';
  const prompt   = buildPrompt(slug, title, category);

  process.stdout.write(`${slug}\n  → ${prompt.slice(0, 90)}...\n  `);
  try {
    const buffer   = await generateImage(prompt);
    const heroPath = `/images/hero/${slug}.jpg`;
    const outPath  = path.join(HERO_DIR, `${slug}.jpg`);
    fs.writeFileSync(outPath, buffer);
    const size = (fs.statSync(outPath).size / 1024).toFixed(0);

    const hasHero = /^heroImage:/m.test(content);
    const updated = hasHero
      ? content.replace(/^heroImage:.*$/m, `heroImage: "${heroPath}"`)
      : content.replace(
          /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
          `$1$2heroImage: "${heroPath}"\n`,
        );
    fs.writeFileSync(filePath, updated);
    console.log(`✓ ${size} KB → ${heroPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово.');
