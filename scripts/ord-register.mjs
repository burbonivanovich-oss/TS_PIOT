#!/usr/bin/env node
/**
 * Регистрирует CPA-баннеры в Яндекс ОРД, получает erid-токены.
 * Результат сохраняется в src/data/ord-erids.json и коммитится в репозиторий.
 *
 * Запуск:
 *   ORD_API_KEY=y0_... node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... BANNER=chestny-znak node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... DRY_RUN=1 node scripts/ord-register.mjs
 *
 * Переменные окружения:
 *   ORD_API_KEY  — API-ключ Яндекс ОРД (обязателен)
 *   BANNER       — slug баннера для одиночной регистрации
 *   DRY_RUN=1    — проверить конфиг, не делая запросов в API
 *   FORCE=1      — перерегистрировать даже если erid уже есть
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const API_KEY = process.env.ORD_API_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';
const FORCE = process.env.FORCE === '1';
const ONLY_BANNER = process.env.BANNER;

// ── Валидация ────────────────────────────────────────────────────────────────

if (!API_KEY) {
  console.error('❌  ORD_API_KEY не задан.');
  console.error('    Запуск: ORD_API_KEY=y0_... node scripts/ord-register.mjs');
  process.exit(1);
}

const ERIDS_FILE = join(ROOT, 'src/data/ord-erids.json');
const CONFIG_FILE = join(ROOT, 'src/data/ord-config.json');
const BASE_URL = 'https://ord.yandex.net';

// ── Загрузка данных ───────────────────────────────────────────────────────────

let erids = {};
try {
  const raw = JSON.parse(readFileSync(ERIDS_FILE, 'utf8'));
  // Убираем служебные поля
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('_')) erids[k] = v;
  }
} catch { /* первый запуск */ }

let config;
try {
  config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
} catch {
  console.error('❌  src/data/ord-config.json не найден или повреждён.');
  process.exit(1);
}

const { publisher, platform, advertisers = [] } = config;

// ── API-клиент ───────────────────────────────────────────────────────────────

async function ordRequest(method, path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 120) : '');
    return { _dry_run: true };
  }

  const url = `${BASE_URL}${path}`;
  let lastErr;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2 ** attempt * 1000);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await res.text();
      if (res.status === 429) {
        console.warn(`  ⏳ Rate limit, ждём...`);
        lastErr = new Error(`429: ${text}`);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status}: ${text}`);
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Шаги регистрации ─────────────────────────────────────────────────────────

async function ensurePlatform() {
  console.log(`\n📡 Регистрация площадки: ${platform.url}`);
  const res = await ordRequest('POST', '/api/external/platform', {
    externalPlatformId: platform.externalId,
    platformType: platform.platformType,
    url: platform.url,
    appName: platform.appName,
  });
  if (!res._dry_run) {
    console.log(`   ✅ platformId = ${res.platform?.platformId ?? '(уже зарегистрирована)'}`);
  }
  return res;
}

async function ensureOrganisation(org, label) {
  const missingFields = ['inn', 'fullOpf', 'legalType'].filter(f => !org[f] || org[f].startsWith('REPLACE'));
  if (missingFields.length) {
    console.warn(`   ⚠️  ${label}: заполните поля в ord-config.json: ${missingFields.join(', ')}`);
    return null;
  }

  console.log(`\n🏢 Регистрация организации: ${org.name ?? label} (ИНН ${org.inn})`);
  const res = await ordRequest('POST', '/api/external/organisation', {
    externalOrganisationId: org.externalId,
    inn: org.inn,
    fullOpf: org.fullOpf,
    legalType: org.legalType,
    isOpc: org.isOpc ?? false,
    isPp: org.isPp ?? false,
    legalAddress: org.legalAddress,
    postAddress: org.legalAddress,
  });
  if (!res._dry_run) {
    console.log(`   ✅ organisationId = ${res.organisation?.organisationId}`);
  }
  return res;
}

async function ensureContract(contract, publisherExtId, advertiserExtId) {
  const missingFields = ['number', 'date', 'type', 'actionType', 'subjectType'].filter(
    f => !contract[f] || (typeof contract[f] === 'string' && contract[f].startsWith('REPLACE'))
  );
  if (missingFields.length) {
    console.warn(`   ⚠️  Контракт: заполните поля в ord-config.json: ${missingFields.join(', ')}`);
    return null;
  }

  console.log(`\n📄 Регистрация договора: ${contract.number ?? contract.externalId}`);
  const res = await ordRequest('POST', '/api/external/contract', {
    externalContractId: contract.externalId,
    contractNumber: contract.number,
    contractDate: contract.date,
    contractType: contract.type,
    actionType: contract.actionType,
    subjectType: contract.subjectType,
    withNds: contract.withNds ?? false,
    externalOrganisationCustomerId: advertiserExtId,
    externalOrganisationPerformerId: publisherExtId,
  });
  if (!res._dry_run) {
    console.log(`   ✅ contractId = ${res.contract?.contractId}`);
  }
  return res;
}

async function registerCreative(creative, advertiserExtId) {
  console.log(`\n🎨 Регистрация креатива: ${creative.name}`);
  const res = await ordRequest('POST', '/api/external/creative', {
    externalCreativeId: creative.externalId,
    externalOrganisationAdvertiserId: advertiserExtId,
    name: creative.name,
    creativeType: creative.type,
  });
  if (!res._dry_run) {
    const erid = res.creative?.erid;
    console.log(`   ✅ erid = ${erid}`);
    return erid;
  }
  return null;
}

// ── Главный цикл ─────────────────────────────────────────────────────────────

async function run() {
  console.log(`🔑 ORD_API_KEY: ${API_KEY.slice(0, 8)}...`);
  if (DRY_RUN) console.log('⚠️  Режим DRY_RUN — запросы в API не отправляются\n');

  // 1. Площадка
  await ensurePlatform();

  // 2. Паблишер (нужен как сторона договора)
  const pubMissingFields = ['inn', 'fullOpf', 'legalType'].filter(
    f => !publisher[f] || publisher[f].startsWith('REPLACE')
  );
  if (pubMissingFields.length) {
    console.error(`\n❌ Заполните реквизиты publisher в ord-config.json: ${pubMissingFields.join(', ')}`);
    process.exit(1);
  }
  await ensureOrganisation(publisher, 'publisher');

  // 3. Рекламодатели
  const targets = ONLY_BANNER
    ? advertisers.filter(a => a.bannerId === ONLY_BANNER)
    : advertisers;

  if (targets.length === 0) {
    console.log(ONLY_BANNER
      ? `\n⚠️  Рекламодатель с bannerId="${ONLY_BANNER}" не найден в ord-config.json`
      : '\nℹ️  В ord-config.json нет рекламодателей. Добавьте их по шаблону.');
    return;
  }

  let registered = 0;
  let skipped = 0;

  for (const adv of targets) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Баннер: ${adv.bannerId}`);

    // Уже есть erid и FORCE не задан
    if (erids[adv.bannerId] && !FORCE) {
      console.log(`  ⏭  erid уже есть: ${erids[adv.bannerId]}. Пропускаем (FORCE=1 чтобы перерегистрировать)`);
      skipped++;
      continue;
    }

    // Регистрируем рекламодателя
    const advOrg = await ensureOrganisation(adv, adv.bannerId);
    if (!advOrg && !DRY_RUN) { skipped++; continue; }

    // Регистрируем договор
    const contract = await ensureContract(adv.contract, publisher.externalId, adv.externalId);
    if (!contract && !DRY_RUN) { skipped++; continue; }

    // Регистрируем креатив и получаем erid
    const erid = await registerCreative(adv.creative, adv.externalId);

    if (erid) {
      erids[adv.bannerId] = erid;
      registered++;
    } else if (DRY_RUN) {
      erids[adv.bannerId] = 'DRY_RUN_ERID_PLACEHOLDER';
      registered++;
    }
  }

  // 4. Сохраняем
  const output = {
    _comment: 'Автогенерируется скриптом scripts/ord-register.mjs. Не редактировать вручную.',
    _generated: new Date().toISOString(),
    ...erids,
  };

  if (!DRY_RUN || registered > 0) {
    writeFileSync(ERIDS_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`\n✅ Сохранено в src/data/ord-erids.json`);
  }

  console.log(`\nИтого: зарегистрировано ${registered}, пропущено ${skipped}`);
  if (registered > 0) {
    console.log(`\nСледующий шаг: закоммитить src/data/ord-erids.json → баннеры автоматически получат плашку «Реклама»`);
  }
}

run().catch(err => {
  console.error('\n❌ Ошибка:', err.message);
  process.exit(1);
});
