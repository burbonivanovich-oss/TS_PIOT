// Распределение ограниченной суточной квоты публикаций (AP-P0-17).
//
// `settle` публиковал каждый прошедший наряд, и после простоя догон давал
// неконтролируемый всплеск. Здесь чистая арифметика: сколько годных статей
// можно выпустить сегодня, а сколько ждёт следующего дня. Старейшие первыми.
//
// Вход:
//   waiting      — уже принятые ранее и ожидающие выпуска (acceptedAt, kind, …)
//   accepted     — принятые в этом проходе
//   alreadyToday — сколько уже выпущено сегодня
//   maxPerDay    — суточный лимит
// Выход: { release, wait } — что публикуем сейчас и что остаётся в очереди.

const byAge = (a, b) => {
  const t = String(a.acceptedAt || '').localeCompare(String(b.acceptedAt || ''));
  return t !== 0 ? t : String(a.slug).localeCompare(String(b.slug));
};

export function allocateReleases({ waiting = [], accepted = [], alreadyToday = 0, maxPerDay }) {
  const limit = Number.isInteger(maxPerDay) && maxPerDay > 0 ? maxPerDay : Infinity;
  const room = Math.max(0, limit - alreadyToday);
  const pool = [...waiting, ...accepted].sort(byAge);
  return { release: pool.slice(0, room), wait: pool.slice(room) };
}
