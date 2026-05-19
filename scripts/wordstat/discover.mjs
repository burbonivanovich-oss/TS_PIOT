#!/usr/bin/env node
// Trend discovery: дёргает /v1/topRequests на каждый seed из seeds.json
// и сохраняет до 2000 фраз вокруг seed-а. Сравнение с прошлой выгрузкой
// делает diff-snapshots.mjs.
//
// Окружение:
//   WORDSTAT_OAUTH_TOKEN — OAuth-токен (обязателен, кроме DRY_RUN)
//   DRY_RUN=1            — печатает план и выходит
//   REGION_ID=225        — Yandex region ID (225 = Россия)
//   NUM_PHRASES=2000     — сколько фраз возвращать на seed (максимум API)
//   REQUEST_DELAY_MS=200 — пауза между запросами (5 req/s, под лимитом 10)
//   ONLY_CATEGORY=…      — если задано, фетчим только seeds этой категории
//                          (entity, intent, audience, problem, system, seasonal)
//
// Чтение:  src/data/wordstat/discoveries/seeds.json
// Запись:  src/data/wordstat/discoveries/<YYYY-MM-DD>/<slug>.json

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DISC_DIR = join(ROOT, "src", "data", "wordstat", "discoveries");
const SEEDS_FILE = join(DISC_DIR, "seeds.json");

const API = "https://api.wordstat.yandex.net/v1/topRequests";
const TOKEN = process.env.WORDSTAT_OAUTH_TOKEN || "";
const DRY_RUN = process.env.DRY_RUN === "1";
const REGION_ID = parseInt(process.env.REGION_ID || "225", 10);
const NUM_PHRASES = parseInt(process.env.NUM_PHRASES || "2000", 10);
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || "200", 10);
const ONLY_CATEGORY = process.env.ONLY_CATEGORY || "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[«»"'`]/g, "")
    .replace(/[^a-zа-я0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function callTopRequests(phrase, attempt = 1) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Accept-Language": "ru",
      "Content-Type": "application/json;charset=utf-8",
    },
    body: JSON.stringify({
      phrase,
      numPhrases: NUM_PHRASES,
      regions: [REGION_ID],
    }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`auth failed (${res.status})`);
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`${res.status} after ${attempt} tries`);
    const backoff = 1000 * 2 ** attempt;
    console.warn(`  ↻ retry "${phrase}" after ${backoff}ms (${res.status})`);
    await sleep(backoff);
    return callTopRequests(phrase, attempt + 1);
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data?.topRequests) ? data.topRequests : [];
}

async function main() {
  if (!existsSync(SEEDS_FILE)) {
    throw new Error(`${SEEDS_FILE} не найден`);
  }
  if (!DRY_RUN && !TOKEN) {
    throw new Error("WORDSTAT_OAUTH_TOKEN не задан (или DRY_RUN=1).");
  }

  const { seeds } = JSON.parse(readFileSync(SEEDS_FILE, "utf8"));
  const filtered = ONLY_CATEGORY
    ? seeds.filter((s) => s.category === ONLY_CATEGORY)
    : seeds;

  const today = todayISO();
  const outDir = join(DISC_DIR, today);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log(
    `discover: ${filtered.length} seeds → ${outDir}` +
      (ONLY_CATEGORY ? ` (filtered by ${ONLY_CATEGORY})` : ""),
  );

  if (DRY_RUN) {
    console.log("DRY_RUN=1 — сетевые запросы пропущены. Первые 5 seeds:");
    for (const s of filtered.slice(0, 5)) {
      console.log(`  [${s.category}/${s.cluster}] "${s.phrase}"`);
    }
    return;
  }

  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const s of filtered) {
    const slug = slugify(s.phrase);
    const outFile = join(outDir, `${slug}.json`);
    if (existsSync(outFile)) {
      skipped++;
      continue;
    }
    try {
      const phrases = await callTopRequests(s.phrase);
      writeFileSync(
        outFile,
        JSON.stringify(
          {
            seed: s.phrase,
            slug,
            category: s.category,
            cluster: s.cluster,
            fetchedAt: new Date().toISOString(),
            count: phrases.length,
            phrases,
          },
          null,
          2,
        ) + "\n",
      );
      done++;
      if (done % 20 === 0) {
        console.log(`  …${done}/${filtered.length - skipped}`);
      }
      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      console.error(`  ✗ "${s.phrase}": ${err.message}`);
      failed++;
    }
  }

  console.log(
    `discover: готово. fetched=${done}, skipped=${skipped}, failed=${failed}`,
  );
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
