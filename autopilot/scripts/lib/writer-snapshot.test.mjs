import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { snapshotSettle, recoverSettle } from './settle-snapshot.mjs';

test('crashed writing blocks settle and restores article, illustration and evidence', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-snapshot-'));
  try {
    const blog = path.join(root, 'src/content/blog'); const dataDir = path.join(root, 'autopilot/data');
    mkdirSync(blog, { recursive: true }); mkdirSync(path.join(dataDir, 'claim-evidence'), { recursive: true }); mkdirSync(path.join(root, 'public/images/hero'), { recursive: true });
    const article = path.join(blog, 'article.md'); const evidence = path.join(dataDir, 'claim-evidence/article.json'); const hero = path.join(root, 'public/images/hero/article.webp');
    for (const file of [article, evidence, hero]) writeFileSync(file, 'original bytes');
    const options = { blog, dataDir, contentRoot: root, mode: 'writer' };
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import { snapshotSettle } from ${JSON.stringify(new URL('./settle-snapshot.mjs', import.meta.url).href)}; import { writeFileSync } from 'node:fs'; snapshotSettle(${JSON.stringify(options)}); for(const f of ${JSON.stringify([article, evidence, hero])})writeFileSync(f,'partial'); writeFileSync(${JSON.stringify(path.join(blog, 'unexpected.mdx'))},'new'); process.kill(process.pid,'SIGKILL');`]);
    assert.equal(child.signal, 'SIGKILL');
    assert.throws(() => recoverSettle({ blog, dataDir }), /Незавершённое написание/);
    assert.equal(recoverSettle(options), true);
    for (const file of [article, evidence, hero]) assert.equal(readFileSync(file, 'utf8'), 'original bytes');
    assert.equal(existsSync(path.join(blog, 'unexpected.mdx')), false); assert.equal(recoverSettle(options), false);
    const tx = snapshotSettle(options); writeFileSync(article, 'finished');
    assert.deepEqual(tx.changes(), [{ kind: 'blog', relative: 'article.md' }]); tx.commit();
    assert.equal(readFileSync(article, 'utf8'), 'finished');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('binary writer backups keep journal small and reject corrupted backup before mutation', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-binary-'));
  try {
    const blog = path.join(root, 'blog'); const dataDir = path.join(root, 'data'); mkdirSync(blog); mkdirSync(dataDir);
    const article = path.join(blog, 'article.md'); writeFileSync(article, 'original');
    const options = { blog, dataDir, contentRoot: root, mode: 'writer' };
    const asset = path.join(root, 'public/images/hero/article.webp'); mkdirSync(path.dirname(asset), { recursive: true }); writeFileSync(asset, Buffer.alloc(16 * 1024 * 1024, 42));
    const tx = snapshotSettle(options); const journal = readFileSync(path.join(dataDir, '.writer-journal'), 'utf8');
    assert.ok(journal.length < 16 * 1024); const doc = JSON.parse(journal); assert.equal(doc.version, 2);
    const entry = doc.entries.find(item => item.kind === 'hero'); const backup = path.join(dataDir, '.writer-backup', entry.snapshotKey);
    const saved = readFileSync(backup); writeFileSync(backup, 'corrupt'); writeFileSync(article, 'changed');
    assert.throws(() => tx.restore(), /Контрольная сумма/); assert.equal(readFileSync(article, 'utf8'), 'changed', 'validate entire backup before first restore');
    writeFileSync(backup, saved); tx.restore(); assert.equal(readFileSync(article, 'utf8'), 'original'); assert.equal(readFileSync(asset).length, 16 * 1024 * 1024);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
