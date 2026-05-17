#!/usr/bin/env node
/**
 * Синхронизирует CPA-баннеры с Яндекс ОРД.
 * Для каждого баннера в ord-config.json, у которого нет erid:
 *   1. Регистрирует площадку (идемпотентно)
 *   2. Регистрирует организацию издателя (идемпотентно)
 *   3. Регистрирует организацию рекламодателя (идемпотентно)
 *   4. Создаёт договор (идемпотентно)
 *   5. Регистрирует креатив → получает erid
 *   6. Записывает erid в src/data/ord-erids.json
 *
 * Запуск:
 *   ORD_API_KEY=y0_... node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... BANNER=kontur-ofd node scripts/ord-register.mjs   # один баннер
 *   ORD_API_KEY=y0_... DRY_RUN=1 node scripts/ord-register.mjs           # без запросов
 *   ORD_API_KEY=y0_... FORCE=1 node scripts/ord-register.mjs             # перерегистрировать всё
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

// ── Валидация ─────────────────────────────────────────────────────────────────

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

const { publisher, platform, advertisers = [] } = config;

// ── API-клиент ────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ordRequest(method, path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] ${method} ${path}`);
    return { _dry: true };
  }

  let lastErr;
  for (let i = 0; i < 4; i++) {
    if (i > 0) await sleep(2 ** i * 1000);
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (res.status === 429) { lastErr = new Error('429'); continue; }
      if (!res.ok) throw new Error(`${res.status}: ${text}`);
      return JSON.parse(text);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// ── Проверка заполненности ────────────────────────────────────────────────────

function hasMissing(obj, fields) {
  return fields.filter(f => {
    const v = obj?.[f];
    return !v || (typeof v === 'string' && v.startsWith('REPLACE'));
  });
}

// ── Шаги регистрации ──────────────────────────────────────────────────────────

async function ensurePlatform() {
  const res = await ordRequest('POST', '/api/external/platform', {
    externalPlatformId: platform.externalId,
    platformType:       platform.platformType,
    url:                platform.url,
    appName:            platform.appName,
  });
  if (!res._dry) console.log(`  ✅ Площадка: ${res.platform?.platformId ?? 'уже зарегистрирована'}`);
}

async function ensureOrg(org, label) {
  const missing = hasMissing(org, ['inn', 'fullOpf', 'legalType']);
  if (missing.length) {
    console.warn(`  ⚠️  ${label}: заполните в ord-config.json: ${missing.join(', ')}`);
    return false;
  }
  const res = await ordRequest('POST', '/api/external/organisation', {
    externalOrganisationId: org.externalId,
    inn:         org.inn,
    fullOpf:     org.fullOpf,
    legalType:   org.legalType,
    isOpc:       org.isOpc ?? false,
    isPp:        org.isPp ?? false,
    legalAddress: org.legalAddress,
    postAddress:  org.legalAddress,
  });
  if (!res._dry) console.log(`  ✅ Орг ${label}: ${res.organisation?.organisationId ?? 'уже есть'}`);
  return true;
}

async function ensureContract(contract, publisherExtId, advertiserExtId) {
  const missing = hasMissing(contract, ['number', 'date', 'type', 'actionType', 'subjectType']);
  if (missing.length) {
    console.warn(`  ⚠️  Договор: заполните в ord-config.json: ${missing.join(', ')}`);
    return false;
  }
  const res = await ordRequest('POST', '/api/external/contract', {
    externalContractId:               contract.externalId,
    contractNumber:                   contract.number,
    contractDate:                     contract.date,
    contractType:                     contract.type,
    actionType:                       contract.actionType,
    subjectType:                      contract.subjectType,
    withNds:                          contract.withNds ?? false,
    externalOrganisationCustomerId:   advertiserExtId,
    externalOrganisationPerformerId:  publisherExtId,
  });
  if (!res._dry) console.log(`  ✅ Договор: ${res.contract?.contractId ?? 'уже есть'}`);
  return true;
}

async function registerCreative(creative, advertiserExtId) {
  const res = await ordRequest('POST', '/api/external/creative', {
    externalCreativeId:              creative.externalId,
    externalOrganisationAdvertiserId: advertiserExtId,
    name:         creative.name,
    creativeType: creative.type,
  });
  if (res._dry) return 'DRY_RUN_PLACEHOLDER';
  const erid = res.creative?.erid;
  console.log(`  ✅ erid = ${erid}`);
  return erid;
}

function saveErids() {
  const out = {
    _comment:   'Автогенерируется скриптом scripts/ord-register.mjs. Не редактировать вручную.',
    _generated: new Date().toISOString(),
    ...erids,
  };
  writeFileSync(ERIDS_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

// ── Главный цикл ──────────────────────────────────────────────────────────────

async function run() {
  if (DRY_RUN) console.log('⚠️  DRY_RUN — запросы в API не отправляются\n');

  // Проверяем реквизиты издателя
  const pubMissing = hasMissing(publisher, ['inn', 'fullOpf', 'legalType']);
  if (pubMissing.length) {
    console.error(`❌  Заполните publisher в ord-config.json: ${pubMissing.join(', ')}`);
    process.exit(1);
  }

  // Регистрируем площадку
  console.log(`\n📡 Площадка: ${platform.url}`);
  await ensurePlatform();

  // Регистрируем издателя
  console.log(`\n🏢 Издатель: ${publisher.inn}`);
  await ensureOrg(publisher, 'издатель');

  // Фильтруем рекламодателей
  const targets = ONLY
    ? advertisers.filter(a => a.bannerId === ONLY)
    : advertisers;

  if (!targets.length) {
    console.log(ONLY
      ? `\n⚠️  bannerId="${ONLY}" не найден в ord-config.json`
      : '\nℹ️  Рекламодателей нет. Добавьте их в ord-config.json по шаблону.');
    return;
  }

  let registered = 0;
  let skipped = 0;
  let failed = 0;

  for (const adv of targets) {
    console.log(`\n${'─'.repeat(60)}\n🎯 ${adv.bannerId}`);

    if (erids[adv.bannerId] && !FORCE) {
      console.log(`  ⏭  erid уже есть: ${erids[adv.bannerId]}`);
      skipped++;
      continue;
    }

    // Рекламодатель
    const orgOk = await ensureOrg(adv, adv.bannerId);
    if (!orgOk && !DRY_RUN) { failed++; continue; }

    // Договор
    const contractOk = await ensureContract(adv.contract, publisher.externalId, adv.externalId);
    if (!contractOk && !DRY_RUN) { failed++; continue; }

    // Креатив → erid
    const erid = await registerCreative(adv.creative, adv.externalId);
    if (erid) {
      erids[adv.bannerId] = erid;
      saveErids(); // сохраняем сразу, чтобы не потерять при ошибке на следующем баннере
      registered++;
    } else {
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ зарегистрировано: ${registered}  ⏭ пропущено: ${skipped}  ❌ ошибок: ${failed}`);

  if (registered > 0) {
    console.log(`\nСледующий шаг: закоммитить src/data/ord-erids.json`);
  }

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
