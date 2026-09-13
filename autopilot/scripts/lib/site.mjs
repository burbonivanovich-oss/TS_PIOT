// Build-гейт принимающего сайта (AP-P0-16).
//
// Текстовые гейты движка не доказывают, что MD/MDX и frontmatter собираются
// Astro: синтаксическая ошибка MDX, неизвестное поле схемы или битый импорт
// видны только на сборке. Гейт запускает настоящую команду `build` из
// package.json принимающего проекта и возвращает машинный результат.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const tail = (text, lines = 40) => String(text || '').split('\n').slice(-lines).join('\n').trim();

/** Команда build из package.json сайта, или null. */
export function readBuildCommand(contentRoot) {
  const pkgFile = path.join(contentRoot, 'package.json');
  if (!existsSync(pkgFile)) return null;
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  } catch {
    return null;
  }
  return pkg?.scripts?.build ? 'build' : null;
}

/**
 * Запустить сборку сайта. Возвращает { ok, code, signal, stdout, stderr }.
 * Ничего не пишет в корпус; build может писать только в dist/ и кеши.
 */
export function runSiteBuild({ contentRoot, script = 'build', timeoutMs = 15 * 60 * 1000, env = process.env } = {}) {
  if (!contentRoot || !existsSync(contentRoot)) {
    return { ok: false, code: null, signal: null, error: `нет contentRoot: ${contentRoot}`, stdout: '', stderr: '' };
  }
  if (!readBuildCommand(contentRoot)) {
    return { ok: false, code: null, signal: null, error: 'в package.json принимающего проекта нет scripts.build', stdout: '', stderr: '' };
  }
  const proc = spawnSync('npm', ['run', script, '--silent'], {
    cwd: contentRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    env,
  });
  const timedOut = proc.error?.code === 'ETIMEDOUT';
  return {
    ok: proc.status === 0,
    code: proc.status,
    signal: proc.signal,
    error: proc.error ? (timedOut ? `сборка превысила ${timeoutMs} мс` : proc.error.message) : null,
    stdout: tail(proc.stdout),
    stderr: tail(proc.stderr),
  };
}
