// Чтение и запись корпуса статей принимающего репозитория.
// Frontmatter разбирается своим парсером подмножества YAML: в статьях
// встречаются только строки, числа, булевы, плоские списки и один уровень
// вложенности (seo.keywords, faq). Тянуть js-yaml ради этого — лишняя
// зависимость в контуре, который должен запускаться где угодно.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseScalar(raw) {
  const v = String(raw).trim();
  if (v === '') return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  // Inline-последовательность `[a, b, c]` — в корпусе встречается наравне с
  // блочными списками, и без этой ветки keywords приезжает строкой.
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((item) => parseScalar(item));
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v;
}

export function parseFrontmatter(source) {
  // BOM перед `---` иначе не даёт распознать frontmatter вовсе, и запись
  // затёрла бы файл (AP-P1-12). Запоминаем его, чтобы вернуть байт в байт.
  const bom = source.startsWith('\uFEFF');
  const text = bom ? source.slice(1) : source;
  const match = text.match(FM_RE);
  if (!match) return { data: {}, body: text, raw: '', bom, eol: '\n' };

  // EOL определяем по разделителю: CRLF-файл должен пережить правку тела без
  // переписывания всех переводов строк.
  const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
  const data = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = null;
  let currentIndent = 0;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      const item = trimmed.slice(2);
      const target = currentKey;
      if (!target) continue;
      const bucket = getPath(data, target);
      if (Array.isArray(bucket)) bucket.push(parseScalar(item));
      continue;
    }

    const kv = trimmed.match(/^([\w.-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rest] = kv;

    if (indent === 0) {
      currentIndent = 0;
      if (rest === '') {
        // Пустое значение — либо список, либо вложенный объект. Считаем списком
        // предварительно; если следующей строкой придёт вложенный ключ, ветка
        // ниже переделает его в объект.
        data[key] = [];
        currentKey = [key];
      } else {
        data[key] = parseScalar(rest);
        currentKey = null;
      }
    } else {
      // Вложенный ключ: родитель оказался объектом, а не списком.
      const parent = currentKey ? currentKey[0] : null;
      if (!parent) continue;
      if (Array.isArray(data[parent]) && data[parent].length === 0) data[parent] = {};
      if (typeof data[parent] !== 'object' || data[parent] === null) data[parent] = {};
      if (rest === '') {
        data[parent][key] = [];
        currentKey = [parent, key];
      } else {
        data[parent][key] = parseScalar(rest);
        currentKey = [parent];
      }
      currentIndent = indent;
    }
  }

  // Сырой frontmatter храним с LF: точечные правки построчные, а EOL вернёт
  // writeArticle по запомненному значению.
  return { data, body: text.slice(match[0].length), raw: match[1].replace(/\r\n?/g, '\n'), bom, eol };
}

function getPath(obj, keys) {
  let node = obj;
  for (const k of keys) node = node?.[k];
  return node;
}

function dumpValue(value, indent) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return ' []';
    return '\n' + value.map((v) => `${pad}  - ${dumpScalar(v)}`).join('\n');
  }
  if (value && typeof value === 'object') {
    const inner = Object.entries(value)
      .map(([k, v]) => `${pad}  ${k}:${dumpValue(v, indent + 2)}`)
      .join('\n');
    return '\n' + inner;
  }
  return ' ' + dumpScalar(value);
}

function dumpScalar(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/^[\d-]+$/.test(s) || /[:#"'{}\[\]|>@`]|^\s|\s$/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return `"${s}"`;
}

export function stringifyFrontmatter(data, body) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}:${dumpValue(v, 0)}`);
  return `---\n${lines.join('\n')}\n---\n${body.startsWith('\n') ? '' : '\n'}${body}`;
}

/** Все статьи блога с распарсенным frontmatter и телом. */
export function loadArticles({ includeDrafts = true } = {}) {
  const cfg = loadConfig();
  const dir = cfg.resolved.blog;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((file) => {
      const full = path.join(dir, file);
      const source = readFileSync(full, 'utf8');
      const { data, body, raw, bom, eol } = parseFrontmatter(source);
      const slug = file.replace(/\.mdx?$/, '');
      return {
        slug,
        file,
        path: full,
        data,
        body,
        fm: raw,
        bom,
        eol,
        title: data.title || slug,
        keywords: (data.seo && data.seo.keywords) || [],
        tags: data.tags || [],
        categories: data.categories || [],
        draft: data.draft === true,
        // Хаб-страницы (календари, обзоры-указатели) осмысленно ссылаются
        // больше нормы. Флаг ставится в frontmatter руками и снимает сигнал
        // навсегда, вместо того чтобы статья всплывала в аудите каждую неделю.
        interlinkExempt: data.interlinkExempt === true,
        pubDate: data.pubDate ? new Date(data.pubDate) : null,
        updatedDate: data.updatedDate ? new Date(data.updatedDate) : null,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
        chars: body.length,
      };
    })
    .filter((a) => (includeDrafts ? true : !a.draft))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Запись статьи без пересборки frontmatter: наружу отдаётся исходный текст
 * заголовка как есть. Свой YAML-дампер сюда пускать нельзя — он не знает про
 * списки объектов (`faq`) и молча их сплющит, а правки в теле статьи автопилот
 * делает регулярно. Менять поля frontmatter — только через setFrontmatterField.
 */
export function writeArticle(article, { fm = article.fm, body = article.body } = {}) {
  // Ровно то, что съел парсер: BOM, разделители и переводы строк как в исходном
  // файле. Никакой нормализации пустых строк — иначе каждый прогон
  // перелинковки порождает шумный diff по всему корпусу, а CRLF-файл
  // переписывался бы целиком (AP-P1-12).
  const eol = article.eol || '\n';
  const prefix = article.bom ? '\uFEFF' : '';
  const fmText = String(fm).replace(/\r?\n/g, eol);
  writeFileSync(article.path, `${prefix}---${eol}${fmText}${eol}---${eol}${body}`, 'utf8');
}

/**
 * Точечная правка одного скалярного поля верхнего уровня в сыром frontmatter.
 * Остальные строки остаются байт-в-байт такими же, какими были.
 */
export function setFrontmatterField(fm, key, value) {
  const line = `${key}: ${dumpScalar(value)}`;
  const re = new RegExp(`^${key}:.*$`, 'm');
  if (re.test(fm)) return fm.replace(re, line);
  return `${fm}\n${line}`;
}

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Строгое чтение JSON с fail-closed семантикой (AP-P0-07).
 *
 * Отсутствие файла — единственный случай, когда возвращается fallback: файл
 * ещё не создан первым проходом. Любая другая ошибка (обрезанный JSON,
 * нехватка прав, I/O) пробрасывается с именем файла и позицией парсера,
 * чтобы проход остановился ДО записи чего-либо, а не заменил повреждённое
 * состояние пустым и не перезаписал его.
 */
export function readJson(file, fallback) {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Не читается ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Повреждён JSON ${file}: ${error.message}`);
  }
}

/** Записать буфер во временный файл, сбросить на диск и закрыть. */
function writeSyncedFile(file, content) {
  const fd = openSync(file, 'w');
  try {
    writeSync(fd, content, null, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Сбросить каталог на диск после rename: без этого запись file может быть
 * видна, а само перемещение — ещё нет после внезапного отключения питания.
 * Часть ФС не поддерживает fsync каталога — для них это best-effort.
 */
function fsyncDir(dir) {
  let fd;
  try {
    fd = openSync(dir, 'r');
    fsyncSync(fd);
  } catch (error) {
    if (!['EINVAL', 'EPERM', 'EISDIR', 'ENOTSUP', 'EACCES'].includes(error.code)) throw error;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Каталог уже закрыт/недоступен — не повод ронять запись.
      }
    }
  }
}

/**
 * Атомарная запись JSON (AP-P0-08).
 *
 * Прямая запись в целевой файл оставляет обрезанный JSON при падении процесса
 * или переполнении диска — а строгий readJson после этого остановит весь
 * контур. Поэтому: сериализация проверяется до касания диска, тело пишется во
 * временный файл в том же каталоге, сбрасывается fsync и переносится поверх
 * цели одним rename. Падение до rename оставляет старую валидную версию, а
 * каталог синхронизируется, чтобы rename пережил отключение питания.
 *
 * Предыдущая версия сохраняется в `<file>.bak` — одна recoverable-копия.
 * Бэкап обновляется только если текущий основной файл сам является валидным
 * JSON: иначе повреждённый файл затёр бы единственную хорошую копию.
 */
export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  // Сериализация до касания диска: циклическая структура или bigint должны
  // упасть здесь, а не оставить полузаписанный файл.
  const payload = JSON.stringify(value, null, 2) + '\n';
  const suffix = `${process.pid}-${randomBytes(6).toString('hex')}`;
  const tmp = `${file}.tmp-${suffix}`;
  // bakTmp объявлен заранее: при сбое уже после его создания файл-дебри
  // нужно убрать, иначе каталог постепенно копит мусор (AP-P0-08).
  let bakTmp = null;
  writeSyncedFile(tmp, payload);

  try {
    if (existsSync(file)) {
      let current = null;
      try {
        current = readFileSync(file, 'utf8');
        JSON.parse(current); // повреждённый основной файл бэкапом не становится
      } catch {
        current = null;
      }
      if (current !== null) {
        bakTmp = `${file}.bak.tmp-${suffix}`;
        writeSyncedFile(bakTmp, current);
        renameSync(bakTmp, `${file}.bak`);
        bakTmp = null;
        fsyncDir(path.dirname(file));
      }
    }
    renameSync(tmp, file);
    fsyncDir(path.dirname(file));
  } finally {
    // Убираем ровно свои временные файлы: общий cleanup способен был снести
    // temp другого живого процесса (AP-P0-08).
    for (const candidate of [tmp, bakTmp]) {
      if (!candidate) continue;
      try {
        if (existsSync(candidate)) unlinkSync(candidate);
      } catch {
        // Не удалось убрать debris — не повод скрыть исходную ошибку записи.
      }
    }
  }
}

/** Удалить строку скалярного поля верхнего уровня из сырого frontmatter. */
export function removeFrontmatterField(fm, key) {
  return fm
    .split('\n')
    .filter((line) => !new RegExp(`^${key}:`).test(line))
    .join('\n');
}

/** Запущен напрямую, а не импортирован: argv[1] бывает и относительным путём. */
export function isMain(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  // fileURLToPath, а не URL.pathname: в пути бывает кириллица, и pathname
  // отдаёт её процентно-закодированной — сравнение тогда всегда ложно.
  return path.resolve(entry) === fileURLToPath(metaUrl);
}

/** Разбор `--key value` / `--flag`. Один разбор на все скрипты контура. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((b - a) / 86400000);
