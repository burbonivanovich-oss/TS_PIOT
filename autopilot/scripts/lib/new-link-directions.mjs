import { tokenize, weightedCoverage, buildIdf } from './text.mjs';

// Topic briefs have no body yet. Match their explicit entity, then rank title
// coverage. These are reading directions, not permission to insert links.
export function newLinkDirections(topic, articles, graph, rules) {
  if (!topic.entity) return [];
  const describe = a => [a.title, ...(a.keywords || []), ...(a.tags || [])].join(' ');
  const idf = buildIdf(articles.map(describe));
  const entity = [...tokenize(topic.entity)].filter(w =>
    (idf.idf.get(w) ?? idf.fallback) >= (rules.minAnchorIdf ?? 0));
  if (!entity.length) return [];
  const words = tokenize([describe(topic), topic.entity].join(' '));
  return articles.filter(a => a.slug !== topic.slug && (graph.inbound.get(a.slug)?.size || 0) < rules.minInbound)
    .filter(a => { const title = tokenize(a.title); return entity.every(w => title.has(w)); })
    .map(a => ({ slug: a.slug, title: a.title, inbound: graph.inbound.get(a.slug)?.size || 0,
      relevance: weightedCoverage(tokenize(a.title), words, idf) }))
    .filter(a => a.relevance >= rules.minRelevance)
    .sort((a,b) => a.inbound - b.inbound || b.relevance - a.relevance || a.slug.localeCompare(b.slug))
    .slice(0, Math.min(rules.minOutbound, rules.maxOutbound));
}
