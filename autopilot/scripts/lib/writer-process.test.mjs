import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { supervisedProcess, assertWriterStopped } from './writer-process.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('large synchronous stderr burst completes without nonblocking pipe error', { skip: process.platform === 'win32' }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-burst-')); const actorFile = path.join(root, '.actor');
  try {
    const code = "const fs=require('node:fs');const b=Buffer.alloc(2*1024*1024,97);let n=0;while(n<b.length)n+=fs.writeSync(2,b,n,b.length-n);";
    const result = await supervisedProcess(process.execPath, ['-e', code], { actorFile, timeout: 5000 });
    assert.equal(result.stderr.length, 2 * 1024 * 1024); assert.equal(existsSync(actorFile), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('log size cap rejects completed oversized output', { skip: process.platform === 'win32' }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-log-cap-')); const actorFile = path.join(root, '.actor');
  try {
    await assert.rejects(supervisedProcess(process.execPath, ['-e', "require('node:fs').writeSync(2,Buffer.alloc(200000,97))"], { actorFile, maxBytes: 10000 }), /превысил лимит/);
    assert.equal(existsSync(actorFile), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('successful leader exit kills its still-writing descendant before delivery', { skip: process.platform === 'win32' }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-descendant-')); const output = path.join(root, 'ticks'); const actorFile = path.join(root, '.actor');
  try {
    const descendant = `const fs=require('node:fs');fs.appendFileSync(${JSON.stringify(output)},'x');setInterval(()=>fs.appendFileSync(${JSON.stringify(output)},'x'),20);`;
    const leader = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});setTimeout(()=>process.exit(0),250);`;
    await supervisedProcess(process.execPath, ['-e', leader], { actorFile, timeout: 5000 });
    assert.equal(existsSync(actorFile), false); const bytes = readFileSync(output, 'utf8'); assert.ok(bytes.length > 0);
    await pause(150); assert.equal(readFileSync(output, 'utf8'), bytes, 'descendant must stop before receipt or rollback');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('timeout kills writing processes and removes lease only after stop', { skip: process.platform === 'win32' }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-timeout-')); const output = path.join(root, 'ticks'); const actorFile = path.join(root, '.actor');
  try {
    // Under a parallel test load the timeout may precede command startup.
    // Both cases must leave stable bytes after the process group is stopped.
    writeFileSync(output, '');
    const code = `const fs=require('node:fs');fs.appendFileSync(${JSON.stringify(output)},'x');setInterval(()=>fs.appendFileSync(${JSON.stringify(output)},'x'),20);`;
    await assert.rejects(supervisedProcess(process.execPath, ['-e', code], { actorFile, timeout: 400 }), /Таймаут/);
    assert.equal(existsSync(actorFile), false); const bytes = readFileSync(output, 'utf8'); await pause(150); assert.equal(readFileSync(output, 'utf8'), bytes);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('live leased actor prevents restoration; dead actor lease is recoverable', { skip: process.platform === 'win32' }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-live-')); const actorFile = path.join(root, '.actor');
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' });
  const stopped = new Promise(resolve => child.once('exit', resolve));
  try {
    writeFileSync(actorFile, JSON.stringify({ pid: child.pid })); assert.throws(() => assertWriterStopped(actorFile), /ещё жива/); assert.equal(existsSync(actorFile), true);
    process.kill(-child.pid, 'SIGKILL'); await stopped;
    assertWriterStopped(actorFile); assert.equal(existsSync(actorFile), false);
  } finally { try { process.kill(-child.pid, 'SIGKILL'); } catch {} await stopped; rmSync(root, { recursive: true, force: true }); }
});
