import { tokenize, weightedCoverage, buildIdf } from './text.mjs';

// A missing incoming link is repaired in its donor, not in the target body.
// These are research directions for the writer; ordinary link gates still apply.
export function donorRewriteDirections(articles, graph, rules) {
  const topic = a => [a.title, ...(a.keywords || []), ...(a.tags || [])].join(' ');
  const model = buildIdf(articles.map(topic));
  const directions = new Map();
  const given = new Map();
  const targets = articles.filter(a => (graph.inbound.get(a.slug)?.size || 0) < rules.minInbound);
  for (const target of targets) {
    const need = rules.minInbound - (graph.inbound.get(target.slug)?.size || 0);
    const donors = articles.filter(a => a.slug !== target.slug &&
      !graph.outbound.get(a.slug)?.has(target.slug) &&
      (graph.outbound.get(a.slug)?.size || 0) + (given.get(a.slug) || 0) < rules.maxOutbound)
      .map(a => ({ article: a, relevance: weightedCoverage(tokenize(topic(target)), tokenize(a.body.slice(0, 12000)), model) }))
      .filter(a => a.relevance >= rules.minRelevance)
      .sort((a, b) => b.relevance - a.relevance || a.article.slug.localeCompare(b.article.slug));
    for (const { article, relevance } of donors.slice(0, need)) {
      const direction = { slug: target.slug, title: target.title, relevance };
      directions.set(article.slug, [...(directions.get(article.slug) || []), direction]);
      given.set(article.slug, (given.get(article.slug) || 0) + 1);
    }
  }
  return directions;
}
