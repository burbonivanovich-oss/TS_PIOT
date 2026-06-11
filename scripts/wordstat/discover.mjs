#!/usr/bin/env node
// Trend discovery: дёргает topRequests (Yandex Cloud Search API v2) на каждый
// seed из seeds.json и сохраняет до 2000 фраз вокруг seed-а. Сравнение с прошлой
// выгрузкой делает diff-snapshots.mjs.
//
// ВАЖНО: старый api.wordstat.yandex.net/v1 отключён — используем Yandex Search
// API (Api-Key сервисного аккаунта + folderId каталога в теле запроса).
//
// Окружение:
//   YC_API_KEY           — Api-Key сервисного аккаунта (обязателен, кроме DRY_RUN)
//   YC_FOLDER_ID         — ID каталога Yandex Cloud (обязателен, кроме DRY_RUN)
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

const API = "https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests";
const API_KEY = process.env.YC_API_KEY || "";
const FOLDER_ID = process.env.YC_FOLDER_ID || "";
const DRY_RUN = process.env.DRY_RUN === "1";
const REGION_ID = String(process.env.REGION_ID || "225");
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
      "Authorization": `Api-Key ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folderId: FOLDER_ID,
      phrase,
      numPhrases: NUM_PHRASES,
      regions: [REGION_ID],
      devices: ["DEVICE_ALL"],
    }),
  });
  const txt = await res.text();
  let data = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    /* не-JSON — ниже как ошибка */
  }
  const grpcCode = data && typeof data.code === "number" ? data.code : null;
  if (!res.ok || grpcCode !== null) {
    const code = grpcCode ?? res.status;
    const msg = (data && data.message) || txt.slice(0, 200);
    const transient = code === 13 || res.status === 429 || res.status >= 500;
    if (transient && attempt < 4) {
      const backoff = 1000 * 2 ** attempt;
      console.warn(`  ↻ retry "${phrase}" after ${backoff}ms (code ${code})`);
      await sleep(backoff);
      return callTopRequests(phrase, attempt + 1);
    }
    throw new Error(`code ${code}: ${msg}`);
  }
  // count приходит строкой — нормализуем к числу.
  const arr = Array.isArray(data?.results) ? data.results : [];
  return arr.map((r) => ({
    phrase: String(r.phrase || ""),
    count: parseInt(r.count, 10) || 0,
  }));
}

async function main() {
  if (!existsSync(SEEDS_FILE)) {
    throw new Error(`${SEEDS_FILE} не найден`);
  }
  if (!DRY_RUN && (!API_KEY || !FOLDER_ID)) {
    throw new Error("YC_API_KEY и YC_FOLDER_ID обязательны (или DRY_RUN=1).");
  }
  if (!DRY_RUN) {
    console.log(
      `[WORDSTAT] folder_id=${FOLDER_ID} api_key_len=${API_KEY.length} ` +
        `api_key_tail=${API_KEY.slice(-4)}`,
    );
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
