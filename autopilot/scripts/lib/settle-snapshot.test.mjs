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

for (const action of ['stage', 'promote']) test(`SIGKILL during queued rewrite ${action}: recovery restores candidate, baseline, corpus and queue together`, () => {
  const fx = crashFixture();
  try {
    const data = fx.options.dataDir;
    for (const dir of ['published-rewrites', 'release-drafts', 'failed-rewrites']) mkdirSync(path.join(data, dir));
    const baseline = path.join(data, 'published-rewrites/a.md');
    const candidate = path.join(data, 'release-drafts/a.mdx');
    const queue = path.join(data, 'release-queue.json');
    const original = '---\ntitle: old\ndraft: false\n---\nold published';
    const rewritten = '---\ntitle: new\ndraft: true\n---\nnew candidate';
    writeFileSync(baseline, original);
    writeFileSync(fx.article, action === 'stage' ? rewritten : original);
    if (action === 'promote') writeFileSync(candidate, rewritten);
    writeFileSync(queue, JSON.stringify({ items: [{slug:'a',kind:'rewrite'}] }));
    const before = readFileSync(queue, 'utf8');
    const snapshots = new URL('./settle-snapshot.mjs', import.meta.url).href;
    const rewrites = new URL('./queued-rewrite.mjs', import.meta.url).href;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import {snapshotSettle} from ${JSON.stringify(snapshots)};
      import {stageQueuedRewrite,promoteQueuedRewrite} from ${JSON.stringify(rewrites)};
      import {writeFileSync} from 'node:fs';
      snapshotSettle(${JSON.stringify(fx.options)});
      ${action === 'stage' ? `stageQueuedRewrite({...${JSON.stringify(fx.options)},slug:'a',file:${JSON.stringify(fx.article)}});` : `promoteQueuedRewrite({...${JSON.stringify(fx.options)},slug:'a',stagedFile:'release-drafts/a.mdx'});`}
      writeFileSync(${JSON.stringify(queue)}, '{"items":[]}');
      process.kill(process.pid,'SIGKILL');
    `]);
    assert.equal(child.signal, 'SIGKILL', child.stderr?.toString());
    assert.equal(recoverSettle(fx.options), true);
    assert.equal(readFileSync(baseline,'utf8'), original);
    assert.equal(readFileSync(queue,'utf8'), before);
    assert.equal(readFileSync(fx.article,'utf8'), action === 'stage' ? rewritten : original);
    if (action === 'promote') assert.equal(readFileSync(candidate,'utf8'),rewritten);
    else assert.equal(existsSync(path.join(data,'release-drafts/a.md')),false);
    assert.equal(existsSync(path.join(fx.options.blog,'a.mdx')),false);
    assert.equal(recoverSettle(fx.options), false);
  } finally {rmSync(fx.root,{recursive:true,force:true});}
});
