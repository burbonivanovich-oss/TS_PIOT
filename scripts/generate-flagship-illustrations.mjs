/**
 * Генерирует иллюстрации к шагам флагмана-симулятора «Как живёт чек в ТС ПИоТ».
 * Промты и стиль — из src/content/wiki/flagship-ts-piot-moodboard.md.
 *
 * Запуск: GitHub Actions → Generate Flagship Illustrations → Run workflow
 *
 * Env-переменные:
 *   OPENROUTER_API_KEY  — обязателен
 *   FLAGSHIP_MODEL      — модель (по умолчанию google/gemini-3.1-flash-image-preview)
 *   STEPS               — список шагов через запятую, например "1,7" (по умолчанию все)
 *   FORCE               — "1" чтобы перезаписать существующие
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const OUT_DIR   = path.join(ROOT, 'public/images/flagship');
const MODEL     = process.env.FLAGSHIP_MODEL ?? 'google/gemini-3.1-flash-image-preview';
const FORCE     = process.env.FORCE === '1';
const ONLY      = (process.env.STEPS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

fs.mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

// ─── Базовый стилевой префикс ─────────────────────────────────────────────────
// Из flagship-ts-piot-moodboard.md, раздел «Базовый промт для Nano Banana».
const STYLE_PREFIX =
  'Flat semi-isometric illustration in editorial explainer style, ' +
  'reminiscent of notdotteam.github.io/trust and molyanov.ru visualizations. ' +
  'Sand-colored background (#F4EBD9), dark charcoal lines (#1F1F1F), equal stroke weight. ' +
  'Two accent colors maximum per image: primary pink (#FF4D8F) for the focal element ' +
  'and secondary lime (#C8FF6B) for data flow arrows or active states. ' +
  'No people, no realistic 3D, no stock-photo aesthetic. ' +
  'Clean composition with one dominant object and supporting smaller elements. ' +
  'Russian B2B explainer context — should look like a page from a long-form interactive ' +
  'article about retail compliance systems.';

// ─── Шаги сценария ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: '0',
    aspect: '16:9',
    subject:
      'A grocery store cash register from a 30-degree isometric angle; on the conveyor belt ' +
      'lies a single retail package of candy (zefir or marshmallow-style sweet) with a clearly ' +
      'visible DataMatrix code on its label. Above the scene floats a thin line "3 seconds" in ' +
      'dark charcoal. Mood: calm, anticipatory, hint of "something invisible is about to happen".',
  },
  {
    id: '1',
    aspect: '4:3',
    subject:
      'A large DataMatrix code (the GS1 type, square dotted pattern) shown frontally, taking 60% ' +
      'of the frame. To the right, three horizontal bands extending from the code, each labeled ' +
      'with one short term: "GTIN", "Serial", "Crypto-tail". Light pink highlight on the ' +
      '"Crypto-tail" band — that is the primary focus. Small lime triangle marker pointing to the ' +
      'gap between bands, indicating an invisible GS separator.',
  },
  {
    id: '2',
    aspect: '4:3',
    subject:
      'An isometric outline of a POS terminal (cash register) cut into two layered zones. ' +
      'Top zone labeled "Hardware" contains a small chip-like icon labeled "ФН" (fiscal storage). ' +
      'Bottom zone labeled "Software" contains six labeled rectangles arranged in a grid: ' +
      '"Кассовая программа", "Драйвер ККТ", "Драйвер сканера", "ОФД-модуль", "ТС ПИоТ" (this one ' +
      'pink-highlighted), "ЛМ ЧЗ". Clean borders, no shadows.',
  },
  {
    id: '3',
    aspect: '4:3',
    subject:
      'A POS terminal on the left, a stylized cloud labeled "Честный знак" on the right, ' +
      'connected by a lime arrow. Between them, a small envelope-shaped JSON pack labeled ' +
      '"{ cm, inn, kkt_rn, op_type }". A semi-transparent timer arc in the corner shows ' +
      '"1.5 sec" — pink highlight.',
  },
  {
    id: '4',
    aspect: '4:3',
    subject:
      'Three vertical option cards stacked left-to-right: "✓ Валиден" (lime tint), ' +
      '"⚠ Выведен из оборота" (pink tint, primary focus, slightly larger), ' +
      '"✗ Нет в системе" (charcoal). Above all three — small cloud labeled "Честный знак" as the source ' +
      'of the response. Three thin arrows from the cloud down to each card.',
  },
  {
    id: '5',
    aspect: '4:3',
    subject:
      'A long thermal receipt rendered semi-isometrically (tilted slightly to the right), with ' +
      'three highlighted lines forming a connected block: "[1163] Код товара", ' +
      '"[2106] Результат проверки", "[1265] ID запроса". The block has a thin pink border ' +
      'around it to emphasize the grouped structure. Sand background, no shadows.',
  },
  {
    id: '6',
    aspect: '4:3',
    subject:
      'Left side: a POS terminal. Center: an "ОФД" rectangle. Right side: a fork — one lime arrow ' +
      'rising up to a rectangle labeled "ФНС", one pink arrow extending down-right to a cloud labeled ' +
      '"Честный знак". Small clock icons next to each arrow: "секунды" for ФНС, "минуты" for ЧЗ.',
  },
  {
    id: '7',
    aspect: '4:3',
    subject:
      'A horizontal flow diagram of five status circles connected by arrows: "Эмитирован" → ' +
      '"Нанесён" → "В обороте" → "Выведен из оборота" (pink-highlighted, primary focus, slightly ' +
      'enlarged) with a sixth branching off labeled "Заблокирован". Below the highlighted circle — ' +
      'a small rectangular info card with rows: "ИНН", "ККТ", "ФД", "ФПД", "дата".',
  },
];

// ─── API ──────────────────────────────────────────────────────────────────────
async function callOpenRouter(prompt) {
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
  if (!imgUrl) {
    const reply = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
    const err = new Error(`Нет изображения. Модель вернула: ${String(reply).slice(0, 200)}`);
    err.code = 'NO_IMAGE';
    throw err;
  }

  if (imgUrl.startsWith('data:image/')) {
    return Buffer.from(imgUrl.split(',')[1], 'base64');
  }
  const r = await fetch(imgUrl);
  if (!r.ok) throw new Error(`Скачивание ${r.status}: ${imgUrl}`);
  return Buffer.from(await r.arrayBuffer());
}

// Главный вызов с retry: на ответе без изображения модель иногда
// возвращает только текст (объяснение, что бы она сгенерила). Один
// retry с усиленным промтом «output image only» обычно лечит.
async function generateImage(prompt) {
  try {
    return await callOpenRouter(prompt);
  } catch (err) {
    if (err.code !== 'NO_IMAGE') throw err;
    process.stdout.write(`retry (text-only response) → `);
    const reinforced =
      'Output: a single image, no text explanation, no markdown. ' + prompt;
    return await callOpenRouter(reinforced);
  }
}

function buildPrompt(step) {
  return `${STYLE_PREFIX} Aspect ratio: ${step.aspect}. Subject: ${step.subject}`;
}

// ─── Основной цикл ────────────────────────────────────────────────────────────
const targets = STEPS.filter(s => {
  if (ONLY.length > 0 && !ONLY.includes(s.id)) return false;
  const outPath = path.join(OUT_DIR, `step-${s.id}.jpg`);
  if (!FORCE && fs.existsSync(outPath)) return false;
  return true;
});

if (targets.length === 0) {
  console.log('Нет шагов для генерации (используйте FORCE=1 для перезаписи).');
  process.exit(0);
}

console.log(`Модель: ${MODEL}`);
console.log(`FORCE: ${FORCE ? 'да' : 'нет'}`);
console.log(`Шаги: ${targets.map(t => t.id).join(', ')}\n`);

const failures = [];
for (const step of targets) {
  const prompt = buildPrompt(step);
  const outPath = path.join(OUT_DIR, `step-${step.id}.jpg`);
  process.stdout.write(`step-${step.id} (${step.aspect})\n  → ${prompt.slice(0, 90)}...\n  `);
  try {
    const buffer = await generateImage(prompt);
    fs.writeFileSync(outPath, buffer);
    console.log(`OK → public/images/flagship/step-${step.id}.jpg (${(buffer.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    failures.push({ id: step.id, error: err.message });
  }
}

const succeeded = targets.length - failures.length;
console.log(`\nГотово. Успешно: ${succeeded}/${targets.length}.`);
if (failures.length) {
  console.log('Сбои:');
  for (const f of failures) console.log(`  step-${f.id}: ${f.error}`);
}

// Exit-стратегия: даже при частичном успехе возвращаем 0, чтобы
// следующий step workflow (commit) сохранил то, что получилось.
// Полный провал (0 успехов) — exit 1, чтобы workflow честно
// помечался failed.
if (succeeded === 0) process.exit(1);
