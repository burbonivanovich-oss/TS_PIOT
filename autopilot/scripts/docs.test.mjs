import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownFiles } from './lib/markdown-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

/** Внутренние относительные ссылки markdown, которые обязаны существовать. */
function brokenLinks(file) {
  const text = readFileSync(file, 'utf8');
  const broken = [];
  for (const match of text.matchAll(LINK_RE)) {
    const target = match[1].trim();
    if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;
    const clean = target.split('#')[0].split('?')[0];
    if (!clean) continue;
    const resolved = path.resolve(path.dirname(file), clean);
    if (!existsSync(resolved)) broken.push({ file: path.relative(ROOT, file), target });
  }
  return broken;
}

test('AP-P2-05: markdown не ссылается на несуществующие внутренние файлы', () => {
  const files = markdownFiles(ROOT);
  const broken = files.flatMap(brokenLinks);
  assert.deepEqual(broken, [], `битые ссылки: ${JSON.stringify(broken, null, 2)}`);
});

test('AP-P2-05: в README нет дублирующейся строки AGENTS.md', () => {
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const rows = [...readme.matchAll(/\|\s*\[AGENTS\.md\]\(([^)]+)\)\s*\|/g)];
  assert.equal(rows.length, 1, 'AGENTS.md должен упоминаться в таблице один раз');
});

test('AP-P2-05: ссылок на несуществующий .agents/workflows нет', () => {
  // deep-backlog сам описывает этот дефект — он исключён из проверки.
  const files = markdownFiles(ROOT)
    .filter((f) => path.basename(f) !== 'deep-backlog.md')
    .concat([path.join(ROOT, '.github', 'workflows', 'autopilot.yml')]);
  const offenders = files.filter((f) => existsSync(f) && statSync(f).isFile() && readFileSync(f, 'utf8').includes('.agents/workflows/'));
  assert.deepEqual(offenders.map((f) => path.relative(ROOT, f)), []);
});
