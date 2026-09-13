import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTIONS, OPTIONAL } from './config-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Ключи, которые потребляются generic-циклом резолвера путей, а не по имени.
const GENERIC = new Set(['paths.pillars', 'paths.glossary', 'paths.wiki']);

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.mjs$/.test(entry.name) && !/\.test\.mjs$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * AP-P1-05: каждый заявленный лимит обязан иметь потребителя в коде. Тест
 * статический: ищет имя ключа в не-тестовых скриптах. Это ловит декоративные
 * ключи, которые объявлены, но ни на что не влияют.
 */
test('AP-P1-05: у каждого ключа конфига есть потребитель в коде', () => {
  const source = sourceFiles(path.join(ROOT, 'scripts'))
    .filter((f) => !f.endsWith('config-schema.mjs') && !f.endsWith(`${path.sep}config.mjs`))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  const missing = [];
  for (const [section, keys] of Object.entries(SECTIONS)) {
    for (const key of [...keys, ...(OPTIONAL[section] || [])]) {
      const full = `${section}.${key}`;
      if (GENERIC.has(full)) continue;
      const re = new RegExp(`\\b${key}\\b`);
      if (!re.test(source)) missing.push(full);
    }
  }
  assert.deepEqual(missing, [], `ключи без потребителя: ${missing.join(', ')}`);
});

test('AP-P1-05: неизвестный ключ конфига отвергается схемой', async () => {
  const { validateConfig } = await import('./config-schema.mjs');
  const { readFileSync: read } = await import('node:fs');
  const cfg = JSON.parse(read(path.join(ROOT, 'config', 'autopilot.config.json'), 'utf8'));
  assert.deepEqual(validateConfig(cfg), [], 'канонический конфиг валиден');
  cfg.interlink.mystery = 1;
  assert.match(validateConfig(cfg).join('\n'), /неизвестный ключ interlink\.mystery/);
});
