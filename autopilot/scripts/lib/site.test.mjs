import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readBuildCommand, runSiteBuild, runSiteQuality } from './site.mjs';

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

test('PUB-04: QA сайта допускает только зелёный результат и нулевой код', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'site-quality-'));
  mkdirSync(path.join(root, 'scripts/content'), { recursive: true });
  const gate = path.join(root, 'scripts/content/qa-gate.mjs');
  const file = path.join(root, 'article.md');
  writeFileSync(file, 'draft');
  for (const [code, json, ok] of [
    [0, { pass: true }, true],
    [0, { pass: false, blockers: ['нет FAQ'] }, false],
    [1, { pass: true }, false],
    [0, { pass: 'true' }, false],
    [0, null, false],
  ]) {
    writeFileSync(gate, `console.log(${JSON.stringify(JSON.stringify(json))}); process.exit(${code});`);
    assert.equal(runSiteQuality({ contentRoot: root, file }).ok, ok);
  }
  writeFileSync(gate, 'console.log("broken")');
  assert.equal(runSiteQuality({ contentRoot: root, file }).ok, false);
  assert.equal(runSiteQuality({ contentRoot: root }).ok, false);
});
