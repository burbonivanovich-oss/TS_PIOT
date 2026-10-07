#!/usr/bin/env node
import path from 'node:path';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { loadArticles, readJson, writeJson, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { extractCriticalClaims } from './gates.mjs';
import { auditSourceUrl } from './lib/sources.mjs';
import { captureSource } from './source-snapshot.mjs';

export function sourceCheckBudget(totalSources, minimum, coverageDays) {
  if (!Number.isSafeInteger(totalSources) || totalSources < 0 || !Number.isInteger(minimum) || minimum < 1 || minimum > 50 || !Number.isFinite(coverageDays) || coverageDays < 1) throw new Error('Invalid source coverage budget');
  const budget = Math.max(minimum, Math.ceil(totalSources / Math.max(1, Math.floor(coverageDays) - 1)));
  if (budget > 50) throw new Error('Source coverage requires more than 50 checks per daily pass; increase cadence before continuing');
  return budget;
}

export async function monitorSources({ articles, previous = { byUrl: {} }, limit = 10, intervalDays = 1, coverageDays = null, now = new Date(), evidenceFor, capture = captureSource }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('limit должен быть целым числом 1–50');
  const byUrl = { ...previous.byUrl };
  const urls = [...new Set(articles.flatMap(article => extractCriticalClaims(article, null, { now, evidence: evidenceFor?.(article.slug) }).map(c => c.source)).filter(url => url && auditSourceUrl(url).ok))];
  const effectiveLimit = coverageDays === null ? limit : sourceCheckBudget(urls.length, limit, coverageDays);
  // A future or malformed timestamp is not a valid successful observation.
  // Prioritize its recovery instead of letting every normally due URL pass it.
  const checkedTime = url => {
    const stamp = Date.parse(byUrl[url]?.checkedAt);
    return Number.isFinite(stamp) && stamp <= now.getTime() ? stamp : Number.NEGATIVE_INFINITY;
  };
  const candidates = urls.filter(url => {
    const age = now.getTime() - Date.parse(byUrl[url]?.checkedAt);
    return !Number.isFinite(age) || age < 0 || age >= intervalDays * 86400000;
  }).sort((a, b) => checkedTime(a) - checkedTime(b) || a.localeCompare(b));
  const checked = [];
  for (const url of candidates.slice(0, effectiveLimit)) {
    let observation;
    try {
      const doc = await capture(url, { now });
      observation = { status: 'ok', checkedAt: now.toISOString(), sha256: doc.sha256, finalUrl: doc.finalUrl };
    } catch (error) {
      observation = { status: 'unavailable', checkedAt: now.toISOString(), reason: error.message };
    }
    byUrl[url] = observation;
    checked.push({ url, ...observation });
  }
  return { generatedAt: now.toISOString(), totalSources: urls.length, checkBudget: effectiveLimit, checkedCount: checked.length, dueRemaining: Math.max(0, candidates.length - checked.length), checked, byUrl };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  let locked = false;
  try {
    if (args.write) {
      assertContentRoot(cfg);
      acquireLock({ cmd: 'source-monitor' });
      locked = true;
    }
    const file = path.join(cfg.resolved.dataDir, 'source-observations.json');
    const published = loadArticles({ includeDrafts: false });
    const articles = args.slug ? published.filter(article => article.slug === args.slug) : published;
    if (args.slug && articles.length !== 1) throw new Error('не найдена опубликованная статья для --slug');
    const report = { ...await monitorSources({ articles, previous: readJson(file, { byUrl: {} }), limit: Number(args.limit ?? cfg.rewrite.sourceChecksPerRun ?? 10), intervalDays: cfg.rewrite.sourceCheckIntervalDays ?? 1 }), scope: args.slug ? { slug: args.slug } : { publishedArticles: articles.length } };
    if (args.write) writeJson(file, report);
    console.log(JSON.stringify({ ...report, persisted: Boolean(args.write) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { if (locked) releaseLock(); }
}
