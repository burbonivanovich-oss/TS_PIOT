// Журнал приёмки сохраняется до первой мутации. Восстановление идемпотентно:
// авария во время отката оставляет журнал для следующего запуска.
import {
  readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync,
  lstatSync, realpathSync, openSync, closeSync, fsyncSync, renameSync,
  copyFileSync, rmSync, chmodSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertWriterStopped } from './writer-process.mjs';

const JOURNAL = '.settle-journal';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function context({ blog, dataDir, contentRoot, mode = 'settle' }) {
  if (!['settle', 'writer'].includes(mode)) throw new Error('Неизвестный тип транзакции');
  const roots = { blog: path.resolve(blog), data: path.resolve(dataDir) };
  if (mode === 'writer') {
    if (!contentRoot) throw new Error('Нет корня сайта для снимка написания');
    for (const [kind, relative] of Object.entries({ hero: 'public/images/hero', preview: 'public/images/preview', factchecked: '.claude/factchecked', factresults: 'src/data/factcheck/results', factclaims: 'src/data/factcheck/claims', research: 'autopilot/research' })) roots[kind] = path.resolve(contentRoot, relative);
    roots.code = path.resolve(contentRoot);
  }
  for (const root of Object.values(roots)) {
    mkdirSync(root, { recursive: true });
    if (lstatSync(root).isSymbolicLink()) throw new Error(`Симлинк в области приёмки: ${root}`);
  }
  // Системный /var → /private/var на macOS допустим: фиксируем реальные корни.
  for (const kind of Object.keys(roots)) roots[kind] = realpathSync(roots[kind]);
  const journal = path.join(roots.data, mode === 'writer' ? '.writer-journal' : JOURNAL);
  const scopes = [
    { kind: 'blog', root: roots.blog, recursive: true, match: name => /\.(md|mdx)$/.test(name) },
    { kind: 'data', root: roots.data, recursive: false, match: name => name.endsWith('.json') },
    { kind: 'data', root: path.join(roots.data, 'runs'), recursive: true, match: name => name.endsWith('.json') },
  ];
  for (const name of ['published-rewrites', 'release-drafts', 'failed-rewrites']) {
    scopes.push({ kind: 'data', root: path.join(roots.data, name), recursive: true, match: file => /\.(md|mdx)$/.test(file) });
  }
  if (mode === 'writer') {
    scopes.push({ kind: 'data', root: path.join(roots.data, 'claim-evidence'), recursive: true, match: name => name.endsWith('.json') });
    for (const kind of ['hero', 'preview', 'factchecked', 'factresults', 'factclaims', 'research']) scopes.push({ kind, root: roots[kind], recursive: true, match: () => true });
    // Preserve existing dirty source bytes too. Generated output, dependencies,
    // Git internals and credentials are deliberately outside this transaction.
    scopes.push({ kind: 'code', root: roots.code, recursive: true, match: () => true, exclude: file => {
      const relative = path.relative(roots.code, file).split(path.sep).join('/');
      if (relative.split('/').some(part => ['.git', 'node_modules', 'dist', '.astro', '.cache'].includes(part) || part.startsWith('.env'))) return true;
      return Object.entries(roots).some(([kind, root]) => kind !== 'code' && (file === root || file.startsWith(root + path.sep)));
    } });
  }
  function files(scope, root = scope.root) {
    if (!existsSync(root)) return [];
    if (lstatSync(root).isSymbolicLink()) throw new Error(`Симлинк в области приёмки: ${root}`);
    return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(root, entry.name);
      if (scope.exclude?.(file)) return [];
      if (entry.isSymbolicLink()) throw new Error(`Симлинк в области приёмки: ${file}`);
      if (entry.isDirectory()) return scope.recursive ? files(scope, file) : [];
      if (!entry.isFile() || !scope.match(entry.name)) return [];
      if (lstatSync(file).nlink !== 1) throw new Error(`Hardlink в области приёмки: ${file}`);
      return [file];
    });
  }
  const list = () => scopes.flatMap(scope => files(scope).map(file => ({ kind: scope.kind, file })));
  return { roots, journal, list, mode, backup: path.join(roots.data, '.writer-backup') };
}

function sync(file) {
  const fd = openSync(file, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function durableWrite(file, bytes, mode = 0o600) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.settle-tmp`;
  // exclusive create: never follow a pre-existing symlink or overwrite other work
  const fd = openSync(temporary, 'wx', mode);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, file);
  sync(path.dirname(file));
}

function discardJournal(ctx) {
  unlinkSync(ctx.journal);
  sync(ctx.roots.data);
  if (ctx.mode === 'writer' && existsSync(ctx.backup)) rmSync(ctx.backup, { recursive: true });
}

function readJournal(ctx) {
  if (lstatSync(ctx.journal).isSymbolicLink() || lstatSync(ctx.journal).nlink !== 1) throw new Error('Небезопасный журнал приёмки');
  const document = JSON.parse(readFileSync(ctx.journal, 'utf8'));
  if (![1, 2].includes(document.version) || (document.version === 2 && ctx.mode !== 'writer') || JSON.stringify(document.roots) !== JSON.stringify(ctx.roots) || !Array.isArray(document.entries)) throw new Error('Повреждён журнал приёмки или изменились его корни');
  const seen = new Set();
  // Проверить весь журнал до первой записи. Пути из JSON не дают права выйти
  // за ограниченные области корпуса/состояния.
  const entries = document.entries.map(entry => {
    const { kind, relative, base64, sha256, mode, snapshotKey } = entry;
    if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) throw new Error('Некорректный режим файла в журнале');
    if (!Object.hasOwn(ctx.roots, kind) || typeof relative !== 'string' || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Небезопасный путь в журнале приёмки');
    const allowed = kind === 'blog' ? /\.(md|mdx)$/.test(relative) : kind === 'data' ? (relative.endsWith('.json') && (!relative.includes('/') || relative.startsWith('runs/') || (ctx.mode === 'writer' && relative.startsWith('claim-evidence/')))) || (kind === 'data' && /^(published-rewrites|release-drafts|failed-rewrites)\/[a-z0-9-]+\.(md|mdx)$/.test(relative)) : ctx.mode === 'writer';
    if (!allowed) throw new Error('Небезопасная запись в журнале приёмки');
    let bytes = null; let backup = null;
    if (document.version === 2) {
      if (typeof snapshotKey !== 'string' || !/^\d+$/.test(snapshotKey) || !existsSync(ctx.backup) || lstatSync(ctx.backup).isSymbolicLink()) throw new Error('Небезопасный путь снимка написания');
      backup = path.join(ctx.backup, snapshotKey);
      if (!existsSync(backup) || !lstatSync(backup).isFile() || lstatSync(backup).isSymbolicLink() || lstatSync(backup).nlink !== 1 || hash(readFileSync(backup)) !== sha256) throw new Error('Контрольная сумма снимка написания не совпала');
    } else {
      if (typeof base64 !== 'string') throw new Error('Небезопасная запись в журнале приёмки');
      bytes = Buffer.from(base64, 'base64');
      if (bytes.toString('base64') !== base64 || hash(bytes) !== sha256) throw new Error('Контрольная сумма журнала приёмки не совпала');
    }
    const file = path.join(ctx.roots[kind], relative);
    if (seen.has(file)) throw new Error('Повтор файла в журнале приёмки');
    seen.add(file);
    let current = ctx.roots[kind];
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      if (existsSync(current) && (lstatSync(current).isSymbolicLink() || (lstatSync(current).isFile() && lstatSync(current).nlink !== 1))) throw new Error('Небезопасный файл восстановления');
    }
    return { file, bytes, backup, mode, sha256 };
  });
  return entries;
}

export function recoverSettle(options, { dry = false } = {}) {
  const ctx = context(options);
  if (ctx.mode === 'writer') assertWriterStopped(path.join(ctx.roots.data, '.writer-actor'));
  if (ctx.mode === 'settle') {
    const writerJournal = path.join(ctx.roots.data, '.writer-journal');
    if (existsSync(writerJournal)) {
      if (lstatSync(writerJournal).isSymbolicLink() || lstatSync(writerJournal).nlink !== 1) throw new Error('Небезопасный журнал написания');
      const owner = JSON.parse(readFileSync(writerJournal, 'utf8')).ownerPid;
      if (owner !== process.pid) throw new Error('Незавершённое написание; сначала восстановить writer');
    }
  }
  if (!existsSync(ctx.journal)) return false;
  if (dry) throw new Error('Есть незавершённый журнал приёмки; dry-run остановлен до восстановления');
  const entries = readJournal(ctx);
  const originals = new Set(entries.map(entry => entry.file));
  const current = ctx.list(); // проверить симлинки до удаления/записи
  for (const { file } of current) if (!originals.has(file)) { unlinkSync(file); sync(path.dirname(file)); }
  for (const { file, bytes, backup, mode, sha256 } of entries) {
    // Do not rewrite untouched source/cache files or change their mtimes.
    if (backup && existsSync(file) && lstatSync(file).isFile() && (lstatSync(file).mode & 0o777) === mode && hash(readFileSync(file)) === sha256) continue;
    // После аварии rename мог не выполниться; временный файл принадлежит
    // исключительно этой транзакции и не является контентом.
    const temporary = `${file}.settle-tmp`;
    if (existsSync(temporary)) unlinkSync(temporary);
    if (backup) {
      copyFileSync(backup, temporary); chmodSync(temporary, mode); sync(temporary); renameSync(temporary, file); sync(path.dirname(file));
    } else durableWrite(file, bytes, mode);
  }
  discardJournal(ctx);
  return true;
}

export function snapshotSettle(options) {
  const ctx = context(options);
  if (existsSync(ctx.journal)) throw new Error('Незавершённая приёмка: сначала восстановить журнал');
  const files = ctx.list(); // validate all scopes before writing backup
  if (ctx.mode === 'writer') {
    if (existsSync(ctx.backup)) {
      if (lstatSync(ctx.backup).isSymbolicLink()) throw new Error('Небезопасный каталог снимка');
      rmSync(ctx.backup, { recursive: true });
    }
    mkdirSync(ctx.backup, { mode: 0o700 });
  }
  const entries = files.map(({ kind, file }, index) => {
    const bytes = readFileSync(file);
    const metadata = { kind, relative: path.relative(ctx.roots[kind], file).split(path.sep).join('/'), sha256: hash(bytes), mode: lstatSync(file).mode & 0o777 };
    if (ctx.mode === 'writer') {
      const snapshotKey = String(index); const backup = path.join(ctx.backup, snapshotKey);
      copyFileSync(file, backup); chmodSync(backup, 0o600); sync(backup);
      return { ...metadata, snapshotKey };
    }
    return { ...metadata, base64: bytes.toString('base64') };
  });
  if (ctx.mode === 'writer') sync(ctx.backup);
  const temporary = `${ctx.journal}.settle-tmp`;
  if (existsSync(temporary)) unlinkSync(temporary); // остаток до создания журнала; мутаций ещё не было
  durableWrite(ctx.journal, JSON.stringify({ version: ctx.mode === 'writer' ? 2 : 1, ownerPid: process.pid, roots: ctx.roots, entries }));
  return {
    changes() {
      const current = ctx.list().map(({ kind, file }) => ({ kind, relative: path.relative(ctx.roots[kind], file).split(path.sep).join('/'), sha256: hash(readFileSync(file)), mode: lstatSync(file).mode & 0o777 }));
      const originals = new Map(entries.map(entry => [`${entry.kind}/${entry.relative}`, entry]));
      const present = new Set(current.map(entry => `${entry.kind}/${entry.relative}`));
      return [...current.filter(entry => { const old = originals.get(`${entry.kind}/${entry.relative}`); return !old || old.sha256 !== entry.sha256 || old.mode !== entry.mode; }), ...entries.filter(entry => !present.has(`${entry.kind}/${entry.relative}`))].map(({ kind, relative }) => ({ kind, relative }));
    },
    restore: () => recoverSettle(options),
    commit() {
      const originals = new Map(entries.map(entry => [`${entry.kind}/${entry.relative}`, entry]));
      for (const { kind, file } of ctx.list()) {
        const relative = path.relative(ctx.roots[kind], file).split(path.sep).join('/');
        const original = originals.get(`${kind}/${relative}`);
        if (ctx.mode === 'writer' && original && original.sha256 === hash(readFileSync(file)) && original.mode === (lstatSync(file).mode & 0o777)) continue;
        sync(file); sync(path.dirname(file));
      }
      discardJournal(ctx);
    },
  };
}
