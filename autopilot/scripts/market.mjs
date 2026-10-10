#!/usr/bin/env node
// Еженедельный анализ рынка: спрос Wordstat, который корпус ещё не закрывает,
// и свежие изменения для бизнеса → темы в topicSeeds и даты в календарь НПА.
//
// Модель только предлагает. Принимает детерминированная проверка: каждый
// ключ темы дословно совпадает со свежей фразой Wordstat, тема не дублирует
// корпус, бэклог и уже заведённые seeds, у события календаря первоисточник.
// Без этой проверки еженедельный проход за месяц засорил бы бэклог темами
// без спроса и повторами того, что уже написано.
//
//   node scripts/market.mjs brief [--json]     # что ушло бы модели
//   node scripts/market.mjs run [--dry] [--json]
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { loadArticles, readJson, writeJson, today, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { canonicalKey, tokenize } from './lib/text.mjs';
import { rankByDemand } from './lib/demand.mjs';
import { hostAllowed, hostOf } from './lib/sources.mjs';
import { supervisedProcess } from './lib/writer-process.mjs';
import { buildIndex, checkTopic } from './dedupe.mjs';

export const FORMATS = ['explainer', 'howto', 'news', 'reference', 'comparison', 'checklist', 'faq'];
export const LIMITS = { topics: 12, perEntity: 3, calendar: 5, briefPhrases: 120, perSeed: 5, minCount: 50 };

// Навигация, развлечения и чужие смыслы совпавших слов. Частотность у них
// огромная, и без отсева они вытесняли бы из брифа всё полезное.
const NOISE = /(^|\s)(https?|www|ru|com|aspx|catalog|detail|вход|войти|кабинет\p{L}*|промокод\p{L}*|скачать|телефон|горяч\p{L}* лини\p{L}*|адрес|отзыв\p{L}*|ваканси\p{L}*|фильм\p{L}*|сериал\p{L}*|гороскоп\p{L}*|ретроградн\p{L}*|планета|кинотеатр\p{L}*|расписани\p{L}*|погода|купить|счетчик\p{L}*)(\s|$)/iu;

const normalize = (value) => String(value).normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

/** Свежие фразы Wordstat: последняя выборка на фразу, только то, что принял бы ранжировщик. */
export function freshPhrases(evidence, settings, now = Date.now()) {
  const best = new Map();
  for (const snapshot of evidence?.snapshots || []) {
    let seed = null;
    try { seed = new URL(snapshot.url).searchParams.get('words'); } catch { seed = null; }
    for (const row of snapshot.rows || []) {
      if (typeof row.phrase !== 'string' || !Number.isSafeInteger(row.count)) continue;
      const key = normalize(row.phrase);
      if (!best.has(key) || best.get(key).count < row.count) best.set(key, { phrase: row.phrase.trim(), count: row.count, seed: seed ? normalize(seed) : null });
    }
  }
  // Свежесть и область выборки решает тот же код, что ранжирует темы.
  const rows = [...best.values()].sort((a, b) => b.count - a.count);
  const ranked = rankByDemand(rows.map((r) => ({ score: 0, keywords: [r.phrase], phrase: r.phrase })), evidence, settings, now);
  const collected = new Set(ranked.filter((t) => t.demand.status === 'collected').map((t) => normalize(t.phrase)));
  return rows.filter((r) => collected.has(normalize(r.phrase)));
}

/** Спрос, который сайт не закрывает: ни статья, ни тема бэклога его не покрывают. */
export function uncoveredDemand(phrases, index, { limit = LIMITS.briefPhrases, perSeed = LIMITS.perSeed, minCount = LIMITS.minCount } = {}) {
  const out = [];
  const bySeed = new Map();
  for (const row of phrases) {
    if (out.length >= limit) break;
    if (row.count < minCount) break;
    const size = tokenize(row.phrase).length;
    if (size < 2 || size > 7 || NOISE.test(normalize(row.phrase))) continue;
    // Одна выборка Wordstat не забирает весь бриф: широкой картине рынка
    // нужны разные кластеры, а не тридцать вариаций одного запроса.
    if (row.seed && (bySeed.get(row.seed) || 0) >= perSeed) continue;
    if (checkTopic({ title: row.phrase, keywords: [row.phrase] }, index).verdict !== 'ok') continue;
    out.push({ phrase: row.phrase, count: row.count });
    if (row.seed) bySeed.set(row.seed, (bySeed.get(row.seed) || 0) + 1);
  }
  return out;
}

/**
 * Проверка предложений модели. Возвращает принятое и причины отказов:
 * отчёт по отказам — единственный способ заметить, что модель систематически
 * предлагает не то.
 */
export function validateProposals(proposals, { evidence, settings, index, seeds, entities, now = new Date(), limits = LIMITS }) {
  const accepted = { topics: [], calendar: [] };
  const rejected = [];
  const reject = (item, reason) => rejected.push({ item: item?.title || item?.event || null, reason });
  const known = new Set((seeds.topicSeeds || []).map((t) => canonicalKey(t.title)));
  const perEntity = new Map();
  const peers = index.slice(); peers.idf = index.idf;
  for (const t of seeds.topicSeeds || []) peers.push(peerEntry(t));

  for (const topic of proposals?.topics || []) {
    if (accepted.topics.length >= limits.topics) { reject(topic, 'лимит тем за неделю'); continue; }
    const title = typeof topic?.title === 'string' ? topic.title.trim() : '';
    const entity = typeof topic?.entity === 'string' ? topic.entity.trim().toLowerCase() : '';
    const keywords = Array.isArray(topic?.keywords) ? [...new Set(topic.keywords.filter((k) => typeof k === 'string').map((k) => normalize(k)).filter(Boolean))] : [];
    if (title.length < 20 || title.length > 120) { reject(topic, 'длина заголовка'); continue; }
    if (entity.length < 2 || entity.length > 40) { reject(topic, 'сущность'); continue; }
    if (!FORMATS.includes(topic.format)) { reject(topic, 'формат'); continue; }
    if (!keywords.length || keywords.length > 4) { reject(topic, 'ключи'); continue; }
    const demand = rankByDemand(keywords.map((k) => ({ score: 0, keywords: [k] })), evidence, settings, now.getTime());
    if (demand.some((d) => d.demand.status !== 'collected')) { reject(topic, 'ключ без свежего спроса Wordstat'); continue; }
    if (known.has(canonicalKey(title))) { reject(topic, 'такая тема уже есть в seeds'); continue; }
    if ((perEntity.get(entity) || 0) >= limits.perEntity) { reject(topic, 'лимит тем на сущность'); continue; }
    const verdict = checkTopic({ title, keywords }, peers);
    if (verdict.verdict === 'block') { reject(topic, `дубль: ${verdict.hits?.[0]?.slug || verdict.advice || 'корпус'}`); continue; }
    const clean = { title, entity, keywords, format: topic.format };
    accepted.topics.push(clean);
    known.add(canonicalKey(title));
    perEntity.set(entity, (perEntity.get(entity) || 0) + 1);
    peers.push(peerEntry(clean));
  }

  const dayMs = 86400000;
  const existing = new Set((seeds.calendar || []).map((c) => `${c.date}|${normalize(c.entity)}`));
  const entitySet = new Set(entities.map(normalize));
  for (const item of proposals?.calendar || []) {
    if (accepted.calendar.length >= limits.calendar) { reject(item, 'лимит событий'); continue; }
    const date = typeof item?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null;
    const at = date ? Date.parse(`${date}T00:00:00Z`) : NaN;
    if (!Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== date) { reject(item, 'дата'); continue; }
    if (at <= now.getTime() || at > now.getTime() + 365 * dayMs) { reject(item, 'дата вне ближайшего года'); continue; }
    const entity = typeof item.entity === 'string' ? item.entity.trim() : '';
    if (!entitySet.has(normalize(entity))) { reject(item, 'неизвестная сущность'); continue; }
    const event = typeof item.event === 'string' ? item.event.trim() : '';
    if (event.length < 10 || event.length > 200) { reject(item, 'описание события'); continue; }
    let host = null;
    try { const url = new URL(item.source); host = url.protocol === 'https:' && !url.username && !url.password ? hostOf(url.href) : null; } catch { host = null; }
    if (!host || !hostAllowed(host)) { reject(item, 'источник не первоисточник'); continue; }
    const key = `${date}|${normalize(entity)}`;
    if (existing.has(key)) { reject(item, 'событие уже в календаре'); continue; }
    existing.add(key);
    accepted.calendar.push({ date, entity, event, boost: 40, source: item.source });
  }
  return { accepted, rejected };
}

function peerEntry(t) {
  return { kind: 'planned', slug: `seed:${t.title}`, title: t.title, keywords: t.keywords || [], canonical: canonicalKey(t.title), titleTokens: tokenize(t.title), keywordTokens: tokenize((t.keywords || []).join(' ')), allTokens: tokenize([t.title, ...(t.keywords || [])].join(' ')) };
}

/** Дописать принятое в seeds: только добавление, существующие записи не трогаются. */
export function applyAccepted(seeds, accepted, day) {
  const next = { ...seeds, topicSeeds: [...(seeds.topicSeeds || [])], calendar: [...(seeds.calendar || [])] };
  for (const t of accepted.topics) next.topicSeeds.push({ ...t, source: 'market', addedAt: day });
  for (const c of accepted.calendar) next.calendar.push({ ...c, addedAt: day });
  return next;
}

export const PROPOSAL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['topics', 'calendar', 'summary'],
  properties: {
    summary: { type: 'string' },
    topics: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'entity', 'keywords', 'format', 'reason'], properties: {
      title: { type: 'string' }, entity: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } }, format: { type: 'string', enum: FORMATS }, reason: { type: 'string' } } } },
    calendar: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['date', 'entity', 'event', 'source'], properties: {
      date: { type: 'string' }, entity: { type: 'string' }, event: { type: 'string' }, source: { type: 'string' } } } },
  },
};

function corpusEntities(articles, seeds) {
  const out = new Set();
  for (const a of articles) for (const tag of a.tags || []) if (String(tag).trim().length >= 3) out.add(String(tag).trim());
  for (const e of seeds.extraEntities || []) out.add(e);
  return [...out];
}

export function buildBrief({ cfg = loadConfig(), now = new Date() } = {}) {
  assertContentRoot(cfg);
  const dataDir = cfg.resolved.dataDir;
  const seeds = readJson(path.join(dataDir, 'seeds.json'), { topicSeeds: [], calendar: [] });
  const evidence = readJson(path.join(dataDir, 'demand.json'), null);
  const index = buildIndex();
  const phrases = freshPhrases(evidence, cfg.backlog, now.getTime());
  const articles = loadArticles({ includeDrafts: false });
  return {
    cfg, seeds, evidence, index, articles,
    brief: {
      week: now.toISOString().slice(0, 10),
      uncovered: uncoveredDemand(phrases, index),
      existingTopics: [...articles.map((a) => a.title), ...(seeds.topicSeeds || []).map((t) => t.title)].slice(-400),
      calendar: seeds.calendar || [],
      entities: corpusEntities(articles, seeds).slice(0, 200),
      allowedSourceHosts: ['consultant.ru', 'garant.ru', 'nalog.gov.ru', 'publication.pravo.gov.ru', 'pravo.gov.ru', 'crpt.ru', 'честныйзнак.рф', 'rospotrebnadzor.ru', 'regulation.gov.ru', 'duma.gov.ru', 'kremlin.ru'],
    },
  };
}

/** Модель через тот же Codex CLI, что пишет статьи; песочница только на чтение. */
export async function proposeWithCodex(prompt, { cwd, binary = process.env.AUTOPILOT_CODEX_BIN || 'codex', timeout = 20 * 60_000 } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'autopilot-market-'));
  try {
    const schema = path.join(dir, 'schema.json'); const output = path.join(dir, 'result.json');
    writeFileSync(schema, JSON.stringify(PROPOSAL_SCHEMA));
    await supervisedProcess(binary, ['--no-daemon', '--search', '--ask-for-approval', 'never', 'exec', '--sandbox', 'read-only', '--cd', cwd, '--output-schema', schema, '--output-last-message', output, '-'], { input: prompt, cwd, timeout, actorFile: path.join(dir, 'actor.json') });
    return JSON.parse(readFileSync(output, 'utf8'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export async function runMarket({ dry = false, now = new Date(), propose = proposeWithCodex } = {}) {
  const ctx = buildBrief({ now });
  const skill = readFileSync(path.join(ctx.cfg.resolved.contentRoot, '.agents/skills/auto-market/SKILL.md'), 'utf8');
  const prompt = `${skill}\n\n## Данные недели\n\n\`\`\`json\n${JSON.stringify(ctx.brief, null, 1)}\n\`\`\`\n`;
  const proposals = await propose(prompt, { cwd: ctx.cfg.resolved.contentRoot });
  const seedsFile = path.join(ctx.cfg.resolved.dataDir, 'seeds.json');
  acquireLock({ cmd: 'market' });
  try {
    // Между брифом и ответом модели корпус не меняется (один владелец), но
    // seeds перечитываются под замком: запись идёт только от свежей версии.
    const seeds = readJson(seedsFile, ctx.seeds);
    const result = validateProposals(proposals, { evidence: ctx.evidence, settings: ctx.cfg.backlog, index: ctx.index, seeds, entities: ctx.brief.entities, now });
    const report = { version: 1, at: now.toISOString(), summary: String(proposals?.summary || '').slice(0, 1000), uncovered: ctx.brief.uncovered.length, proposed: { topics: (proposals?.topics || []).length, calendar: (proposals?.calendar || []).length }, accepted: result.accepted, rejected: result.rejected };
    if (!dry) {
      if (result.accepted.topics.length || result.accepted.calendar.length) writeJson(seedsFile, applyAccepted(seeds, result.accepted, today()));
      writeJson(path.join(ctx.cfg.resolved.dataDir, 'market-latest.json'), report);
    }
    return report;
  } finally { releaseLock(); }
}

if (isMain(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  try {
    if (cmd === 'brief') {
      const { brief } = buildBrief();
      console.log(args.json !== undefined ? JSON.stringify(brief, null, 2) : `Непокрытый спрос: ${brief.uncovered.length} фраз\n` + brief.uncovered.slice(0, 30).map((r) => `  ${String(r.count).padStart(7)}  ${r.phrase}`).join('\n'));
    } else if (cmd === 'run') {
      const report = await runMarket({ dry: args.dry !== undefined });
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('Использование: market.mjs brief [--json] | run [--dry] [--json]');
      process.exitCode = 2;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
