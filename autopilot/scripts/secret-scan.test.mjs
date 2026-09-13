import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText, scanPath } from './secret-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('AP-P0-25: формат ключей распознаётся', () => {
  assert.equal(scanText('-----BEGIN RSA PRIVATE KEY-----').length, 1);
  assert.equal(scanText('token=ghp_abcdefghijklmnopqrstuvwxyz0123456789').length, 1);
  assert.equal(scanText('sk-abcdefghijklmnopqrstuvwx').length, 1);
  assert.equal(scanText('xoxb-1234567890-abcdefghij').length, 1);
  assert.equal(scanText('password = "supersecretvalue123"').length, 1);
  assert.equal(scanText('обычный текст без секретов').length, 0);
});

test('AP-P0-25: имена констант и env-переменных — не секреты', () => {
  // Реальный корпус TS_PIOT передаёт значения через константы; это не утечка.
  assert.equal(scanText('client_secret: OAUTH_CLIENT_SECRET').length, 0);
  assert.equal(scanText('apiKey: process.env.GOOGLE_API_KEY').length, 0);
  assert.equal(scanText('access_token: GITHUB_TOKEN').length, 0);
  // Но настоящий литерал остаётся находкой.
  assert.equal(scanText('client_secret: "abcdefghijklmnop"').length, 1);
});

test('AP-P0-25: маркер allow пропускает строку', () => {
  assert.equal(scanText('token=ghp_abcdefghijklmnopqrstuvwxyz0123456789 // secret-scan:allow').length, 0);
});

test('AP-P0-25: скан каталога находит секрет и уважает allowlist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'secrets-'));
  mkdirSync(path.join(dir, 'sub'), { recursive: true });
  writeFileSync(path.join(dir, 'leak.md'), 'ключ AKIAIOSFODNN7EXAMPLE\n', 'utf8');
  writeFileSync(path.join(dir, 'sub', 'clean.md'), 'тут чисто\n', 'utf8');
  const findings = scanPath(dir);
  assert.equal(findings.length, 1);
  assert.match(findings[0].file, /leak\.md$/);
  assert.equal(findings[0].pattern, 'aws-access-key');
  assert.equal(scanPath(dir, [path.join(dir, 'leak.md')]).length, 0, 'allowlist пути пропускает файл');
  // Бинарный файл с сигнатурой ключа не читается как текст.
  writeFileSync(path.join(dir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x41, 0x4b, 0x49, 0x41, 0x49, 0x4f, 0x53]));
  assert.equal(scanPath(dir).length, 1);
});

test('AP-P0-25: CLI возвращает exit 2 и JSON при находке', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'secrets-cli-'));
  writeFileSync(path.join(dir, 'leak.md'), 'ключ AKIAIOSFODNN7EXAMPLE\n', 'utf8');
  const proc = spawnSync(process.execPath, ['scripts/secret-scan.mjs', '--path', dir, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(proc.status, 2, proc.stderr);
  const out = JSON.parse(proc.stdout);
  assert.equal(out.findings.length, 1);

  const clean = mkdtempSync(path.join(tmpdir(), 'secrets-clean-'));
  writeFileSync(path.join(clean, 'ok.md'), 'тут чисто\n', 'utf8');
  const ok = spawnSync(process.execPath, ['scripts/secret-scan.mjs', '--path', clean], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(ok.status, 0);
});
