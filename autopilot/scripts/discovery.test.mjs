import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownFiles } from './lib/markdown-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('ETK-P0-05: scripts.test сужен до тестов проекта', () => {
  // Голый `node --test` рекурсивно подбирает вложенный чекаут сайта
  // (test-*.mjs и его markdown), поэтому контракт — явные маски *.test.mjs.
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const cmd = pkg.scripts?.test ?? '';
  assert.notEqual(cmd.trim(), 'node --test', 'голый node --test подхватит вложенный чекаут');
  assert.match(cmd, /\*\.test\.mjs/, 'прогон должен быть ограничен масками *.test.mjs');
});

test('ETK-P0-05: обход markdown не заходит во вложенный чекаут', () => {
  // Фикстура на диске, а не реальный каталог: проверка не должна зависеть
  // от того, есть ли вложенная копия сайта в рабочем дереве.
  const root = mkdtempSync(path.join(tmpdir(), 'discovery-'));
  try {
    const nested = path.join(root, 'nested');
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(root, 'ok.md'), '# ok\n', 'utf8');
    writeFileSync(path.join(nested, 'package.json'), '{}\n', 'utf8');
    writeFileSync(path.join(nested, 'bad.md'), '# чужой\n', 'utf8');
    const found = markdownFiles(root).map((f) => path.basename(f));
    assert.deepEqual(found, ['ok.md']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
