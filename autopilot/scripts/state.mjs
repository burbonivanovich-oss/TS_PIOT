#!/usr/bin/env node
// Машина состояний автопилота. Отличие от редакционного цикла с человеком —
// здесь нет состояния «ждём согласования»: тема идёт из очереди сразу в работу,
// а вместо потолка очереди редактора действует потолок незавершённой работы
// самого контура (сколько статей одновременно пишется). Всё, что раньше решал
// редактор, решают детерминированные гейты — см. scripts/gates.mjs.
//
//   node scripts/state.mjs get [--json]
//   node scripts/state.mjs claim --slug s --kind new|rewrite
//   node scripts/state.mjs done --slug s --score 82 [--file path]
//   node scripts/state.mjs fail --slug s --reason "..."
//   node scripts/state.mjs quarantine --slug s --reason "..."
//   node scripts/state.mjs month           # счётчик текущего месяца
//   node scripts/state.mjs reset --force
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { readJson, writeJson, today, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock, forceUnlock } from './lib/lock.mjs';

const cfg = loadConfig();
const STATE_FILE = path.join(cfg.resolved.dataDir, 'autopilot.json');

const EMPTY = {
  version: 1,
  startedAt: null,
  month: null,
  counters: { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 },
  inFlight: [],
  quarantine: [],
  history: [],
  lastRunAt: null,
};

export function readState() {
  const state = readJson(STATE_FILE, { ...EMPTY });
  const currentMonth = today().slice(0, 7);
  if (state.month !== currentMonth) {
    // Новый месяц — счётчики обнуляются, незавершённая работа переносится.
    // История месяца уезжает в history, чтобы «сделано за месяц» осталось
    // проверяемым числом, а не воспоминанием.
    if (state.month) {
      state.history.unshift({ month: state.month, ...state.counters });
      state.history = state.history.slice(0, 24);
    }
    state.month = currentMonth;
    state.counters = { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 };
    if (!state.startedAt) state.startedAt = today();
  }
  return state;
}

export function saveState(state) {
  // Единая точка записи состояния (AP-P0-09): и plan/settle, и одиночные
  // вызовы `state.mjs claim/done/fail` проходят через этот lock. Вложенный
  // захват внутри plan/settle реентерантен.
  acquireLock({ cmd: 'state-save' });
  try {
    state.lastRunAt = new Date().toISOString();
    writeJson(STATE_FILE, state);
    return state;
  } finally {
    releaseLock();
  }
}

/**
 * Сколько статей контур может взять в работу прямо сейчас.
 *
 * Темп считается по календарным дням UTC (AP-P1-04): `workingDaysPerMonth` в
 * расчёте не участвует и удалён из конфига, чтобы не создавать ложную
 * семантику производственного календаря. `now` инъектируется для контрольных
 * дат в тестах.
 */
export function capacity(state = readState(), now = new Date()) {
  const T = cfg.throughput;
  const done = state.counters.new + state.counters.rewrite;
  // Отчётный день — UTC, и вычисление конца месяца тоже UTC. Раньше здесь
  // `new Date(y, m, 0)` строила локальную дату, и в UTC+14 конец месяца
  // съезжал на день назад: expectedByToday зависел от TZ машины.
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

  // План на сегодня — не «месячная норма / 30», а догоняющий: если вчера
  // недобрали (упал прогон, гейты завернули батч), сегодняшняя норма растёт.
  // Иначе один сбойный день навсегда съедает месячную цель.
  const expectedByToday = Math.round((T.monthlyTarget * day) / daysInMonth);
  const debt = Math.max(0, expectedByToday - done);
  const evenPace = T.monthlyTarget / daysInMonth;
  // Потолок устойчив к FP: 20/3*1.35*2 в двоичной дроби даёт 18.000000000000004,
  // и обычный ceil превратил бы ровно 18 в 19. Округление до 1e-6 перед ceil
  // убирает ложный «лишний слот», не ослабляя догон.
  const ceilStable = (x) => Math.ceil(Math.round(x * 1e6) / 1e6);
  const todayTarget = Math.min(
    ceilStable(evenPace + debt * (T.catchUpFactor - 1)),
    ceilStable(evenPace * T.catchUpFactor * T.batchesPerDay),
  );

  const freeSlots = Math.max(0, T.maxParallelWriting - state.inFlight.length);
  return {
    month: state.month,
    done,
    monthlyTarget: T.monthlyTarget,
    expectedByToday,
    debt,
    todayTarget,
    inFlight: state.inFlight.length,
    freeSlots,
    canTake: Math.min(freeSlots, todayTarget, T.maxBatchSize * T.batchesPerDay),
  };
}

export function claim(state, { slug, kind, title = '' }) {
  if (state.inFlight.some((t) => t.slug === slug)) {
    throw new Error(`Уже в работе: ${slug}`);
  }
  if (state.quarantine.some((t) => t.slug === slug)) {
    throw new Error(`В карантине, повторный заход запрещён: ${slug}`);
  }
  state.inFlight.push({ slug, kind, title, claimedAt: new Date().toISOString(), failures: 0, infraFailures: 0 });
  return state;
}

export function done(state, { slug, score = null, published = false }) {
  const idx = state.inFlight.findIndex((t) => t.slug === slug);
  if (idx === -1) throw new Error(`Не в работе: ${slug}`);
  const [task] = state.inFlight.splice(idx, 1);
  state.counters[task.kind === 'rewrite' ? 'rewrite' : 'new'] += 1;
  if (published) state.counters.published += 1;
  return { state, task, score };
}

/**
 * Отметить неудачу наряда.
 *
 * kind:
 * - `infra` — результат модели отсутствует по инфраструктурной причине
 *   (исполнитель не запущен, файл не создан). Это НЕ редакционный провал:
 *   тема не портится и в карантин не уходит. Инфраструктурные повторы
 *   ограничены, после лимита слот освобождается и тема возвращается в очередь
 *   с тревогой — иначе выключенный исполнитель навсегда сожрёт слоты.
 * - `author`/`gate` (по умолчанию) — содержательная неудача: считаются
 *   редакционные failures и после порога тема уходит в карантин.
 */
export function fail(state, { slug, reason, kind = 'gate' }) {
  const task = state.inFlight.find((t) => t.slug === slug);
  if (!task) throw new Error(`Не в работе: ${slug}`);
  task.lastFailure = reason;

  if (kind === 'infra') {
    task.infraFailures = (task.infraFailures || 0) + 1;
    const limit = cfg.gates.infraRetryLimit ?? 3;
    if (task.infraFailures >= limit) {
      state.inFlight = state.inFlight.filter((t) => t.slug !== slug);
      state.counters.infraReleases = (state.counters.infraReleases || 0) + 1;
      return { state, quarantined: false, released: true, infra: true, infraFailures: task.infraFailures };
    }
    return { state, quarantined: false, released: false, infra: true, infraFailures: task.infraFailures };
  }

  task.failures += 1;
  if (task.failures >= cfg.gates.quarantineAfterFailures) {
    state.inFlight = state.inFlight.filter((t) => t.slug !== slug);
    state.quarantine.push({ ...task, quarantinedAt: today(), reason });
    state.counters.quarantined += 1;
    return { state, quarantined: true, released: false, infra: false };
  }
  return { state, quarantined: false, released: false, infra: false };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  // Мутирующие команды держат lock на всё чтение-изменение-запись (AP-P0-09):
  // иначе два параллельных claim читают одно состояние и один из них теряется.
  // Read-only команды (get/month) идут без блокировки.
  const mutating = ['claim', 'done', 'fail', 'quarantine', 'reset'].includes(cmd);
  if (mutating) acquireLock({ cmd: `state-${cmd}` });
  try {
    runCommand(cmd, args);
  } finally {
    if (mutating) releaseLock();
  }
}

function runCommand(cmd, args) {
  let state = readState();

  switch (cmd) {
    case 'get': {
      const cap = capacity(state);
      if (args.json) {
        console.log(JSON.stringify({ state, capacity: cap }, null, 2));
        break;
      }
      console.log(`Месяц ${cap.month}: сделано ${cap.done}/${cap.monthlyTarget}`);
      console.log(`План на сегодня ${cap.todayTarget} (долг ${cap.debt}, ожидалось ${cap.expectedByToday})`);
      console.log(`В работе ${cap.inFlight}, свободных слотов ${cap.freeSlots}, взять можно ${cap.canTake}`);
      if (state.quarantine.length) console.log(`Карантин: ${state.quarantine.length} — ${state.quarantine.map((q) => q.slug).join(', ')}`);
      break;
    }
    case 'claim': {
      claim(state, { slug: args.slug, kind: args.kind || 'new', title: args.title || '' });
      saveState(state);
      console.log(`Взято в работу: ${args.slug} (${args.kind || 'new'})`);
      break;
    }
    case 'done': {
      const res = done(state, {
        slug: args.slug,
        score: args.score ? Number(args.score) : null,
        published: args.published !== undefined,
      });
      saveState(res.state);
      console.log(`Готово: ${args.slug}, счётчик месяца ${res.state.counters.new + res.state.counters.rewrite}`);
      break;
    }
    case 'fail': {
      const res = fail(state, { slug: args.slug, reason: args.reason || 'не указана', kind: args.kind || 'gate' });
      saveState(res.state);
      console.log(
        res.quarantined
          ? `В карантин: ${args.slug}`
          : res.released
            ? `Инфра-лимит исчерпан, слот освобождён, тема возвращена: ${args.slug}`
            : `Отметил неудачу: ${args.slug}`,
      );
      break;
    }
    case 'month': {
      console.log(JSON.stringify({ ...capacity(state), history: state.history.slice(0, 6) }, null, 2));
      break;
    }
    case 'unlock': {
      if (!args.force) {
        console.error('Нужен --force: снятие блокировки в обход владельца.');
        process.exit(1);
      }
      const by = args.by || process.env.USER || 'unknown';
      const res = forceUnlock({ by });
      console.log(`Снято: ${res.removed.length ? res.removed.join(', ') : 'нечего'} (by ${by})`);
      break;
    }
    case 'reset': {
      if (!args.force) {
        console.error('Нужен --force: reset стирает счётчики месяца и очередь в работе.');
        process.exit(1);
      }
      state = { ...EMPTY, month: today().slice(0, 7), startedAt: today() };
      saveState(state);
      console.log('Состояние сброшено.');
      break;
    }
    default:
      console.log('Использование: state.mjs get|claim|done|fail|month|unlock|reset');
      process.exit(1);
  }
}

if (isMain(import.meta.url)) main();
