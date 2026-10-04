#!/usr/bin/env node
// Resolve opaque article ids from the actual built pages, without exporting URLs/queries.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function contentIndex(dist = 'dist') {
  const root = path.join(dist, 'blog');
  const articles = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const html = readFileSync(path.join(root, entry.name, 'index.html'), 'utf8');
    const id = html.match(/<article\b[^>]*\bdata-commercial-content-id="([a-f0-9]{64})"/)?.[1];
    if (!id) continue; // index/category pages carry no article context
    const expected = createHash('sha256').update(entry.name).digest('hex');
    if (id !== expected) throw Error(`Content id does not match built article: ${entry.name}`);
    articles.push({ contentId: id, slug: entry.name });
  }
  return { schemaVersion: 1, scope: 'article ids found in this built corpus; not a live analytics export', articles: articles.sort((a,b)=>a.slug.localeCompare(b.slug)) };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { console.log(JSON.stringify(contentIndex(process.argv[2] || 'dist'), null, 2)); }
  catch(error) { console.error(error.message); process.exitCode = 1; }
}
