#!/usr/bin/env node
// Учёт дублей. В автономном контуре это не отчёт «посмотрите глазами», а
// решающий гейт: тема с вердиктом block не попадает в план вообще, и никто
// не придёт руками её разрешить.
//
//   node scripts/dedupe.mjs check --title "..." [--keywords "a,b"] [--json]
//   node scripts/dedupe.mjs scan            # весь корпус на взаимные дубли
//   node scripts/dedupe.mjs index           # пересобрать data/dedupe-index.json
//
// Три независимых сигнала, каждый ловит свой класс дублей:
//   1. canonical  — совпадение отсортированных стемов заголовка (перестановки);
//   2. jaccard    — пересечение токенов заголовка (переформулировки);
//   3. keywords   — покрытие целевых запросов (каннибализация выдачи);
//   4. shingles   — совпадение тел (для scan, при проверке темы тела ещё нет).
import path from 'node:path';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { loadArticles, writeJson, readJson, today, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { buildLinkGraph } from './interlink.mjs';
import { runGates } from './gates.mjs';
import {
  canonicalKey,
  tokenize,
  weightedJaccard,
  weightedCoverage,
  coverage,
  buildIdf,
  shingles,
} from './lib/text.mjs';

const cfg = loadConfig();
const D = cfg.dedupe;

/** Индекс корпуса: то, с чем сравнивается любая новая тема. */
export function buildIndex() {
  assertContentRoot(cfg);
  const articles = loadArticles();
  const planned = readJson(path.join(cfg.resolved.dataDir, 'backlog.json'), { topics: [] }).topics;

  const entries = [
    ...articles.map((a) => ({
      kind: 'article',
      slug: a.slug,
      title: a.title,
      keywords: a.keywords,
      draft: a.draft,
    })),
    ...planned
      .filter((t) => t.status && !['dropped', 'released'].includes(t.status))
      .map((t) => ({ kind: 'planned', slug: t.slug, title: t.title, keywords: t.keywords || [] })),
  ];

  const model = buildIdf(entries.map((e) => [e.title, ...(e.keywords || [])].join(' ')));
  const prepared = entries.map((e) => ({
    ...e,
    canonical: canonicalKey(e.title),
    titleTokens: tokenize(e.title),
    keywordTokens: tokenize((e.keywords || []).join(' ')),
    allTokens: tokenize([e.title, ...(e.keywords || [])].join(' ')),
  }));
  prepared.idf = model;
  return prepared;
}

/**
 * Вердикт по одной теме: block | warn | ok.
 * block — тема отбрасывается, warn — принимается, но с обязательным сужением
 * угла и ссылкой на найденный материал (это же попадает в бриф автору).
 */
export function checkTopic({ title, keywords = [] }, index = buildIndex()) {
  const canonical = canonicalKey(title);
  const titleTokens = tokenize(title);
  const keywordTokens = tokenize(keywords.join(' '));
  const allTokens = tokenize([title, ...keywords].join(' '));

  const hits = [];
  for (const entry of index) {
    if (entry.title === title) {
      hits.push({ ...bare(entry), reason: 'exact-title', score: 1, verdict: 'block' });
      continue;
    }
    if (D.canonicalExact && canonical && entry.canonical === canonical) {
      hits.push({ ...bare(entry), reason: 'canonical', score: 1, verdict: 'block' });
      continue;
    }
    const titleScore = weightedJaccard(titleTokens, entry.titleTokens, index.idf);
    const containment = weightedCoverage(allTokens, entry.allTokens, index.idf);
    // Отдельный сигнал по целевым запросам: заголовки могут разойтись
    // формулировкой, а бороться за выдачу статьи всё равно будут между собой.
    const kwScore =
      keywordTokens.size && entry.keywordTokens.size
        ? coverage(keywordTokens, entry.keywordTokens)
        : 0;

    if (kwScore >= D.keywordOverlapBlock) {
      hits.push({
        ...bare(entry),
        reason: 'keyword-cannibalization',
        score: round(kwScore),
        verdict: 'block',
      });
    } else if (containment >= D.containmentBlock) {
      hits.push({ ...bare(entry), reason: 'containment', score: round(containment), verdict: 'block' });
    } else if (titleScore >= D.titleJaccardBlock) {
      hits.push({ ...bare(entry), reason: 'title-similarity', score: round(titleScore), verdict: 'block' });
    } else if (containment >= D.containmentWarn || titleScore >= D.titleJaccardWarn) {
      hits.push({
        ...bare(entry),
        reason: containment >= D.containmentWarn ? 'containment-partial' : 'title-overlap',
        score: round(Math.max(containment, titleScore)),
        verdict: 'warn',
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const verdict = hits.some((h) => h.verdict === 'block')
    ? 'block'
    : hits.length
      ? 'warn'
      : 'ok';

  return {
    title,
    canonical,
    verdict,
    hits: hits.slice(0, 8),
    // Что делать автору, если warn: сузить угол и сослаться на соседа.
    advice:
      verdict === 'warn'
        ? `Сузить угол: пересечение с «${hits[0].title}». Обязательна ссылка на /blog/${hits[0].slug}/ и разведение целевых запросов.`
        : verdict === 'block'
          ? `Тема отклонена: дубль «${hits[0].title}» (${hits[0].reason}). Вместо новой статьи — кандидат на рерайт ${hits[0].slug}.`
          : '',
  };
}

const bare = (e) => ({ kind: e.kind, slug: e.slug, title: e.title });
const round = (n) => Math.round(n * 100) / 100;

/** Жаккар по множествам шинглов — веса тут не нужны, элементы уже редкие. */
function shingleJaccard(a, b) {
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Взаимные дубли уже опубликованного корпуса — вход для очереди рерайтов. */
function scanCorpus() {
  assertContentRoot(cfg);
  const articles = loadArticles();
  const model = buildIdf(articles.map((a) => [a.title, ...a.keywords].join(' ')));
  const prepared = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    titleTokens: tokenize(a.title),
    allTokens: tokenize([a.title, ...a.keywords].join(' ')),
    canonical: canonicalKey(a.title),
    shingles: shingles(a.body, D.shingleSize),
  }));

  const pairs = [];
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i];
      const b = prepared[j];
      const titleScore = weightedJaccard(a.titleTokens, b.titleTokens, model);
      const containment = Math.max(
        weightedCoverage(a.allTokens, b.allTokens, model),
        weightedCoverage(b.allTokens, a.allTokens, model),
      );
      const bodyScore = shingleJaccard(a.shingles, b.shingles);
      if (containment < D.containmentWarn && titleScore < D.titleJaccardWarn && bodyScore < D.bodyShingleBlock) {
        continue;
      }

      pairs.push({
        a: a.slug,
        b: b.slug,
        title: round(titleScore),
        containment: round(containment),
        body: round(bodyScore),
        verdict:
          bodyScore >= D.bodyShingleBlock ||
          containment >= D.containmentBlock ||
          titleScore >= D.titleJaccardBlock
            ? 'merge'
            : 'watch',
      });
    }
  }
  pairs.sort((x, y) => Math.max(y.title, y.body, y.containment) - Math.max(x.title, x.body, x.containment));

  // AP-P1-10: merge-пара должна быть объяснимой и исполнимой, а не словом
  // «merge». Для каждой пары считаем сильную и слабую статью по измеримым
  // данным (gate-балл, входящие ссылки, объём), сохраняем рекомендуемый угол
  // слабой и статус разведения. Дорогие проверки — только для merge.
  const merges = pairs.filter((p) => p.verdict === 'merge');
  if (merges.length) {
    const bySlug = new Map(articles.map((a) => [a.slug, a]));
    const graph = buildLinkGraph(articles);
    const known = new Set(articles.map((a) => a.slug));
    const measure = new Map();
    const measureOf = (slug) => {
      if (measure.has(slug)) return measure.get(slug);
      const article = bySlug.get(slug);
      const row = {
        gate: article ? runGates({ file: article.path, knownSlugs: known }).score : null,
        inbound: graph.inbound.get(slug)?.size || 0,
        chars: article?.chars || 0,
        keywords: article ? article.keywords : [],
        tokens: article ? tokenize([article.title, ...article.keywords].join(' ')) : new Set(),
      };
      measure.set(slug, row);
      return row;
    };
    for (const pair of merges) {
      const a = measureOf(pair.a);
      const b = measureOf(pair.b);
      const better = (x, y) => {
        if (x.gate !== y.gate) return (x.gate ?? -1) - (y.gate ?? -1);
        if (x.inbound !== y.inbound) return x.inbound - y.inbound;
        return x.chars - y.chars;
      };
      const keepA = better(a, b) >= 0;
      pair.keep = keepA ? pair.a : pair.b;
      pair.rewrite = keepA ? pair.b : pair.a;
      pair.gateScore = { [pair.a]: a.gate, [pair.b]: b.gate };
      pair.inbound = { [pair.a]: a.inbound, [pair.b]: b.inbound };
      pair.reason =
        `body ${pair.body}, containment ${pair.containment}, title ${pair.title}; ` +
        `gate ${a.gate}/${b.gate}, входящих ${a.inbound}/${b.inbound}, символов ${a.chars}/${b.chars}`;
      const weak = keepA ? b : a;
      const strong = keepA ? a : b;
      const angleTokens = [...weak.tokens].filter((t) => !strong.tokens.has(t)).slice(0, 6);
      pair.weakAngle = angleTokens;
      pair.remediation = 'pending';
    }
  }
  return pairs;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (cmd === 'check') {
    const result = checkTopic({
      title: args.title || '',
      keywords: (args.keywords || '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`${verdictIcon(result.verdict)} ${result.verdict.toUpperCase()} — ${result.title}`);
      for (const h of result.hits) console.log(`   ${h.score} ${h.reason} → ${h.slug} (${h.kind})`);
      if (result.advice) console.log(`   ${result.advice}`);
    }
    process.exit(result.verdict === 'block' ? 3 : 0);
  }

  if (cmd === 'scan') {
    // Мутирующая команда (пишет dupes.json) — под единым lock (AP-P0-09).
    // Освобождение до вывода и exit: process.exit внутри try пропустил бы finally.
    acquireLock({ cmd: 'dedupe-scan' });
    let pairs;
    try {
      pairs = scanCorpus();
      writeJson(path.join(cfg.resolved.dataDir, 'dupes.json'), { generatedAt: today(), pairs });
    } finally {
      releaseLock();
    }
    const merge = pairs.filter((p) => p.verdict === 'merge');
    console.log(`Пар с пересечением: ${pairs.length}, из них на склейку/рерайт: ${merge.length}`);
    for (const p of merge.slice(0, 20)) {
      // AP-P1-10: решение объяснимо — видно, кто сильнее, кто идёт в рерайт,
      // и какие различающие токены стоит вынести в новый угол.
      console.log(
        `   merge  t=${p.title} c=${p.containment} body=${p.body}  ${p.a} ↔ ${p.b}` +
          (p.keep ? `  strong=${p.keep} rewrite=${p.rewrite} [${p.remediation}]` : ''),
      );
      if (p.reason) console.log(`      ${p.reason}`);
      if (p.weakAngle?.length) console.log(`      угол слабой: ${p.weakAngle.join(', ')}`);
    }
    process.exit(0);
  }

  if (cmd === 'index') {
    acquireLock({ cmd: 'dedupe-index' });
    let index;
    try {
      index = buildIndex();
      writeJson(path.join(cfg.resolved.dataDir, 'dedupe-index.json'), {
        generatedAt: today(),
        size: index.length,
        entries: index.map(({ tokens, titleTokens, keywordTokens, ...rest }) => rest),
      });
    } finally {
      releaseLock();
    }
    console.log(`Индекс дублей пересобран: ${index.length} записей.`);
    process.exit(0);
  }

  console.log('Использование: dedupe.mjs check --title "..." [--keywords a,b] | scan | index');
  process.exit(1);
}

function verdictIcon(v) {
  return v === 'block' ? '✖' : v === 'warn' ? '▲' : '✔';
}

if (isMain(import.meta.url)) main();

