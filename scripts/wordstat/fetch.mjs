#!/usr/bin/env node
// Запрашивает Wordstat API для всех приоритетных ключей и мерджит в кеш.
//
// Окружение:
//   WORDSTAT_OAUTH_TOKEN — OAuth-токен с oauth.yandex.ru (обязательно, кроме DRY_RUN)
//   DRY_RUN=1            — печатает план и выходит, без сетевых запросов
//   MAX_QUOTA=500        — потолок по квотам за прогон (1 запрос dynamics = 1 квота)
//   TOP_REQUESTS_LIMIT=50 — сколько самых приоритетных ключей также получают topRequests
//   REGION_ID=225        — Yandex region ID (225 = Россия)
//   FRESH_DAYS=7         — ключ считается актуальным, если обновлён не позднее N дней назад
//   REQUEST_DELAY_MS=200 — пауза между запросами
//
// Чтение:  src/data/wordstat/.candidates.json (генерит extract-keys.mjs)
//          src/data/wordstat/keys.json (если существует)
// Запись:  src/data/wordstat/keys.json
//          src/data/wordstat/snapshots/YYYY-MM-DD.json

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = join(ROOT, "src", "data", "wordstat");
const CANDIDATES = join(DATA_DIR, ".candidates.json");
const KEYS_FILE = join(DATA_DIR, "keys.json");
const SNAPSHOTS_DIR = join(DATA_DIR, "snapshots");

const API_BASE = "https://api.wordstat.yandex.net";
const TOKEN = process.env.WORDSTAT_OAUTH_TOKEN || "";
const DRY_RUN = process.env.DRY_RUN === "1";
const MAX_QUOTA = parseInt(process.env.MAX_QUOTA || "500", 10);
// Сколько P1-ключей получают /v1/topRequests. По умолчанию — все,
// потому что точная фраза часто даёт 0 (мы спрашиваем длинную формулировку
// типа «АТОЛ 27Ф обзор», а аудитория ищет «атол 27» или «атол 27 касса»).
// topRequests показывает реальные популярные вариации.
const TOP_REQUESTS_LIMIT = parseInt(
  process.env.TOP_REQUESTS_LIMIT || "1000",
  10,
);
const REGION_ID = parseInt(process.env.REGION_ID || "225", 10);
const FRESH_DAYS = parseInt(process.env.FRESH_DAYS || "7", 10);
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || "200", 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pad(n) {
  return String(n).padStart(2, "0");
}

function isoDate(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function todayISO() {
  return isoDate(new Date());
}

function firstDayMonthsAgo(months) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  return isoDate(d);
}

function daysBetween(aIso, bIso) {
  return Math.abs((Date.parse(aIso) - Date.parse(bIso)) / 86400_000);
}

async function callApi(path, body, attempt = 1) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Accept-Language": "ru",
      "Content-Type": "application/json;charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    const txt = await res.text();
    throw new Error(`auth failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) {
      throw new Error(`API ${path} failed after ${attempt} attempts: ${res.status}`);
    }
    const backoff = 1000 * 2 ** attempt;
    console.warn(`  ↻ retry ${path} after ${backoff}ms (status ${res.status})`);
    await sleep(backoff);
    return callApi(path, body, attempt + 1);
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${path} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function getDynamics(phrase) {
  const fromDate = firstDayMonthsAgo(12);
  const data = await callApi("/v1/dynamics", {
    phrase,
    period: "monthly",
    fromDate,
    regions: [REGION_ID],
  });
  const arr = Array.isArray(data?.dynamics) ? data.dynamics : [];
  return arr.map((d) => ({
    date: typeof d.date === "string" ? d.date.slice(0, 7) : String(d.date),
    count: typeof d.count === "number" ? d.count : 0,
  }));
}

async function getTopRequests(phrase) {
  const data = await callApi("/v1/topRequests", {
    phrase,
    regions: [REGION_ID],
  });
  const arr = Array.isArray(data?.topRequests) ? data.topRequests : [];
  return arr.slice(0, 30).map((r) => ({
    phrase: String(r.phrase || ""),
    count: typeof r.count === "number" ? r.count : 0,
  }));
}

function classifyTrend(history) {
  if (history.length < 6) return "unknown";
  const recent = history.slice(-3).reduce((s, p) => s + p.count, 0) / 3;
  const prev = history.slice(-6, -3).reduce((s, p) => s + p.count, 0) / 3;
  if (prev === 0) return recent > 0 ? "up" : "unknown";
  const ratio = recent / prev;
  if (ratio >= 1.2) return "up";
  if (ratio <= 0.8) return "down";
  return "stable";
}

function loadJSON(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}

function isUsefulKey(norm) {
  if (!norm || norm.length < 3) return false;
  if (/^\d+$/.test(norm)) return false;
  const tokens = norm.split(/[\s-]+/).filter(Boolean);
  return tokens.length >= 2;
}

function pruneCache(cache) {
  let removed = 0;
  for (const k of Object.keys(cache.keys)) {
    if (!isUsefulKey(k)) {
      delete cache.keys[k];
      removed++;
    }
  }
  return removed;
}

function selectStaleKeys(candidates, cache) {
  const now = todayISO();
  const stale = [];
  for (const c of candidates.keys) {
    const entry = cache.keys[c.norm];
    const fetchedAt = entry?.fetchedAt;
    const ageDays = fetchedAt
      ? daysBetween(now, fetchedAt.slice(0, 10))
      : Infinity;
    const threshold = c.priority === 1 ? FRESH_DAYS : FRESH_DAYS * 4;
    if (ageDays >= threshold) {
      stale.push({ ...c, ageDays });
    }
  }
  // Сначала P1 (priority 1), внутри — самые устаревшие (или вообще не запрошенные)
  stale.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.ageDays - a.ageDays;
  });
  return stale;
}

async function main() {
  if (!existsSync(CANDIDATES)) {
    throw new Error(
      `${CANDIDATES} не найден — запустите сначала extract-keys.mjs`,
    );
  }
  if (!DRY_RUN && !TOKEN) {
    throw new Error(
      "WORDSTAT_OAUTH_TOKEN не задан. Установите токен или запустите с DRY_RUN=1.",
    );
  }
  const candidates = loadJSON(CANDIDATES, { keys: [] });
  const cache = loadJSON(KEYS_FILE, {
    schemaVersion: 1,
    lastFullUpdate: null,
    keys: {},
  });

  const pruned = pruneCache(cache);
  if (pruned > 0) {
    console.log(`prune: удалено ${pruned} устаревших по правилам ключей из кеша`);
  }

  const stale = selectStaleKeys(candidates, cache);

  // Бюджет: 1 квота на dynamics + 1 на topRequests (только для верхних P1).
  // Берём не больше, чем влезает в MAX_QUOTA.
  const plan = [];
  let quota = 0;
  for (const k of stale) {
    if (quota >= MAX_QUOTA) break;
    const wantsTop =
      k.priority === 1 && plan.filter((p) => p.top).length < TOP_REQUESTS_LIMIT;
    const cost = wantsTop ? 2 : 1;
    if (quota + cost > MAX_QUOTA) {
      if (quota + 1 <= MAX_QUOTA) {
        plan.push({ ...k, top: false });
        quota += 1;
      }
      continue;
    }
    plan.push({ ...k, top: wantsTop });
    quota += cost;
  }

  console.log(
    `fetch: ${candidates.keys.length} кандидатов, ` +
      `${stale.length} устаревших, в план попало ${plan.length} (квота: ${quota}/${MAX_QUOTA})`,
  );

  if (DRY_RUN) {
    console.log("DRY_RUN=1 — сетевые запросы пропущены. Первые 10 в плане:");
    for (const p of plan.slice(0, 10)) {
      console.log(
        `  [P${p.priority}${p.top ? "+top" : ""}] "${p.phrase}" (age ${
          p.ageDays === Infinity ? "∞" : Math.round(p.ageDays) + "d"
        })`,
      );
    }
    return;
  }

  let updated = 0;
  for (const p of plan) {
    try {
      const history = await getDynamics(p.phrase);
      await sleep(REQUEST_DELAY_MS);
      let related;
      if (p.top) {
        related = await getTopRequests(p.phrase);
        await sleep(REQUEST_DELAY_MS);
      }
      const last = history[history.length - 1];
      const shows = last ? last.count : 0;
      const topShows = related && related.length
        ? Math.max(...related.map((r) => r.count))
        : undefined;
      const entry = cache.keys[p.norm] || {};
      cache.keys[p.norm] = {
        ...entry,
        phrase: p.phrase,
        priority: p.priority,
        sources: p.sources,
        fetchedAt: new Date().toISOString(),
        history,
        shows,
        trend: classifyTrend(history),
        ...(related
          ? {
              related,
              topShows,
              // Если точная фраза молчит, а топ говорит — это сигнал
              // переформулировать целевой запрос. Скиллы это покажут.
              topPhrase: related[0]?.phrase,
              relatedFetchedAt: new Date().toISOString(),
            }
          : {}),
      };
      updated++;
      if (updated % 25 === 0) {
        console.log(`  …${updated}/${plan.length}`);
        // промежуточный сейв на случай прерывания
        writeFileSync(KEYS_FILE, JSON.stringify(cache, null, 2) + "\n");
      }
    } catch (err) {
      console.error(`  ✗ "${p.phrase}": ${err.message}`);
      // Не критично — идём дальше, токен может сломаться на одной фразе
      // (например, кириллица или редкий символ).
    }
  }

  cache.lastFullUpdate = todayISO();
  if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  writeFileSync(KEYS_FILE, JSON.stringify(cache, null, 2) + "\n");
  copyFileSync(KEYS_FILE, join(SNAPSHOTS_DIR, `${todayISO()}.json`));

  console.log(`fetch: обновлено ${updated} ключей → ${KEYS_FILE}`);
  console.log(`       snapshot → snapshots/${todayISO()}.json`);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
