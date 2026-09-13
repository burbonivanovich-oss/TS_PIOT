#!/usr/bin/env node
// Межпроцессная блокировка мутирующих команд (AP-P0-09).
//
// Документация запрещает параллельные проходы, но код их не предотвращал: два
// `plan`/`settle` одновременно читали старое состояние и затирали изменения
// друг друга. Здесь единый lock-файл с PID/runId/cmd и временем старта
// охраняет все мутирующие команды.
//
// Корректность держится на двух атомарных примитивах файловой системы, а не
// на «проверить и записать» (это классический TOCTOU: между `existsSync` и
// `writeFileSync` несколько процессов успевают стать владельцами):
//
//   1. Захват — `linkSync(tmp, lock)` из уже записанного и сброшенного на диск
//      временного файла. Жёсткая ссылка создаётся атомарно и падает с EEXIST,
//      если lock уже есть. Контент записан до ссылки, поэтому окна «lock есть,
//      но пуст» не существует.
//   2. Перехват мёртвого владельца — под отдельным reap-файлом, создаваемым
//      через exclusive create. Только один процесс перехватывает за раз;
//      живой владелец не снимается никогда.
//
// Повреждённый lock-файл — отказ, а не тихий захват: владельца установить
// нельзя, значит безопасного решения нет.
import {
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  appendFileSync,
  linkSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');

export const lockFile = () => {
  if (process.env.AUTOPILOT_LOCK_FILE) return process.env.AUTOPILOT_LOCK_FILE;
  const dataDir = process.env.AUTOPILOT_DATA_DIR || path.join(ROOT, 'data');
  return path.join(dataDir, '.autopilot.lock');
};

const eventsFile = () => path.join(path.dirname(lockFile()), 'lock-events.jsonl');

function journal(event) {
  try {
    mkdirSync(path.dirname(eventsFile()), { recursive: true });
    appendFileSync(eventsFile(), JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n', 'utf8');
  } catch {
    // Журнал — наблюдаемость, а не условие корректности: его недоступность
    // не должна ронять захват или освобождение блокировки.
  }
}

/** Жив ли процесс-владелец. EPERM означает «чужой, но живой». */
export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') return true;
    return false;
  }
}

/** Прочитать lock. null — файла нет; исключение — файл повреждён/нечитаем. */
export function readLock() {
  const file = lockFile();
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Не читается lock-файл ${file}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Повреждён lock-файл ${file}: ${error.message}. ` +
        'Снимите его вручную, убедившись, что живого владельца нет.',
    );
  }
  if (!parsed || !Number.isInteger(parsed.pid)) {
    throw new Error(`Повреждён lock-файл ${file}: нет валидного pid. Снимите его вручную после проверки владельца.`);
  }
  return parsed;
}

/**
 * Атомарно создать lock-файл из готового содержимого.
 * true — создали и владеем; false — файл уже существует.
 */
function createExclusive(file, content) {
  const candidate = `${file}.candidate-${process.pid}-${randomBytes(6).toString('hex')}`;
  let fd;
  try {
    fd = openSync(candidate, 'w');
    writeSync(fd, content, null, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    // Жёсткая ссылка атомарна и не перезаписывает существующий файл: именно
    // это делает захват честным при одновременном старте процессов.
    linkSync(candidate, file);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Дескриптор уже мог быть закрыт.
      }
    }
    try {
      unlinkSync(candidate);
    } catch {
      // Debris после падения не должен скрывать исходную ошибку.
    }
  }
}

// Реентерантный счётчик текущего процесса: plan держит lock всё время
// прохода, вложенные мутирующие вызовы захват повторяют, а не конкурируют.
let held = null;

export function newRunId() {
  return `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Прочитать reap-файл (владелец перехвата). null — файла нет или содержимое
 * неполное/повреждено: по такому файлу нельзя надёжно определить владельца,
 * поэтому он не считается мёртвым и автоматически не снимается.
 */
function readReap(file) {
  const reap = `${file}.reap`;
  let raw;
  try {
    raw = readFileSync(reap, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return Number.isInteger(parsed?.pid) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Перехватить lock мёртвого владельца. Возвращает true, если старый файл снят
 * (или уже исчез) и можно повторить захват. Живой владелец и повреждённый
 * файл не трогаются.
 */
function reapStale(file) {
  const reap = `${file}.reap`;
  let fd;
  try {
    fd = openSync(reap, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') return false; // другой процесс уже перехватывает
    throw error;
  }
  try {
    writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), null, 'utf8');
    fsyncSync(fd);
    let current;
    try {
      current = readLock();
    } catch {
      // Повреждённый файл под перехватом не снимаем: владельца не установить.
      return false;
    }
    if (current === null) return true; // кто-то успел снять
    if (isAlive(current.pid)) return false; // владелец ожил — не трогаем
    try {
      unlinkSync(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    journal({ event: 'reaped', reaperPid: process.pid, previousOwner: current });
    return true;
  } finally {
    closeSync(fd);
    try {
      unlinkSync(reap);
    } catch {
      // reap-файл мог быть снят конкурентным перехватчиком.
    }
  }
}

/**
 * Занять блокировку. Бросает исключение, если lock держит живой процесс или
 * lock-файл повреждён — до любой работы с данными.
 */
export function acquireLock({ cmd = 'unknown', runId = null } = {}) {
  if (held) {
    held.count += 1;
    return held.lock;
  }
  runId = runId || newRunId();
  const file = lockFile();
  mkdirSync(path.dirname(file), { recursive: true });
  const lock = { pid: process.pid, runId, cmd, startedAt: new Date().toISOString() };
  const content = JSON.stringify(lock, null, 2) + '\n';

  for (let attempt = 0; attempt < 20; attempt++) {
    if (createExclusive(file, content)) {
      journal({ event: 'acquired', cmd, runId, pid: process.pid });
      held = { lock, count: 1 };
      return lock;
    }

    const current = readLock();
    if (current === null) continue; // файл исчез между EEXIST и чтением
    if (isAlive(current.pid)) {
      journal({ event: 'refused', cmd, runId, owner: current });
      throw new Error(
        `Контур уже работает: pid ${current.pid}, команда ${current.cmd || '?'}, ` +
          `старт ${current.startedAt || '?'}, runId ${current.runId || '?'}. ` +
          'Дождитесь завершения или снимите lock вручную, убедившись, что процесс мёртв.',
      );
    }
    if (reapStale(file)) continue;

    // Перехват уже кем-то занят. Если владелец reap-файла мёртв, автоснятие
    // запрещено: два одновременных перехватчика могут удалить чужой свежий
    // lock. Это аварийная ситуация для оператора, а не для авто-выхода.
    const reaper = readReap(file);
    if (reaper && !isAlive(reaper.pid)) {
      journal({ event: 'blocked-stale-reap', cmd, runId, reaperPid: reaper.pid });
      throw new Error(
        `Блокировка не снята: reap-файл ${file}.reap остался от мёртвого процесса ${reaper.pid}. ` +
          `Аварийное снятие: node scripts/state.mjs unlock --force --by <оператор>.`,
      );
    }
    sleep(20); // перехват занят живым процессом — короткая пауза и повтор
  }
  throw new Error(
    `Не удалось занять блокировку ${file}: слишком много конкурентов за перехват мёртвого владельца. ` +
      `Проверьте ${file} и ${file}.reap; аварийное снятие: node scripts/state.mjs unlock --force --by <оператор>.`,
  );
}

/**
 * Аварийное снятие блокировки оператором. Отказывает, пока жив владелец lock
 * или живой процесс-перехватчик: снимать чужую активную работу нельзя.
 * Каждое снятие журналируется отдельным событием force-unlock.
 */
export function forceUnlock({ by = 'unknown' } = {}) {
  const file = lockFile();
  const reapFile = `${file}.reap`;
  let owner = null;
  try {
    owner = readLock();
  } catch {
    owner = null; // повреждённый lock оператор вправе снять принудительно
  }
  if (owner && isAlive(owner.pid)) {
    throw new Error(`Отказ: владелец lock (pid ${owner.pid}) жив. Остановите его сначала.`);
  }
  const reaper = readReap(file);
  if (reaper && isAlive(reaper.pid)) {
    throw new Error(`Отказ: процесс-перехватчик (pid ${reaper.pid}) жив. Остановите его сначала.`);
  }
  const removed = [];
  for (const candidate of [file, reapFile]) {
    if (existsSync(candidate)) {
      unlinkSync(candidate);
      removed.push(candidate);
    }
  }
  journal({ event: 'force-unlock', by, removed, previousOwner: owner, previousReaper: reaper });
  return { removed, previousOwner: owner, previousReaper: reaper };
}

/** Освободить блокировку. Чужой lock не трогает — бросает исключение. */
export function releaseLock() {
  if (held) {
    held.count -= 1;
    if (held.count > 0) return false;
    const { runId, cmd } = held.lock;
    held = null;
    removeOwnLock(runId, cmd);
    return true;
  }
  return false;
}

function removeOwnLock(runId, cmd) {
  const file = lockFile();
  let current = null;
  try {
    current = readLock();
  } catch {
    // Свой lock оказался повреждён (внешнее вмешательство) — не снимаем
    // чужое и не скрываем проблему.
    throw new Error(`Не удаётся освободить lock ${file}: файл повреждён.`);
  }
  if (current && (current.pid !== process.pid || current.runId !== runId)) {
    throw new Error(
      `Lock-файл принадлежит другому процессу: pid ${current.pid}, runId ${current.runId || '?'}. Свой не снимаю.`,
    );
  }
  if (current) unlinkSync(file);
  journal({ event: 'released', cmd, runId, pid: process.pid });
}

/** Обёртка: захват → работа → освобождение даже при исключении. */
export async function withLock(options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }
  acquireLock(options);
  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

/** Только для тестов: сбросить счётчик текущего процесса. */
export function __resetForTests() {
  held = null;
}

/**
 * Read-only инспекция блокировки для preflight/health-check: кто владелец, жив
 * ли он, остался ли reap-файл и жив ли перехватчик. Ничего не меняет.
 */
export function inspectLock() {
  const file = lockFile();
  let lock = null;
  let corrupt = null;
  try {
    lock = readLock();
  } catch (error) {
    corrupt = error.message;
  }
  const reap = readReap(file);
  return {
    file,
    exists: existsSync(file),
    corrupt,
    lock,
    ownerAlive: lock ? isAlive(lock.pid) : false,
    reap,
    reaperAlive: reap ? isAlive(reap.pid) : false,
  };
}
