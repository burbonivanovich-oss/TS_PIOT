import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectProjectRoot, assertProjectRoot } from './guard.mjs';

const SECURITY = { strictContentRoot: true, expectedRemote: 'TS_PIOT', allowedBranches: ['main', 'codex/*'] };
const cfgOf = (root) => ({ resolved: { contentRoot: root, blog: path.join(root, 'src', 'content', 'blog') }, security: SECURITY });

function git(cwd, args) {
  execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' });
}

/** Валидный по маркерам каталог; git-remote/ветку задаёт вызывающий. */
function projectDir({ astro = true, blog = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'guard-'));
  if (astro) writeFileSync(path.join(root, 'astro.config.mjs'), 'export default {};\n', 'utf8');
  if (blog) mkdirSync(path.join(root, 'src', 'content', 'blog'), { recursive: true });
  return root;
}

function makeRepo(root, { remote = 'https://github.com/burbonivanovich-oss/TS_PIOT.git', branch = 'main' } = {}) {
  git(root, ['init', '-b', branch]);
  git(root, ['remote', 'add', 'origin', remote]);
  writeFileSync(path.join(root, '.gitkeep'), '\n', 'utf8');
  git(root, ['add', '.']);
  execFileSync('git', ['-C', root, '-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-m', 'init'], { stdio: 'ignore' });
  return root;
}

test('AP-P0-04: настоящий checkout TS_PIOT проходит проверку', () => {
  const root = makeRepo(projectDir(), { branch: 'codex/autopilot-integration-2026-09-13' });
  const result = inspectProjectRoot(cfgOf(root));
  assert.equal(result.ok, true, JSON.stringify(result.problems));
});

test('AP-P0-04: чужие и служебные пути отвергаются', () => {
  for (const bad of ['/', '/srv']) {
    const result = inspectProjectRoot({
      resolved: { contentRoot: bad, blog: path.join(bad, 'src', 'content', 'blog') },
      security: SECURITY,
    });
    assert.equal(result.ok, false, `${bad} не должен проходить`);
  }
});

test('AP-P0-04: родительская директория нескольких сайтов отвергается', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'guard-parent-'));
  mkdirSync(path.join(parent, 'site-a', 'src', 'content', 'blog'), { recursive: true });
  mkdirSync(path.join(parent, 'site-b', 'src', 'content', 'blog'), { recursive: true });
  const result = inspectProjectRoot(cfgOf(parent));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => /маркеров/.test(p)));
});

test('AP-P0-04: пустой каталог и каталог без маркера отвергаются', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'guard-empty-'));
  assert.equal(inspectProjectRoot(cfgOf(empty)).ok, false);

  const noMarker = projectDir({ astro: false });
  const result = inspectProjectRoot(cfgOf(noMarker));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => /маркеров/.test(p)));
});

test('AP-P0-04: symlink блога наружу отвергается', () => {
  const root = projectDir({ blog: false });
  const outside = mkdtempSync(path.join(tmpdir(), 'guard-outside-'));
  mkdirSync(path.join(root, 'src', 'content'), { recursive: true });
  symlinkSync(outside, path.join(root, 'src', 'content', 'blog'));
  const result = inspectProjectRoot(cfgOf(root));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => /symlink/.test(p)), JSON.stringify(result.problems));
});

test('AP-P0-04: remote другого репозитория и неверная ветка отвергаются', () => {
  const other = makeRepo(projectDir(), { remote: 'https://github.com/attacker/other-site.git' });
  const remoteResult = inspectProjectRoot(cfgOf(other));
  assert.equal(remoteResult.ok, false);
  assert.ok(remoteResult.problems.some((p) => /remote/.test(p)));

  const wrongBranch = makeRepo(projectDir(), { branch: 'feature/experiment' });
  const branchResult = inspectProjectRoot(cfgOf(wrongBranch));
  assert.equal(branchResult.ok, false);
  assert.ok(branchResult.problems.some((p) => /ветка/.test(p)));
});

test('AP-P0-04: assertProjectRoot бросает до любой мутации', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'guard-throw-'));
  assert.throws(() => assertProjectRoot(cfgOf(empty)), /AP-P0-04/);
});
