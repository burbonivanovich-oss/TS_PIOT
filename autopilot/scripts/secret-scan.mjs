#!/usr/bin/env node
// Проверка секретов перед коммитом (AP-P0-25).
//
// Секреты модели не должны попадать в repo/лог, а `research/` и `chats/` могут
// содержать чувствительные черновики. Сканер ищет конкретные форматы ключей в
// том, что реально может быть закоммичено (tracked + untracked, но не ignored),
// и валится до коммита. Строка с маркером `secret-scan:allow` пропускается —
// только для проверяемых fixtures, где секретом не является.
//
//   node scripts/secret-scan.mjs [--path <dir>] [--json]
//
// Код выхода: 0 — чисто, 1 — ошибка запуска, 2 — найдены секреты.
import path from 'node:path';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PATTERNS = [
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: 'openai-key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    id: 'generic-credential',
    re: /\b(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["']?([A-Za-z0-9_\-]{16,})/i,
    // UPPER_SNAKE — это имя константы/env-переменной, а не литерал секрета.
    // Проверка в коде, а не lookahead: флаг /i не различает регистр в классе.
    filter: (match) => !/^[A-Z][A-Z0-9_]*$/.test(match[1]),
  },
];

const ALLOW_MARKER = 'secret-scan:allow';
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|mp4|mov|mp3|wasm)$/i;

/** Найти секреты в тексте. Возвращает список {line, pattern}. */
export function scanText(text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(ALLOW_MARKER)) continue;
    for (const p of PATTERNS) {
      const match = line.match(p.re);
      if (match && (!p.filter || p.filter(match))) {
        findings.push({ line: i + 1, pattern: p.id });
        break;
      }
    }
  }
  return findings;
}

export function scanFile(file) {
  let stat;
  try {
    stat = statSync(file);
  } catch {
    return [];
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024 || BINARY_EXT.test(file)) return [];
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  if (text.includes('\u0000')) return []; // бинарный
  return scanText(text).map((f) => ({ file, ...f }));
}

/** Рекурсивно просканировать каталог (пропуская .git/node_modules). */
export function scanPath(dir, allow = []) {
  const findings = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (allow.some((prefix) => full.includes(prefix))) continue;
      if (entry.isDirectory()) walk(full);
      else findings.push(...scanFile(full));
    }
  };
  walk(dir);
  return findings;
}

function gitCandidateFiles() {
  const proc = spawnSync('git', ['-C', ROOT, 'ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' });
  if (proc.status !== 0) return null;
  return proc.stdout
    .split('\n')
    .filter(Boolean)
    .map((rel) => path.join(ROOT, rel));
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const pathIdx = argv.indexOf('--path');
  const target = pathIdx !== -1 ? argv[pathIdx + 1] : null;
  const allow = (process.env.AUTOPILOT_SECRET_ALLOW || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Fixtures самого сканера содержат примеры ключей (без них нельзя проверить
  // детекторы) — они не production-секреты и исключены по пути.
  allow.push(path.join(ROOT, 'scripts', 'secret-scan.test.mjs'));

  let findings;
  if (target) {
    findings = scanPath(path.resolve(target), allow);
  } else {
    const files = gitCandidateFiles();
    findings = files
      ? files.flatMap((f) => (allow.some((p) => f.includes(p)) ? [] : scanFile(f)))
      : scanPath(ROOT, allow);
  }

  if (json) {
    console.log(JSON.stringify({ findings }, null, 2));
  } else if (findings.length) {
    console.log(`✖ Найдено потенциальных секретов: ${findings.length}`);
    for (const f of findings.slice(0, 30)) console.log(`   ${f.file}:${f.line}  ${f.pattern}`);
  } else {
    console.log('✔ Секретов не найдено');
  }
  process.exit(findings.length ? 2 : 0);
}

if (isMain(import.meta.url)) main();
