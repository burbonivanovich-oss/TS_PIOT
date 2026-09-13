// Единая точка чтения конфигурации автопилота. Все скрипты берут пути и
// пороги отсюда, а не из собственных констант, — иначе два скрипта начнут
// считать «дубль» или «просрочку» по-разному и расхождение всплывёт только
// на проде.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateConfig } from './config-schema.mjs';
import { assertProjectRoot } from './guard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');

let cached = null;

export function loadConfig() {
  if (cached) return cached;
  const file = process.env.AUTOPILOT_CONFIG || path.join(ROOT, 'config', 'autopilot.config.json');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    // Ошибка чтения/парсинга конфига — стоп до любой записи, а не «дефолты».
    throw new Error(`Не читается конфиг ${file}: ${error.message}`);
  }
  const errors = validateConfig(parsed);
  if (errors.length) {
    throw new Error(`Некорректный конфиг ${file}:\n - ${errors.join('\n - ')}`);
  }
  const cfg = parsed;

  // contentRoot может прийти из окружения — так один и тот же движок гоняется
  // против рабочего репозитория и против песочницы, без правки файла.
  const rawRoot = process.env.CONTENT_ROOT || cfg.contentRoot;
  cfg.resolved = {
    contentRoot: path.resolve(ROOT, rawRoot),
    // Песочница для тестов и dry-run: переопределяет каталог состояния, не
    // трогая файл конфига. Production всегда идёт с `data/` по умолчанию.
    dataDir: process.env.AUTOPILOT_DATA_DIR || path.join(ROOT, 'data'),
  };
  for (const [key, rel] of Object.entries(cfg.paths)) {
    cfg.resolved[key] = path.join(cfg.resolved.contentRoot, rel);
  }
  cached = cfg;
  return cfg;
}

export function assertContentRoot(cfg = loadConfig()) {
  if (!existsSync(cfg.resolved.blog)) {
    throw new Error(
      `Не найден каталог статей: ${cfg.resolved.blog}\n` +
        'Проверьте contentRoot в config/autopilot.config.json или переменную CONTENT_ROOT.',
    );
  }
  // В production корень дополнительно проверяется на маркеры, remote, ветку и
  // symlink до любой мутации (AP-P0-04). В тестах strict выключен.
  if (cfg.security?.strictContentRoot) {
    assertProjectRoot(cfg);
  }
  return cfg;
}
