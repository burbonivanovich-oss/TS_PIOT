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
  const urgent = item => item.kind === 'rewrite' && item.factualCorrection === true;
  const priority = Number(urgent(b)) - Number(urgent(a));
  if (priority) return priority;
  const t = String(a.acceptedAt || '').localeCompare(String(b.acceptedAt || ''));
  return t !== 0 ? t : String(a.slug).localeCompare(String(b.slug));
};

export function allocateReleases({ waiting = [], accepted = [], alreadyToday = 0, maxPerDay, calendar = null }) {
  const limit = Number.isInteger(maxPerDay) && maxPerDay > 0 ? maxPerDay : Infinity;
  const room = Math.max(0, limit - alreadyToday);
  const pool = [...waiting, ...accepted].sort(byAge);
  if (!calendar) return { release: pool.slice(0, room), wait: pool.slice(room) };
  const remaining = Object.fromEntries(Object.entries(calendar.byKind).map(([kind, value]) => [kind, value.remaining]));
  const release = []; const wait = [];
  for (const item of pool) {
    if (!['new', 'rewrite'].includes(item.kind)) throw new Error('Неизвестный вид наряда для календаря выпуска');
    if (release.length < room && remaining[item.kind] > 0) { release.push(item); remaining[item.kind] -= 1; }
    else wait.push(item);
  }
  return { release, wait };
}

/** Кумулятивный календарь UTC: отдельные нормы новых статей и обновлений. */
export function releaseCalendar({ date = new Date(), config, publishLog = { days: {} } }) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Некорректная дата календаря');
  const day = date.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const dayIndex = date.getUTCDate();
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const targets = { new: config.throughput.monthlyTarget, rewrite: config.throughput.monthlyRewriteTarget };
  if (!Object.values(targets).every(n => Number.isInteger(n) && n >= 0)) throw new Error('Для календаря нужны отдельные целые нормы новых статей и обновлений');
  const done = { new: 0, rewrite: 0 };
  if (!publishLog.days || typeof publishLog.days !== 'object' || Array.isArray(publishLog.days)) throw new Error('Повреждён журнал выпуска');
  for (const [loggedDay, slugs] of Object.entries(publishLog.days)) {
    if (!loggedDay.startsWith(month)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedDay) || !Number.isFinite(Date.parse(loggedDay + 'T00:00:00Z')) || new Date(loggedDay + 'T00:00:00Z').toISOString().slice(0, 10) !== loggedDay || loggedDay > day || !Array.isArray(slugs) || new Set(slugs).size !== slugs.length) throw new Error('Повреждён календарь журнала выпуска');
    for (const slug of slugs) {
      // Старый журнал не различал виды; консервативно считаем новым выпуском.
      const kind = publishLog.kinds?.[loggedDay]?.[slug] ?? 'new';
      if (!['new', 'rewrite'].includes(kind) || typeof slug !== 'string') throw new Error('Повреждён вид выпуска');
      done[kind] += 1;
    }
  }
  const byKind = Object.fromEntries(Object.entries(targets).map(([kind, target]) => {
    const allowedToDate = Math.ceil(target * dayIndex / days);
    return [kind, { target, done: done[kind], allowedToDate, remaining: Math.max(0, Math.min(target, allowedToDate) - done[kind]) }];
  }));
  return { day, byKind };
}

/** Necessary publication capacity bound; sufficient room never promises success. */
export function publicationCapacity({ date = new Date(), config, publishLog = { days: {} } }) {
  const calendar = releaseCalendar({ date, config, publishLog });
  const limit = config.publish.maxPerDay;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Нужен положительный суточный лимит выпуска');
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const todayPublished = (publishLog.days[calendar.day] || []).length;
  const slotsRemaining = (daysInMonth - date.getUTCDate()) * limit + Math.max(0, limit - todayPublished);
  const byKind = Object.fromEntries(Object.entries(calendar.byKind).map(([kind, v]) => [kind, { target: v.target, published: v.done, remaining: Math.max(0, v.target - v.done) }]));
  const needed = Object.values(byKind).reduce((sum, v) => sum + v.remaining, 0);
  return { day: calendar.day, slotsRemaining, needed, impossible: needed > slotsRemaining, shortfall: Math.max(0, needed - slotsRemaining), byKind };
}

/** Distinct completed passes only; retrying a run cannot add an observation. */
export function publicationFailureStreak(runs, day) {
  const month = day.slice(0, 7);
  const seen = new Set();
  const completed = runs.filter(r => r.date?.startsWith(month) && r.date <= day && r.stages?.committed)
    .sort((a,b) => String(b.stages.gated?.at || b.createdAt).localeCompare(String(a.stages.gated?.at || a.createdAt)));
  let count = 0;
  for (const run of completed) {
    if (seen.has(run.runId)) continue;
    seen.add(run.runId);
    if (run.stages.gated?.publicationCapacity?.impossible !== true) break;
    count++;
  }
  return count;
}
