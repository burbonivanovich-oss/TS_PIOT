// Дата фактчека хранится в маркере, а не в mtime: checkout меняет mtime.
export function checkFactcheckDate(text, { now = new Date(), maxAgeDays = 180 } = {}) {
  let checkedAt;
  try {
    if (String(text).trimStart().startsWith('{')) {
      const record = JSON.parse(text);
      if (record.passed !== true) throw new Error('нет явного passed: true');
      checkedAt = record.checkedAt;
    } else {
      const line = String(text).split(/\r?\n/, 1)[0].trim();
      checkedAt = line.replace(/^Factcheck pass:\s*/i, '');
    }
    if (typeof checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(checkedAt)) throw new Error('нет распознаваемой даты внутри маркера');
    const day = checkedAt.slice(0, 10);
    const calendarDay = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== day) throw new Error('нереальная календарная дата фактчека');
    const time = new Date(checkedAt.length === 10 ? checkedAt + 'T00:00:00Z' : checkedAt);
    if (!Number.isFinite(time.getTime()) || !Number.isFinite(now.getTime())) throw new Error('некорректная дата фактчека');
    const ageDays = (now.getTime() - time.getTime()) / 86400000;
    if (ageDays < 0) throw new Error('дата фактчека в будущем');
    if (ageDays > maxAgeDays) throw new Error(`фактчек старше ${maxAgeDays} дней (${Math.floor(ageDays)})`);
    return { ok: true, checkedAt, ageDays };
  } catch (error) { return { ok: false, detail: error.message }; }
}
