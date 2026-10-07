#!/usr/bin/env node
import { publishedRewriteTargets } from './lib/queued-rewrite.mjs';
import { checkHeroAssets } from './lib/hero-assets.mjs';
// Гейты качества. Это замена редактора-человека, а не «дополнительная
// проверка»: если гейт пропустил текст — текст выйдет в публикацию без
// чьего-либо взгляда. Поэтому проверки жёсткие, а любой сомнительный случай
// трактуется в пользу отказа: непройденный гейт стоит одной статьи, плохая
// статья в выдаче — доверия ко всему домену.
//
//   node scripts/gates.mjs check --file path/to/article.md [--json]
//   node scripts/gates.mjs check --slug 2026-08-10-...
//
// Код выхода: 0 — прошло, 1 — ошибка запуска, 2 — не прошло.
import path from 'node:path';
import { activeFactCorrections } from './lib/fact-corrections.mjs';
import { checkClaimEvidence, bindMetadataSources } from './lib/claim-evidence.mjs';
import { observedSourceChanges } from './lib/fact-freshness.mjs';
import { readJson } from './lib/content.mjs';
import { runSiteQuality } from './lib/site.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { parseFrontmatter, loadArticles, isMain, parseArgs } from './lib/content.mjs';
import { tokenize, shingles, buildIdf, weightedCoverage } from './lib/text.mjs';
import { readSourceEvidence, sourceLinks, auditSourceUrl } from './lib/sources.mjs';
import { envelope, EXIT } from './lib/outcome.mjs';
import { extractInternalLinks, unpublishedSlugs } from './lib/links.mjs';
import { parseIsoDate, isFutureIso, isPastIso } from './lib/dates.mjs';
import { buildLinkGraph } from './interlink.mjs';

import { extractClaims, articleClaimText } from './lib/critical-claims.mjs';

const cfg = loadConfig();
const G = cfg.gates;

// Обороты, по которым текст читается как машинный. Список закрытый и
// намеренно короткий: ловим не «плохой стиль вообще», а конкретные штампы,
// которые модель воспроизводит чаще человека.
const AI_MARKERS = [
  'в современном мире', 'в наше время', 'играет важную роль', 'является ключевым',
  'стоит отметить', 'важно отметить', 'следует отметить', 'необходимо отметить',
  'таким образом', 'в заключение', 'подводя итог', 'в целом можно сказать',
  'не стоит забывать', 'широкий спектр', 'ряд преимуществ', 'динамично развивается',
  'на сегодняшний день', 'в конечном итоге', 'позволяет значительно',
  'мир бизнеса', 'давайте разберёмся', 'давайте разберемся', 'погрузимся в',
];

// One detector feeds acceptance, source monitoring and the published-corpus audit.
export function extractCriticalClaims(input, sourceEvidence = null, { evidence, now = new Date(), maxAgeDays = G.sourceMaxAgeDays ?? 180 } = {}) {
  if (evidence === undefined && input?.slug) evidence = readJson(path.join(cfg.resolved.dataDir, 'claim-evidence', input.slug + '.json'), null);
  return bindMetadataSources({ claims: extractClaims(input, sourceEvidence, { maxAgeDays }), evidence, now, maxAgeDays });
}


export function runGates({ file, source, requiredPubDate = null, knownSlugs = null, sourceEvidence = null, siteQuality = runSiteQuality, claimEvidence = undefined, claimVerifier = checkClaimEvidence, assetVerifier = checkHeroAssets, correctionEvidence = undefined }) {
  const raw = source ?? readFileSync(file, 'utf8');
  const { data, body, raw: fm } = parseFrontmatter(raw);
  const checks = [];
  const add = (id, ok, weight, detail) => checks.push({ id, ok, weight, detail });

  const correctionSlug = file ? path.basename(file).replace(/\.mdx?$/, '') : String(data.slug || '');
  const unresolvedCorrections = activeFactCorrections({ slug: correctionSlug, body: articleClaimText({ body, fm }), evidence: correctionEvidence ?? (correctionSlug ? readJson(path.join(cfg.resolved.dataDir, 'fact-corrections', correctionSlug + '.json'), null) : null), maxAgeDays: G.sourceMaxAgeDays ?? 180 });
  add('fact-corrections', unresolvedCorrections.length === 0, 0, unresolvedCorrections.length ? unresolvedCorrections.map(c => c.rationale).join('; ') : 'подтверждённых неисправленных ошибок нет');

  // 1. Frontmatter: без него статья не соберётся у принимающего проекта.
  const required = ['title', 'description', 'pubDate'];
  const missing = required.filter((k) => !data[k]);
  add('frontmatter', missing.length === 0, 15, missing.length ? `нет полей: ${missing.join(', ')}` : 'все обязательные поля на месте');

  if (G.requireHeroImage === true) {
    const assets = assetVerifier({ data, contentRoot: cfg.resolved.contentRoot });
    add('hero-assets', assets.ok, 0, assets.detail);
  }

  const descLength = String(data.description || '').length;
  add('description', descLength >= 100 && descLength <= 200, 5, `длина description ${descLength} (нужно 100–200)`);

  // 1b. Даты (AP-P1-03): формат, реальная календарная дата, будущий pubDate.
  // `2026-02-30` не должен «съезжать» на март и молча проходить дальше.
  const dateProblems = [];
  let dateOk = true;
  if (requiredPubDate !== null && (!parseIsoDate(requiredPubDate).ok || String(data.pubDate) !== requiredPubDate)) {
    dateOk = false;
    dateProblems.push(`pubDate нового материала должен совпадать с датой прохода: ${requiredPubDate}`);
  }
  let reviewOverdue = false;
  if ('pubDate' in data && data.pubDate !== '' && data.pubDate !== null && data.pubDate !== undefined) {
    const pub = parseIsoDate(data.pubDate);
    if (!pub.ok) {
      dateOk = false;
      dateProblems.push(`pubDate: ${pub.reason}`);
    } else if (data.draft !== true && isFutureIso(data.pubDate)) {
      // У черновика будущий pubDate — это расписание публикации, а не ошибка.
      // У опубликованной статьи будущая дата означает, что её никто не должен
      // видеть, — это противоречие.
      dateOk = false;
      dateProblems.push(`pubDate в будущем у не-черновика: ${pub.iso}`);
    }
  }
  for (const key of ['updatedDate', 'reviewDate']) {
    const value = data[key];
    if (value === undefined || value === null || value === '') continue;
    const parsed = parseIsoDate(value);
    if (!parsed.ok) {
      dateOk = false;
      dateProblems.push(`${key}: ${parsed.reason}`);
    } else if (key === 'reviewDate' && isPastIso(value)) {
      reviewOverdue = true; // просроченный review — сигнал, но не блокер
    }
  }
  add(
    'dates',
    dateOk,
    10,
    dateProblems.length ? dateProblems.join('; ') : `даты корректны${reviewOverdue ? ', reviewDate просрочен (не блокер)' : ''}`,
  );

  // 2. Объём.
  add(
    'length',
    body.length >= G.minChars && body.length <= G.maxChars,
    15,
    `${body.length} симв. (норма ${G.minChars}–${G.maxChars})`,
  );

  // 3. Структура: без H2 текст нечитаем и не попадает в быстрые ответы.
  const h2 = (body.match(/^##\s+/gm) || []).length;
  add('structure', h2 >= 3, 10, `H2-подзаголовков ${h2} (нужно ≥3)`);

  // 4. AI-маркеры.
  const found = AI_MARKERS.filter((m) => body.toLowerCase().includes(m));
  const density = (found.length / (body.length / 1000)) * 10;
  add(
    'ai-markers',
    density <= G.maxAiMarkerDensity,
    15,
    found.length ? `штампы (${found.length}): ${found.slice(0, 5).join(', ')}` : 'штампов не найдено',
  );

  // 5. Проверяемость фактов.
  //
  // Сравнивать общее число утверждений и ссылок по всей статье нельзя: одна
  // случайная ссылка формально «подтверждала» любые несвязанные даты и штрафы
  // (AP-P0-24). Теперь каждое утверждение считается покрытым, только если
  // первоисточник стоит в том же предложении; для plain metadata требуется
  // отдельная точная сверка поля с целым снимком. Формируется манифест claims —
  // его можно сохранять и перепроверять отдельным сетевым этапом.
  let evidence = claimEvidence;
  let evidenceError = null;
  if (evidence === undefined && file) {
    try { evidence = readJson(path.join(cfg.resolved.dataDir, 'claim-evidence', path.basename(file).replace(/\.mdx?$/, '') + '.json'), null); }
    catch (e) { evidenceError = e.message; }
  }
  const claims = extractCriticalClaims({ body, fm }, sourceEvidence, { evidence });
  const uncovered = claims.filter((c) => !c.covered);
  const sources = sourceLinks(articleClaimText({ body, fm })).filter(url => auditSourceUrl(url).ok).length;
  add(
    'sources',
    !G.requireFactcheck || claims.length === 0 || uncovered.length === 0,
    20,
    `утверждений с датами/штрафами/НПА: ${claims.length}, без пригодной привязки первоисточника: ${uncovered.length}, ссылок на первоисточники: ${sources}` +
      (uncovered.length ? ` (напр. «${uncovered[0].text}»: ${uncovered[0].reason})` : ''),
  );

  if (G.requireClaimEvidence) {
    let error = evidenceError;
    let observations = {};
    try { observations = readJson(path.join(cfg.resolved.dataDir, 'source-observations.json'), { byUrl: {} }).byUrl; }
    catch (e) { error = e.message; }
    const verdict = claimVerifier({ claims, evidence, maxAgeDays: G.sourceMaxAgeDays });
    const observed = observedSourceChanges({ claims, evidence, observations, observationMaxAgeDays: cfg.rewrite.sourceObservationMaxAgeDays ?? 7 });
    const problems = [...verdict.problems.map(p => `${p.text}: ${p.reason}`), ...observed.reasons];
    add('claim-evidence', !error && verdict.ok && !observed.reasons.length, 0, error || (problems.length ? problems.join('; ') : 'сверка утверждений сохранена'));
  }

  // 6. Перелинковка: изолированная статья не работает ни на читателя, ни на
  //    краулер, и в автономном режиме её некому «потом дообвязать».
  //    Формы ссылок разбирает общий с interlink парсер (AP-P1-07).
  const selfSlug = file ? path.basename(file).replace(/\.mdx?$/, '') : null;
  const outbound = extractInternalLinks(body);
  if (selfSlug) outbound.delete(selfSlug);
  const interlinkExempt = data.interlinkExempt === true;
  add(
    'interlink',
    outbound.size >= cfg.interlink.minOutbound &&
      (interlinkExempt || outbound.size <= cfg.interlink.maxOutbound),
    10,
    `исходящих внутренних ссылок ${outbound.size} (норма ${cfg.interlink.minOutbound}–${cfg.interlink.maxOutbound})`,
  );

  // 7. Битые внутренние ссылки — только на существующие статьи корпуса.
  // Fail-closed: любое исключение при чтении корпуса — это отказ проверки,
  // а не «пропуск». Иначе гейт проходит без проверки ссылок и пропускает
  // текст, который никто не проверил (AP-P0-06).
  let brokenDetail = 'внутренние ссылки ведут на существующие материалы';
  let brokenOk = true;
  try {
    // Отсутствующий каталог loadArticles() молча превращает в пустой список:
    // тогда статья без исходящих ссылок прошла бы links-valid «за счёт»
    // отсутствия корпуса. Проверяем наличие каталога явно (только для
    // реального корпуса; в тестах со своим knownSlugs проверка не нужна).
    if (knownSlugs === null && !existsSync(cfg.resolved.blog)) {
      throw new Error(`нет каталога корпуса: ${cfg.resolved.blog}`);
    }
    let known;
    if (knownSlugs) {
      known = new Set(knownSlugs);
    } else {
      // Черновики и удержанные статьи не считаются существующей целью:
      // ссылка на них не откроется читателю (AP-P1-07).
      const articles = loadArticles();
      known = new Set(articles.map((a) => a.slug));
      for (const slug of unpublishedSlugs(articles)) known.delete(slug);
      for (const slug of publishedRewriteTargets({dataDir:cfg.resolved.dataDir,articles})) known.add(slug);
    }
    const broken = [...outbound].filter((slug) => !known.has(slug));
    brokenOk = broken.length === 0;
    if (!brokenOk) brokenDetail = `битые ссылки: ${broken.join(', ')}`;
  } catch (error) {
    brokenOk = false;
    brokenDetail = `корпус недоступен, проверка не пройдена: ${error.message}`;
  }
  add('links-valid', brokenOk, 10, brokenDetail);

  if (cfg.security?.qualityCheck) {
    const site = siteQuality({ contentRoot: cfg.resolved.contentRoot, file });
    add('site-quality', site.ok, 0, site.ok ? 'QA сайта пройден' : site.blockers.join('; '));
  }

  const gained = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const score = Math.round((gained / total) * 100);

  // Блокеры — то, что нельзя компенсировать баллами в других проверках.
  const blockers = checks.filter((c) => !c.ok && ['frontmatter', 'length', 'sources', 'links-valid', 'dates', 'site-quality', 'claim-evidence', 'hero-assets', 'fact-corrections'].includes(c.id));

  return {
    file: file || null,
    score,
    passed: score >= G.minScore && blockers.length === 0,
    blockers: blockers.map((b) => b.id),
    claims,
    checks,
  };
}

/** Проверка на дубль уже написанного текста относительно корпуса. */
export function bodyDuplication({ file, source, excludeSlug }) {
  const raw = source ?? readFileSync(file, 'utf8');
  const { data, body, raw: fm } = parseFrontmatter(raw);
  let articles;
  try {
    articles = loadArticles().filter((a) => a.path !== path.resolve(file || '') && a.slug !== excludeSlug);
  } catch (error) {
    // Fail-closed того же класса, что AP-P0-06: нечитаемый корпус — это блок
    // публикации, а не падение CLI с кодом ошибки запуска и не «дублей нет».
    return { slug: null, body: 0, topic: 0, verdict: 'block', detail: `корпус недоступен, проверка не пройдена: ${error.message}` };
  }
  const model = buildIdf(articles.map((a) => [a.title, ...a.keywords].join(' ')));
  const mine = shingles(body, cfg.dedupe.shingleSize);
  const myTokens = tokenize([data.title, ...(data.seo?.keywords || [])].join(' '));

  let worst = { slug: null, body: 0, topic: 0 };
  for (const a of articles) {
    const theirs = shingles(a.body, cfg.dedupe.shingleSize);
    let inter = 0;
    for (const s of mine) if (theirs.has(s)) inter++;
    const union = mine.size + theirs.size - inter;
    const bodyScore = union === 0 ? 0 : inter / union;
    const topicScore = weightedCoverage(myTokens, tokenize([a.title, ...a.keywords].join(' ')), model);
    if (bodyScore > worst.body) worst = { slug: a.slug, body: bodyScore, topic: topicScore };
  }
  return {
    ...worst,
    body: Math.round(worst.body * 100) / 100,
    verdict: worst.body >= cfg.dedupe.bodyShingleBlock ? 'block' : 'ok',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(3));
  const cmd = process.argv[2];
  if (cmd !== 'check') {
    console.log('Использование: gates.mjs check --file <path> | --slug <slug> [--required-pub-date YYYY-MM-DD] [--json]');
    process.exit(1);
  }

  let file = args.file;
  if (!file && args.slug) {
    for (const ext of ['.md', '.mdx']) {
      const candidate = path.join(cfg.resolved.blog, `${args.slug}${ext}`);
      if (existsSync(candidate)) file = candidate;
    }
  }
  if (!file || !existsSync(file)) {
    console.error(`Не найден файл статьи: ${file || args.slug}`);
    process.exit(1);
  }

  const result = runGates({ file, sourceEvidence: readSourceEvidence().entries, requiredPubDate: args['required-pub-date'] ?? null });
  const dupe = bodyDuplication({ file });
  const passed = result.passed && dupe.verdict === 'ok';

  if (args.json) {
    console.log(JSON.stringify(envelope({ ok: passed, category: passed ? 'ok' : 'content_reject', exitCode: passed ? EXIT.ok : EXIT.content_reject, ...result, duplication: dupe, passed }), null, 2));
  } else {
    console.log(`${passed ? '✔ ПРОШЛО' : '✖ НЕ ПРОШЛО'} — ${result.score}/100  ${path.basename(file)}`);
    for (const c of result.checks) console.log(`   ${c.ok ? '✔' : '✖'} ${c.id.padEnd(12)} ${c.detail}`);
    console.log(`   ${dupe.verdict === 'ok' ? '✔' : '✖'} ${'duplication'.padEnd(12)} максимум совпадения тела ${dupe.body}${dupe.slug ? ` с ${dupe.slug}` : ''}${dupe.topic ? ` (совпадение темы ${Math.round(dupe.topic * 100) / 100})` : ''}`);
    if (result.blockers.length) console.log(`   блокеры: ${result.blockers.join(', ')}`);
  }
  process.exit(passed ? 0 : 2);
}

if (isMain(import.meta.url)) main();
