#!/usr/bin/env node
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
import { readFileSync, existsSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { parseFrontmatter, loadArticles, isMain, parseArgs } from './lib/content.mjs';
import { tokenize, shingles, buildIdf, weightedCoverage } from './lib/text.mjs';
import { auditSourceUrl, evaluateEvidence, urlFromMatch, readSourceEvidence } from './lib/sources.mjs';
import { envelope, EXIT } from './lib/outcome.mjs';
import { extractInternalLinks, unpublishedSlugs } from './lib/links.mjs';
import { parseIsoDate, isFutureIso, isPastIso } from './lib/dates.mjs';
import { buildLinkGraph } from './interlink.mjs';

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

// Утверждения, которые обязаны опираться на источник: даты вступления в силу,
// суммы штрафов, номера статей. Без ссылки рядом это выдумка до доказательства
// обратного — проверять её постфактум будет некому.
// Границы слова здесь заданы явным классом, а не \b: в JS \b работает по
// ASCII, и между пробелом и кириллической буквой границы не возникает — с
// \b эти шаблоны молча не находили ничего, а гейт источников считался
// пройденным на любом тексте.
const EDGE = '(?:^|[\\s(«„"\'-])';
const CLAIM_PATTERNS = [
  {
    id: 'date',
    re: new RegExp(
      `${EDGE}с\\s+(?:\\d{2}\\.\\d{2}\\.\\d{4}|\\d{1,2}\\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\\s+\\d{4})`,
      'gi',
    ),
  },
  {
    id: 'fine',
    re: /\d{1,3}(?:[\s\u00a0]?\d{3})+\s*(?:₽|руб)/gi,
    // Денежная сумма сама по себе утверждением о норме не является. В обзоре
    // оборудования «касса от 20 000 рублей» — это ценник, а не санкция, и
    // требовать под него ссылку на КоАП бессмысленно: гейт насчитывает
    // десяток «утверждений» там, где их три, и заворачивает нормальный текст.
    // Поэтому сумма учитывается, только если предложение вокруг неё говорит
    // об ответственности.
    context: /штраф|санкци|ответственн|наказ|взыска|неустойк|пен[яию]|КоАП|конфиска|предупрежден/i,
  },
  {
    id: 'law',
    // Обязателен номер рядом: иначе шаблон ловит обычное слово «статьи»
    // («в тексте статьи»), и любой текст выглядит напичканным ссылками на НПА.
    re: new RegExp(
      `${EDGE}(?:ст\\.\\s*\\d|стать[ияию]\\s+\\d|№\\s*\\d{2,4}-ФЗ|КоАП|НК\\s+РФ)`,
      'gi',
    ),
  },
];

const SOURCE_RE = /\]\(https?:\/\/(?:[^)]*\.)?(?:consultant\.ru|garant\.ru|nalog\.gov\.ru|publication\.pravo\.gov\.ru|pravo\.gov\.ru|честныйзнак\.рф|xn--80ajghhoc2aj1c8b\.xn--p1ai|crpt\.ru|kremlin\.ru|duma\.gov\.ru|regulation\.gov\.ru)[^)]*\)/gi;

/**
 * Предложение, внутри которого стоит найденная позиция.
 *
 * Точки внутри даты (`01.09.2026`) и десятичных чисел не являются концом
 * предложения — иначе утверждение о сроке и ссылка на закон рядом с ним
 * попадали бы в разные «предложения», и гейт источников заворачивал бы
 * корректно оформленный текст. Поэтому даты предварительно маскируются
 * символом той же длины: смещения сохраняются, а ложные границы исчезают.
 */
const DATE_MASK = /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g;
const SENTENCE_END = /[.!?](?=\s|$)/g;

function sentenceAt(text, index) {
  const masked = text.replace(DATE_MASK, (m) => m.replace(/\./g, '\u0001'));
  let start = 0;
  let end = masked.length;
  for (const m of masked.matchAll(SENTENCE_END)) {
    const at = m.index + 1;
    if (at <= index) start = at;
    else {
      end = at;
      break;
    }
  }
  return text.slice(start, end);
}

/** URL первоисточника, стоящего в том же предложении, что и утверждение. */
function sourceInSentence(sentence) {
  const matches = sentence.match(SOURCE_RE);
  if (!matches || !matches.length) return null;
  return urlFromMatch(matches[0]);
}

/**
 * @param sourceEvidence — сохранённый evidence сетевой проверки (url → запись).
 * null означает «сеть не учитывать»: используется в юнит-тестах и там, где
 * evidence ещё не собран. Гейт при этом всё равно проверяет URL
 * детерминированно (схема, allowlist, не главная страница).
 */
export function runGates({ file, source, knownSlugs = null, sourceEvidence = null }) {
  const raw = source ?? readFileSync(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const checks = [];
  const add = (id, ok, weight, detail) => checks.push({ id, ok, weight, detail });

  // 1. Frontmatter: без него статья не соберётся у принимающего проекта.
  const required = ['title', 'description', 'pubDate'];
  const missing = required.filter((k) => !data[k]);
  add('frontmatter', missing.length === 0, 15, missing.length ? `нет полей: ${missing.join(', ')}` : 'все обязательные поля на месте');

  const descLength = String(data.description || '').length;
  add('description', descLength >= 100 && descLength <= 200, 5, `длина description ${descLength} (нужно 100–200)`);

  // 1b. Даты (AP-P1-03): формат, реальная календарная дата, будущий pubDate.
  // `2026-02-30` не должен «съезжать» на март и молча проходить дальше.
  const dateProblems = [];
  let dateOk = true;
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
  // первоисточник стоит в том же предложении. Формируется манифест claims —
  // его можно сохранять и перепроверять отдельным сетевым этапом.
  const claims = CLAIM_PATTERNS.flatMap((p) =>
    [...body.matchAll(p.re)]
      .filter((m) => !p.context || p.context.test(sentenceAt(body, m.index)))
      .map((m) => {
        const sentence = sentenceAt(body, m.index);
        const sourceUrl = sourceInSentence(sentence);
        let covered = Boolean(sourceUrl);
        let reason = covered ? null : 'нет ссылки на первоисточник в этом предложении';
        if (covered) {
          const audit = auditSourceUrl(sourceUrl);
          if (!audit.ok) {
            covered = false;
            reason = audit.reason;
          } else if (sourceEvidence) {
            // Evidence — отдельный сетевой этап. Пустая карта (файла ещё нет)
            // не блокирует: непроверенное не значит опровергнутое. Блокирует
            // только запись, которая говорит «404/редирект/устарело».
            const entry = sourceEvidence[sourceUrl];
            if (entry) {
              const verdict = evaluateEvidence(entry, {
                maxAgeDays: cfg.gates.sourceMaxAgeDays ?? 180,
              });
              if (!verdict.ok) {
                covered = false;
                reason = verdict.reason;
              }
            }
          }
        }
        return { id: p.id, text: m[0], covered, source: sourceUrl, reason };
      }),
  );
  const uncovered = claims.filter((c) => !c.covered);
  const sources = [...body.matchAll(SOURCE_RE)].length;
  add(
    'sources',
    !G.requireFactcheck || claims.length === 0 || uncovered.length === 0,
    20,
    `утверждений с датами/штрафами/НПА: ${claims.length}, без пригодного источника в том же предложении: ${uncovered.length}, ссылок на первоисточники: ${sources}` +
      (uncovered.length ? ` (напр. «${uncovered[0].text}»: ${uncovered[0].reason})` : ''),
  );

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
    }
    const broken = [...outbound].filter((slug) => !known.has(slug));
    brokenOk = broken.length === 0;
    if (!brokenOk) brokenDetail = `битые ссылки: ${broken.join(', ')}`;
  } catch (error) {
    brokenOk = false;
    brokenDetail = `корпус недоступен, проверка не пройдена: ${error.message}`;
  }
  add('links-valid', brokenOk, 10, brokenDetail);

  const gained = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const score = Math.round((gained / total) * 100);

  // Блокеры — то, что нельзя компенсировать баллами в других проверках.
  const blockers = checks.filter((c) => !c.ok && ['frontmatter', 'length', 'sources', 'links-valid', 'dates'].includes(c.id));

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
export function bodyDuplication({ file, source }) {
  const raw = source ?? readFileSync(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  let articles;
  try {
    articles = loadArticles().filter((a) => a.path !== path.resolve(file || ''));
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
    console.log('Использование: gates.mjs check --file <path> | --slug <slug> [--json]');
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

  const result = runGates({ file, sourceEvidence: readSourceEvidence().entries });
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
