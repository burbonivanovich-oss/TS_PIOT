#!/usr/bin/env node
// Проверка первоисточников (AP-P1-02).
//
//   node scripts/source-check.mjs audit --file <path> | --slug <slug> [--json]
//   node scripts/source-check.mjs verify --file <path> | --slug <slug> [--json]
//   node scripts/source-check.mjs status [--json]
//
// audit  — детерминированно: схема, домен из allowlist, не главная страница.
// verify — сетевой этап: HTTP status, редиректы; результат сохраняется в
//          data/source-evidence.json. Гейты потом читают именно этот файл.
// status — свежесть сохранённого evidence.
//
// Код выхода: 0 — ок, 1 — ошибка запуска, 2 — найдены непригодные источники.
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { parseFrontmatter, writeJson, today, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import {
  extractUrls,
  auditSourceUrl,
  readSourceEvidence,
  evaluateEvidence,
  verifySources,
} from './lib/sources.mjs';

const cfg = loadConfig();
const EVIDENCE_FILE = path.join(cfg.resolved.dataDir, 'source-evidence.json');
const MAX_AGE_DAYS = cfg.gates.sourceMaxAgeDays ?? 180;

function resolveFile(args) {
  let file = args.file;
  if (!file && args.slug) {
    for (const ext of ['.md', '.mdx']) {
      const candidate = path.join(cfg.resolved.blog, `${args.slug}${ext}`);
      if (existsSync(candidate)) file = candidate;
    }
  }
  return file && existsSync(file) ? file : null;
}

function auditArticle(file) {
  const body = parseFrontmatter(readFileSync(file, 'utf8')).body;
  const urls = extractUrls(body);
  return urls.map((url) => ({ url, ...auditSourceUrl(url) }));
}

async function verifyArticle(file, evidence) {
  const body = parseFrontmatter(readFileSync(file, 'utf8')).body;
  const candidates = extractUrls(body).filter((url) => auditSourceUrl(url).ok);
  if (!candidates.length) return { checked: 0, entries: {} };
  const entries = await verifySources(candidates);
  const merged = { generatedAt: today(), entries: { ...evidence.entries, ...entries } };
  acquireLock({ cmd: 'source-evidence' });
  try {
    writeJson(EVIDENCE_FILE, merged);
  } finally {
    releaseLock();
  }
  return { checked: Object.keys(entries).length, entries };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (cmd === 'audit') {
    const file = resolveFile(args);
    if (!file) {
      console.error(`Не найден файл статьи: ${args.file || args.slug}`);
      process.exit(1);
    }
    const results = auditArticle(file);
    const bad = results.filter((r) => !r.ok);
    if (args.json) {
      console.log(JSON.stringify({ file, results, bad: bad.length }, null, 2));
    } else {
      console.log(`${bad.length ? '✖' : '✔'} источников ${results.length}, непригодных ${bad.length}`);
      for (const r of bad) console.log(`   ✖ ${r.url} — ${r.reason}`);
    }
    process.exit(bad.length ? 2 : 0);
  }

  if (cmd === 'verify') {
    const file = resolveFile(args);
    if (!file) {
      console.error(`Не найден файл статьи: ${args.file || args.slug}`);
      process.exit(1);
    }
    const evidence = readSourceEvidence(EVIDENCE_FILE);
    verifyArticle(file, evidence)
      .then((result) => {
        if (args.json) console.log(JSON.stringify(result, null, 2));
        else console.log(`Проверено сетевых источников: ${result.checked}`);
      })
      .catch((error) => {
        console.error(error.message);
        process.exit(1);
      });
    return;
  }

  if (cmd === 'status') {
    const evidence = readSourceEvidence(EVIDENCE_FILE);
    const verdicts = Object.entries(evidence.entries).map(([url, entry]) => ({
      url,
      ...evaluateEvidence(entry, { maxAgeDays: MAX_AGE_DAYS }),
    }));
    const stale = verdicts.filter((v) => v.stale);
    const invalid = verdicts.filter((v) => !v.ok && !v.stale);
    if (args.json) {
      console.log(JSON.stringify({ generatedAt: evidence.generatedAt, total: verdicts.length, stale: stale.length, invalid: invalid.length, verdicts }, null, 2));
      return;
    }
    console.log(`Evidence: ${verdicts.length} источников (от ${evidence.generatedAt || 'никогда'}), устарело ${stale.length}, недействительно ${invalid.length}`);
    for (const v of [...invalid, ...stale].slice(0, 20)) console.log(`   ${v.url} — ${v.reason}`);
    return;
  }

  console.log('Использование: source-check.mjs audit|verify|status [--file p | --slug s] [--json]');
  process.exit(1);
}

if (isMain(import.meta.url)) main();
