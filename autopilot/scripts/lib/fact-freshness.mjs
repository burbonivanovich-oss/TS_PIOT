import { checkClaimEvidence } from './claim-evidence.mjs';

/** Наличие свежего снимка не означает содержательную сверку новой редакции. */
export function observedSourceChanges({ claims, evidence, observations = {}, now = new Date(), observationMaxAgeDays = 7 }) {
  const reasons = [];
  const changed = [];
  const unavailable = [];
  for (const url of new Set(claims.map(c => c.source).filter(Boolean))) {
    const observation = observations[url];
    const age = now.getTime() - Date.parse(observation?.checkedAt);
    if (!Number.isFinite(age) || age < 0 || age > observationMaxAgeDays * 86400000) continue;
    if (observation.status === 'unavailable') {
      unavailable.push(url);
      reasons.push(`первоисточник недоступен для перепроверки: ${url}`);
      continue;
    }
    const saved = evidence?.documents?.find(d => d.url === url);
    if (observation.status === 'ok' && /^[a-f0-9]{64}$/.test(observation.sha256 || '') && saved && observation.sha256 !== saved.sha256) {
      changed.push(url);
      reasons.push(`текст первоисточника изменился; нужна содержательная сверка: ${url}`);
    }
  }
  return { reasons, changed, unavailable };
}

export function factFreshness(options) {
  const verdict = checkClaimEvidence(options);
  const observed = observedSourceChanges(options);
  const reasons = [...verdict.problems.map(p => `${p.text}: ${p.reason}`), ...observed.reasons];
  return { needsReview: reasons.length > 0, criticalClaims: options.claims.length, reasons: [...new Set(reasons)], changed: observed.changed, unavailable: observed.unavailable, evidenceProblems: verdict.problems.length };
}
