// Защита целевого checkout (AP-P0-04).
//
// `CONTENT_ROOT` — произвольный путь из окружения, а автопилот пишет в него
// массово. На общем сервере ошибка переменной означала бы правку чужого сайта.
// Проверки идут до любой мутации: realpath, маркеры принимающего проекта,
// точный путь блога без выхода через symlink, ожидаемый Git remote и ветка.
import { realpathSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_ALLOWED_BRANCHES = ['main', 'codex/*', 'autopilot/*'];

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Read-only проверка корня. Возвращает { ok, problems, ... }.
 * Ничего не пишет и не меняет.
 */
export function inspectProjectRoot(cfg, { env = process.env } = {}) {
  const problems = [];
  const declared = cfg?.resolved?.contentRoot;
  if (!declared || !existsSync(declared)) {
    return { ok: false, problems: [`contentRoot не существует: ${declared || '(не задан)'}`] };
  }
  let root;
  try {
    root = realpathSync(declared);
  } catch (error) {
    return { ok: false, problems: [`realpath(contentRoot): ${error.message}`] };
  }
  if (root === path.parse(root).root) problems.push('contentRoot указывает на корень ФС');

  // Маркеры принимающего проекта: без них любой каталог с blog-совпадением
  // (или просто пустой) стал бы целью записи.
  const hasMarker = existsSync(path.join(root, 'astro.config.mjs')) && existsSync(path.join(root, 'src', 'content', 'blog'));
  if (!hasMarker) problems.push('нет маркеров TS_PIOT (astro.config.mjs и src/content/blog)');

  const blog = cfg?.resolved?.blog;
  if (!blog || !existsSync(blog)) {
    problems.push(`нет каталога блога: ${blog || '(не задан)'}`);
  } else {
    let realBlog = null;
    try {
      realBlog = realpathSync(blog);
    } catch (error) {
      problems.push(`realpath(blog): ${error.message}`);
    }
    const expectedBlog = path.join(root, 'src', 'content', 'blog');
    if (realBlog && realBlog !== expectedBlog) {
      problems.push(`блог вне ожидаемого пути (symlink?): ${realBlog} ≠ ${expectedBlog}`);
    }
  }

  const remote = git(root, ['config', '--get', 'remote.origin.url']);
  const expectedRemote = cfg?.security?.expectedRemote || env.AUTOPILOT_EXPECTED_REMOTE || 'TS_PIOT';
  if (!remote) problems.push('нет git remote origin');
  else if (!remote.includes(expectedRemote)) problems.push(`remote не содержит "${expectedRemote}": ${remote}`);

  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const allowed = cfg?.security?.allowedBranches || DEFAULT_ALLOWED_BRANCHES;
  const branchOk = branch && allowed.some((pattern) => (pattern.endsWith('*') ? branch.startsWith(pattern.slice(0, -1)) : branch === pattern));
  if (!branchOk) problems.push(`ветка ${branch || '(нет)'} не разрешена (${allowed.join(', ')})`);

  return { ok: problems.length === 0, problems, realRoot: root, remote, branch };
}

/** Бросает до записи, если корень не прошёл проверку. */
export function assertProjectRoot(cfg, opts) {
  const result = inspectProjectRoot(cfg, opts);
  if (!result.ok) {
    throw new Error(`contentRoot не прошёл проверку (AP-P0-04): ${result.problems.join('; ')}`);
  }
  return result;
}
