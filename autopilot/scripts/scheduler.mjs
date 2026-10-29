#!/usr/bin/env node
// Планировщик автопилота — единственный владелец расписания на этой машине.
// launchd запускает его по расписанию и при входе в систему. Решений «на
// глазок» здесь нет: прежний агент-планировщик однажды прочитал старый
// orders.json, решил, что работы нет, и пропустил выпуск. Здесь порядок
// жёсткий:
//
//   1. одна копия планировщика; включённая автоматизация Codex — стоп;
//   2. чистая main, fetch, только fast-forward;
//   3. раз в неделю: анализ рынка → темы, пополнение бэклога, план недели,
//      коммит и push;
//   4. раз в сутки: daily.mjs (модель, гейты, сборка, коммит, push);
//   5. ожидание деплоя и проверка выпущенных страниц на сайте;
//   6. уведомление только о событии: выпуск, план недели, сбой.
//
//   node autopilot/scripts/scheduler.mjs run [--force-daily] [--skip-weekly] [--skip-daily]
//   node autopilot/scripts/scheduler.mjs status
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMain, parseArgs } from './lib/content.mjs';
import { isoWeek } from './lib/week.mjs';

export const SITE = process.env.AUTOPILOT_SITE || 'https://etiketka-media.ru/';
export const ALLOWED_PATHS = 'autopilot/data,autopilot/research,src/content/blog,public/images/hero,public/images/preview,.claude/factchecked,src/data/factcheck/results,src/data/factcheck/claims';
// fileURLToPath, а не URL.pathname: путь с пробелом и кириллицей иначе
// приходит процентно-закодированным.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOME = process.env.AUTOPILOT_SCHEDULER_HOME || path.join(os.homedir(), 'Library', 'Application Support', 'etiketka-autopilot');
const LOG_DIR = process.env.AUTOPILOT_SCHEDULER_LOGS || path.join(os.homedir(), 'Library', 'Logs', 'etiketka-autopilot');
const CODEX_AUTOMATION = process.env.AUTOPILOT_CODEX_AUTOMATION || path.join(os.homedir(), '.codex', 'automations', 'automation-2', 'automation.toml');
// macOS хранит имена файлов в другой нормализации Unicode; без этого Git
// видит отслеживаемый PDF с кириллицей как новый файл и считает копию грязной.
const GIT_ENV = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.precomposeunicode', GIT_CONFIG_VALUE_0: 'false' };

const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

// ── Чистые функции (покрыты тестами) ────────────────────────────────────────

/** Включена ли прежняя автоматизация Codex: два владельца расписания запрещены. */
export function codexAutomationActive(text) {
  return /^\s*status\s*=\s*"ACTIVE"\s*$/m.test(String(text || ''));
}

/** daily.mjs печатает вывод тестов, затем итоговый JSON — берём последний. */
export function parseDailyOutput(stdout) {
  const text = String(stdout || '');
  const start = text.lastIndexOf('\n{\n') >= 0 ? text.lastIndexOf('\n{\n') + 1 : (text.startsWith('{\n') ? 0 : -1);
  if (start < 0) return null;
  try { return JSON.parse(text.slice(start)); } catch { return null; }
}

/** Что выпущено и каким SHA ушло в remote. */
export function releasedFromResult(result) {
  const commit = result?.delivery?.publication?.commit ?? result?.publication?.commit ?? null;
  const slugs = (result?.acceptance?.results || []).filter((r) => r.status === 'published').map((r) => r.slug);
  return { commit: /^[a-f0-9]{40,64}$/.test(commit || '') ? commit : null, slugs: [...new Set(slugs)] };
}

const bodyOf = (source) => {
  const text = String(source || '');
  const m = text.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? text.slice(m[0].length) : text;
};

/**
 * Фраза, по которой видно новую версию страницы. Заголовки разделов и
 * простые фрагменты абзацев выходят в HTML без изменений; кавычки, ссылки и
 * разметку обходим — типограф и Markdown их меняют. Для рерайта фраза
 * обязана отсутствовать в прежней версии, иначе проверка ничего не доказывает.
 */
export function requiredText(newSource, oldSource = null) {
  const body = bodyOf(newSource);
  const old = oldSource ? bodyOf(oldSource) : '';
  // Точка безопасна, многоточие типограф превращает в «…» — его обходим.
  const plain = /^[\p{L}\p{N} ,.:?—–-]+$/u;
  const candidates = [];
  for (const line of body.split('\n')) {
    const heading = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (heading) {
      const text = heading[1].trim();
      if (text.length >= 12 && plain.test(text) && !text.includes('..')) candidates.push(text);
      continue;
    }
    if (/^\s*([|<>#*\-+]|\d+\.|import\s|export\s)/.test(line)) continue;
    const run = line.match(/[\p{L}\p{N}][\p{L}\p{N} ,]{39,}/u);
    if (run) candidates.push(run[0].trim().split(' ').slice(0, 9).join(' '));
  }
  return candidates.find((c) => c.length >= 12 && !old.includes(c)) || null;
}

// ── Окружение ───────────────────────────────────────────────────────────────

function log(line) {
  const stamp = new Date().toISOString();
  const text = `[${stamp}] ${line}`;
  console.log(text);
  try { mkdirSync(LOG_DIR, { recursive: true }); appendFileSync(path.join(LOG_DIR, `${utcDay()}.log`), text + '\n'); } catch { /* лог — не причина падать */ }
}

export function notify(title, message) {
  log(`УВЕДОМЛЕНИЕ: ${title} — ${message}`);
  if (process.env.AUTOPILOT_NOTIFY === '0' || process.platform !== 'darwin') return;
  const quote = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 220)}"`;
  spawnSync('/usr/bin/osascript', ['-e', `display notification ${quote(message)} with title ${quote(title)}`], { stdio: 'ignore' });
}

function git(args, { allowFail = false, raw = false } = {}) {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args[0]}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-1)[0]}`);
  return allowFail ? r : raw ? r.stdout : r.stdout.trim();
}

/** Пути изменённых файлов. Без trim: ведущий пробел — часть формата porcelain. */
export function changedPaths(porcelainZ) {
  return String(porcelainZ || '').split('\0').filter(Boolean).map((entry) => entry.slice(3));
}

function readState() { try { return JSON.parse(readFileSync(path.join(HOME, 'state.json'), 'utf8')); } catch { return {}; } }
function writeState(state) { mkdirSync(HOME, { recursive: true }); writeFileSync(path.join(HOME, 'state.json'), JSON.stringify(state, null, 2) + '\n'); }

function acquireSchedulerLock() {
  mkdirSync(HOME, { recursive: true });
  const file = path.join(HOME, 'scheduler.lock');
  if (existsSync(file)) {
    const pid = Number(readFileSync(file, 'utf8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch (error) { alive = error.code === 'EPERM'; }
    if (alive) return null;
    unlinkSync(file);
  }
  writeFileSync(file, String(process.pid), { flag: 'wx' });
  return () => { try { unlinkSync(file); } catch { /* уже снят */ } };
}

// ── Шаги ────────────────────────────────────────────────────────────────────

/** Чистая main и fast-forward к origin. Возвращает причину остановки или null. */
function syncCheckout() {
  if (git(['symbolic-ref', '--short', 'HEAD']) !== 'main') return 'checkout не на main';
  if (git(['status', '--porcelain', '--untracked-files=all'])) return 'в рабочей копии есть незакоммиченные изменения';
  git(['fetch', '--no-tags', 'origin', 'main']);
  const [ahead, behind] = git(['rev-list', '--left-right', '--count', 'HEAD...origin/main']).split(/\s+/).map(Number);
  if (ahead === 0 && behind > 0) {
    const lockBefore = git(['rev-parse', 'HEAD:package-lock.json'], { allowFail: true }).stdout?.trim();
    git(['merge', '--ff-only', 'origin/main']);
    const lockAfter = git(['rev-parse', 'HEAD:package-lock.json'], { allowFail: true }).stdout?.trim();
    if (lockBefore !== lockAfter) {
      log('lockfile изменился — npm ci');
      const r = spawnSync('npm', ['ci'], { cwd: REPO, stdio: 'inherit' });
      if (r.status !== 0) return 'npm ci не прошёл';
    }
    return null;
  }
  if (ahead > 0) {
    const subjects = git(['log', '--format=%s', 'origin/main..HEAD']).split('\n').filter(Boolean);
    const onlyWeekly = subjects.every((s) => s.startsWith('autopilot: weekly'));
    if (onlyWeekly) {
      // Недоставленный недельный коммит: только данные плана, конфликтов с
      // выгрузками Wordstat нет — переносим поверх remote и отправляем.
      if (behind > 0) {
        const r = git(['rebase', 'origin/main'], { allowFail: true });
        if (r.status !== 0) { git(['rebase', '--abort'], { allowFail: true }); return 'недельный коммит не переносится поверх remote'; }
      }
      const push = git(['push', 'origin', 'HEAD:refs/heads/main'], { allowFail: true });
      if (push.status !== 0) return 'push недельного коммита отклонён';
      return null;
    }
    // Незавершённую доставку daily восстанавливает сам по своему журналу.
    log(`локально впереди на ${ahead} (доставка daily) — восстановление оставлено daily`);
  }
  return null;
}

async function runWeekly({ now = new Date() } = {}) {
  const week = isoWeek(now);
  const planFile = path.join(REPO, 'autopilot', 'data', 'week-plan.json');
  const current = existsSync(planFile) ? JSON.parse(readFileSync(planFile, 'utf8')) : null;
  if (current?.week === week) return { skipped: true, week };
  log(`недельный проход ${week}`);
  const { runMarket } = await import('./market.mjs');
  const { refill, buildWeekPlan } = await import('./backlog.mjs');
  let market = null; let marketError = null;
  try { market = await runMarket({ now }); } catch (error) { marketError = error.message; log(`анализ рынка не выполнен: ${error.message}`); }
  refill();
  const plan = buildWeekPlan({ now });
  const dirty = changedPaths(git(['status', '--porcelain', '-z', '--untracked-files=all'], { raw: true }));
  const foreign = dirty.filter((file) => !file.startsWith('autopilot/data/'));
  if (foreign.length) throw new Error(`недельный проход изменил файлы вне autopilot/data: ${foreign.join(', ')}`);
  if (dirty.length) {
    git(['add', '--', 'autopilot/data']);
    git(['commit', '-q', '-m', `autopilot: weekly plan ${week}`, '-m', `Темы из анализа рынка: ${market?.accepted?.topics?.length ?? 0}, даты календаря: ${market?.accepted?.calendar?.length ?? 0}. План: ${plan.topics.length} тем.`]);
    const push = git(['push', 'origin', 'HEAD:refs/heads/main'], { allowFail: true });
    if (push.status !== 0) {
      // Remote ушёл вперёд (выгрузка Wordstat): переносим и пробуем один раз.
      git(['fetch', '--no-tags', 'origin', 'main']);
      const rebase = git(['rebase', 'origin/main'], { allowFail: true });
      if (rebase.status !== 0) { git(['rebase', '--abort'], { allowFail: true }); throw new Error('недельный коммит не переносится поверх remote'); }
      git(['push', 'origin', 'HEAD:refs/heads/main']);
    }
  }
  return { skipped: false, week, plan, market, marketError };
}

function runDaily() {
  const env = {
    ...process.env, ...GIT_ENV,
    AUTOPILOT_PREFLIGHT_GIT: '1', AUTOPILOT_ALLOWED_BRANCH: 'main', AUTOPILOT_ALLOWED_PATHS: ALLOWED_PATHS,
    AUTOPILOT_CODEX_BIN: process.env.AUTOPILOT_CODEX_BIN || 'codex',
  };
  const r = spawnSync(process.execPath, ['autopilot/scripts/daily.mjs', '--commit', '--push', '--remote', 'origin', '--target-ref', 'refs/heads/main'], { cwd: REPO, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { mkdirSync(LOG_DIR, { recursive: true }); writeFileSync(path.join(LOG_DIR, `${utcDay()}-daily.log`), `${r.stdout || ''}\n--- stderr ---\n${r.stderr || ''}`); } catch { /* лог — не причина падать */ }
  const result = parseDailyOutput(r.stdout);
  const error = r.status === 0 ? null : ((r.stderr || '').trim().split('\n').filter(Boolean).slice(-1)[0] || `код ${r.status}`);
  return { ok: r.status === 0 && Boolean(result), result, error };
}

async function waitForDeploy(commit, { timeoutMs = Number(process.env.AUTOPILOT_DEPLOY_TIMEOUT_MS) || 45 * 60_000, intervalMs = Math.min(60_000, timeoutMs) } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const url = new URL('release.json', SITE); url.searchParams.set('revision', commit); url.searchParams.set('t', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
      if (response.ok) {
        const receipt = await response.json();
        if (receipt.revision === commit) return commit;
        // Сайт уже собран из более поздней версии, которая содержит выпуск.
        if (/^[a-f0-9]{40}$/.test(receipt.revision || '')) {
          git(['fetch', '--no-tags', 'origin', 'main'], { allowFail: true });
          if (git(['merge-base', '--is-ancestor', commit, receipt.revision], { allowFail: true }).status === 0) return receipt.revision;
        }
      }
    } catch { /* сеть или деплой ещё идёт */ }
    const left = deadline - Date.now();
    if (left <= 0) return null;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, left)));
  }
}

function pagesFor(slugs, liveRevision, baseHead) {
  const pages = []; const unverified = [];
  for (const slug of slugs) {
    const file = ['mdx', 'md'].map((ext) => `src/content/blog/${slug}.${ext}`).find((f) => git(['cat-file', '-e', `${liveRevision}:${f}`], { allowFail: true }).status === 0);
    if (!file) { unverified.push(slug); continue; }
    const now = git(['show', `${liveRevision}:${file}`]);
    // Рерайт мог сменить расширение .md → .mdx: прежнюю версию ищем под обоими.
    const before = ['mdx', 'md'].map((ext) => git(['show', `${baseHead}:src/content/blog/${slug}.${ext}`], { allowFail: true })).find((r) => r.status === 0) || { status: 1, stdout: '' };
    // Черновик до выпуска на сайте не виден — прежней версией считается только опубликованная.
    const old = before.status === 0 && !/^draft:\s*true\s*$/m.test(before.stdout) ? before.stdout : null;
    const text = requiredText(now, old);
    if (text) pages.push({ path: `/blog/${slug}/`, requiredText: text }); else unverified.push(slug);
  }
  return { pages, unverified };
}

function titleOf(slug, revision) {
  for (const ext of ['mdx', 'md']) {
    const r = git(['show', `${revision}:src/content/blog/${slug}.${ext}`], { allowFail: true });
    if (r.status === 0) return (r.stdout.match(/^title:\s*"?(.*?)"?\s*$/m) || [])[1] || slug;
  }
  return slug;
}

export async function run({ forceDaily = false, skipWeekly = false, skipDaily = false, now = new Date() } = {}) {
  if (existsSync(CODEX_AUTOMATION) && codexAutomationActive(readFileSync(CODEX_AUTOMATION, 'utf8'))) {
    notify('Этикетка: автопилот не запущен', 'Включена автоматизация Codex «ежедневный выпуск». Выключите её — владелец расписания должен быть один.');
    return { status: 'blocked_codex_automation' };
  }
  const release = acquireSchedulerLock();
  if (!release) { log('планировщик уже работает — выход'); return { status: 'already_running' }; }
  const state = readState();
  try {
    const stop = syncCheckout();
    if (stop) { notify('Этикетка: выпуск остановлен', `${stop}. Нужна проверка рабочей копии.`); return { status: 'stopped', reason: stop }; }

    if (state.pendingLive) {
      // Вчерашний выпуск, который сайт не успел показать: проверяем без ожидания.
      const live = await waitForDeploy(state.pendingLive.commit, { timeoutMs: 1, intervalMs: 0 });
      if (live) {
        const { verifyLiveRelease } = await import('./lib/live-release.mjs');
        const { pages } = pagesFor(state.pendingLive.slugs, live, state.pendingLive.baseHead || `${state.pendingLive.commit}~1`);
        try { await verifyLiveRelease({ site: SITE, expectedCommit: live, pages }); delete state.pendingLive; writeState(state); log('отложенная проверка сайта прошла'); }
        catch (error) { notify('Этикетка: проверка сайта не прошла', error.message); }
      }
    }

    let weekly = null;
    if (!skipWeekly) {
      try {
        weekly = await runWeekly({ now });
        if (!weekly.skipped) {
          const added = weekly.market?.accepted?.topics?.length ?? 0;
          notify('Этикетка: план недели', `${weekly.plan.topics.length} тем на ${weekly.week}; новых тем из анализа рынка: ${added}${weekly.marketError ? ' (анализ рынка не удался, план из текущего бэклога)' : ''}.`);
        }
      } catch (error) {
        notify('Этикетка: недельный проход не удался', error.message);
        // До недельного прохода копия была чистой, значит всё изменённое в
        // autopilot/data — его недоделанный результат. Возвращаем HEAD, иначе
        // грязная копия остановит и daily. Выпуск важнее плана.
        git(['rebase', '--abort'], { allowFail: true });
        git(['checkout', '--', 'autopilot/data'], { allowFail: true });
        git(['clean', '-fdq', '--', 'autopilot/data'], { allowFail: true });
        if (git(['status', '--porcelain', '--untracked-files=all'])) {
          notify('Этикетка: выпуск остановлен', 'после сбоя недели рабочая копия не вернулась в чистое состояние');
          return { status: 'stopped', reason: 'dirty_after_weekly' };
        }
        // Неотправленный недельный коммит: доставка daily поверх него не
        // сойдётся с remote. Его отправит синхронизация следующего запуска.
        if (Number(git(['rev-list', '--count', 'origin/main..HEAD'])) > 0) {
          writeState({ ...state, lastFailure: { at: new Date().toISOString(), error: 'weekly push pending' } });
          return { status: 'stopped', reason: 'weekly_push_pending' };
        }
      }
    }

    if (skipDaily) return { status: 'weekly_only', weekly };
    if (!forceDaily && state.lastDailyDay === utcDay(now)) { log('сегодняшний выпуск уже выполнен'); return { status: 'done_today', weekly }; }
    const baseHead = git(['rev-parse', 'HEAD']);
    log('daily.mjs: старт');
    const daily = runDaily();
    if (!daily.ok) {
      notify('Этикетка: выпуск не удался', `${daily.error || 'нет итогового отчёта'}. Повтор — при следующем запуске.`);
      writeState({ ...state, lastFailure: { at: new Date().toISOString(), error: daily.error } });
      return { status: 'daily_failed', error: daily.error, weekly };
    }
    const result = daily.result;
    if (result.actionRequired) notify('Этикетка: нужно действие', String(result.reason || result.status));
    const { commit, slugs } = releasedFromResult(result);
    const next = { ...state, lastDailyDay: utcDay(now), lastDaily: { at: new Date().toISOString(), status: result.status, released: slugs, commit } };
    writeState(next);
    if (!commit || !slugs.length) { log(`daily: ${result.status}, выпусков нет`); return { status: result.status, released: [], weekly }; }

    log(`ожидание деплоя ${commit.slice(0, 8)}`);
    const live = await waitForDeploy(commit);
    if (!live) {
      notify('Этикетка: сайт не обновился', `Выпуск ${slugs.length} материалов отправлен, но сайт не показал новую версию. Проверю при следующем запуске.`);
      writeState({ ...next, pendingLive: { commit, slugs, baseHead } });
      return { status: 'deploy_unconfirmed', released: slugs, weekly };
    }
    const { verifyLiveRelease } = await import('./lib/live-release.mjs');
    const { pages, unverified } = pagesFor(slugs, live, baseHead);
    let verified = null; let verifyError = null;
    try { verified = await verifyLiveRelease({ site: SITE, expectedCommit: live, pages }); } catch (error) { verifyError = error.message; }
    writeState({ ...next, lastLive: { at: new Date().toISOString(), revision: live, verified: Boolean(verified), verifyError, unverified } });
    if (verifyError) {
      notify('Этикетка: проверка сайта не прошла', `${verifyError}. Выпущено: ${slugs.length}.`);
      return { status: 'live_check_failed', released: slugs, weekly };
    }
    const titles = slugs.map((s) => titleOf(s, live));
    notify(`Этикетка: вышло ${slugs.length}`, titles.join(' · '));
    return { status: 'released', released: slugs, live, weekly };
  } finally {
    release();
  }
}

if (isMain(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (cmd === 'run') {
    run({ forceDaily: args['force-daily'] !== undefined, skipWeekly: args['skip-weekly'] !== undefined, skipDaily: args['skip-daily'] !== undefined })
      .then((r) => { log(`итог: ${JSON.stringify(r).slice(0, 2000)}`); })
      .catch((error) => { notify('Этикетка: планировщик упал', error.message); process.exitCode = 1; });
  } else if (cmd === 'status') {
    console.log(JSON.stringify({ state: readState(), week: isoWeek(), codexAutomationActive: existsSync(CODEX_AUTOMATION) && codexAutomationActive(readFileSync(CODEX_AUTOMATION, 'utf8')), logs: LOG_DIR }, null, 2));
  } else {
    console.log('Использование: scheduler.mjs run [--force-daily] [--skip-weekly] [--skip-daily] | status');
    process.exitCode = 2;
  }
}
