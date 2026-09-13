import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readBuildCommand, runSiteBuild } from './site.mjs';

function siteWithBuild(script) {
  const dir = mkdtempSync(path.join(tmpdir(), 'site-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fake', scripts: { build: script } }), 'utf8');
  return dir;
}

test('AP-P0-16: успешная сборка проходит, падение — нет', () => {
  const ok = siteWithBuild('node -e "process.exit(0)"');
  const okResult = runSiteBuild({ contentRoot: ok });
  assert.equal(okResult.ok, true, JSON.stringify(okResult));

  const bad = siteWithBuild('node -e "console.error(\'MDX syntax error\'); process.exit(1)"');
  const badResult = runSiteBuild({ contentRoot: bad });
  assert.equal(badResult.ok, false);
  assert.equal(badResult.code, 1);
  assert.match(badResult.stderr, /MDX syntax error/);
});

test('AP-P0-16: отсутствие build-команды — явный отказ, не пропуск', () => {
  const noBuild = mkdtempSync(path.join(tmpdir(), 'site-nobuild-'));
  writeFileSync(path.join(noBuild, 'package.json'), JSON.stringify({ name: 'x', scripts: { dev: 'astro dev' } }), 'utf8');
  assert.equal(readBuildCommand(noBuild), null);
  const result = runSiteBuild({ contentRoot: noBuild });
  assert.equal(result.ok, false);
  assert.match(result.error, /scripts\.build/);

  const missing = mkdtempSync(path.join(tmpdir(), 'site-empty-'));
  const missingResult = runSiteBuild({ contentRoot: missing });
  assert.equal(missingResult.ok, false);
  assert.match(missingResult.error, /scripts\.build/);
});

test('AP-P0-16: таймаут сборки — отказ', () => {
  const slow = siteWithBuild('node -e "setTimeout(()=>{}, 5000)"');
  const result = runSiteBuild({ contentRoot: slow, timeoutMs: 300 });
  assert.equal(result.ok, false);
  assert.match(result.error, /превысила/);
});
