#!/usr/bin/env node
/**
 * Регистрирует креативы в Яндекс ОРД и сохраняет erid-токены.
 * Организации и договор уже зарегистрированы вручную — скрипт только создаёт креативы.
 *
 * Запуск:
 *   ORD_API_KEY=y0_... node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... BANNER=kontur-ofd node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... FORCE=1 node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... DRY_RUN=1 node scripts/ord-register.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const API_KEY  = process.env.ORD_API_KEY;
const DRY_RUN  = process.env.DRY_RUN === '1';
const FORCE    = process.env.FORCE === '1';
const ONLY     = process.env.BANNER;
const BASE_URL = 'https://ord.yandex.net';

const ERIDS_FILE  = join(ROOT, 'src/data/ord-erids.json');
const CONFIG_FILE = join(ROOT, 'src/data/ord-config.json');

if (!API_KEY) {
  console.error('❌  ORD_API_KEY не задан.');
  process.exit(1);
}

// ── Загрузка ──────────────────────────────────────────────────────────────────

let erids = {};
try {
  const raw = JSON.parse(readFileSync(ERIDS_FILE, 'utf8'));
  erids = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
} catch { /* первый запуск */ }

let config;
try {
  config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
} catch {
  console.error('❌  src/data/ord-config.json не найден.');
  process.exit(1);
}

const { platform, advertiserExternalId, creatives = [] } = config;

if (!advertiserExternalId || advertiserExternalId.startsWith('REPLACE')) {
  console.error('❌  Заполните advertiserExternalId в ord-config.json — внешний ID рекламодателя из кабинета ОРД.');
  process.exit(1);
}

// ── API-клиент ────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ordRequest(method, path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] ${method} ${path}`);
    return { _dry: true };
  }
  let lastErr;
  for (let i = 0; i < 4; i++) {
    if (i > 0) { console.log(`  ⏳ retry ${i}...`); await sleep(2 ** i * 1000); }
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (res.status === 429) { lastErr = new Error('429 rate limit'); continue; }
      if (!res.ok) throw new Error(`${res.status}: ${text}`);
      return JSON.parse(text);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function saveErids() {
  writeFileSync(ERIDS_FILE, JSON.stringify({
    _comment:   'Автогенерируется скриптом scripts/ord-register.mjs. Не редактировать вручную.',
    _generated: new Date().toISOString(),
    ...erids,
  }, null, 2) + '\n', 'utf8');
}

// ── Регистрация ───────────────────────────────────────────────────────────────

async function ensurePlatform() {
  const res = await ordRequest('POST', '/api/external/platform', {
    externalPlatformId: platform.externalId,
    platformType:       platform.platformType,
    url:                platform.url,
    appName:            platform.appName,
  });
  if (!res._dry) console.log(`  ✅ Площадка зарегистрирована`);
}

async function registerCreative(creative) {
  const res = await ordRequest('POST', '/api/external/creative', {
    externalCreativeId:               creative.externalId,
    externalOrganisationAdvertiserId: advertiserExternalId,
    name:         creative.name,
    creativeType: creative.type,
  });
  if (res._dry) return `DRY_RUN_${creative.externalId}`;
  const erid = res.creative?.erid;
  if (!erid) throw new Error(`erid не получен: ${JSON.stringify(res)}`);
  console.log(`  ✅ erid = ${erid}`);
  return erid;
}

// ── Главный цикл ──────────────────────────────────────────────────────────────

async function run() {
  if (DRY_RUN) console.log('⚠️  DRY_RUN — запросы не отправляются\n');

  console.log(`📡 Площадка: ${platform.url}`);
  await ensurePlatform();

  const targets = ONLY
    ? creatives.filter(c => c.bannerId === ONLY)
    : creatives;

  if (!targets.length) {
    console.log(ONLY ? `\n⚠️  bannerId="${ONLY}" не найден в ord-config.json` : '\nℹ️  Список creatives пуст.');
    return;
  }

  let registered = 0, skipped = 0, failed = 0;

  for (const creative of targets) {
    console.log(`\n── ${creative.bannerId}`);

    if (erids[creative.bannerId] && !FORCE) {
      console.log(`  ⏭  erid уже есть: ${erids[creative.bannerId]}`);
      skipped++;
      continue;
    }

    try {
      const erid = await registerCreative(creative);
      erids[creative.bannerId] = erid;
      saveErids();
      registered++;
    } catch (err) {
      console.error(`  ❌ Ошибка: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ ${registered}  ⏭ ${skipped}  ❌ ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('\n❌', err.message); process.exit(1); });
