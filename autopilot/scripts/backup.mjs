#!/usr/bin/env node
// Резервная копия и восстановление состояния контура (AP-P1-17/AP-P0-22).
//
// Локальная часть: бэкап каталога `data/` (включая `runs/`), манифест с
// sha256 каждого файла и HEAD git — и проверяемое восстановление в отдельный
// каталог. Восстановление сначала верифицирует хэши, а не копирует вслепую:
// «backup создан» без проверки restore — не доказательство.
//
//   node scripts/backup.mjs create  --from data --to /backups/state-<ts>
//   node scripts/backup.mjs verify  --backup /backups/state-<ts>
//   node scripts/backup.mjs restore --backup /backups/state-<ts> --to /sandbox/data
import path from 'node:path';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadConfig } from './lib/config.mjs';
import { isMain, parseArgs } from './lib/content.mjs';
import { envelope, EXIT } from './lib/outcome.mjs';

const cfg = loadConfig();

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function listFiles(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full));
  }
  return out;
}

function gitHead(dir) {
  const proc = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

export function createBackup({ from, to }) {
  if (!existsSync(from)) throw new Error(`Нет каталога для бэкапа: ${from}`);
  mkdirSync(to, { recursive: true });
  const files = {};
  // Вложенные бэкапы не копируем: иначе каждый следующий растёт как снежный ком.
  for (const rel of listFiles(from).filter((r) => !r.startsWith(`backups${path.sep}`) && !r.startsWith('backups/'))) {
    const target = path.join(to, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(from, rel), target);
    files[rel] = sha256(target);
  }
  const manifest = { createdAt: new Date().toISOString(), from, files, gitHead: gitHead(process.cwd()) };
  writeFileSync(path.join(to, 'backup-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { to, files: Object.keys(files).length, manifest };
}

export function verifyBackup({ backup }) {
  const manifestFile = path.join(backup, 'backup-manifest.json');
  if (!existsSync(manifestFile)) throw new Error(`Нет манифеста: ${manifestFile}`);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const mismatches = [];
  const missing = [];
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const file = path.join(backup, rel);
    if (!existsSync(file)) {
      missing.push(rel);
      continue;
    }
    if (sha256(file) !== hash) mismatches.push(rel);
  }
  return { ok: mismatches.length === 0 && missing.length === 0, mismatches, missing, files: Object.keys(manifest.files).length, manifest };
}

export function restoreBackup({ backup, to }) {
  const check = verifyBackup({ backup });
  if (!check.ok) {
    throw new Error(`Бэкап повреждён: несовпадений ${check.mismatches.length}, отсутствует ${check.missing.length}`);
  }
  mkdirSync(to, { recursive: true });
  for (const rel of Object.keys(check.manifest.files)) {
    const target = path.join(to, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(backup, rel), target);
  }
  return { to, files: Object.keys(check.manifest.files).length, verified: true };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const json = args.json !== undefined;
  try {
    if (cmd === 'create') {
      const from = path.resolve(args.from || cfg.resolved.dataDir);
      if (!args.to) throw new Error('Нужен --to <каталог>');
      const out = createBackup({ from, to: path.resolve(args.to) });
      console.log(json ? JSON.stringify(envelope({ ok: true, category: 'ok', exitCode: 0, ...out }), null, 2) : `Бэкап: ${out.to} (${out.files} файлов)`);
      return;
    }
    if (cmd === 'verify') {
      const out = verifyBackup({ backup: path.resolve(args.backup || '') });
      console.log(json ? JSON.stringify(envelope({ ok: out.ok, category: out.ok ? 'ok' : 'infra', exitCode: out.ok ? 0 : EXIT.infra, ...out }), null, 2) : (out.ok ? `✔ Бэкап цел (${out.files} файлов)` : `✖ Бэкап повреждён: ${out.mismatches.join(', ')}`));
      process.exit(out.ok ? 0 : EXIT.infra);
    }
    if (cmd === 'restore') {
      const out = restoreBackup({ backup: path.resolve(args.backup || ''), to: path.resolve(args.to || '') });
      console.log(json ? JSON.stringify(envelope({ ok: true, category: 'ok', exitCode: 0, ...out }), null, 2) : `Восстановлено: ${out.to} (${out.files} файлов)`);
      return;
    }
    console.log('Использование: backup.mjs create --from <dir> --to <dir> | verify --backup <dir> | restore --backup <dir> --to <dir>');
    process.exit(EXIT.usage);
  } catch (error) {
    if (json) console.log(JSON.stringify(envelope({ ok: false, category: 'infra', exitCode: EXIT.infra, error: error.message }), null, 2));
    else console.error(`infra: ${error.message}`);
    process.exit(EXIT.infra);
  }
}

if (isMain(import.meta.url)) main();
