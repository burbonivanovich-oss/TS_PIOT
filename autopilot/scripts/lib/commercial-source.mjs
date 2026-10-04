// Report windows and collection timestamps describe the data, never the file mtime.
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function receiptProblem(dir, verification) {
  const ref = verification?.evidenceRef;
  if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || ref.split(/[\\/]/).some(x => !x || x === '.' || x === '..')) return 'не указан безопасный относительный путь первичной выгрузки';
  if (!/^[a-f0-9]{64}$/.test(verification?.sha256 || '')) return 'нет SHA-256 первичной выгрузки';
  try {
    const root = realpathSync(dir), file = path.resolve(root, ref);
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 50 * 1024 * 1024 || !realpathSync(file).startsWith(root + path.sep)) return 'первичная выгрузка недоступна или выходит за каталог данных';
    if (createHash('sha256').update(readFileSync(file)).digest('hex') !== verification.sha256) return 'первичная выгрузка изменилась после сверки';
    return null;
  } catch { return 'нет доступного файла первичной выгрузки'; }
}
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  if (!validDay(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}
export function sourceProblem(data, { period, now, maxAgeMs, partner = false, verificationSource = null }) {
  const collected = timestamp(data.fetchedAt);
  if (collected === null) return 'нет корректной даты фактической выгрузки fetchedAt';
  if (collected > now.getTime()) return 'дата выгрузки находится в будущем';
  if (now.getTime() - collected > maxAgeMs) return 'выгрузка устарела';
  if (!validDay(data.period?.from) || !validDay(data.period?.to) || data.period.from > data.period.to) return 'нет корректного периода данных';
  if (data.period.timeZone !== 'UTC') return 'часовой пояс периода не подтверждён как UTC';
  if (data.period.from !== period.from || data.period.to !== period.to) return 'период источника не совпадает с окном отчёта';
  if (data.period.to > new Date(collected).toISOString().slice(0, 10)) return 'выгрузка не покрывает конец периода';
  if (partner || verificationSource) {
    const v = data.verification;
    const verified = timestamp(v?.verifiedAt);
    if (v?.source !== (verificationSource || 'partner-cabinet') || typeof v.evidenceRef !== 'string' || !v.evidenceRef.trim() || verified === null) return 'нет явной сверки с первичным источником';
    if (verified > now.getTime() || now.getTime() - verified > maxAgeMs) return 'сверка с первичным источником устарела или датирована будущим';
    if (data.currency !== 'RUB') return 'валюта сверки не подтверждена как RUB';
  }
  return null;
}
export function basisFor(data, key, period) {
  const b = data.measurement?.[key];
  if (!b || !['visitors', 'visits', 'leads', 'events', 'invoices', 'rub', 'ratio'].includes(b.unit) || typeof b.cohort !== 'string' || !b.cohort.trim()) return null;
  const cutoff = timestamp(data.asOf), fetched = timestamp(data.fetchedAt);
  if (cutoff === null || fetched === null || cutoff > fetched) return null;
  return { metric: key, unit: b.unit, cohort: b.cohort, subsetOf: Array.isArray(b.subsetOf) ? b.subsetOf.filter(x => typeof x === 'string') : [], asOf: new Date(cutoff).toISOString(), period: { from: period.from, to: period.to, timeZone: 'UTC' }, unique: b.unique === true, complete: b.complete === true };
}
export function confirmedLeads(data) {
  const c = data.confirmation?.validLeads;
  return ['server-accepted', 'partner-cabinet'].includes(c?.source) && typeof c.evidenceRef === 'string' && !!c.evidenceRef.trim();
}
export function validMetric(value, kind = 'int') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
  if (kind === 'ratio') return value <= 1;
  if (kind === 'money') return Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
  return Number.isSafeInteger(value);
}
