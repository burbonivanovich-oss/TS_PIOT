import { COMMERCIAL_GOALS, COUNTER_ID } from './commercial-metrika.mjs';
// Only aggregate numbers and coverage flags, never API bodies, URLs or tokens.
export function commercialLogSummary(result) {
  const fields = ['users', 'siteVisits', ...COMMERCIAL_GOALS.map(([, field]) => field)];
  const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(value) ? value : null;
  const safe = result.counterId === COUNTER_ID && ['ok','partial'].includes(result.status);
  return { schemaVersion: 1, counterId: COUNTER_ID, status: safe ? result.status : 'error',
    period: { from: iso(result.period?.from), to: iso(result.period?.to), timeZone: 'UTC' }, asOf: iso(result.asOf),
    sampled: typeof result.coverage?.sampled === 'boolean' ? result.coverage.sampled : null,
    sampleShare: Number.isFinite(result.coverage?.sampleShare) && result.coverage.sampleShare >= 0 && result.coverage.sampleShare <= 1 ? result.coverage.sampleShare : null,
    dataLagSeconds: Number.isSafeInteger(result.coverage?.dataLagSeconds) && result.coverage.dataLagSeconds >= 0 ? result.coverage.dataLagSeconds : null,
    metrics: Object.fromEntries(fields.map(field => [field, {
      value: safe && Number.isSafeInteger(result[field]) && result[field] >= 0 ? result[field] : null,
      unit: field === 'siteVisits' ? 'visits' : 'visitors',
      complete: safe && result.measurement?.[field]?.complete === true,
      issue: Boolean(result.issues?.[field])
    }])), confirmedLeads: null, payments: null, revenue: null, paidModelCost: null };
}
