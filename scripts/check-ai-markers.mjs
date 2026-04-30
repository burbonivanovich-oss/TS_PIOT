/**
 * Автоматическая проверка текста на AI-маркеры (русский язык).
 * Запуск: node scripts/check-ai-markers.mjs <файл.md>
 *         node scripts/check-ai-markers.mjs src/content/blog/  # все файлы
 * Флаги:
 *   --threshold=N  порог скора для exit(1) (по умолчанию 6)
 *   --json         вывод в JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Маркеры: [regex, вес, замена]
const MARKERS = [
  // Вводные клише
  [/следует\s+отметить/gi,                    2, 'удалить или переформулировать'],
  [/важно\s+(?:понимать|отметить|учитывать)/gi, 2, 'удалить или конкретизировать'],
  [/необходимо\s+(?:учитывать|отметить)/gi,   2, 'удалить'],
  [/в\s+заключени[ие]\s+(?:можно|следует)/gi, 3, 'просто написать вывод без вводного'],
  [/подводя\s+итог/gi,                         2, 'удалить'],
  [/таким\s+образом[,\s]/gi,                   1, 'убрать или заменить конкретным выводом'],
  [/вместе\s+с\s+тем/gi,                       1, 'удалить или «но»'],
  [/помимо\s+этого/gi,                          1, 'удалить или «ещё»'],
  [/в\s+данном\s+контексте/gi,                 2, 'удалить'],
  [/одним\s+из\s+ключевых/gi,                  2, 'сказать конкретно что именно'],
  [/ключевым\s+аспектом\s+является/gi,         2, 'переформулировать'],

  // Пассивные глаголы
  [/\bявляется\b/gi,                            1, 'заменить на тире или живой глагол'],
  [/\bявляются\b/gi,                            1, 'заменить на тире или живой глагол'],
  [/\bосуществля[ея]тся\b/gi,                  2, 'заменить на конкретный глагол'],
  [/\bосуществлять\b/gi,                        1, 'заменить: делать, вести, проводить'],
  [/\bреализуется\b/gi,                         1, 'выполняется, работает'],
  [/\bпроизводится\b/gi,                        1, 'делается, происходит'],
  [/\bприменяется\b/gi,                         1, 'используется, действует'],

  // Канцелярные существительные
  [/\bданный\b/gi,                              1, '→ этот'],
  [/\bданная\b/gi,                              1, '→ эта'],
  [/\bданное\b/gi,                              1, '→ это'],
  [/\bданные\b(?!\s+(?:из|о|по|за|в|от))/gi,   1, '→ эти (если не «данные» как существительное)'],
  [/актуальным\s+является/gi,                   2, 'удалить'],
  [/немаловажным\s+является/gi,                 2, 'удалить'],
  [/в\s+настоящее\s+время/gi,                   1, '→ сейчас'],
  [/на\s+сегодняшний\s+день/gi,                 1, '→ сейчас или конкретная дата'],
  [/надлежащим\s+образом/gi,                    2, '→ как положено или удалить'],
  [/в\s+полном\s+объёме/gi,                     1, '→ полностью или удалить'],
  [/конечн(?:ый|ого|ому)\s+потребител/gi,       2, '→ покупатель'],
  [/в\s+рамках\s+(?:данной|настоящей)/gi,       2, '→ в статье, здесь'],

  // Оценочные клише
  [/играет\s+(?:важную|ключевую|значительную)\s+роль/gi, 2, 'сказать конкретно что и как'],
  [/оказывает\s+(?:существенное|значительное|важное)\s+влияние/gi, 2, 'как именно влияет?'],
  [/в\s+целом\s+можно\s+сказать/gi,             2, 'удалить'],
  [/как\s+правило[,\s]/gi,                       1, 'проверить: это всегда так? если да — убрать'],
];

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\n/, '');
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')  // code blocks
    .replace(/`[^`]+`/g, '')         // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/#{1,6}\s/g, '');       // headings
}

function analyzeText(text, filename) {
  const body = stripMarkdown(stripFrontmatter(text));
  const lines = body.split('\n');

  const hits = [];
  let totalWeight = 0;

  for (const [re, weight, fix] of MARKERS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) {
      // Найти номер строки
      const lineNo = body.slice(0, m.index).split('\n').length;
      hits.push({ line: lineNo, phrase: m[0], fix, weight });
      totalWeight += weight;
    }
  }

  // Структурный анализ
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim().length > 50);
  const paraLengths = paragraphs.map(p => p.split(/[.!?]/).filter(s => s.trim()).length);
  const avgLen = paraLengths.reduce((a, b) => a + b, 0) / (paraLengths.length || 1);
  const variance = paraLengths.reduce((a, b) => a + Math.abs(b - avgLen), 0) / (paraLengths.length || 1);
  const uniformParagraphs = variance < 0.8 && paragraphs.length > 4;

  // Скор: 0–10
  const rawScore = Math.min(10, Math.round(totalWeight / 3));

  return { filename, hits, totalWeight, rawScore, uniformParagraphs, paragraphCount: paragraphs.length };
}

function scoreLabel(s) {
  if (s <= 2) return 'Публиковать без правок';
  if (s <= 5) return 'Заменить стоп-фразы, проверить структуру';
  if (s <= 8) return 'Переписать проблемные секции';
  return 'Переписать статью целиком';
}

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const THRESHOLD = parseInt(flags.threshold ?? '6', 10);
const AS_JSON = flags.json === true;

if (!args[0]) {
  console.error('Использование: node scripts/check-ai-markers.mjs <файл.md или папка>');
  process.exit(1);
}

const target = path.resolve(args[0]);
let files = [];

if (fs.statSync(target).isDirectory()) {
  files = fs.readdirSync(target)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(target, f));
} else {
  files = [target];
}

const results = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (/^draft:\s*true/m.test(content)) {
    // не пропускаем драфты — проверяем их тоже, просто помечаем
  }
  results.push(analyzeText(content, path.relative(process.cwd(), file)));
}

if (AS_JSON) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.some(r => r.rawScore >= THRESHOLD) ? 1 : 0);
}

let anyAboveThreshold = false;

for (const r of results) {
  const above = r.rawScore >= THRESHOLD;
  if (above) anyAboveThreshold = true;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Файл:   ${r.filename}`);
  console.log(`Скор:   ${r.rawScore}/10  — ${scoreLabel(r.rawScore)}`);
  if (r.uniformParagraphs) {
    console.log(`⚠  Структура: абзацы однородной длины (признак AI)`);
  }

  if (r.hits.length === 0) {
    console.log('Стоп-фраз не найдено.');
    continue;
  }

  console.log(`\nСтоп-фразы (${r.hits.length} вхождений, суммарный вес ${r.totalWeight}):\n`);
  console.log('Стр.'.padEnd(6) + 'Фраза'.padEnd(45) + 'Замена');
  console.log('─'.repeat(90));
  for (const h of r.hits.sort((a, b) => a.line - b.line)) {
    console.log(
      String(h.line).padEnd(6) +
      h.phrase.padEnd(45) +
      h.fix
    );
  }
}

console.log('');
process.exit(anyAboveThreshold ? 1 : 0);
