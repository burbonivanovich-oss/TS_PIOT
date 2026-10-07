#!/usr/bin/env node
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewTraffic } from './lib/factual-traffic.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadArticles, readJson, isMain } from './lib/content.mjs';
import { buildFactualRegister } from './lib/factual-register.mjs';

export function factualRegister({ now=new Date() }={}) {
  const cfg = loadConfig(), dir = cfg.resolved.dataDir;
  const file=path.join(cfg.resolved.contentRoot,'src/data/analytics/metrika.json');
  const raw=existsSync(file)?readFileSync(file):null;
  const traffic=reviewTraffic({snapshot:raw?JSON.parse(raw):null,now});
  const trafficEvidence={...traffic.metadata,file,sha256:raw?createHash('sha256').update(raw).digest('hex'):null};
  return buildFactualRegister({ now, trafficFor:traffic.trafficFor, trafficEvidence, articles: loadArticles({ includeDrafts: false }),
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
