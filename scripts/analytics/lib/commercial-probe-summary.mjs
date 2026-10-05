import { createHash } from 'node:crypto';
import { COUNTER_ID } from './commercial-metrika.mjs';

// Derived metrics for public article slugs only, not raw API rows or parameter values.
// The summary preserves the real event window (period/asOf/fetchedAt) so that
// article event counts are never dateless. All window fields are strictly
// validated; anything missing or invalid fails closed to status 'unverified'
// with null dates and no confirmed article counts. No raw metadata passthrough:
// only explicitly validated scalars are copied, never arbitrary result fields.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Supported timestamps: collector emits Date.toISOString() canonical form
// YYYY-MM-DDTHH:mm:ss.sssZ (milliseconds always present, exactly 3 digits).
// For forward tolerance the summary also accepts the same shape without
// milliseconds (YYYY-MM-DDTHH:mm:ssZ) or with 1-2 digit fractions. Anything
// else (offsets, spaces, missing Z/T) is rejected before Date.parse, because
// Date.parse normalizes impossible values (Feb 30 -> Mar 02, 24:00 -> next
// day) instead of refusing them. Validation below parses components with
// Date.UTC and requires new Date(ms).toISOString() to round-trip to the
// canonical form, which rejects non-existent calendar dates and out-of-range
// clock fields (hour 24, minute/second 60, day 30 Feb, 29 Feb non-leap).
const ISOZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function parseIsoZUtcMs(value) {
  if (typeof value !== 'string') return null;
  const m = ISOZ_RE.exec(value);
  if (!m) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  if (month < 1 || month > 12) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  let millis = 0;
  if (m[1] !== undefined) millis = Number((m[1].slice(1) + '000').slice(0, 3));
  const ms = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  if (!Number.isFinite(ms)) return null;
  // Round-trip against the real UTC calendar: overflow (Feb 30, Apr 31,
  // 29 Feb on a non-leap year, hour 24 normalized to next day) produces a
  // different ISO string and is rejected here.
  const canonical = new Date(ms).toISOString();
  const expected = `${value.slice(0, 19)}.${String(millis).padStart(3, '0')}Z`;
  if (canonical !== expected) return null;
  return ms;
}

function isRealCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms)) return false;
  return new Date(ms).toISOString().slice(0, 10) === value;
}

function isIsoZ(value) {
  return parseIsoZUtcMs(value) !== null;
}

function validatedWindow(result) {
  const period = result?.period;
  const asOf = result?.asOf;
  const fetchedAt = result?.fetchedAt;
  const from = period?.from;
  const to = period?.to;
  const timeZone = period?.timeZone;
  if (timeZone !== 'UTC') return null;
  if (!isRealCalendarDate(from) || !isRealCalendarDate(to)) return null;
  if (from > to) return null;
  const asOfMs = parseIsoZUtcMs(asOf);
  const fetchedMs = parseIsoZUtcMs(fetchedAt);
  if (asOfMs === null || fetchedMs === null) return null;
  if (!(fetchedMs >= asOfMs)) return null;
  // Containment uses actual UTC timestamps, never the raw asOf date prefix:
  // a normalized-looking value such as 2026-10-05T24:00:00Z is already
  // rejected above, and a valid asOf must satisfy
  // from-midnight <= asOf <= to-end (23:59:59.999 UTC).
  const fromMidnightMs = Date.parse(`${from}T00:00:00.000Z`);
  const toEndMs = Date.parse(`${to}T23:59:59.999Z`);
  if (!(fromMidnightMs <= asOfMs && asOfMs <= toEndMs)) return null;
  return { from, to, asOf, fetchedAt, timezoneUTC: '+00:00' };
}

function verifiedKind(result, kind, window) {
  const report = result?.reports?.[kind];
  if (!window) return false;
  if (!report || report.status !== 'ok') return false;
  // Per-kind cutoff must exactly match the validated top-level asOf and be ISOZ.
  // A mismatched cutoff never participates in comparison.
  if (!isIsoZ(report.asOf)) return false;
  if (report.asOf !== window.asOf) return false;
  return true;
}

export function commercialProbeSummary(result, slugs) {
  const allowed = new Set(
    (Array.isArray(slugs) ? slugs : []).filter(s => typeof s === 'string' && /^[a-z0-9-]+$/.test(s)),
  );
  const byHash = new Map([...allowed].map(s => [createHash('sha256').update(s).digest('hex'), s]));
  const safe =
    result?.counterId === COUNTER_ID && typeof result?.sourceRevision === 'string' && /^[a-f0-9]{40}$/.test(result.sourceRevision);
  const window = validatedWindow(result);
  const windowOk = window !== null && safe;
  const pagesOk = safe && verifiedKind(result, 'pages', window);
  const paramsOk = safe && verifiedKind(result, 'parameters', window);

  const metrics = new Map();
  for (const kind of ['pages', 'parameters']) {
    const ok = kind === 'pages' ? pagesOk : paramsOk;
    if (!ok) continue;
    const report = result.reports[kind];
    for (const row of report.rows || []) {
      const slug = kind === 'pages' ? row.slug : byHash.get(row.contentId);
      if (!allowed.has(slug) || !['cpa-visible', 'cpa-click'].includes(row.event) || !Number.isSafeInteger(row.events) || row.events < 0) continue;
      const key = `${row.event}:${slug}`;
      if (!metrics.has(key)) metrics.set(key, { event: row.event, slug, pageEvents: null, contentParameterEvents: null });
      const item = metrics.get(key), field = kind === 'pages' ? 'pageEvents' : 'contentParameterEvents';
      const next = (item[field] ?? 0) + row.events;
      if (!Number.isSafeInteger(next)) throw Error('summary_count_invalid');
      item[field] = next;
    }
  }
  // Without a verified window there are no confirmed article counts.
  const articles = windowOk
    ? [...metrics.values()].sort((a, b) => a.slug.localeCompare(b.slug) || a.event.localeCompare(b.event))
      .map(a => ({ ...a, countsAgree: a.pageEvents !== null && a.contentParameterEvents !== null ? a.pageEvents === a.contentParameterEvents : null }))
    : [];
  const coverage = Object.fromEntries(['pages', 'parameters'].map(kind => {
    const ok = kind === 'pages' ? pagesOk : paramsOk;
    const r = result?.reports?.[kind], c = r?.coverage;
    const int = x => ok && Number.isSafeInteger(x) && x >= 0 ? x : null;
    return [kind, {
      status: ok ? 'ok' : 'unverified',
      returnedRows: int(c?.returnedRows),
      totalRows: int(c?.totalRows),
      dataLagSeconds: int(c?.dataLagSeconds),
      paginationComplete: ok && c?.paginationComplete === true,
      sampled: ok && typeof c?.sampled === 'boolean' ? c.sampled : null,
      sampleShare: ok && c?.sampleShare === 1 ? 1 : null,
      trackingWindowComplete: ok && r?.complete === true,
    }];
  }));
  const status = !windowOk ? 'unverified' : pagesOk && paramsOk ? 'ok' : pagesOk || paramsOk ? 'partial' : 'unverified';
  return {
    counterId: COUNTER_ID,
    sourceRevision: safe && windowOk ? result.sourceRevision : null,
    unit: 'events',
    status,
    period: windowOk ? { from: window.from, to: window.to } : null,
    asOf: windowOk ? window.asOf : null,
    fetchedAt: windowOk ? window.fetchedAt : null,
    timezoneUTC: windowOk ? window.timezoneUTC : null,
    coverage,
    articleRows: articles.length,
    truncated: articles.length > 200,
    articles: articles.slice(0, 200),
    semantics: 'Independent event-page and marginal contentId counts. Agreement is not a joined offer attribution or conversion proof.',
    attributionProven: false,
    confirmedLeads: null,
    payments: null,
    revenue: null,
    paidModelCost: null,
  };
}
