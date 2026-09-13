import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBackup, verifyBackup, restoreBackup } from './backup.mjs';

function fixture() {
  const data = mkdtempSync(path.join(tmpdir(), 'backup-data-'));
  mkdirSync(path.join(data, 'runs'), { recursive: true });
  writeFileSync(path.join(data, 'autopilot.json'), JSON.stringify({ month: '2026-09' }), 'utf8');
  writeFileSync(path.join(data, 'runs', 'run-1.json'), JSON.stringify({ runId: 'run-1' }), 'utf8');
  const backup = mkdtempSync(path.join(tmpdir(), 'backup-out-'));
  return { data, backup };
}

test('AP-P1-17: создание, верификация и восстановление бэкапа', () => {
  const { data, backup } = fixture();
  const created = createBackup({ from: data, to: backup });
  assert.equal(created.files, 2);
  assert.ok(existsSync(path.join(backup, 'backup-manifest.json')));

  const check = verifyBackup({ backup });
  assert.equal(check.ok, true);
  assert.equal(check.files, 2);

  const restored = mkdtempSync(path.join(tmpdir(), 'backup-restore-'));
  const result = restoreBackup({ backup, to: restored });
  assert.equal(result.files, 2);
  assert.equal(readFileSync(path.join(restored, 'autopilot.json'), 'utf8'), readFileSync(path.join(data, 'autopilot.json'), 'utf8'));
  assert.equal(readFileSync(path.join(restored, 'runs', 'run-1.json'), 'utf8'), readFileSync(path.join(data, 'runs', 'run-1.json'), 'utf8'));
});

test('AP-P1-17: повреждённый бэкап отвергается и не восстанавливается', () => {
  const { data, backup } = fixture();
  createBackup({ from: data, to: backup });
  writeFileSync(path.join(backup, 'autopilot.json'), '{"month":"tampered"}', 'utf8');

  const check = verifyBackup({ backup });
  assert.equal(check.ok, false);
  assert.deepEqual(check.mismatches, ['autopilot.json']);

  const restored = mkdtempSync(path.join(tmpdir(), 'backup-restore-'));
  assert.throws(() => restoreBackup({ backup, to: restored }), /Бэкап повреждён/);
  assert.ok(!existsSync(path.join(restored, 'autopilot.json')));
});

test('AP-P1-17: отсутствие манифеста — явная ошибка', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'backup-empty-'));
  assert.throws(() => verifyBackup({ backup: empty }), /Нет манифеста/);
});
