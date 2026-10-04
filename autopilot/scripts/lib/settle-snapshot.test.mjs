import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { snapshotSettle } from './settle-snapshot.mjs';

test('rollback restores content/state/run and removes new reports without changing evidence', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'settle-snapshot-'));
  try {
    const blog = path.join(root, 'blog'); const dataDir = path.join(root, 'data');
    mkdirSync(blog); mkdirSync(path.join(dataDir, 'runs'), { recursive: true });
    mkdirSync(path.join(dataDir, 'claim-evidence'));
    const article = path.join(blog, 'a.mdx'); const state = path.join(dataDir, 'autopilot.json');
    const run = path.join(dataDir, 'runs', 'run.json'); const evidence = path.join(dataDir, 'claim-evidence', 'a.json');
    for (const file of [article, state, run, evidence]) writeFileSync(file, 'original\r\n');
    const snapshot = snapshotSettle({ blog, dataDir });
    for (const file of [article, state, run]) writeFileSync(file, 'changed');
    writeFileSync(evidence, 'independent');
    const report = path.join(dataDir, 'report-new.json'); writeFileSync(report, '{}');
    snapshot.restore();
    for (const file of [article, state, run]) assert.equal(readFileSync(file, 'utf8'), 'original\r\n');
    assert.equal(existsSync(report), false);
    assert.equal(readFileSync(evidence, 'utf8'), 'independent');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

import { spawnSync } from 'node:child_process';
import { recoverSettle } from './settle-snapshot.mjs';

function crashFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'settle-crash-'));
  const options = { blog: path.join(root, 'blog'), dataDir: path.join(root, 'data') };
  mkdirSync(options.blog); mkdirSync(options.dataDir);
  const article = path.join(options.blog, 'a.md');
  writeFileSync(article, 'draft: true\r\nисходный текст');
  return { root, options, article };
}

test('SIGKILL after mutation: another process restores bytes and removes journal', () => {
  const fx = crashFixture();
  try {
    const module = new URL('./settle-snapshot.mjs', import.meta.url).href;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { snapshotSettle } from ${JSON.stringify(module)};
      import { writeFileSync } from 'node:fs';
      snapshotSettle(${JSON.stringify(fx.options)});
      writeFileSync(${JSON.stringify(fx.article)}, 'draft: false');
      writeFileSync(${JSON.stringify(path.join(fx.options.dataDir, 'report-new.json'))}, '{}');
      process.kill(process.pid, 'SIGKILL');
    `]);
    assert.equal(child.signal, 'SIGKILL');
    assert.equal(readFileSync(fx.article, 'utf8'), 'draft: false');
    const restored = spawnSync(process.execPath, ['--input-type=module', '-e', `import { recoverSettle } from ${JSON.stringify(module)}; recoverSettle(${JSON.stringify(fx.options)});`], { encoding: 'utf8' });
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(readFileSync(fx.article, 'utf8'), 'draft: true\r\nисходный текст');
    assert.equal(existsSync(path.join(fx.options.dataDir, 'report-new.json')), false);
    assert.equal(recoverSettle(fx.options), false);
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});

test('commit keeps new content; dry recovery refuses without changing files', () => {
  const fx = crashFixture();
  try {
    const tx = snapshotSettle(fx.options);
    writeFileSync(fx.article, 'published');
    assert.throws(() => recoverSettle(fx.options, { dry: true }), /dry-run/);
    assert.equal(readFileSync(fx.article, 'utf8'), 'published');
    tx.commit();
    assert.equal(recoverSettle(fx.options), false);
    assert.equal(readFileSync(fx.article, 'utf8'), 'published');
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});

test('corrupt journal fails before restoring any file', () => {
  const fx = crashFixture();
  try {
    snapshotSettle(fx.options);
    writeFileSync(fx.article, 'published');
    const file = path.join(fx.options.dataDir, '.settle-journal');
    const journal = JSON.parse(readFileSync(file, 'utf8'));
    journal.entries[0].sha256 = 'invalid'; writeFileSync(file, JSON.stringify(journal));
    assert.throws(() => recoverSettle(fx.options), /Контрольная сумма/);
    assert.equal(readFileSync(fx.article, 'utf8'), 'published');
    assert.equal(existsSync(file), true);
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});

test('journal cannot write outside corpus through traversal', () => {
  const fx = crashFixture();
  try {
    snapshotSettle(fx.options);
    const file = path.join(fx.options.dataDir, '.settle-journal');
    const journal = JSON.parse(readFileSync(file, 'utf8'));
    journal.entries[0].relative = '../outside.md'; writeFileSync(file, JSON.stringify(journal));
    assert.throws(() => recoverSettle(fx.options), /Небезопасный путь/);
    assert.equal(existsSync(path.join(fx.root, 'outside.md')), false);
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});
