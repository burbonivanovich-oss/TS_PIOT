import { createHash } from 'node:crypto';
import { claimHash, normalizeClaim } from './claim-evidence.mjs';
import { auditSourceUrl, extractUrls } from './sources.mjs';

/** Explicit semantic findings are inputs, never inferred from absent evidence. */
export function activeFactCorrections({ slug, body, evidence, now = new Date(), maxAgeDays = 180 }) {
  if (evidence?.version !== 1 || evidence.slug !== slug || !Array.isArray(evidence.findings) || !Array.isArray(evidence.documents)) return [];
  const fresh = value => { const age = now.getTime() - Date.parse(value); return Number.isFinite(age) && age >= 0 && age <= maxAgeDays * 86400000; };
  const text = normalizeClaim(body);
  const urls = new Set(extractUrls(body));
  return evidence.findings.filter(finding => {
    const matches = Object.hasOwn(finding, 'matchUrl')
      ? typeof finding.matchUrl === 'string' && finding.matchUrl === finding.source && auditSourceUrl(finding.matchUrl).ok && urls.has(finding.matchUrl)
      : text.includes(normalizeClaim(finding.statement));
    if (finding.result !== 'contradicted' || typeof finding.statement !== 'string' || !finding.statement.trim() ||
        finding.claimHash !== claimHash(finding.statement) || !matches ||
        typeof finding.rationale !== 'string' || !finding.rationale.trim() || !fresh(finding.checkedAt) || !auditSourceUrl(finding.source).ok) return false;
    const document = evidence.documents.find(d => d.url === finding.source);
    return document?.status === 200 && typeof document.text === 'string' && fresh(document.fetchedAt) &&
      createHash('sha256').update(document.text).digest('hex') === document.sha256 &&
      typeof finding.excerpt === 'string' && finding.excerpt.trim() && normalizeClaim(document.text).includes(normalizeClaim(finding.excerpt));
  }).map(({ claimHash, source, rationale }) => ({ claimHash, source, rationale }));
}

/** Late findings can promote a previously accepted rewrite without another model call. */
export function lateCorrectionPriority({ item, publishedBody, candidateBody, evidence, now = new Date(), maxAgeDays = 180 }) {
  if (item.kind !== 'rewrite' || !item.stagedFile) return item;
  const options = { slug: item.slug, evidence, now, maxAgeDays };
  if (!activeFactCorrections({ ...options, body: publishedBody }).length ||
      activeFactCorrections({ ...options, body: candidateBody }).length) return item;
  return { ...item, factualCorrection: true };
}
