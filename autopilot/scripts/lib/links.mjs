// Разбор внутренних ссылок блога (AP-P1-07).
//
// Один парсер на гейты и перелинковку: если граф и проверка ссылок понимают
// формы ссылок по-разному, валидатор пропускает то, чего не видит граф (или
// наоборот). Поддерживаются:
//   • `/blog/<slug>` и `/blog/<slug>/` с trailing slash;
//   • query/hash: `/blog/<slug>?utm=…#section` — цель всё та же;
//   • URL-encoding: `/blog/%D1%81…` декодируется;
//   • относительный `./<slug>`.
// Ссылка на непубликуемую статью (draft/hold) валидной не считается — это
// проверяет вызывающая сторона по набору опубликованных slug'ов.

const MD_LINK_RE = /\]\(([^)\s]+)\)/g;

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // битый percent-encoding оставляем как есть — slug не совпадёт
  }
}

/** Нормализовать цель до slug или null, если ссылка не внутренняя. */
export function normalizeInternalTarget(target) {
  let raw = null;
  if (target.startsWith('/blog/')) raw = target.slice('/blog/'.length);
  else if (target.startsWith('./')) raw = target.slice(2);
  if (raw === null) return null;
  const clean = decodeSafe(raw.split(/[?#]/)[0]).replace(/\/+$/, '').trim();
  if (!clean || clean.includes('/')) return null; // только slug одного уровня
  return clean;
}

/** Множество внутренних slug'ов, на которые ссылается тело статьи. */
export function extractInternalLinks(body) {
  const links = new Set();
  for (const match of String(body || '').matchAll(MD_LINK_RE)) {
    const slug = normalizeInternalTarget(match[1]);
    if (slug) links.add(slug);
  }
  return links;
}

/** Список внутренних ссылок с исходной целью — для отчётов. */
export function listInternalLinks(body) {
  const out = [];
  for (const match of String(body || '').matchAll(MD_LINK_RE)) {
    const slug = normalizeInternalTarget(match[1]);
    if (slug) out.push({ href: match[1], slug });
  }
  return out;
}

/**
 * Slug'и, недоступные для ссылок: черновики и удержанные автопилотом статьи.
 * Ссылка на них «валидна» только формально — читатель её не откроет.
 */
export function unpublishedSlugs(articles) {
  return new Set(
    articles
      .filter((a) => a.draft || a.data?.autopilotHold === true)
      .map((a) => a.slug),
  );
}
