import { extractCriticalClaims } from '../gates.mjs';
import { auditSourceUrl } from './sources.mjs';
import { factFreshness } from './fact-freshness.mjs';

export function factualCoverage({articles, observations = {}, evidenceFor, now = new Date(), maxAgeDays = 180, observationMaxAgeDays = 7}) {
  const urls = new Set();
  let claimsWithoutSource = 0, articlesWithUnlinkedClaims = 0, reviewRequired = 0;
  for (const article of articles) {
    const evidence = evidenceFor(article.slug);
    const claims = extractCriticalClaims(article, null, { evidence, now, maxAgeDays });
    const unlinked = claims.filter(c => !c.source || !auditSourceUrl(c.source).ok).length;
    claimsWithoutSource += unlinked;
    articlesWithUnlinkedClaims += Number(unlinked > 0);
    for (const c of claims) if (c.source && auditSourceUrl(c.source).ok) urls.add(c.source);
    if (factFreshness({claims, evidence, observations, now, maxAgeDays, observationMaxAgeDays}).needsReview) reviewRequired++;
  }
  let freshSources = 0, unavailableSources = 0, missingOrExpiredSources = 0;
  for (const url of urls) {
    const obs = observations[url], age = now.getTime() - Date.parse(obs?.checkedAt);
    if (!Number.isFinite(age) || age < 0 || age > observationMaxAgeDays * 86400000 || !['ok','unavailable'].includes(obs?.status) || (obs.status === 'ok' && !/^[a-f0-9]{64}$/.test(obs.sha256 || ''))) missingOrExpiredSources++;
    else if (obs.status === 'unavailable') unavailableSources++;
    else freshSources++;
  }
  return {level:reviewRequired || claimsWithoutSource || unavailableSources || missingOrExpiredSources ? 'warn':'ok', articles:articles.length, sourceUrls:urls.size, freshSources, unavailableSources, missingOrExpiredSources, reviewRequired, articlesWithUnlinkedClaims, claimsWithoutSource};
}
