#!/usr/bin/env node
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { loadArticles, readJson, isMain } from './lib/content.mjs';
import { buildFactualRegister } from './lib/factual-register.mjs';

export function factualRegister() {
  const cfg = loadConfig(), dir = cfg.resolved.dataDir;
  return buildFactualRegister({ articles: loadArticles({ includeDrafts: false }),
    evidenceFor: slug => readJson(path.join(dir,'claim-evidence',slug+'.json'),null),
    correctionsFor: slug => readJson(path.join(dir,'fact-corrections',slug+'.json'),null),
    observations: readJson(path.join(dir,'source-observations.json'),{byUrl:{}}).byUrl,
    sourceFor: article => readFileSync(article.path), maxAgeDays: cfg.gates.sourceMaxAgeDays,
    observationMaxAgeDays: cfg.rewrite.sourceObservationMaxAgeDays });
}

if (isMain(import.meta.url)) {
  try { console.log(JSON.stringify(factualRegister(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
