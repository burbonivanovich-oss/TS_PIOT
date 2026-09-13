import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseFrontmatter, setFrontmatterField, readJson, writeJson, writeArticle } from './content.mjs';

const SAMPLE = `---
title: "ТС ПИоТ: что это"
pubDate: "2026-05-01"
draft: false
tags:
  - тс пиот
  - касса
seo:
  keywords:
    - что такое ТС ПИоТ
    - ТС ПИоТ кассы
  noindex: false
inline: [первый, второй]
---

Первый абзац.
`;

test('парсер читает списки, вложенность и inline-последовательности', () => {
  const { data, body } = parseFrontmatter(SAMPLE);
  assert.equal(data.title, 'ТС ПИоТ: что это');
  assert.equal(data.draft, false);
  assert.deepEqual(data.tags, ['тс пиот', 'касса']);
  assert.deepEqual(data.seo.keywords, ['что такое ТС ПИоТ', 'ТС ПИоТ кассы']);
  assert.equal(data.seo.noindex, false);
  assert.deepEqual(data.inline, ['первый', 'второй']);
  assert.ok(body.includes('Первый абзац.'));
});

test('setFrontmatterField меняет только свою строку', () => {
  const { raw } = parseFrontmatter(SAMPLE);
  const updated = setFrontmatterField(raw, 'draft', true);
  assert.ok(updated.includes('draft: true'));
  assert.ok(updated.includes('- тс пиот'), 'списки не должны пострадать');
  assert.equal(updated.split('\n').length, raw.split('\n').length);
});

test('setFrontmatterField добавляет отсутствующее поле', () => {
  const { raw } = parseFrontmatter(SAMPLE);
  const updated = setFrontmatterField(raw, 'updatedDate', '2026-08-10');
  assert.ok(updated.includes('updatedDate: "2026-08-10"'));
});

test('запись после чтения не меняет файл побайтно', () => {
  // Инвариант всей автоматики: прогон перелинковки по статье, где нечего
  // менять, обязан оставить файл нетронутым — иначе каждый прогон порождает
  // diff по всему корпусу и историю правок невозможно читать.
  const { raw, body } = parseFrontmatter(SAMPLE);
  assert.equal(`---\n${raw}\n---\n${body}`, SAMPLE);
});

test('AP-P1-12: CRLF и BOM переживают правку байт в байт', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'frontmatter-'));
  const articleOf = (file, source) => {
    const parsed = parseFrontmatter(source);
    return { path: file, fm: parsed.raw, body: parsed.body, bom: parsed.bom, eol: parsed.eol };
  };

  const crlf = SAMPLE.replace(/\n/g, '\r\n');
  const crlfFile = path.join(dir, 'crlf.md');
  writeFileSync(crlfFile, crlf, 'utf8');
  const crlfParsed = parseFrontmatter(crlf);
  assert.equal(crlfParsed.bom, false);
  assert.equal(crlfParsed.eol, '\r\n');
  assert.equal(crlfParsed.data.title, 'ТС ПИоТ: что это');
  writeArticle(articleOf(crlfFile, crlf));
  assert.equal(readFileSync(crlfFile, 'utf8'), crlf, 'CRLF-файл не должен переписываться');

  const withBom = `\uFEFF${SAMPLE}`;
  const bomFile = path.join(dir, 'bom.md');
  writeFileSync(bomFile, withBom, 'utf8');
  const bomParsed = parseFrontmatter(withBom);
  assert.equal(bomParsed.bom, true, 'BOM должен распознаваться, иначе frontmatter не парсится');
  assert.equal(bomParsed.data.title, 'ТС ПИоТ: что это');
  writeArticle(articleOf(bomFile, withBom));
  assert.equal(readFileSync(bomFile, 'utf8'), withBom, 'BOM-файл не должен терять BOM');
});

test('AP-P0-07: обрезанный JSON каждого state-файла останавливает проход', () => {
  // autopilot.json, backlog.json, orders.json — representative payloads;
  // требование одно: syntax error пробрасывается с именем файла, а не
  // заменяется пустым состоянием.
  const dir = mkdtempSync(path.join(tmpdir(), 'json-strict-'));
  const payloads = {
    'autopilot.json': '{"version": 1, "counters": {"new":',
    'backlog.json': '{"generatedAt": "2026-09-13", "topics": [{"slug":',
    'orders.json': '{"generatedAt": "2026-09-13", "orders": [',
  };
  for (const [name, truncated] of Object.entries(payloads)) {
    const file = path.join(dir, name);
    writeFileSync(file, truncated, 'utf8');
    assert.throws(() => readJson(file, {}), new RegExp(name), `обрезанный ${name} должен бросать исключение`);
  }
});

test('AP-P0-07: fallback только для отсутствующего файла', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'json-strict-'));
  const missing = path.join(dir, 'never-created.json');
  assert.deepEqual(readJson(missing, { orders: [] }), { orders: [] });
  // Ошибка I/O (чтение каталога как файла) — не ENOENT: пробрасывается.
  assert.throws(() => readJson(dir, {}), /Не читается/);
});

test('AP-P0-08: запись сериализуется до касания диска', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'json-atomic-'));
  const file = path.join(dir, 'state.json');
  writeJson(file, { version: 1 });
  const before = readFileSync(file, 'utf8');
  const circular = {};
  circular.self = circular;
  assert.throws(() => writeJson(file, circular));
  assert.equal(readFileSync(file, 'utf8'), before, 'несериализуемое значение не должно трогать файл');
});

test('AP-P0-08: предыдущая версия сохраняется в .bak, временных файлов не остаётся', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'json-atomic-'));
  const file = path.join(dir, 'state.json');
  writeJson(file, { version: 1 });
  assert.equal(existsSync(`${file}.bak`), false, 'первая запись: бэкапа ещё нет');
  writeJson(file, { version: 2 });
  assert.deepEqual(readJson(`${file}.bak`, null), { version: 1 });
  assert.deepEqual(readJson(file, null), { version: 2 });
  const leftovers = readdirSync(dir).filter((f) => f.includes('.tmp-'));
  assert.deepEqual(leftovers, [], 'временные файлы записи не должны оставаться');
});

test('AP-P0-08: восстановление из .bak после повреждения основного файла', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'json-atomic-'));
  const file = path.join(dir, 'state.json');
  writeJson(file, { version: 1 });
  writeJson(file, { version: 2 });
  writeFileSync(file, '{"version": 2, "counte', 'utf8'); // обрезанный JSON
  assert.throws(() => readJson(file, {}), /Повреждён JSON/);
  // Путь восстановления оператора: бэкап читается, поверх него продолжается работа.
  const backup = readJson(`${file}.bak`, null);
  assert.deepEqual(backup, { version: 1 });
  writeJson(file, backup);
  assert.deepEqual(readJson(file, null), { version: 1 });
});

test('AP-P0-08: повреждённый основной файл не затирает валидный .bak', () => {
  // Регрессия: восстановление через writeJson(file, backup) копировало
  // повреждённый основной файл поверх хорошего .bak и уничтожало
  // единственную recoverable-копию.
  const dir = mkdtempSync(path.join(tmpdir(), 'json-atomic-'));
  const file = path.join(dir, 'state.json');
  writeJson(file, { version: 1 });
  writeJson(file, { version: 2 });
  assert.deepEqual(readJson(`${file}.bak`, null), { version: 1 });
  writeFileSync(file, '{"version": 2, "counte', 'utf8');
  writeJson(file, { version: 1 });
  assert.deepEqual(readJson(`${file}.bak`, null), { version: 1 }, '.bak должен остаться валидным');
  assert.deepEqual(readJson(file, null), { version: 1 });
});

test('AP-P0-08: сбой rename не оставляет temp и не создаёт полузапись', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'json-atomic-'));
  const file = path.join(dir, 'state.json');
  writeJson(file, { version: 1 });
  // Цель становится каталогом: renameSync(tmp, file) обязан упасть.
  unlinkSync(file);
  mkdirSync(file);
  assert.throws(() => writeJson(file, { version: 2 }));
  const leftovers = readdirSync(dir).filter((f) => f.includes('.tmp-'));
  assert.deepEqual(leftovers, [], 'после сбоя rename временных файлов быть не должно');
});

test('AP-P0-08: сбой записи temp не трогает предыдущую валидную версию', { skip: process.getuid?.() === 0 }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'json-atomic-'));
  const file = path.join(dir, 'state.json');
  writeJson(file, { version: 1 });
  chmodSync(dir, 0o500); // запрет создания новых файлов в каталоге
  try {
    assert.throws(() => writeJson(file, { version: 2 }), /EACCES|EPERM/);
    assert.deepEqual(readJson(file, null), { version: 1 }, 'старая версия должна остаться целой');
    assert.equal(existsSync(`${file}.bak`), false, 'бэкап не должен создаваться при неудачной записи');
  } finally {
    chmodSync(dir, 0o700);
  }
});
