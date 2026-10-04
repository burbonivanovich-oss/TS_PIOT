// Обход markdown рабочего дерева (ETK-P0-05).
//
// Вынесен из docs.test.mjs, чтобы отрицательная проверка discovery.test.mjs
// не импортировала тестовый файл: такой импорт прогонял бы его тесты дважды.
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'chats', 'research', 'data']);

export function markdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.agents') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    // Вложенный чекаут/пакет — чужое дерево со своими ссылками: обход туда
    // давал бы ложные «битые ссылки» на файлы, которых нет в нашем проекте.
    if (entry.isDirectory() && (existsSync(path.join(full, 'package.json')) || existsSync(path.join(full, '.git')))) continue;
    if (entry.isDirectory()) out.push(...markdownFiles(full));
    else if (/\.md$/.test(entry.name)) out.push(full);
  }
  return out;
}
