import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireLock, releaseLock, isAlive, readLock, lockFile, forceUnlock, __resetForTests } from './lock.mjs';

const LOCK_MOD = path.resolve('scripts/lib/lock.mjs');

function childEnv(lockFile) {
  return { ...process.env, AUTOPILOT_LOCK_FILE: lockFile };
}

/** Держатель блокировки: сигналит READY и ждёт, пока его убьют. */
const HOLDER_CODE = `
import { acquireLock } from ${JSON.stringify(LOCK_MOD)};
acquireLock({ cmd: 'test-hold', runId: 'test-holder' });
process.stdout.write('READY\\n');
await new Promise((resolve) => setTimeout(resolve, 30000));
`;

/** Претендент: пробует занять и сообщает итог. */
const CONTENDER_CODE = `
import { acquireLock, releaseLock } from ${JSON.stringify(LOCK_MOD)};
try {
  acquireLock({ cmd: 'test-contender', runId: 'test-contender' });
  releaseLock();
  process.stdout.write('ACQUIRED\\n');
} catch (error) {
  process.stderr.write(error.message + '\\n');
  process.exit(2);
}
`;

/**
 * Участник стресс-теста. Стартует по барьеру START_AT, пытается занять lock и
 * фиксирует факт попытки в общем каталоге. Победитель держит lock, пока все
 * участники не отметятся, поэтому поздний старт не может «дождаться»
 * освобождения и создать ложную вторую победу. Печатает ACQUIRED или BUSY.
 */
const STRESS_CODE = `
import { readdirSync, writeFileSync } from 'node:fs';
import { acquireLock, releaseLock } from ${JSON.stringify(LOCK_MOD)};
const dir = process.env.DIR;
const runId = process.env.RUN_ID;
const workers = Number(process.env.WORKERS);
const maxWait = Number(process.env.MAX_WAIT || 5000);
const startAt = Number(process.env.START_AT);
while (Date.now() < startAt) {}
let acquired = false;
try {
  acquireLock({ cmd: 'stress', runId });
  acquired = true;
} catch {}
writeFileSync(dir + '/attempt-' + runId, '1');
if (acquired) {
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    const n = readdirSync(dir).filter((f) => f.startsWith('attempt-')).length;
    if (n >= workers) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  releaseLock();
  process.stdout.write('ACQUIRED\\n');
} else {
  process.stdout.write('BUSY\\n');
}
`;

function waitFor(file, timeoutMs = 5000) {
  const start = Date.now();
  while (!existsSync(file)) {
    if (Date.now() - start > timeoutMs) throw new Error(`не дождались файла ${file}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}

function runStressChild(lockFile, startAt, runId, workers, dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', STRESS_CODE], {
      env: {
        ...childEnv(lockFile),
        START_AT: String(startAt),
        RUN_ID: runId,
        WORKERS: String(workers),
        DIR: dir,
      },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out }));
  });
}

test('AP-P0-09: второй процесс отказывает до чтения/записи состояния', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const env = childEnv(lockFile);

  const holder = spawn(process.execPath, ['--input-type=module', '-e', HOLDER_CODE], { env });
  try {
    holder.stdout.on('data', () => {});
    waitFor(lockFile);
    const contender = spawnSync(process.execPath, ['--input-type=module', '-e', CONTENDER_CODE], {
      env, encoding: 'utf8',
    });
    assert.equal(contender.status, 2, `претендент должен отказать, stdout: ${contender.stdout}`);
    assert.match(contender.stderr, /уже работает/);
    assert.match(contender.stderr, /test-hold/);
    const current = JSON.parse(readFileSync(lockFile, 'utf8'));
    assert.equal(current.runId, 'test-holder');
  } finally {
    holder.kill('SIGKILL');
    await new Promise((resolve) => holder.on('close', resolve));
  }
});

test('AP-P0-09: одновременный старт 16 процессов — ровно один владелец', async () => {
  // Регрессия на TOCTOU: между проверкой существования lock и обычной записью
  // несколько процессов успевали стать владельцами. Захват обязан быть
  // атомарным exclusive create, а не «проверить и записать».
  const ROUNDS = 6;
  const WORKERS = 16;
  for (let round = 0; round < ROUNDS; round++) {
    const dir = mkdtempSync(path.join(tmpdir(), `lock-stress-${round}-`));
    const lockFile = path.join(dir, '.autopilot.lock');
    const startAt = Date.now() + 250;
    const results = await Promise.all(
      Array.from({ length: WORKERS }, (_, i) => runStressChild(lockFile, startAt, `stress-${round}-${i}`, WORKERS, dir)),
    );
    const acquired = results.filter((r) => r.out.includes('ACQUIRED')).length;
    const busy = results.filter((r) => r.out.includes('BUSY')).length;
    assert.equal(
      acquired,
      1,
      `раунд ${round}: владельцев ${acquired}, BUSY ${busy}; выводы: ${results.map((r) => r.out.trim()).join(',')}`,
    );
    assert.equal(acquired + busy, WORKERS);
    assert.equal(existsSync(lockFile), false, `раунд ${round}: lock должен быть освобождён`);
  }
});

test('AP-P0-09: lock умершего процесса перенимается и журналируется', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    writeFileSync(lockFile, JSON.stringify({ pid: 999999999, runId: 'dead', cmd: 'plan', startedAt: '2026-01-01T00:00:00.000Z' }), 'utf8');
    assert.equal(isAlive(999999999), false);
    const lock = acquireLock({ cmd: 'plan', runId: 'test-recovery' });
    assert.equal(lock.runId, 'test-recovery');
    releaseLock();
    assert.equal(existsSync(lockFile), false);
    const events = readFileSync(path.join(dir, 'lock-events.jsonl'), 'utf8');
    assert.match(events, /reaped/);
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});

test('AP-P1-19: убитый владелец lock не блокирует takeover', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-kill-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const env = childEnv(lockFile);
  const holder = spawn(process.execPath, ['--input-type=module', '-e', HOLDER_CODE], { env });
  holder.stdout.on('data', () => {});
  waitFor(lockFile);
  holder.kill('SIGKILL');
  await new Promise((resolve) => holder.on('close', resolve));

  const contender = spawnSync(process.execPath, ['--input-type=module', '-e', CONTENDER_CODE], { env, encoding: 'utf8' });
  assert.equal(contender.status, 0, `takeover должен пройти: ${contender.stderr}`);
  assert.match(contender.stdout, /ACQUIRED/);
});

test('AP-P0-09: живой владелец не снимается перехватом', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    // Владелец — сам тестовый процесс: гарантированно жив.
    writeFileSync(lockFile, JSON.stringify({ pid: process.pid, runId: 'live', cmd: 'plan', startedAt: new Date().toISOString() }), 'utf8');
    assert.throws(() => acquireLock({ cmd: 'plan', runId: 'other' }), /уже работает/);
    assert.equal(JSON.parse(readFileSync(lockFile, 'utf8')).runId, 'live');
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});

test('AP-P0-09: повреждённый lock-файл — отказ, а не тихий захват', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    writeFileSync(lockFile, '{"pid": 123, "runId":', 'utf8');
    assert.throws(() => acquireLock({ cmd: 'plan' }), /Повреждён lock-файл/);
    assert.throws(() => readLock(), /Повреждён lock-файл/);
    // Файл не снят: повреждённое состояние нельзя молча перезаписать.
    assert.equal(existsSync(lockFile), true);
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});

test('AP-P0-09: повторный захват из того же процесса реентерантен', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    const first = acquireLock({ cmd: 'plan' });
    const second = acquireLock({ cmd: 'state-save' });
    assert.equal(second, first);
    assert.equal(releaseLock(), false, 'вложенное освобождение файл не снимает');
    assert.equal(existsSync(lockFile), true);
    assert.equal(releaseLock(), true, 'внешнее освобождение файл снимает');
    assert.equal(existsSync(lockFile), false);
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});

test('AP-P0-09: по умолчанию lock лежит в AUTOPILOT_DATA_DIR', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-datadir-'));
  const prevLock = process.env.AUTOPILOT_LOCK_FILE;
  const prevData = process.env.AUTOPILOT_DATA_DIR;
  delete process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_DATA_DIR = dir;
  try {
    assert.equal(lockFile(), path.join(dir, '.autopilot.lock'));
    mkdirSync(dir, { recursive: true });
    acquireLock({ cmd: 'plan' });
    assert.equal(existsSync(path.join(dir, '.autopilot.lock')), true);
    releaseLock();
  } finally {
    __resetForTests();
    if (prevLock === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevLock;
    if (prevData === undefined) delete process.env.AUTOPILOT_DATA_DIR;
    else process.env.AUTOPILOT_DATA_DIR = prevData;
  }
});

test('AP-P0-09: stale reap-файл не снимается автоматически, но диагностируется', () => {
  // Сбой процесса-перехватчика оставляет reap-файл. Автоснять его нельзя:
  // два перехватчика могут удалить чужой свежий lock. Нужен явный оператор.
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    writeFileSync(lockFile, JSON.stringify({ pid: 999999999, runId: 'dead', cmd: 'plan' }), 'utf8');
    writeFileSync(`${lockFile}.reap`, JSON.stringify({ pid: 999999998, at: '2026-01-01T00:00:00Z' }), 'utf8');
    assert.throws(() => acquireLock({ cmd: 'plan', runId: 'x' }), /reap-файл.*мёртвого процесса/);
    // Ни lock, ни reap не тронуты.
    assert.equal(existsSync(lockFile), true);
    assert.equal(existsSync(`${lockFile}.reap`), true);
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});

test('AP-P0-09: forceUnlock отказывает живому владельцу', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    writeFileSync(lockFile, JSON.stringify({ pid: process.pid, runId: 'live', cmd: 'plan' }), 'utf8');
    assert.throws(() => forceUnlock({ by: 'operator' }), /владелец lock.*жив/);
    assert.equal(existsSync(lockFile), true);
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});

test('AP-P0-09: forceUnlock снимает мёртвый lock и stale reap, журналируя', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    writeFileSync(lockFile, JSON.stringify({ pid: 999999999, runId: 'dead', cmd: 'plan' }), 'utf8');
    writeFileSync(`${lockFile}.reap`, JSON.stringify({ pid: 999999998 }), 'utf8');
    const res = forceUnlock({ by: 'operator' });
    assert.deepEqual(res.removed.sort(), [lockFile, `${lockFile}.reap`].sort());
    assert.equal(existsSync(lockFile), false);
    assert.equal(existsSync(`${lockFile}.reap`), false);
    const events = readFileSync(path.join(dir, 'lock-events.jsonl'), 'utf8');
    assert.match(events, /force-unlock/);
    assert.match(events, /operator/);
    // После аварийного снятия захват снова работает.
    acquireLock({ cmd: 'plan', runId: 'after-unlock' });
    releaseLock();
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});

test('AP-P0-09: forceUnlock снимает повреждённый lock при мёртвом reap', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const lockFile = path.join(dir, '.autopilot.lock');
  const prevEnv = process.env.AUTOPILOT_LOCK_FILE;
  process.env.AUTOPILOT_LOCK_FILE = lockFile;
  try {
    writeFileSync(lockFile, '{"pid":', 'utf8');
    writeFileSync(`${lockFile}.reap`, JSON.stringify({ pid: 999999998 }), 'utf8');
    const res = forceUnlock({ by: 'operator' });
    assert.equal(res.removed.length, 2);
    assert.equal(existsSync(lockFile), false);
  } finally {
    __resetForTests();
    if (prevEnv === undefined) delete process.env.AUTOPILOT_LOCK_FILE;
    else process.env.AUTOPILOT_LOCK_FILE = prevEnv;
  }
});
