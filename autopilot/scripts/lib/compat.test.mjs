import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { slugify, canonicalKey, tokenize, stem, shingles } from './text.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// Детерминированный снимок: те же входы обязаны давать те же выходы независимо
// от TZ и locale процесса. Если где-то протечёт локальная дата или localeCompare,
// две строки разойдутся.
const SNAPSHOT_CODE = `
import { slugify, canonicalKey, tokenize, stem, shingles } from ${JSON.stringify(path.join(HERE, 'text.mjs'))};
import { today } from ${JSON.stringify(path.join(HERE, 'content.mjs'))};
import { capacity } from ${JSON.stringify(path.join(HERE, '..', 'state.mjs'))};
const state = {
  month: today().slice(0, 7),
  counters: { new: 3, rewrite: 1, published: 2, blockedDupes: 0, quarantined: 0 },
  inFlight: [{ slug: 'a' }, { slug: 'b' }],
  quarantine: [],
  history: [],
};
const snapshot = {
  today: today(),
  slug: slugify('Маркировка игрушек 2026: сроки, товары'),
  canonical: canonicalKey('Кто обязан подключить ЭПД'),
  tokens: tokenize('Маркировка игрушек 2026'),
  stem: stem('маркировки'),
  shingles: [...shingles('раз два три четыре пять шесть семь', 5)].sort(),
  cap: capacity(state),
};
process.stdout.write(JSON.stringify(snapshot));
`;

/** Снимок в дочернем процессе с заданными TZ и locale. */
function snapshot({ TZ, LANG, LC_ALL }) {
  const proc = spawnSync(process.execPath, ['--input-type=module', '-e', SNAPSHOT_CODE], {
    cwd: ROOT,
    env: { ...process.env, TZ, LANG, LC_ALL },
    encoding: 'utf8',
  });
  assert.equal(proc.status, 0, proc.stderr);
  return proc.stdout;
}

test('AP-P0-26: расчёты не зависят от timezone и locale', () => {
  const reference = snapshot({ TZ: 'UTC', LANG: 'C', LC_ALL: 'C' });
  for (const env of [
    { TZ: 'Pacific/Kiritimati', LANG: 'ru_RU.UTF-8', LC_ALL: 'ru_RU.UTF-8' }, // UTC+14
    { TZ: 'America/Anchorage', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' }, // UTC-9
  ]) {
    assert.equal(snapshot(env), reference, `снимок разошёлся при ${JSON.stringify(env)}`);
  }
});

test('AP-P0-26: golden-значения текстовых примитивов стабильны', () => {
  // Здесь фиксируются именно выходы, а не только их равенство между средами:
  // неожиданное изменение этих значений означает смену семантики дедупа.
  assert.equal(slugify('Маркировка игрушек 2026: сроки, товары'), 'markirovka-igrushek-2026-sroki-tovary');
  assert.equal(canonicalKey('Кто обязан подключить ЭПД'), canonicalKey('ЭПД: кто обязан подключить'));
  assert.deepEqual([...tokenize('Маркировка игрушек 2026')], ['маркировк', 'игрушек', '2026']);
  assert.equal(stem('маркировки'), 'маркировк');
  assert.equal(shingles('раз два три четыре пять шесть семь', 5).size, 3);
});
