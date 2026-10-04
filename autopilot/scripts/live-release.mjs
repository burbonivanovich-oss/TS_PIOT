#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isMain, parseArgs } from './lib/content.mjs';
import { verifyLiveRelease } from './lib/live-release.mjs';

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const pages = args.pages ? JSON.parse(readFileSync(args.pages, 'utf8')) : [];
    if (!Array.isArray(pages)) throw new Error('Expected page array');
    console.log(JSON.stringify(await verifyLiveRelease({ site: args.site, expectedCommit: args.commit, pages }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
