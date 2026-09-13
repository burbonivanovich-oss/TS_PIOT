#!/usr/bin/env node
// Preflight перед любой мутирующей командой (AP-P0-10).
//
// Главный принцип проекта — «сомнительное не пишется». Workflow с `|| true`
// после health-check этот принцип нарушал: неуспешная проверка не мешала
// запуску. Preflight собирает все предпосылки прохода (конфиг, корпус, JSON
// состояния, lock, место на диске, при необходимости git) и завершается
// fail-closed: любой отказ прекращает job до первой записи.
//
//   node scripts/preflight.mjs [--json]
//
// Код выхода: 0 — можно запускать, 1 — ошибка запуска, 2 — preflight не пройден.
import { existsSync, statSync, readdirSync, statfsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, ROOT } from './lib/config.mjs';
import { readJson, isMain } from './lib/content.mjs';
import { inspectLock } from './lib/lock.mjs';
import { envelope, EXIT } from './lib/outcome.mjs';
import { parseIsoDate } from './lib/dates.mjs';
import { runSiteBuild } from './lib/site.mjs';
import { inspectProjectRoot } from './lib/guard.mjs';

const MUTATING_STATE = ['autopilot.json', 'backlog.json', 'orders.json'];
const OPTIONAL_STATE = ['seeds.json', 'dupes.json', 'rewrite-queue.json', 'dedupe-index.json', 'rewrite-log.json'];

function runCheck(id, fn) {
  try {
    const result = fn();
    return { id, ok: result.ok !== false, level: result.level || (result.ok === false ? 'fail' : 'ok'), detail: result.detail };
  } catch (error) {
    return { id, ok: false, level: 'fail', detail: error.message };
  }
}

function checkConfig(cfg) {
  if (!cfg) throw new Error('конфиг не загружен');
  return { ok: true, detail: `contentRoot: ${cfg.resolved.contentRoot}` };
}

function checkContentRoot(cfg) {
  const root = cfg.resolved.contentRoot;
  if (root === '/' || root === path.parse(root).root) {
    throw new Error(`contentRoot указывает на корень ФС: ${root}`);
  }
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`contentRoot не существует/не каталог: ${root}`);
  }
  const blog = cfg.resolved.blog;
  if (!existsSync(blog) || !statSync(blog).isDirectory()) {
    throw new Error(`нет каталога блога: ${blog}`);
  }
  // В production корень проверяется по маркерам, remote, ветке и symlink
  // (AP-P0-04) до любой мутации.
  if (cfg.security?.strictContentRoot) {
    const guard = inspectProjectRoot(cfg);
    if (!guard.ok) throw new Error(`AP-P0-04: ${guard.problems.join('; ')}`);
  }
  const articles = readdirSync(blog).filter((f) => /\.mdx?$/.test(f)).length;
  return articles > 0
    ? { ok: true, detail: `корпус читается: ${articles} статей` }
    : { ok: false, detail: `каталог блога пуст: ${blog}` };
}

function checkStateJson(cfg) {
  const created = [];
  for (const name of MUTATING_STATE) {
    const file = path.join(cfg.resolved.dataDir, name);
    if (!existsSync(file)) {
      created.push(`${name}=нет`);
      continue;
    }
    readJson(file, null); // strict: повреждённый JSON бросает
  }
  for (const name of OPTIONAL_STATE) {
    const file = path.join(cfg.resolved.dataDir, name);
    if (existsSync(file)) readJson(file, null);
  }
  return { ok: true, detail: created.length ? `состояние ещё не создано: ${created.join(', ')}` : 'JSON состояния читается' };
}

function checkSeeds(cfg) {
  const file = path.join(cfg.resolved.dataDir, 'seeds.json');
  if (!existsSync(file)) return { ok: true, level: 'skip', detail: 'seeds.json не создан' };
  const seeds = readJson(file, {});
  const problems = [];
  for (const [index, item] of (seeds.calendar || []).entries()) {
    if (!item || typeof item.entity !== 'string' || item.entity.trim() === '') problems.push(`calendar[${index}].entity пуст`);
    const parsed = parseIsoDate(item && item.date);
    if (!parsed.ok) problems.push(`calendar[${index}].date: ${parsed.reason}`);
    if (typeof item?.boost !== 'number' || !Number.isFinite(item.boost)) problems.push(`calendar[${index}].boost не число`);
  }
  if (seeds.intents !== undefined && !Array.isArray(seeds.intents)) problems.push('intents должен быть массивом');
  if (seeds.segments !== undefined && !Array.isArray(seeds.segments)) problems.push('segments должен быть массивом');
  return problems.length
    ? { ok: false, detail: `seeds.json: ${problems.slice(0, 5).join('; ')}` }
    : { ok: true, detail: `seeds: ${(seeds.calendar || []).length} дат календаря` };
}

function checkLock() {
  const info = inspectLock();
  if (!info.exists && !info.reap) return { ok: true, detail: 'блокировка свободна' };
  if (info.corrupt) throw new Error(info.corrupt);
  if (info.ownerAlive) {
    throw new Error(`уже работает pid ${info.lock.pid} (${info.lock.cmd || '?'}), runId ${info.lock.runId || '?'}`);
  }
  if (info.reaperAlive) {
    throw new Error(`идёт перехват блокировки pid ${info.reap.pid}`);
  }
  if (info.reap) {
    throw new Error(
      `остался reap-файл мёртвого процесса ${info.reap.pid}: аварийное снятие ` +
        'node scripts/state.mjs unlock --force --by <оператор>',
    );
  }
  throw new Error(
    `осталась блокировка мёртвого процесса ${info.lock.pid}: аварийное снятие ` +
      'node scripts/state.mjs unlock --force --by <оператор>',
  );
}

function checkSiteBuild(cfg) {
  const enabled = cfg.security?.buildCheck === true || process.env.AUTOPILOT_BUILD_CHECK === '1';
  if (!enabled) return { ok: true, level: 'skip', detail: 'build-проверка не включена' };
  const result = runSiteBuild({ contentRoot: cfg.resolved.contentRoot });
  if (result.ok) return { ok: true, detail: 'сборка сайта прошла' };
  const reason = result.error || `код ${result.code}`;
  const last = String(result.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ');
  return { ok: false, detail: `сборка не прошла: ${reason}${last ? `; ${last}` : ''}` };
}

function checkDisk(cfg) {
  const minMb = Number(process.env.AUTOPILOT_MIN_FREE_MB || 200);
  const targets = [ROOT, cfg.resolved.contentRoot].filter((dir) => existsSync(dir));
  let minFree = Infinity;
  let failed = null;
  for (const dir of targets) {
    try {
      const stat = statfsSync(dir);
      const freeMb = Math.floor((stat.bavail * stat.bsize) / (1024 * 1024));
      if (freeMb < minFree) minFree = freeMb;
    } catch (error) {
      failed = error.message;
    }
  }
  if (!Number.isFinite(minFree)) {
    return { ok: true, level: 'warn', detail: `не удалось определить свободное место: ${failed}` };
  }
  return minFree >= minMb
    ? { ok: true, detail: `свободно ${minFree} МБ (нужно ≥${minMb})` }
    : { ok: false, detail: `мало места: ${minFree} МБ < ${minMb} МБ` };
}

function checkGit(cfg) {
  if (process.env.AUTOPILOT_PREFLIGHT_GIT !== '1') {
    return { ok: true, level: 'skip', detail: 'git-проверка не включена (AUTOPILOT_PREFLIGHT_GIT=1)' };
  }
  const root = cfg.resolved.contentRoot;
  if (!existsSync(path.join(root, '.git'))) throw new Error(`contentRoot не git-репозиторий: ${root}`);
  const git = (args) => {
    const proc = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    if (proc.status !== 0) throw new Error(`git ${args.join(' ')}: ${proc.stderr.trim()}`);
    return proc.stdout.trim();
  };
  const expectedBranch = process.env.AUTOPILOT_ALLOWED_BRANCH;
  if (expectedBranch) {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== expectedBranch) throw new Error(`ветка ${branch}, ожидалась ${expectedBranch}`);
  }
  git(['rev-parse', 'HEAD']); // HEAD должен резолвиться
  const allowed = (process.env.AUTOPILOT_ALLOWED_PATHS || 'data,src/content')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const changed = git(['status', '--porcelain'])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((p) => !allowed.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)));
  if (changed.length) throw new Error(`изменения вне allowlist: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ' …' : ''}`);
  return { ok: true, detail: `git: ветка${expectedBranch ? ` ${expectedBranch}` : ' ok'}, diff в пределах allowlist` };
}

export function preflight() {
  const checks = [];
  let cfg = null;
  checks.push(
    runCheck('config', () => {
      cfg = loadConfig();
      return checkConfig(cfg);
    }),
  );
  if (cfg) {
    checks.push(runCheck('content-root', () => checkContentRoot(cfg)));
    checks.push(runCheck('state-json', () => checkStateJson(cfg)));
    checks.push(runCheck('seeds', () => checkSeeds(cfg)));
    checks.push(runCheck('lock', () => checkLock()));
    checks.push(runCheck('disk', () => checkDisk(cfg)));
    checks.push(runCheck('git', () => checkGit(cfg)));
    checks.push(runCheck('site-build', () => checkSiteBuild(cfg)));
  }
  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

function main() {
  const args = process.argv.slice(2);
  const report = preflight();
  const failed = report.checks.filter((c) => !c.ok);
  const category = report.ok ? 'ok' : failed.some((c) => c.id === 'config') ? 'config' : 'precondition';
  const exitCode = report.ok ? EXIT.ok : category === 'config' ? EXIT.config : EXIT.content_reject;
  if (args.includes('--json')) {
    console.log(JSON.stringify(envelope({ ...report, category, exitCode }), null, 2));
  } else {
    for (const c of report.checks) {
      const icon = c.level === 'skip' ? '•' : c.ok ? '✔' : '✖';
      console.log(`${icon} ${c.id.padEnd(14)} ${c.detail}`);
    }
    console.log(`\nPreflight: ${report.ok ? 'OK' : 'НЕ ПРОЙДЕН'}`);
  }
  process.exit(exitCode);
}

if (isMain(import.meta.url)) main();
