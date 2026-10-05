// Вторичный внутренний вход из статьи на карточку продукта витрины.
//
// Только точное совпадение bannerId из закрытого списка розничных офферов
// (kontur-market / kontur-ofd / kontur-markirovka) с записью PRODUCT_CATALOG
// и действующим erid в CPA_BANNERS. Никакого угадывания по заголовку,
// тегам или подстрокам текста — выбор баннера остаётся за articleCpa().
// Неизвестный id, нерозничный оффер и отсутствующий erid дают null
// (ссылка не рендерится).
export const RETAIL_PRODUCT_IDS = Object.freeze([
  'kontur-market',
  'kontur-ofd',
  'kontur-markirovka',
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function articleProductEntry(bannerId, deps = {}) {
  if (typeof bannerId !== 'string') return null;
  const id = bannerId;
  if (!RETAIL_PRODUCT_IDS.includes(id)) return null;
  const { catalog = [], banners = {} } = deps ?? {};
  const entry = Array.isArray(catalog)
    ? catalog.find((e) => e && e.bannerId === id)
    : null;
  if (!entry || typeof entry.slug !== 'string' || !SLUG_RE.test(entry.slug)) return null;
  const banner = banners ? banners[id] : null;
  if (!banner || typeof banner !== 'object') return null;
  const erid = banner.erid;
  if (typeof erid !== 'string' || erid.trim() === '') return null;
  return `/produkty/${entry.slug}/`;
}
