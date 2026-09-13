#!/usr/bin/env node
// Перелинковка. Автономному контуру она нужна не «для красоты»: 200 статей в
// месяц без автоматических связей превращаются в 200 сирот, на которые никто
// не ссылается и по которым не ходит ни читатель, ни краулер.
//
//   node scripts/interlink.mjs graph [--json]     # состояние графа, сироты
//   node scripts/interlink.mjs plan [--slug s]    # что предлагается вставить
//   node scripts/interlink.mjs apply [--slug s] [--dry]
//
// Правила вставки (все — из config.interlink):
//   • не трогаем frontmatter, заголовки, код и то, что уже внутри ссылки;
//   • не больше одной новой ссылки на абзац;
//   • не больше maxOutbound исходящих на статью;
//   • взаимные ссылки штрафуются — «ты мне, я тебе» не наращивает связность;
//   • якорь — точное вхождение фразы в тексте, никаких «читайте также здесь».
import path from 'node:path';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { loadArticles, writeArticle, writeJson, today, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { tokenize, weightedCoverage, buildIdf } from './lib/text.mjs';
import { extractInternalLinks } from './lib/links.mjs';

const cfg = loadConfig();
const L = cfg.interlink;

/** Граф внутренних ссылок между статьями блога. */
export function buildLinkGraph(articles = loadArticles()) {
  const outbound = new Map();
  const inbound = new Map();
  for (const a of articles) {
    outbound.set(a.slug, new Set());
    if (!inbound.has(a.slug)) inbound.set(a.slug, new Set());
  }
  for (const a of articles) {
    // Общий парсер форм ссылок (AP-P1-07): query/hash, encoding и trailing
    // slash не создают «битую» или «невидимую» для графа ссылку.
    for (const target of extractInternalLinks(a.body)) {
      if (target === a.slug) continue;
      outbound.get(a.slug).add(target);
      if (!inbound.has(target)) inbound.set(target, new Set());
      inbound.get(target).add(a.slug);
    }
  }
  return { outbound, inbound, articles };
}

/**
 * Разметка тела на зоны. Вставлять ссылку можно только в «обычный» текст:
 * внутри кода она сломает пример, в заголовке испортит оглавление и якоря,
 * внутри существующей ссылки даст вложенную разметку, которую markdown не
 * разбирает. Какие зоны защищены — решает config.interlink.protectedZones
 * (AP-P1-05): значение ключа действительно управляет поведением, а не
 * дублирует захардкоженный список.
 */
function editableSpans(body, zones) {
  const lines = body.split('\n');
  const spans = [];
  let offset = 0;
  let inFence = false;
  let inComponent = false; // многострочный JSX/HTML-блок или компонент

  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;
    const trimmed = line.trim();

    // Внутри многострочного компонента — не трогаем ничего до закрытия тега.
    if (inComponent) {
      if (trimmed.includes('</') || /\/?>$/.test(trimmed)) inComponent = false;
      continue;
    }
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence && zones.has('code')) continue;
    if (trimmed === '') continue;
    if (zones.has('heading') && /^#{1,6}\s/.test(trimmed)) continue;
    if (/^(import|export)\s/.test(trimmed)) continue; // MDX-обвязка
    if (/^<[A-Za-z]/.test(trimmed)) {
      // Открывающий тег без закрытия на этой же строке — блок до закрывающего.
      if (!trimmed.includes('</') && !/\/?>$/.test(trimmed)) inComponent = true;
      continue;
    }
    // MDX-выражение в фигурных скобках, цитата/callout и элемент списка:
    // вставка ссылки внутрь ломает разметку или читается как часть цитаты.
    if (/^\{/.test(trimmed)) continue;
    if (trimmed.startsWith('>')) continue;
    if (/^([-*+]|\d+\.)\s/.test(trimmed)) continue;
    // Таблицы не трогаем: markdown-разметка ячеек хрупкая, а выигрыш от
    // ссылки внутри таблицы минимальный.
    if (/^\|/.test(trimmed)) continue;
    if (trimmed.length < 60) continue; // слишком короткая строка — подпись, пункт списка-однострочник

    spans.push({ start, end: start + line.length, text: line });
  }
  return spans;
}

/** Позиции, уже занятые ссылками, — в них якорь искать нельзя. */
function linkedRanges(line) {
  const ranges = [];
  for (const m of line.matchAll(/\[[^\]]*\]\([^)]*\)/g)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  for (const m of line.matchAll(/https?:\/\/\S+/g)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

/** Инлайн-код защищён всегда: якорь внутри `` `` `` сломал бы пример. */
function codeRanges(line) {
  return [...line.matchAll(/`[^`]*`/g)].map((m) => [m.index, m.index + m[0].length]);
}

const overlaps = (ranges, from, to) => ranges.some(([s, e]) => from < e && to > s);

/**
 * Кандидаты в якоря для целевой статьи.
 *
 * Теги в якоря не берём, а одиночные общие слова отсеиваем по IDF: якорь
 * «маркировка» встречается в половине корпуса и ведёт читателя куда попало —
 * ссылка получается формально валидной и бесполезной. Якорь должен опознавать
 * конкретно ту статью, на которую ведёт, поэтому либо это фраза из двух и
 * более слов, либо одно, но редкое слово («ЕГАИС», «поэкземплярный»).
 */
function anchorsFor(article, model) {
  const fromTitle = article.title
    .split(/[:—–|]/)[0]
    .replace(/["«»]/g, '')
    .trim();
  const candidates = [...article.keywords, fromTitle]
    .map((s) => String(s).trim())
    .filter((s) => s.length >= L.anchorMinLength && s.split(/\s+/).length <= 6);

  return [...new Set(candidates)]
    .filter((anchor) => {
      const tokens = [...tokenize(anchor)];
      if (tokens.length === 0) return false;
      const weight = tokens.reduce((sum, t) => sum + (model.idf.get(t) ?? model.fallback), 0);
      if (tokens.length === 1) return weight >= L.rareAnchorIdf;
      return weight >= L.minAnchorIdf;
    })
    .sort((a, b) => b.length - a.length);
}

function findAnchor(spans, anchors, lineCounts, zones) {
  for (const anchor of anchors) {
    const needle = anchor.toLowerCase();
    for (const span of spans) {
      // Не больше maxLinksPerParagraph новых ссылок на абзац/строку (AP-P1-05):
      // иначе движок мог обвесить одну строку пачкой ссылок.
      if ((lineCounts.get(span.start) || 0) >= L.maxLinksPerParagraph) continue;
      const hay = span.text.toLowerCase();
      const at = hay.indexOf(needle);
      if (at === -1) continue;
      // Границы слова: «касса» не должна цеплять «кассационный».
      const before = hay[at - 1] || ' ';
      const after = hay[at + needle.length] || ' ';
      if (/[а-яёa-z0-9]/i.test(before) || /[а-яёa-z0-9]/i.test(after)) continue;
      if (overlaps(codeRanges(span.text), at, at + needle.length)) continue;
      if (zones.has('existingLink') && overlaps(linkedRanges(span.text), at, at + needle.length)) continue;
      return { span, at, length: needle.length, anchor: span.text.slice(at, at + needle.length) };
    }
  }
  return null;
}

/**
 * План перелинковки: какие ссылки и куда вставить.
 * Приоритет отдаётся статьям-сиротам — тем, у кого меньше всего входящих.
 * Это единственный способ выравнять граф: если раздавать ссылки «по
 * релевантности», их всегда получают одни и те же флагманы.
 */
export function planLinks({ slug = null } = {}) {
  assertContentRoot(cfg);
  const articles = loadArticles({ includeDrafts: false });
  const graph = buildLinkGraph(articles);
  const model = buildIdf(articles.map((a) => [a.title, ...a.keywords, ...a.tags].join(' ')));

  const prepared = articles.map((a) => ({
    ...a,
    tokens: tokenize([a.title, ...a.keywords, ...a.tags].join(' ')),
    bodyTokens: tokenize(a.body.slice(0, 12000)),
  }));
  const bySlug = new Map(prepared.map((a) => [a.slug, a]));

  const inboundNeed = new Map(
    prepared.map((a) => [a.slug, Math.max(0, L.minInbound - (graph.inbound.get(a.slug)?.size || 0))]),
  );

  const plan = [];
  const sources = slug ? prepared.filter((a) => a.slug === slug) : prepared;
  const zones = new Set(L.protectedZones || []);

  for (const source of sources) {
    const already = graph.outbound.get(source.slug) || new Set();
    let budget = Math.max(0, L.maxOutbound - already.size);
    if (budget === 0) continue;

    const spans = editableSpans(source.body, zones);
    if (!spans.length) continue;
    const lineCounts = new Map();

    const targets = prepared
      .filter((t) => t.slug !== source.slug && !already.has(t.slug))
      .map((t) => {
        // Релевантность: насколько тема цели покрыта содержанием источника.
        const relevance = weightedCoverage(t.tokens, source.bodyTokens, model);
        const need = inboundNeed.get(t.slug) || 0;
        const reciprocal = (graph.outbound.get(t.slug) || new Set()).has(source.slug);
        const penalty = reciprocal && L.reciprocalPenalty ? 0.5 : 1;
        return { target: t, relevance, need, weight: (relevance + need * 0.25) * penalty };
      })
      .filter((c) => c.relevance >= L.minRelevance)
      .sort((a, b) => b.weight - a.weight);

    const additions = [];
    for (const candidate of targets) {
      if (budget === 0) break;
      if ((inboundGiven.get(candidate.target.slug) || 0) >= L.maxInboundPerRun) continue;
      const hit = findAnchor(spans, anchorsFor(candidate.target, model), lineCounts, zones);
      if (!hit) continue;

      lineCounts.set(hit.span.start, (lineCounts.get(hit.span.start) || 0) + 1);
      budget--;
      inboundGiven.set(candidate.target.slug, (inboundGiven.get(candidate.target.slug) || 0) + 1);
      inboundNeed.set(candidate.target.slug, Math.max(0, (inboundNeed.get(candidate.target.slug) || 0) - 1));
      additions.push({
        target: candidate.target.slug,
        anchor: hit.anchor,
        relevance: Math.round(candidate.relevance * 100) / 100,
        offset: hit.span.start + hit.at,
        length: hit.length,
        line: hit.span.text.trim().slice(0, 100),
      });
    }

    if (additions.length) {
      plan.push({
        slug: source.slug,
        outboundBefore: already.size,
        additions,
      });
    }
  }

  const orphans = prepared
    .map((a) => ({ slug: a.slug, inbound: graph.inbound.get(a.slug)?.size || 0 }))
    .filter((a) => a.inbound < L.minInbound)
    .sort((a, b) => a.inbound - b.inbound);

  return { generatedAt: today(), plan, orphans, bySlug };
}

// Счётчик выданных за прогон входящих: не даёт всем источникам разом
// проставить ссылки на одну и ту же сироту и перекосить граф в другую сторону.
const inboundGiven = new Map();

export function applyLinks({ slug = null, dry = false } = {}) {
  // Dry-run ничего не пишет — блокировка не нужна и не должна мешать диагностике.
  if (dry) return applyLinksInner({ slug, dry });
  acquireLock({ cmd: 'interlink-apply' });
  try {
    return applyLinksInner({ slug, dry });
  } finally {
    releaseLock();
  }
}

function applyLinksInner({ slug = null, dry = false } = {}) {
  inboundGiven.clear();
  const { plan, orphans, bySlug } = planLinks({ slug });
  const orphansBefore = orphans.length;
  let inserted = 0;
  // Тела после вставок: нужны, чтобы посчитать граф заново, а не выдавать
  // «сирот осталось» по графу до правок (AP-P1-06).
  const changed = new Map();

  for (const entry of plan) {
    const article = bySlug.get(entry.slug);
    // С конца, чтобы вставки не сдвигали offset ещё не применённых правок.
    const sorted = [...entry.additions].sort((a, b) => b.offset - a.offset);
    let body = article.body;
    for (const add of sorted) {
      const anchorText = body.slice(add.offset, add.offset + add.length);
      if (anchorText.toLowerCase() !== add.anchor.toLowerCase()) continue; // тело изменилось — пропускаем
      body = `${body.slice(0, add.offset)}[${anchorText}](/blog/${add.target}/)${body.slice(add.offset + add.length)}`;
      inserted++;
    }
    if (body !== article.body) {
      changed.set(article.slug, body);
      if (!dry) writeArticle(article, { body });
    }
  }

  // Пересчёт графа по телам после вставок. Для dry-run это предварительная
  // оценка: файлы не тронуты, но эффект правок виден до их применения.
  const afterArticles = [...bySlug.values()].map((a) => ({ slug: a.slug, body: changed.get(a.slug) ?? a.body }));
  const afterGraph = buildLinkGraph(afterArticles);
  const orphansAfter = afterArticles.filter(
    (a) => (afterGraph.inbound.get(a.slug)?.size || 0) < L.minInbound,
  ).length;

  const report = { generatedAt: today(), dry, inserted, touched: plan.length, orphansBefore, orphansAfter };
  if (!dry) writeJson(path.join(cfg.resolved.dataDir, 'interlink-report.json'), { ...report, plan });
  return { ...report, plan };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (cmd === 'graph') {
    const articles = loadArticles({ includeDrafts: false });
    const graph = buildLinkGraph(articles);
    const rows = articles.map((a) => ({
      slug: a.slug,
      out: graph.outbound.get(a.slug).size,
      in: graph.inbound.get(a.slug)?.size || 0,
      exempt: a.interlinkExempt,
    }));
    const orphans = rows.filter((r) => r.in < L.minInbound);
    const deadEnds = rows.filter((r) => r.out < L.minOutbound);
    // Статьи выше потолка исходящих. Движок сам столько не поставит — это
    // наследство: гейты по старым статьям никогда не гоняли, и норма 3–8
    // для них не проверялась ни разу.
    const overLinked = rows.filter((r) => r.out > L.maxOutbound && !r.exempt);
    if (args.json) {
      console.log(JSON.stringify({ rows, orphans, deadEnds, overLinked }, null, 2));
      return;
    }
    const totalLinks = rows.reduce((s, r) => s + r.out, 0);
    console.log(`Статей ${rows.length}, внутренних ссылок ${totalLinks}, в среднем ${(totalLinks / rows.length).toFixed(1)} исходящих.`);
    console.log(`Сирот (входящих < ${L.minInbound}): ${orphans.length}`);
    console.log(`Тупиков (исходящих < ${L.minOutbound}): ${deadEnds.length}`);
    console.log(`Перелинкованных (исходящих > ${L.maxOutbound}): ${overLinked.length}`);
    for (const r of overLinked.slice(0, 10)) console.log(`   out=${r.out}  ${r.slug}`);
    for (const r of orphans.slice(0, 15)) console.log(`   in=${r.in} out=${r.out}  ${r.slug}`);
    return;
  }

  if (cmd === 'plan') {
    inboundGiven.clear();
    const { plan, orphans } = planLinks({ slug: args.slug || null });
    if (args.json) {
      console.log(JSON.stringify({ plan, orphans }, null, 2));
      return;
    }
    const total = plan.reduce((s, p) => s + p.additions.length, 0);
    console.log(`К вставке ${total} ссылок в ${plan.length} статьях; сирот ${orphans.length}.`);
    for (const entry of plan.slice(0, 10)) {
      console.log(`\n${entry.slug} (+${entry.additions.length})`);
      for (const a of entry.additions) console.log(`   «${a.anchor}» → ${a.target}  rel=${a.relevance}`);
    }
    return;
  }

  if (cmd === 'apply') {
    const result = applyLinks({ slug: args.slug || null, dry: args.dry !== undefined });
    if (args.json) {
      const { plan, ...summary } = result;
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    console.log(
      `${result.dry ? '[dry] ' : ''}Вставлено ссылок: ${result.inserted} в ${result.touched} статьях. ` +
        `Сирот было ${result.orphansBefore}, стало ${result.orphansAfter}`,
    );
    return;
  }

  console.log('Использование: interlink.mjs graph|plan|apply [--slug s] [--dry] [--json]');
  process.exit(1);
}

if (isMain(import.meta.url)) main();
