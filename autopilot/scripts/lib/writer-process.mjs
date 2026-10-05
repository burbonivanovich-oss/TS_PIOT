import { spawn } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, writeFileSync, openSync, fsyncSync, closeSync, unlinkSync, statSync, readSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Persist categories only: CLI diagnostics may contain credentials or private prompts.
export function writerFailureCode(error) {
  if (['model_capacity', 'model_rate_limit', 'model_transport', 'writer_failure'].includes(error?.failureCode)) return error.failureCode;
  const message = String(error?.message || '');
  if (/selected model is at capacity/i.test(message)) return 'model_capacity';
  if (/rate limit|quota exceeded/i.test(message)) return 'model_rate_limit';
  if (/stream disconnected|network|ECONNRESET|ETIMEDOUT/i.test(message)) return 'model_transport';
  return 'writer_failure';
}

export function groupAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Неверный PID исполнителя');
  try { process.kill(-pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; }
}

export function assertWriterStopped(actorFile) {
  if (!existsSync(actorFile)) return;
  if (lstatSync(actorFile).isSymbolicLink() || lstatSync(actorFile).nlink !== 1) throw new Error('Небезопасный actor lease');
  const actor = JSON.parse(readFileSync(actorFile, 'utf8'));
  if (process.platform === 'win32' || groupAlive(actor.pid)) throw new Error('Группа модельного исполнителя ещё жива; откат запрещён');
  unlinkSync(actorFile);
}

// Only the terminal CLI footer is an observation; this is not billing data.
export function reportedCliTokens(stderr) {
  const match = stderr.match(/(?:^|\n)tokens used\r?\n([0-9]+(?:[ ,\u00a0\u202f][0-9]{3})*)\s*$/);
  if (!match) return null;
  const value = Number(match[1].replace(/[ ,\u00a0\u202f]/g, ''));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function supervisedProcess(command, args, { cwd, input = '', timeout = 30 * 60_000, actorFile, maxBytes = 32 * 1024 * 1024 } = {}) {
  if (process.platform === 'win32') throw new Error('Модельный исполнитель требует POSIX process groups');
  if (!actorFile) throw new Error('Нет пути actor lease');
  assertWriterStopped(actorFile);
  const outFile = `${actorFile}.stdout.log`; const errFile = `${actorFile}.stderr.log`;
  function openLog(file) {
    if (existsSync(file)) {
      if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink() || lstatSync(file).nlink !== 1) throw new Error('Небезопасный файл диагностики');
      unlinkSync(file);
    }
    return openSync(file, 'wx', 0o600);
  }
  const outFd = openLog(outFile); let errFd;
  try { errFd = openLog(errFile); } catch (error) { closeSync(outFd); throw error; }
  // Rust CLI expects blocking stdio. Regular files avoid EAGAIN/panic from
  // inheriting Node's nonblocking pipes during large tool output bursts.
  let child;
  try { child = spawn(process.execPath, [fileURLToPath(new URL('./writer-worker.mjs', import.meta.url)), JSON.stringify([command, args])], { cwd, detached: true, stdio: ['pipe', outFd, errFd] }); }
  finally { closeSync(outFd); closeSync(errFd); }
  let failure = null;
  const kill = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') failure ||= error; } } };
  const done = new Promise(resolve => { child.once('error', error => { failure ||= error; resolve({ code: null }); }); child.once('exit', (code, signal) => resolve({ code, signal })); });
  const checkSize = () => {
    try { if (statSync(outFile).size + statSync(errFile).size > maxBytes) { failure ||= new Error('Вывод исполнителя превысил лимит'); kill(); } }
    catch (error) { failure ||= error; kill(); }
  };
  child.stdin.on('error', () => {});
  const sizeTimer = setInterval(checkSize, 200);
  const timer = setTimeout(() => { failure ||= new Error('Таймаут модельного исполнителя'); kill(); }, timeout);
  try {
    if (!child.pid) { await done; throw failure || new Error('Не удалось запустить worker'); }
    // Exclusive creation and fsync happen before worker can launch the command.
    const fd = openSync(actorFile, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify({ pid: child.pid, parentPid: process.pid, at: new Date().toISOString() })); fsyncSync(fd); } finally { closeSync(fd); }
    child.stdin.end(input);
    const result = await done;
    kill(); // main command may have exited while its descendants still write
    for (let i = 0; i < 200 && groupAlive(child.pid); i++) await new Promise(resolve => setTimeout(resolve, 25));
    assertWriterStopped(actorFile); // retain lease and refuse rollback if quiescence is unproven
    checkSize();
    function prefix(file, limit) {
      const fd = openSync(file, 'r');
      try { const bytes = Buffer.alloc(Math.min(statSync(file).size, Math.max(0, limit))); const count = readSync(fd, bytes, 0, bytes.length, 0); return bytes.subarray(0, count).toString('utf8'); } finally { closeSync(fd); }
    }
    const output = prefix(outFile, maxBytes); const stderr = prefix(errFile, maxBytes - Buffer.byteLength(output));
    // Private diagnostics stay local and are excluded from Git. Never echo raw
    // model/tool transcripts into routine reports or production artifacts.
    writeFileSync(`${actorFile}.trace.log`, JSON.stringify({ code: result.code, signal: result.signal, failure: failure?.message || null, output, stderr }), { mode: 0o600 });
    const reportedTokens = reportedCliTokens(stderr);
    if (failure) { failure.reportedTokens = reportedTokens; throw failure; }
    if (result.code !== 0 || result.signal) { const error = new Error(`Исполнитель завершился с ошибкой: ${result.signal || result.code}`); error.reportedTokens = reportedTokens; error.failureCode = writerFailureCode({ message: stderr }); throw error; }
    return { output, stderr, reportedTokens };
  } finally { clearTimeout(timer); clearInterval(sizeTimer); kill(); }
}
