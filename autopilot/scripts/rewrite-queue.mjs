#!/usr/bin/env node
// Очередь рерайтов. В контуре с редактором обновление старого шло по
// остаточному принципу — руки не доходили. Здесь рерайт занимает
// фиксированную долю выработки (mix.rewrite в конфиге), поэтому очередь
// должна быть ранжированной всегда, а не «когда что-то заметили».
//
//   node scripts/rewrite-queue.mjs build [--json]
//   node scripts/rewrite-queue.mjs take --count 2
//   node scripts/rewrite-queue.mjs mark --slug s      # зафиксировать рерайт
//
// Сигналы (складываются, максимум по каждому ограничен):
//   возраст статьи, просроченный reviewDate, тонкий текст, дубль по scan,
//   близость даты из календаря НПА, сиротство по входящим ссылкам.
import path from 'node:path';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { loadArticles, readJson, writeJson, today, daysBetween, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { buildLinkGraph } from './interlink.mjs';

const cfg = loadConfig();
const R = cfg.rewrite;
const QUEUE_FILE = path.join(cfg.resolved.dataDir, 'rewrite-queue.json');
const LOG_FILE = path.join(cfg.resolved.dataDir, 'rewrite-log.json');

export function buildQueue() {
  acquireLock({ cmd: 'rewrite-build' });
  try {
    return buildQueueInner();
  } finally {
    releaseLock();
  }
}

function buildQueueInner() {
  assertContentRoot(cfg);
  const articles = loadArticles({ includeDrafts: false });
  const now = new Date();
  const dupes = readJson(path.join(cfg.resolved.dataDir, 'dupes.json'), { pairs: [] }).pairs;
  const log = readJson(LOG_FILE, { entries: {} }).entries;
  const seeds = readJson(path.join(cfg.resolved.dataDir, 'seeds.json'), { calendar: [] });
  const graph = buildLinkGraph(articles);

  // Резервации прошлой очереди (AP-P1-09): активный рерайт не должен
  // потеряться из-за пересборки — иначе исполнитель остаётся без наряда.
  const previous = readJson(QUEUE_FILE, { items: [] });
  const reservations = new Map();
  for (const item of previous.items || []) {
    if (item.reservedAt) reservations.set(item.slug, { reservedAt: item.reservedAt, runId: item.runId || null });
  }
  const seen = new Set();

  const dupeScore = new Map();
  for (const pair of dupes) {
    const weight = pair.verdict === 'merge' ? 35 : 15;
    for (const slug of [pair.a, pair.b]) {
      dupeScore.set(slug, Math.max(dupeScore.get(slug) || 0, weight));
    }
  }

  const rows = [];
  for (const article of articles) {
    const lastTouch = article.updatedDate || article.pubDate;
    const age = lastTouch ? daysBetween(lastTouch, now) : 999;
    const lastRewrite = log[article.slug]?.lastRewrite ? new Date(log[article.slug].lastRewrite) : null;
    const sinceRewrite = lastRewrite ? daysBetween(lastRewrite, now) : null;

    // Свежепереписанное не берём повторно, даже если формально «старое»:
    // иначе очередь начинает крутить одни и те же статьи каждый месяц.
    if (sinceRewrite !== null && sinceRewrite < R.minDaysBetweenRewrites) continue;

    const reasons = [];
    let score = 0;

    if (age >= R.hardStaleAfterDays) {
      score += 45;
      reasons.push(`не обновлялась ${age} дн.`);
    } else if (age >= R.staleAfterDays) {
      score += Math.round((25 * (age - R.staleAfterDays)) / (R.hardStaleAfterDays - R.staleAfterDays)) + 15;
      reasons.push(`не обновлялась ${age} дн.`);
    }

    if (article.reviewDate && article.reviewDate < now) {
      const overdue = daysBetween(article.reviewDate, now);
      score += Math.min(30, 10 + Math.round(overdue / 10));
      reasons.push(`reviewDate просрочен на ${overdue} дн.`);
    }

    if (article.chars < R.thinContentChars) {
      score += 20;
      reasons.push(`тонкий текст, ${article.chars} симв.`);
    }

    if (dupeScore.has(article.slug)) {
      score += dupeScore.get(article.slug);
      reasons.push('пересечение с другой статьёй корпуса');
    }

    const inbound = graph.inbound.get(article.slug)?.size || 0;
    if (inbound < cfg.interlink.minInbound) {
      score += 12;
      reasons.push(`входящих ссылок ${inbound}`);
    }

    // Перебор исходящих движок не создаёт — он ограничен потолком. Это
    // наследство статей, написанных до контура: читателя уводят из текста
    // десятком ссылок, а вес растекается. Чинится при рерайте, руками.
    const outbound = graph.outbound.get(article.slug)?.size || 0;
    if (outbound > cfg.interlink.maxOutbound && !article.interlinkExempt) {
      score += 10;
      reasons.push(`исходящих ссылок ${outbound} при норме ${cfg.interlink.maxOutbound}`);
    }

    for (const item of seeds.calendar || []) {
      const text = `${article.title} ${article.tags.join(' ')}`.toLowerCase();
      if (!text.includes(item.entity.toLowerCase())) continue;
      const days = daysBetween(now, new Date(item.date));
      if (days < -60 || days > 200) continue;
      score += Math.round(R.npaTriggerBoost * Math.max(0, 1 - Math.abs(days - 40) / 200));
      reasons.push(`${item.date}: ${item.event}`);
    }

    if (score <= 0) continue;
    seen.add(article.slug);
    rows.push({
      slug: article.slug,
      title: article.title,
      score,
      age,
      chars: article.chars,
      inbound,
      outbound,
      reasons,
      lastRewrite: lastRewrite ? lastRewrite.toISOString().slice(0, 10) : null,
      ...(reservations.get(article.slug) || {}),
    });
  }

  // Зарезервированный элемент, переставший быть кандидатом (например,
  // переписан и потому отфильтрован), всё равно переносится: пока он в
  // inFlight, исполнитель обязан получить тот же наряд (AP-P1-09).
  for (const item of previous.items || []) {
    if (item.reservedAt && !seen.has(item.slug)) rows.push(item);
  }

  rows.sort((a, b) => b.score - a.score);
  const queue = { generatedAt: today(), size: rows.length, items: rows };
  writeJson(QUEUE_FILE, queue);
  return queue;
}

function readQueue() {
  return readJson(QUEUE_FILE, null) || buildQueueInner();
}

/**
 * Выдать рерайты и зарезервировать их за проходом. `active` — slug'и, уже
 * занятые в state.inFlight: их повторно не выдаём. Резервации, которых нет
 * среди активных, считаются брошенными и снимаются (recovery после падения).
 */
export function takeRewrites(count, { runId = null, active = [] } = {}) {
  acquireLock({ cmd: 'rewrite-take' });
  try {
    const queue = readQueue();
    const activeSet = new Set(active);
    for (const item of queue.items) {
      if (item.reservedAt && !activeSet.has(item.slug)) {
        delete item.reservedAt;
        delete item.runId;
      }
    }
    const picked = [];
    for (const item of queue.items) {
      if (picked.length >= count) break;
      if (item.reservedAt || activeSet.has(item.slug)) continue;
      item.reservedAt = new Date().toISOString();
      item.runId = runId;
      picked.push(item);
    }
    writeJson(QUEUE_FILE, queue);
    return picked;
  } finally {
    releaseLock();
  }
}

/**
 * Активные рерайты (их slug есть в state.inFlight) — для переноса наряда,
 * когда orders.json потерян. Резервация при этом не обязательна: её мог
 * потерять упавший проход, но тема всё ещё в работе.
 */
export function activeRewrites(active = []) {
  acquireLock({ cmd: 'rewrite-active' });
  try {
    const activeSet = new Set(active);
    return readQueue().items.filter((item) => activeSet.has(item.slug));
  } finally {
    releaseLock();
  }
}

/** Снять резервацию: тема ушла в карантин или инфра-лимит исчерпан. */
export function releaseReservation(slug) {
  acquireLock({ cmd: 'rewrite-release' });
  try {
    const queue = readQueue();
    let changed = false;
    for (const item of queue.items) {
      if (item.slug === slug && item.reservedAt) {
        delete item.reservedAt;
        delete item.runId;
        changed = true;
      }
    }
    if (changed) writeJson(QUEUE_FILE, queue);
    return changed;
  } finally {
    releaseLock();
  }
}

export function markRewritten(slug) {
  acquireLock({ cmd: 'rewrite-mark' });
  try {
    const log = readJson(LOG_FILE, { entries: {} });
    const prev = log.entries[slug] || { count: 0 };
    log.entries[slug] = { lastRewrite: today(), count: prev.count + 1 };
    writeJson(LOG_FILE, log);
    releaseReservationInner(slug);
    return log.entries[slug];
  } finally {
    releaseLock();
  }
}

/** Без повторного захвата lock (markRewritten уже держит его). */
function releaseReservationInner(slug) {
  const queue = readJson(QUEUE_FILE, null);
  if (!queue) return false;
  let changed = false;
  for (const item of queue.items) {
    if (item.slug === slug && item.reservedAt) {
      delete item.reservedAt;
      delete item.runId;
      changed = true;
    }
  }
  if (changed) writeJson(QUEUE_FILE, queue);
  return changed;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!cmd || cmd === 'build') {
    const queue = buildQueue();
    if (args.json) {
      console.log(JSON.stringify(queue, null, 2));
      return;
    }
    console.log(`Кандидатов на рерайт: ${queue.size}`);
    for (const item of queue.items.slice(0, Number(args.limit || 15))) {
      console.log(`${String(item.score).padStart(4)}  ${item.slug}`);
      console.log(`      ${item.reasons.join('; ')}`);
    }
    return;
  }

  if (cmd === 'take') {
    console.log(JSON.stringify(takeRewrites(Number(args.count || 2)), null, 2));
    return;
  }

  if (cmd === 'mark') {
    console.log(JSON.stringify(markRewritten(args.slug), null, 2));
    return;
  }

  console.log('Использование: rewrite-queue.mjs build|take|mark');
  process.exit(1);
}

if (isMain(import.meta.url)) main();
