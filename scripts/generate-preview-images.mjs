/**
 * Генерирует превью-изображения для карточек статей через OpenRouter (FLUX).
 * Использует OpenAI-совместимый endpoint /v1/images/generations.
 *
 * Запуск через GitHub Actions (стандартный способ):
 *   Actions → Generate Article Images → Run workflow
 *
 * Модель по умолчанию: google/gemini-3.1-flash-image-preview
 * Переопределить: PREVIEW_MODEL=google/gemini-2.5-flash-image (дешевле)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, '..');
const BLOG_DIR    = path.join(ROOT, 'src/content/blog');
const PREVIEW_DIR = path.join(ROOT, 'public/images/preview');
const MODEL       = process.env.PREVIEW_MODEL ?? 'google/gemini-3.1-flash-image-preview';

fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('OPENROUTER_API_KEY не задан'); process.exit(1); }

const CAT_STYLE = {
  'ts-piot':         'modern compact POS terminal and receipt printer on a dark retail counter, strong directional side light, dark charcoal background',
  'markirovka':      'consumer product packages with QR labels arranged on a cream-beige surface, clean overhead light, minimal editorial still life',
  'zakonodatelstvo': 'stack of printed documents and a pen on a cream-beige desk, sharp angular window light, clean minimal composition',
  'kkt':             'smart POS terminal on a dark counter, warm ambient light, moody retail atmosphere',
  'egais':           'wine and spirits bottles on a dark bar surface, strong backlight rim highlights, moody atmosphere',
};

const STYLE_SUFFIX =
  'editorial photography, professional B2B context, no text overlays, no people faces, ' +
  'photorealistic, sharp focus, 4:3 aspect ratio';

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
  return `${catStyle}, editorial still life composition, topic context: ${title}. ${STYLE_SUFFIX}`;
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
  if (/^previewImage:/m.test(content)) return false;
  if (!targetSlug && /^draft:\s*true/m.test(content)) return false;
  return true;
});

if (limit > 0) targets = targets.slice(0, limit);

if (targets.length === 0) {
  console.log('Нет статей для генерации (все уже имеют previewImage или являются черновиками).');
  process.exit(0);
}

console.log(`Модель: ${MODEL}`);
if (limit > 0) console.log(`Лимит: ${limit} статьи(й)`);
console.log(`Буду генерировать превью для ${targets.length} статьи(й)...\n`);

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
    const buffer      = await generateImage(prompt);
    const previewPath = `/images/preview/${slug}.jpg`;
    const outputPath  = path.join(PREVIEW_DIR, `${slug}.jpg`);
    fs.writeFileSync(outputPath, buffer);
    const size = (fs.statSync(outputPath).size / 1024).toFixed(0);
    const updated = content.replace(
      /^(---\n[\s\S]*?)(pubDate:[^\n]*\n)/m,
      `$1$2previewImage: "${previewPath}"\n`,
    );
    fs.writeFileSync(filePath, updated);
    console.log(`✓ ${size} KB → ${previewPath}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

console.log('\nГотово.');
