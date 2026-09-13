#!/usr/bin/env node
// Автономный поставщик тем. В контуре с редактором темы приносил человек и
// он же отсекал ерунду; здесь тем нужно ~200 в месяц, и генератор обязан сам
// не приносить дубли — иначе очередь мгновенно забьётся вариациями одного и
// того же. Поэтому каждая тема проходит dedupe.checkTopic до попадания в
// бэклог, а не после.
//
//   node scripts/backlog.mjs refill [--target 260] [--json]
//   node scripts/backlog.mjs list [--limit 30] [--status planned]
//   node scripts/backlog.mjs take --count 5          # выдать темы под батч
//   node scripts/backlog.mjs drop --slug s --reason "..."
//   node scripts/backlog.mjs stats
import path from 'node:path';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { loadArticles, readJson, writeJson, today, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { slugify, tokenize } from './lib/text.mjs';
import { buildIndex, checkTopic } from './dedupe.mjs';

const cfg = loadConfig();
const BACKLOG_FILE = path.join(cfg.resolved.dataDir, 'backlog.json');
const SEEDS_FILE = path.join(cfg.resolved.dataDir, 'seeds.json');

const readBacklog = () => readJson(BACKLOG_FILE, { generatedAt: null, topics: [] });
const writeBacklog = (b) => writeJson(BACKLOG_FILE, b);

/**
 * Сущности берём из корпуса, а не из руками написанного списка: теги и
 * категории уже отражают, о чём проект пишет на самом деле. Список в seeds
 * только дополняет то, чего в корпусе ещё нет.
 */
function entitiesFromCorpus(articles, seeds) {
  const freq = new Map();
  for (const a of articles) {
    for (const tag of a.tags) {
      const key = String(tag).trim();
      if (key.length < 3) continue;
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  const fromTags = [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => ({ entity: tag, coverage: n }));

  const known = new Set(fromTags.map((e) => e.entity.toLowerCase()));
  const extra = (seeds.extraEntities || [])
    .filter((e) => !known.has(e.toLowerCase()))
    .map((entity) => ({ entity, coverage: 0 }));

  return [...fromTags, ...extra];
}

/** Приоритет темы: пробел в покрытии + близость дедлайна из календаря НПА. */
function scoreTopic({ entity, coverage, intentWeight, segmentWeight }, seeds) {
  // Чем меньше материалов по сущности, тем выше приоритет: контур сам
  // выравнивает кластеры вместо того, чтобы бесконечно копать один.
  const gapScore = 40 / (1 + coverage);
  const now = new Date();
  let calendarBoost = 0;
  for (const item of seeds.calendar || []) {
    if (!entity.toLowerCase().includes(item.entity.toLowerCase())) continue;
    const days = Math.round((new Date(item.date) - now) / 86400000);
    if (days < -30) continue;
    // Пик за пару месяцев до даты: раньше — рано, позже — спрос уже упал.
    const proximity = Math.max(0, 1 - Math.abs(days - 45) / 240);
    calendarBoost = Math.max(calendarBoost, item.boost * proximity);
  }
  return Math.round((gapScore + calendarBoost) * intentWeight * segmentWeight * 10) / 10;
}

function generateCandidates(seeds, articles) {
  const entities = entitiesFromCorpus(articles, seeds);
  const year = new Date().getUTCFullYear();
  const out = [];

  for (const { entity, coverage } of entities) {
    for (const intent of seeds.intents) {
      for (const segment of seeds.segments) {
        const title = intent.template
          .replace('{entity}', capitalizeEntity(entity))
          .replace('{year}', String(year))
          .replace('{segment}', segment.label)
          .replace(/\s{2,}/g, ' ')
          .replace(/\s+([:,])/g, '$1')
          .trim();
        out.push({
          title,
          entity,
          intent: intent.id,
          format: intent.format,
          segment: segment.id,
          keywords: buildKeywords(entity, intent.id, segment.label),
          score: scoreTopic(
            { entity, coverage, intentWeight: intent.weight, segmentWeight: segment.weight },
            seeds,
          ),
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

function capitalizeEntity(entity) {
  // Аббревиатуры и имена систем оставляем как есть, обычное слово — с большой.
  if (/[A-ZА-Я]{2,}/.test(entity)) return entity;
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}

function buildKeywords(entity, intent, segmentLabel) {
  const base = entity.toLowerCase();
  const map = {
    what: [`что такое ${base}`, base],
    who: [`кому нужен ${base}`, `${base} кто обязан`],
    howto: [`как подключить ${base}`, `${base} инструкция`],
    deadline: [`${base} сроки`, `${base} когда обязателен`],
    fines: [`штраф ${base}`, `${base} ответственность`],
    cost: [`${base} стоимость`, `сколько стоит ${base}`],
    choose: [`как выбрать ${base}`, `${base} сравнение`],
    mistakes: [`ошибки ${base}`, `${base} проблемы`],
    checklist: [`${base} чек-лист`, `${base} требования`],
    faq: [`${base} вопросы`, `${base} faq`],
  };
  const kws = map[intent] || [base];
  return segmentLabel ? [...kws, `${base} ${segmentLabel}`] : kws;
}

/**
 * Пополнение бэклога до целевого запаса. Возвращает и принятые темы, и
 * причины отказов — отчёт по отказам единственный способ заметить, что
 * генератор упёрся в потолок кластера и крутит одно и то же.
 */
export function refill({ target } = {}) {
  acquireLock({ cmd: 'backlog-refill' });
  try {
    return refillInner({ target });
  } finally {
    releaseLock();
  }
}

function refillInner({ target } = {}) {
  assertContentRoot(cfg);
  const seeds = readJson(SEEDS_FILE, { intents: [], segments: [], extraEntities: [] });
  const backlog = readBacklog();
  const articles = loadArticles();

  // Запас считается от коэффициента конфига, а не от магической 1.3: порог
  // должен иметь одного владельца и проверяться схемой (AP-P0-03).
  const want = target || Math.ceil(cfg.throughput.monthlyTarget * (cfg.backlog.targetBufferFactor ?? 1.3));
  const alive = backlog.topics.filter((t) => ['planned', 'writing'].includes(t.status));
  const need = Math.max(0, want - alive.length);

  const stats = {
    candidates: 0,
    accepted: 0,
    blocked: 0,
    warned: 0,
    duplicateSlug: 0,
    capped: 0,
    byEntity: {},
    byIntent: {},
    blockedAdvice: {},
  };
  const bump = (bucket, key, field) => {
    if (!key) return;
    const row = (bucket[key] ||= { candidates: 0, accepted: 0, blocked: 0, warned: 0, capped: 0, duplicateSlug: 0 });
    row[field]++;
  };
  if (need === 0) {
    return { added: [], stats, backlogSize: alive.length, need, exhausted: false };
  }

  const index = buildIndex();
  const seen = new Set(backlog.topics.map((t) => t.slug));
  const added = [];

  // Квота на сущность. Без неё генератор честно отдаёт всё по убыванию
  // приоритета — и месячный план становится десятком статей про воду и
  // ничем больше: у самой «непокрытой» сущности score выше у всех десяти
  // намерений сразу. Ширина корпуса важнее локальной оптимальности.
  const perEntityCap = Math.max(2, Math.ceil(need * cfg.backlog.maxPerEntityShare));
  const entityCount = new Map();
  for (const t of alive) entityCount.set(t.entity, (entityCount.get(t.entity) || 0) + 1);

  for (const candidate of generateCandidates(seeds, articles)) {
    if (added.length >= need) break;
    stats.candidates++;
    bump(stats.byEntity, candidate.entity, 'candidates');
    bump(stats.byIntent, candidate.intent, 'candidates');

    if ((entityCount.get(candidate.entity) || 0) >= perEntityCap) {
      stats.capped++;
      bump(stats.byEntity, candidate.entity, 'capped');
      continue;
    }

    const slug = `${today()}-${slugify(candidate.title)}`.slice(0, 90);
    const slugKey = slugify(candidate.title);
    if (seen.has(slug) || [...seen].some((s) => s.endsWith(slugKey))) {
      stats.duplicateSlug++;
      bump(stats.byEntity, candidate.entity, 'duplicateSlug');
      continue;
    }

    const verdict = checkTopic({ title: candidate.title, keywords: candidate.keywords }, index);
    if (verdict.verdict === 'block') {
      stats.blocked++;
      bump(stats.byEntity, candidate.entity, 'blocked');
      bump(stats.byIntent, candidate.intent, 'blocked');
      const advice = verdict.advice || 'сходство с существующей статьёй';
      stats.blockedAdvice[advice] = (stats.blockedAdvice[advice] || 0) + 1;
      continue;
    }
    if (verdict.verdict === 'warn') {
      stats.warned++;
      bump(stats.byEntity, candidate.entity, 'warned');
      bump(stats.byIntent, candidate.intent, 'warned');
    }

    const topic = {
      slug,
      title: candidate.title,
      keywords: candidate.keywords,
      entity: candidate.entity,
      intent: candidate.intent,
      format: candidate.format,
      segment: candidate.segment,
      score: candidate.score,
      status: 'planned',
      createdAt: today(),
      dedupe: {
        verdict: verdict.verdict,
        advice: verdict.advice,
        related: verdict.hits.slice(0, 3).map((h) => h.slug),
      },
    };
    added.push(topic);
    seen.add(slug);
    entityCount.set(candidate.entity, (entityCount.get(candidate.entity) || 0) + 1);
    bump(stats.byEntity, candidate.entity, 'accepted');
    bump(stats.byIntent, candidate.intent, 'accepted');
    // Новая тема немедленно попадает в индекс: иначе следующая итерация того
    // же прогона сгенерирует её близнеца и оба пройдут проверку.
    index.push({
      kind: 'planned',
      slug,
      title: topic.title,
      keywords: topic.keywords,
      canonical: '',
      titleTokens: tokenize(topic.title),
      keywordTokens: tokenize(topic.keywords.join(' ')),
      allTokens: tokenize([topic.title, ...topic.keywords].join(' ')),
    });
    stats.accepted++;
  }

  backlog.topics = [...backlog.topics, ...added].sort((a, b) => (b.score || 0) - (a.score || 0));
  backlog.generatedAt = today();
  writeBacklog(backlog);

  // AP-P2-08: сигнал исчерпания. Пустой refill при непустой потребности —
  // это не «нет тем вообще», а конкретные сущности/намерения, упёршиеся в
  // dedupe или квоту. Ослаблять порог ради нормы запрещено; ответ — seeds.
  const exhausted = added.length === 0 && need > 0;
  const topBlocked = Object.entries(stats.byEntity)
    .filter(([, v]) => v.candidates > 0 && v.accepted === 0)
    .sort((a, b) => b[1].candidates - a[1].candidates)
    .slice(0, 5)
    .map(([entity, v]) => ({ entity, candidates: v.candidates, blocked: v.blocked, capped: v.capped, duplicateSlug: v.duplicateSlug }));
  return { added, stats, backlogSize: alive.length + added.length, need, exhausted, topBlocked };
}

/**
 * Вернуть в план темы, зависшие в статусе writing без активного наряда.
 * Такое остаётся после падения прохода между claim и settle: слот
 * освобождается по таймауту, а тема иначе висит «в работе» вечно и тихо
 * съедает запас бэклога.
 */
export function reconcile(activeSlugs) {
  acquireLock({ cmd: 'backlog-reconcile' });
  try {
    const backlog = readBacklog();
    const active = new Set(activeSlugs);
    let healed = 0;
    for (const topic of backlog.topics) {
      if (topic.status === 'writing' && !active.has(topic.slug)) {
        topic.status = 'planned';
        topic.updatedAt = today();
        healed++;
      }
    }
    if (healed) writeBacklog(backlog);
    return healed;
  } finally {
    releaseLock();
  }
}

/**
 * Выдать темы под батч: только planned, по убыванию приоритета, но не больше
 * `maxPerEntityPerBatch` тем на одну сущность.
 *
 * Квота при пополнении бэклога ширину корпуса не спасает: она ограничивает
 * долю сущности в запасе, а наряды берутся с верха списка по приоритету — и
 * у самой непокрытой сущности приоритет выше сразу у всех намерений. В первом
 * же реальном проходе четыре статьи из шести пришлись на один кластер. За
 * неделю такой батч даёт перекос, который потом разгребает очередь рерайтов.
 */
export function take(count) {
  acquireLock({ cmd: 'backlog-take' });
  try {
    const backlog = readBacklog();
    const planned = backlog.topics.filter((t) => t.status === 'planned');
    const picked = selectDiverse(planned, count, cfg.backlog.maxPerEntityPerBatch ?? count);
    writeBacklog(backlog);
    return picked;
  } finally {
    releaseLock();
  }
}

/**
 * Отбор с потолком на сущность. Вынесен отдельно от чтения файлов, чтобы
 * поведение проверялось тестом, а не только на живом бэклоге.
 */
export function selectDiverse(planned, count, cap) {
  const limit = Math.max(1, cap);
  const perEntity = new Map();
  const picked = [];
  const deferred = [];

  for (const topic of planned) {
    if (picked.length >= count) break;
    const used = perEntity.get(topic.entity) || 0;
    if (used >= limit) {
      deferred.push(topic);
      continue;
    }
    perEntity.set(topic.entity, used + 1);
    picked.push(topic);
  }

  // Если тем других сущностей не хватило, добираем отложенными: недобрать
  // норму дня хуже, чем взять три темы одного кластера.
  for (const topic of deferred) {
    if (picked.length >= count) break;
    picked.push(topic);
  }

  return picked;
}

export function setStatus(slug, status, extra = {}) {
  acquireLock({ cmd: 'backlog-status' });
  try {
    const backlog = readBacklog();
    const topic = backlog.topics.find((t) => t.slug === slug);
    if (!topic) throw new Error(`Нет темы ${slug} в бэклоге`);
    topic.status = status;
    Object.assign(topic, extra, { updatedAt: today() });
    writeBacklog(backlog);
    return topic;
  } finally {
    releaseLock();
  }
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (cmd === 'refill') {
    const result = refill({ target: args.target ? Number(args.target) : undefined });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        `Добавлено ${result.added.length} тем (нужно было ${result.need}); ` +
          `кандидатов ${result.stats.candidates}, отсечено дублей ${result.stats.blocked}, ` +
          `по квоте сущности ${result.stats.capped}, с предупреждением ${result.stats.warned}. ` +
          `Запас: ${result.backlogSize}.`,
      );
      for (const t of result.added.slice(0, 12)) console.log(`   ${String(t.score).padStart(6)}  ${t.title}`);
      if (result.exhausted) {
        // AP-P2-08: пустой refill объясняется конкретными сущностями, а не
        // «темы кончились». Ответ — расширять seeds, а не снижать порог.
        console.log('Seeds исчерпаны: кандидаты есть, но ни один не прошёл dedupe/квоту.');
        for (const row of result.topBlocked || []) {
          console.log(`   ${row.entity}: кандидатов ${row.candidates}, blocked ${row.blocked}, capped ${row.capped}, slug-дублей ${row.duplicateSlug}`);
        }
        const advice = Object.entries(result.stats.blockedAdvice || {}).sort((a, b) => b[1] - a[1])[0];
        if (advice) console.log(`   причина отказов чаще всего: ${advice[0]} (${advice[1]}×)`);
        console.log('Действие: дополнить data/seeds.json сущностями/намерениями; порог dedupe не ослаблять.');
      }
    }
    return;
  }

  if (cmd === 'list') {
    const backlog = readBacklog();
    const limit = Number(args.limit || 30);
    const status = args.status;
    const rows = backlog.topics.filter((t) => !status || t.status === status).slice(0, limit);
    for (const t of rows) {
      console.log(`${String(t.score).padStart(6)}  ${t.status.padEnd(8)} ${t.dedupe.verdict.padEnd(5)} ${t.title}`);
    }
    console.log(`— всего ${backlog.topics.length}, показано ${rows.length}`);
    return;
  }

  if (cmd === 'take') {
    const picked = take(Number(args.count || 3));
    console.log(JSON.stringify(picked, null, 2));
    return;
  }

  if (cmd === 'drop') {
    setStatus(args.slug, 'dropped', { dropReason: args.reason || 'не указана' });
    console.log(`Снято: ${args.slug}`);
    return;
  }

  if (cmd === 'reconcile') {
    // Восстановление после рассинхронизации: темы `writing` без активного слота
    // возвращаются в `planned`. Активным считается только state.inFlight.
    const state = readJson(path.join(cfg.resolved.dataDir, 'autopilot.json'), { inFlight: [] });
    const active = (state.inFlight || []).map((t) => t.slug);
    const healed = reconcile(active);
    console.log(`Возвращено в planned: ${healed} (активных слотов ${active.length})`);
    return;
  }

  if (cmd === 'stats') {
    const backlog = readBacklog();
    const by = {};
    for (const t of backlog.topics) by[t.status] = (by[t.status] || 0) + 1;
    const byEntity = {};
    for (const t of backlog.topics.filter((x) => x.status === 'planned')) {
      byEntity[t.entity] = (byEntity[t.entity] || 0) + 1;
    }
    console.log(JSON.stringify({ total: backlog.topics.length, byStatus: by, topEntities: Object.entries(byEntity).sort((a, b) => b[1] - a[1]).slice(0, 10) }, null, 2));
    return;
  }

  console.log('Использование: backlog.mjs refill|list|take|drop|reconcile|stats');
  process.exit(1);
}

if (isMain(import.meta.url)) main();
