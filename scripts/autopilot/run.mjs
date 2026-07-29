#!/usr/bin/env node
// Автопилот: берёт первый pending-элемент очереди, запускает claude CLI для
// написания статьи, проверяет качество (AI-маркеры, объём) и публикует.
//
// Запуск: node scripts/autopilot/run.mjs
// Требует: ANTHROPIC_API_KEY в окружении
//
// Флаги:
//   DRY_RUN=1  — выводит план и выходит
//   MODEL=...  — модель claude (по умолчанию claude-sonnet-5)

import {
  readFileSync, writeFileSync, readdirSync, existsSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOG_DIR = join(ROOT, 'src', 'content', 'blog');
const QUEUE_FILE = join(ROOT, 'src', 'data', 'autopilot', 'queue.json');
const DRY_RUN = process.env.DRY_RUN === '1';
const MODEL = process.env.MODEL || 'claude-sonnet-5';

function todayISO() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function loadQueue() {
  if (!existsSync(QUEUE_FILE)) throw new Error(`${QUEUE_FILE} не найден — сначала запустите build-queue.mjs`);
  return JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
}

function saveQueue(queue) {
  const stats = {
    total: queue.items.length,
    pending: queue.items.filter(i => i.status === 'pending').length,
    in_progress: queue.items.filter(i => i.status === 'in_progress').length,
    done: queue.items.filter(i => i.status === 'done').length,
    failed: queue.items.filter(i => i.status === 'failed').length,
    highRisk: queue.items.filter(i => i.cannibalizationRisk === 'HIGH').length,
  };
  queue.stats = stats;
  queue.updatedAt = new Date().toISOString();
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2) + '\n');
}

function updateItem(queue, slug, patch) {
  const idx = queue.items.findIndex(i => i.slug === slug);
  if (idx === -1) return;
  queue.items[idx] = { ...queue.items[idx], ...patch };
}

// Считает слова в теле статьи (без frontmatter)
function countWords(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const parts = content.split(/^---$/m);
  const body = parts.length >= 3 ? parts.slice(2).join('---') : content;
  return body.trim().split(/\s+/).filter(Boolean).length;
}

// Переключает draft: true → draft: false в frontmatter
function setDraftFalse(filePath) {
  let content = readFileSync(filePath, 'utf8');
  content = content.replace(/^draft:\s*true\s*$/m, 'draft: false');
  writeFileSync(filePath, content);
}

// Строит prompt для claude
function buildPrompt(item, fileSlug, today) {
  const filePath = `src/content/blog/${fileSlug}.md`;

  return `Напиши статью для портала etiketka-media.ru. Это B2B-информационный ресурс для малого бизнеса России на темы ТС ПИоТ, маркировки «Честный знак» и изменений законодательства.

ЗАДАНИЕ:
Тема: ${item.title}
Целевой поисковый запрос: ${item.targetQuery}
Категория: ${item.category}
Кластер: ${item.cluster}
CPA-баннер: ${item.cpa}
Приоритет: ${item.priority}

ФАЙЛ для сохранения: ${filePath}

FRONTMATTER (обязательно точно такая структура):
---
title: "${item.title}"
description: "[140–160 символов, содержит целевой запрос + конкретная польза]"
pubDate: "${today}"
heroImage: "/images/hero/${fileSlug}.jpg"
reviewDate: "${today.slice(0, 7)}-${String(new Date(new Date(today).setMonth(new Date(today).getMonth() + 6)).getMonth() + 1).padStart(2, '0')}-01"
tags:
  - [4–6 тегов строчными буквами без кавычек]
categories:
  - ${item.category}
draft: true
cpa: '${item.cpa}'
seo:
  keywords:
    - ${item.targetQuery}
    - [2–3 дополнительных варианта целевого запроса]
---

СТРУКТУРА СТАТЬИ (1500–2200 слов):
1. Лид: 2–3 предложения — главный факт и почему это важно прямо сейчас
2. 5–7 H2-разделов, раскрывающих тему последовательно
3. Минимум 1 таблица или пошаговый список
4. FAQ: минимум 4 вопроса-ответа в конце (формат ### Вопрос / ответ)
5. Заключение с 2–3 внутренними ссылками на смежные статьи

СТИЛЬ:
- Активный залог: «проверьте», «настройте», «подключите», «выберите»
- Прямое обращение к читателю: «вы», «ваш», «у вас»
- Числа цифрами, конкретные даты (формат 01.07.2026)
- Каждый факт — с ссылкой на НПА или первоисточник (consultant.ru, pravo.gov.ru, честныйзнак.рф)
- Запрещённые слова: является, осуществляет, в целях, следует отметить, таким образом, в данном контексте, с точки зрения, важно отметить, необходимо учитывать
- Без эмодзи, без восклицательных знаков

ВНУТРЕННИЕ ССЫЛКИ:
Прочитай несколько статей из src/content/blog/ из категории ${item.category} и смежных кластеров, найди 3–5 подходящих для ссылок. Вставь якорные ссылки в текст (не в конец) с описательным anchor-текстом.

ВАЖНО:
- Сохрани файл как ${filePath}
- draft: true (не меняй на false)
- НЕ делай git commit
- НЕ делай git push
- НЕ создавай другие файлы
`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !DRY_RUN) {
    throw new Error('ANTHROPIC_API_KEY не задан');
  }

  const queue = loadQueue();

  // Ищем первый pending элемент без HIGH-риска каннибализации
  const item = queue.items.find(
    i => i.status === 'pending' && i.cannibalizationRisk !== 'HIGH',
  );

  if (!item) {
    const highRiskPending = queue.items.filter(
      i => i.status === 'pending' && i.cannibalizationRisk === 'HIGH',
    ).length;
    console.log(
      `run: нет pending-тем без HIGH-риска каннибализации` +
      (highRiskPending ? ` (${highRiskPending} отложены из-за HIGH-риска)` : ''),
    );
    return;
  }

  const today = todayISO();
  const fileSlug = `${today}-${item.slug}`;
  const targetFile = join(BLOG_DIR, `${fileSlug}.md`);

  console.log(`run: выбрана тема [${item.priority}] "${item.title}" (${item.targetQuery})`);

  if (DRY_RUN) {
    console.log(`DRY_RUN=1 — файл не создаётся. Планируемый путь: src/content/blog/${fileSlug}.md`);
    return;
  }

  // Отмечаем in_progress
  updateItem(queue, item.slug, { status: 'in_progress', startedAt: new Date().toISOString() });
  saveQueue(queue);

  // Снимок blog/ до запуска
  const beforeFiles = new Set(readdirSync(BLOG_DIR).filter(f => f.endsWith('.md')));

  const prompt = buildPrompt(item, fileSlug, today);

  console.log(`run: запуск claude (model=${MODEL})…`);
  const result = spawnSync(
    'claude',
    ['--dangerously-skip-permissions', '--model', MODEL, '-p', prompt],
    {
      cwd: ROOT,
      timeout: 20 * 60 * 1000, // 20 минут
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env },
    },
  );

  if (result.error) {
    const msg = `claude завершился с ошибкой: ${result.error.message}`;
    console.error(`run: ✗ ${msg}`);
    updateItem(queue, item.slug, { status: 'failed', lastError: msg, completedAt: new Date().toISOString() });
    saveQueue(queue);
    process.exit(1);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').slice(0, 500);
    const msg = `claude exit ${result.status}: ${stderr}`;
    console.error(`run: ✗ ${msg}`);
    updateItem(queue, item.slug, { status: 'failed', lastError: msg, completedAt: new Date().toISOString() });
    saveQueue(queue);
    process.exit(1);
  }

  // Ищем новый файл
  const afterFiles = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  const newFiles = afterFiles.filter(f => !beforeFiles.has(f));

  if (!newFiles.length) {
    // Проверяем, создал ли claude именно тот файл, который мы ожидали
    if (!existsSync(targetFile)) {
      const msg = `claude не создал ни одного md-файла в blog/`;
      console.error(`run: ✗ ${msg}`);
      updateItem(queue, item.slug, { status: 'failed', lastError: msg, completedAt: new Date().toISOString() });
      saveQueue(queue);
      process.exit(1);
    }
    newFiles.push(basename(targetFile));
  }

  const newFile = newFiles[0];
  const newFilePath = join(BLOG_DIR, newFile);
  console.log(`run: создан файл ${newFile}`);

  // QA-1: проверка AI-маркеров (порог ≤5)
  const aiCheck = spawnSync(
    'node',
    ['scripts/check-ai-markers.mjs', newFilePath, '--threshold=5'],
    { cwd: ROOT, encoding: 'utf8', timeout: 30_000 },
  );
  const aiPass = aiCheck.status === 0;
  const aiOutput = (aiCheck.stdout || '').trim().split('\n').slice(-3).join(' ');
  if (!aiPass) {
    console.warn(`run: ⚠ check-ai-markers: превышен порог\n  ${aiOutput}`);
  } else {
    console.log(`run: ✓ check-ai-markers: ${aiOutput}`);
  }

  // QA-2: подсчёт слов
  const words = countWords(newFilePath);
  const wordPass = words >= 800;
  console.log(`run: ${wordPass ? '✓' : '⚠'} слов в статье: ${words} (порог ≥ 800)`);

  if (!aiPass || !wordPass) {
    const reason = [
      !aiPass && `AI-score > 5`,
      !wordPass && `слов ${words} < 800`,
    ].filter(Boolean).join(', ');

    console.error(`run: ✗ QA не пройдена (${reason}) — статья остаётся draft:true, статус: failed`);
    updateItem(queue, item.slug, {
      status: 'failed',
      lastError: `QA: ${reason}`,
      generatedFile: newFile,
      completedAt: new Date().toISOString(),
    });
    saveQueue(queue);
    process.exit(1);
  }

  // QA пройдена → публикуем
  setDraftFalse(newFilePath);
  console.log(`run: ✓ draft: false установлен`);

  updateItem(queue, item.slug, {
    status: 'done',
    generatedFile: newFile,
    wordCount: words,
    completedAt: new Date().toISOString(),
    lastError: null,
  });
  saveQueue(queue);

  console.log(`run: готово — "${item.title}" опубликована как ${newFile}`);
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
