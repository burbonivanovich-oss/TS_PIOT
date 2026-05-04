/**
 * Генерирует hero-изображения для статей через OpenRouter (FLUX).
 * Использует OpenAI-совместимый endpoint /v1/images/generations.
 *
 * Запуск через GitHub Actions (стандартный способ):
 *   Actions → Generate Article Images → Run workflow
 *
 * Модель по умолчанию: google/gemini-3.1-flash-image-preview
 * Переопределить: HERO_MODEL=google/gemini-2.5-flash-image (дешевле)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const BLOG_DIR  = path.join(ROOT, 'src/content/blog');
const HERO_DIR  = path.join(ROOT, 'public/images/hero');
const MODEL     = process.env.HERO_MODEL ?? 'google/gemini-3.1-flash-image-preview';

fs.mkdirSync(HERO_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

const CAT_STYLE = {
  'ts-piot':         'wide shot of a modern compact POS terminal and receipt printer on a dark retail counter, strong side light, deep shadows, small green LED glowing',
  'markirovka':      'wide shot of retail shelves with consumer goods featuring large bold single-word labels and QR code stickers, warm tungsten lighting, editorial atmosphere',
  'zakonodatelstvo': 'wide minimal desk scene: laptop and stacked documents on a deep navy-blue surface, cool directional window light, blue-grey shadows, clean editorial atmosphere',
  'kkt':             'wide shot of a checkout counter at night, smart POS terminal lit and waiting, warm ambient light, empty counter',
  'egais':           'wide shot of a wine and spirits retail section, densely packed bottle shelves, warm amber lighting, dark upper area',
};

const STYLE_SUFFIX =
  'editorial photography, professional B2B context, no text overlays, no people faces, ' +
  'omit any small print or fine print; keep only naturally large legible text where it belongs, ' +
  'photorealistic, sharp focus, 16:9 aspect ratio';

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

function buildPrompt(title, category) {
  const catStyle = CAT_STYLE[category] ?? 'dark office environment, business documents';
  return `${catStyle}, editorial composition, topic context: ${title}. ${STYLE_SUFFIX}`;
}

async function generateImage(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://etiketka.media',
      'X-Title': 'etiketka.media',
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

const targetSlug = process.env.SLUG;
const limit      = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;
const files      = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

let targets = files.filter(file => {
  if (targetSlug && !file.startsWith(targetSlug) && file !== targetSlug + '.md') return false;
  const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  if (/^heroImage:/m.test(content)) return false;
  if (!targetSlug && /^draft:\s*true/m.test(content)) return false;
  return true;
});

if (limit > 0) targets = targets.slice(0, limit);

if (targets.length === 0) {
  console.log('Нет статей для генерации (все уже имеют heroImage или являются черновиками).');
  process.exit(0);
}

console.log(`Модель: ${MODEL}`);
if (limit > 0) console.log(`Лимит: ${limit} статьи(й)`);
console.log(`Буду генерировать hero для ${targets.length} статьи(й)...\n`);

for (const file of targets) {
  const filePath = path.join(BLOG_DIR, file);
  const content  = fs.readFileSync(filePath, 'utf8');
  const fm       = parseFrontmatter(content);
  if (!fm) { console.warn(`Пропуск ${file}: не распарсился frontmatter`); continue; }

  const slug     = file.replace(/\.md$/, '');
  const title    = fm.title ?? slug;
  const category = (content.match(/categories:\s*\n\s*-\s*(\S+)/) || [])[1] ?? 'zakonodatelstvo';
  const prompt   = buildPrompt(title, category);

  process.stdout.write(`${slug}... `);
  try {
    const buffer   = await generateImage(prompt);
    const heroPath = `/images/hero/${slug}.jpg`;
    const outPath  = path.join(HERO_DIR, `${slug}.jpg`);
    fs.writeFileSync(outPath, buffer);
    const size = (fs.statSync(outPath).size / 1024).toFixed(0);
    const updated = content.replace(
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
