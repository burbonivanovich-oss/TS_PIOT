// Строгие даты и календарная семантика (AP-P1-03).
//
// `new Date("2026-02-30")` в JS не падает: дата молча «съезжает» на март, а
// `"мусор"` даёт Invalid Date, который тихо выпадает из сравнений. В автономном
// контуре это означает, что просроченный reviewDate или будущий pubDate никто
// не поймает. Парсер строгий: только YYYY-MM-DD и только реальная календарная
// дата; всё считается в UTC, без влияния TZ машины.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @returns {{ok: boolean, iso?: string, date?: Date, reason?: string}} */
export function parseIsoDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { ok: false, reason: 'пустая дата' };
  }
  const raw = String(value).trim();
  const match = raw.match(ISO_RE);
  if (!match) return { ok: false, reason: `формат не YYYY-MM-DD: "${raw}"` };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return { ok: false, reason: `несуществующая календарная дата: "${raw}"` };
  }
  return { ok: true, iso: raw, date };
}

/** Сегодняшняя дата UTC как Date (полночь). */
export const utcToday = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export function isFutureIso(value, now = new Date()) {
  const parsed = parseIsoDate(value);
  if (!parsed.ok) return false;
  return parsed.date.getTime() > utcToday(now).getTime();
}

export function isPastIso(value, now = new Date()) {
  const parsed = parseIsoDate(value);
  if (!parsed.ok) return false;
  return parsed.date.getTime() < utcToday(now).getTime();
}
