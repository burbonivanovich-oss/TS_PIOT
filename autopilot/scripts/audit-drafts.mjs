#!/usr/bin/env node
// Аудит готовности очереди. Не меняет черновики, маркеры или состояние.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadArticles, isMain, parseArgs } from './lib/content.mjs';
import { loadConfig } from './lib/config.mjs';
import { readSourceEvidence } from './lib/sources.mjs';
import { runGates, bodyDuplication } from './gates.mjs';

export function auditDrafts() {
  const cfg = loadConfig();
  const sourceEvidence = readSourceEvidence().entries;
  const rows = loadArticles({ includeDrafts: true }).filter(a => a.draft).map(article => {
    const gate = runGates({ file: article.path, sourceEvidence });
    const duplication = bodyDuplication({ file: article.path });
    return {
      slug: article.slug,
      sha256: createHash('sha256').update(readFileSync(article.path)).digest('hex'),
      pubDate: article.data.pubDate,
      held: article.data.autopilotHold === true,
      passed: gate.passed && duplication.verdict === 'ok',
      score: gate.score, blockers: gate.blockers,
      failedChecks: gate.checks.filter(c => !c.ok).map(c => ({ id: c.id, detail: c.detail })),
      duplication,
    };
  });
  const reasons = {};
  for (const row of rows) for (const check of row.failedChecks) reasons[check.id] = (reasons[check.id] || 0) + 1;
  return {
    checkedAt: new Date().toISOString(),
    scope: 'local drafts only; no publication or corpus mutation',
    contract: { monthlyTarget: cfg.throughput.monthlyTarget, monthlyRewriteTarget: cfg.throughput.monthlyRewriteTarget, qualityCheck: cfg.security?.qualityCheck, requireClaimEvidence: cfg.gates.requireClaimEvidence, requireHeroImage: cfg.gates.requireHeroImage },
    total: rows.length, passed: rows.filter(r => r.passed).length, reasons, rows,
  };
}

if (isMain(import.meta.url)) {
  const report = auditDrafts();
  if (parseArgs(process.argv.slice(2)).json) console.log(JSON.stringify(report, null, 2));
  else console.log(`Черновиков ${report.total}, прошли ${report.passed}; причины: ${JSON.stringify(report.reasons)}`);
}
