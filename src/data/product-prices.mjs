// Публичные цены сервисов Контура для страниц /produkty/ (COM-05).
// Только то, что прямо написано на официальной странице тарифов, со ссылкой
// и датой проверки. Цена старше PRICE_MAX_AGE_DAYS на сайт не выводится —
// устаревшая цифра хуже, чем её отсутствие. Перепроверка: открыть url,
// сверить строки и обновить checkedAt.

export const PRICE_MAX_AGE_DAYS = 45;

export const PRODUCT_PRICES = Object.freeze({
  'kontur-ofd': {
    lines: ['ОФД на 13 месяцев — 5 000 ₽', 'на 15 месяцев — 5 300 ₽, на 36 месяцев — 12 000 ₽', 'фискальный накопитель оплачивается отдельно'],
    url: 'https://kontur.ru/ofd/price',
    checkedAt: '2026-10-09',
  },
  'kontur-market': {
    lines: ['розница: от 4 200 ₽ за 3 месяца (тариф «Базовый»)', 'общепит: от 7 820 ₽ за 3 месяца', 'услуги: от 2 900 ₽ за 3 месяца', 'бесплатный доступ ко всем возможностям — 14 дней'],
    note: 'Цены для Москвы; зависят от региона, числа точек и срока.',
    url: 'https://kontur.ru/market/price',
    checkedAt: '2026-10-09',
  },
  'kontur-diadoc': {
    lines: ['входящие документы — бесплатно', '250 отправленных документов на год — 2 950 ₽', 'новым пользователям — 25 документов на 30 дней бесплатно'],
    url: 'https://kontur.ru/diadoc/price',
    checkedAt: '2026-10-09',
  },
  'kontur-extern': {
    lines: ['«Нулевая отчётность» — от 2 000 ₽ в год', '«Кадровые отчёты» — 3 600 ₽ в год', 'остальные тарифы — по заявке'],
    url: 'https://kontur.ru/extern/price',
    checkedAt: '2026-10-09',
  },
});

export function freshPrice(bannerId, { now = new Date(), prices = PRODUCT_PRICES, maxAgeDays = PRICE_MAX_AGE_DAYS } = {}) {
  const price = prices[bannerId];
  if (!price) return null;
  const checked = Date.parse(`${price.checkedAt}T00:00:00Z`);
  if (!Number.isFinite(checked)) return null;
  const age = (now.getTime() - checked) / 86400000;
  return age >= 0 && age <= maxAgeDays ? price : null;
}

export function priceDateLabel(iso) {
  // «9 октября 2026» без «г.», чтобы не получить двойную точку в конце фразы.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/\s*г\.$/, '');
}
