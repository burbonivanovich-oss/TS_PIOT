/**
 * Тест генерации 3 изображений из пула через OpenRouter FLUX.2-max.
 * Выводит стоимость каждого запроса и итог.
 *
 * Запуск:
 *   OPENROUTER_API_KEY=... node scripts/test-pool-generation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const OUT_DIR   = path.join(ROOT, 'scripts', 'pool-test-output');
const MODEL     = 'black-forest-labs/flux.2-max';

fs.mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('OPENROUTER_API_KEY не задан. Запуск: OPENROUTER_API_KEY=... node scripts/test-pool-generation.mjs');
  process.exit(1);
}

// 3 промпта из разных блоков пула (universal, ts-piot, markirovka)
const TESTS = [
  {
    name: 'universal-dark-03',
    type: 'hero',
    width: 1344,
    height: 768,
    prompt:
      'Overhead shot of a dark wooden desk surface, completely empty, single narrow ' +
      'window light strip across the surface, deep shadows in wood grain, ' +
      'clean minimal abstract, no objects, photorealistic, ' +
      'high contrast editorial photography, dark dramatic lighting, sharp shadows, ' +
      'professional B2B context, no text overlays',
  },
  {
    name: 'ts-piot-01',
    type: 'hero',
    width: 1344,
    height: 768,
    prompt:
      'Wide shot of a modern compact POS terminal and receipt printer on a dark retail counter, ' +
      'strong side lighting creating sharp shadows, dark background, ' +
      'small status LED glowing on terminal, bold editorial product photography, ' +
      'no text on screen, no readable labels, photorealistic, ' +
      'high contrast editorial photography, sharp shadows, professional B2B context, no text overlays',
  },
  {
    name: 'markirovka-02',
    type: 'preview',
    width: 800,
    height: 600,
    prompt:
      'Close-up macro of a QR-code label on a product package, sharp focus on code cells, ' +
      'soft blurred background in dark tones, single spot light, dramatic shadows, ' +
      'editorial detail shot, photorealistic, ' +
      'high contrast editorial photography, dark dramatic lighting, no text overlays',
  },
];

async function generate(test) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://etiketka.media',
      'X-Title': 'Этикетка Медиа',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: test.prompt }],
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 600)}`);

  const data = JSON.parse(raw);

  // Стоимость из OpenRouter usage
  const usage     = data.usage ?? {};
  const costUsd   = usage.cost ?? null;  // OpenRouter пишет total_cost или cost
  const totalCost = data.usage?.total_cost ?? costUsd;

  // Извлекаем изображение
  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new Error('Нет message: ' + raw.slice(0, 400));

  let imgBuffer = null;

  // Вариант 1: content — строка-URL
  if (typeof msg.content === 'string') {
    const url = msg.content.trim();
    if (/^https?:\/\//.test(url)) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Скачивание ${r.status}: ${url}`);
      imgBuffer = Buffer.from(await r.arrayBuffer());
    } else if (url.startsWith('data:')) {
      imgBuffer = Buffer.from(url.split(',')[1], 'base64');
    }
  }

  // Вариант 2: content — массив частей
  if (!imgBuffer && Array.isArray(msg.content)) {
    for (const part of msg.content) {
      const url = part?.image_url?.url;
      if (!url) continue;
      if (url.startsWith('data:')) { imgBuffer = Buffer.from(url.split(',')[1], 'base64'); break; }
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Скачивание ${r.status}`);
      imgBuffer = Buffer.from(await r.arrayBuffer());
      break;
    }
  }

  // Вариант 3: images field (некоторые провайдеры)
  if (!imgBuffer && Array.isArray(msg.images)) {
    const url = msg.images[0]?.image_url?.url;
    if (url) {
      if (url.startsWith('data:')) { imgBuffer = Buffer.from(url.split(',')[1], 'base64'); }
      else {
        const r = await fetch(url);
        imgBuffer = Buffer.from(await r.arrayBuffer());
      }
    }
  }

  if (!imgBuffer) throw new Error('Изображение не найдено в ответе:\n' + raw.slice(0, 800));

  return { imgBuffer, totalCost, raw };
}

console.log(`Модель: ${MODEL}`);
console.log(`Генерируем 3 изображения...\n`);

let totalCostAll = 0;

for (const test of TESTS) {
  process.stdout.write(`[${test.name}] (${test.width}×${test.height}) ... `);
  const start = Date.now();
  try {
    const { imgBuffer, totalCost, raw } = await generate(test);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const outPath = path.join(OUT_DIR, `${test.name}.jpg`);
    fs.writeFileSync(outPath, imgBuffer);
    const sizeKb = (imgBuffer.length / 1024).toFixed(0);
    const costStr = totalCost != null ? `$${Number(totalCost).toFixed(4)}` : 'неизвестно';
    if (totalCost != null) totalCostAll += Number(totalCost);
    console.log(`✓ ${elapsed}s  ${sizeKb} KB  стоимость: ${costStr}`);
    console.log(`   → ${outPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Итого за 3 изображения: $${totalCostAll.toFixed(4)}`);
if (totalCostAll > 0) {
  const perImg = totalCostAll / TESTS.length;
  const fullPool = perImg * 72;
  console.log(`Среднее за изображение: $${perImg.toFixed(4)}`);
  console.log(`Оценка полного пула (72 шт.): $${fullPool.toFixed(2)}`);
}
