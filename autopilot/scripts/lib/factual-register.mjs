import { createHash } from 'node:crypto';
import { extractClaims, articleClaimText } from './critical-claims.mjs';
import { checkClaimEvidence, claimHash } from './claim-evidence.mjs';
import { activeFactCorrections } from './fact-corrections.mjs';
import { observedSourceChanges } from './fact-freshness.mjs';

/** Read-only inventory: missing evidence is a review task, never a proven error. */
export function buildFactualRegister({ articles, evidenceFor, correctionsFor = () => null,
  observations = {}, sourceFor, trafficFor = () => null, now = new Date(),
  maxAgeDays = 180, observationMaxAgeDays = 7 }) {
  const rows = articles.filter(a => !a.draft).map(article => {
    const evidence = evidenceFor(article.slug);
    const claims = extractClaims(article, null, { maxAgeDays });
    const confirmedErrors = activeFactCorrections({ slug: article.slug, body: articleClaimText(article),
      evidence: correctionsFor(article.slug), now, maxAgeDays });
    const details = claims.map(claim => {
      const verdict = checkClaimEvidence({ claims: [claim], evidence, now, maxAgeDays });
      const observed = observedSourceChanges({ claims: [claim], evidence, observations, now, observationMaxAgeDays });
      const entry = evidence?.claims?.find(e => e.claimHash === claimHash(claim.sentence) && e.source === claim.source);
      const document = evidence?.documents?.find(d => d.url === claim.source);
      const status = observed.unavailable.length ? 'source-unavailable' : verdict.ok && !observed.reasons.length ? 'verified' : 'needs-review';
      return { id: claim.id, claimHash: claimHash(claim.sentence), text: claim.text, sentence: claim.sentence,
        source: claim.source, status, reasons: [...verdict.problems.map(p => p.reason), ...observed.reasons],
        checkedAt: status === 'verified' ? entry.checkedAt : null,
        excerpt: entry?.excerpt ?? null, rationale: entry?.rationale ?? null,
        documentSha256: document?.sha256 ?? null };
    });
    const unverified = details.filter(c => c.status !== 'verified').length;
    const status = confirmedErrors.length ? 'confirmed-error' : details.some(c => c.status === 'source-unavailable') ? 'source-unavailable'
      : unverified ? 'needs-review' : claims.length ? 'verified' : 'no-critical-claims';
    return { slug: article.slug, url: `/blog/${article.slug}/`, title: article.title,
      sourceSha256: createHash('sha256').update(sourceFor(article)).digest('hex'), status,
      traffic: trafficFor(article.slug), confirmedErrors, unverifiedClaims: unverified, claims: details };
  });
  rows.sort((a,b) => b.confirmedErrors.length - a.confirmedErrors.length || b.unverifiedClaims - a.unverifiedClaims || a.slug.localeCompare(b.slug));
  const statuses = Object.fromEntries(['verified','needs-review','confirmed-error','source-unavailable','no-critical-claims'].map(status => [status,rows.filter(r => r.status === status).length]));
  return { version: 1, generatedAt: now.toISOString(), scope: 'current published files; no-critical-claims means detector found none, not semantic verification',
    summary: { articles: rows.length, claims: rows.reduce((n,r) => n+r.claims.length,0),
      unverifiedClaims: rows.reduce((n,r) => n+r.unverifiedClaims,0), statuses }, articles: rows };
}
