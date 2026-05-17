#!/usr/bin/env node
/**
 * Регистрирует площадку и креативы в Яндекс ОРД через API v7.
 * Организации и договор регистрируются вручную в кабинете https://ord.yandex.ru/.
 *
 * Документация: https://ord.yandex.net/api/docs
 *
 * Запуск:
 *   ORD_API_KEY=y0_... node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... BANNER=kontur-ofd node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... FORCE=1 node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... DRY_RUN=1 node scripts/ord-register.mjs
 *   ORD_API_KEY=y0_... SKIP_PLATFORM=1 node scripts/ord-register.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const API_KEY       = process.env.ORD_API_KEY;
const DRY_RUN       = process.env.DRY_RUN === '1';
const FORCE         = process.env.FORCE === '1';
const SKIP_PLATFORM = process.env.SKIP_PLATFORM === '1';
const ONLY          = process.env.BANNER;
const BASE_URL      = 'https://ord.yandex.net';

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

const { organizationId, contractId, platform, defaults = {}, creatives = [] } = config;

if (!organizationId) {
  console.error('❌  Заполни organizationId в ord-config.json — ID издателя из кабинета ОРД.');
  process.exit(1);
}
if (!contractId) {
  console.error('❌  Заполни contractId в ord-config.json — ID договора из кабинета ОРД.');
  process.exit(1);
}

// ── API-клиент ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ordRequest(method, path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] ${method} ${path}${body ? ' ' + JSON.stringify(body) : ''}`);
    return { _dry: true };
  }
  let lastErr;
  for (let i = 0; i < 4; i++) {
    if (i > 0) {
      console.log(`  ⏳ retry ${i}...`);
      await sleep(2 ** i * 1000);
    }
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (res.status === 429) {
        lastErr = new Error('429 rate limit');
        continue;
      }
      if (!res.ok) throw new Error(`${res.status}: ${text}`);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function saveErids() {
  writeFileSync(
    ERIDS_FILE,
    JSON.stringify({
      _comment: 'Автогенерируется скриптом scripts/ord-register.mjs. Не редактировать вручную.',
      _generated: new Date().toISOString(),
      ...erids,
    }, null, 2) + '\n',
    'utf8'
  );
}

// ── Регистрация площадки ──────────────────────────────────────────────────────

async function registerPlatform() {
  if (!platform) {
    console.log('ℹ️  platform не указан в конфиге — пропуск регистрации площадки.');
    return;
  }
  const res = await ordRequest('POST', '/api/v7/platforms', {
    organizationId,
    platforms: [
      {
        platformId: platform.platformId,
        isOwned:    platform.isOwned ?? true,
        type:       platform.type ?? 'site',
        name:       platform.name,
        ...(platform.url ? { url: platform.url } : {}),
      },
    ],
  });
  if (res._dry) return;
  console.log(`  ✅ Площадка зарегистрирована (request_id=${res.request_id})`);
}

// ── Регистрация креативов ─────────────────────────────────────────────────────

async function registerCreative(c) {
  const body = {
    id: c.id,
    creativeType:  c.creativeType  ?? defaults.creativeType  ?? 'creative',
    form:          c.form          ?? defaults.form          ?? 'text-graphic-block',
    isSocial:      c.isSocial      ?? defaults.isSocial      ?? false,
    isSocialQuota: c.isSocialQuota ?? defaults.isSocialQuota ?? false,
    coBranding:    c.coBranding    ?? defaults.coBranding    ?? false,
    contractIds:   c.contractIds   ?? [contractId],
    kktuCodes:     c.kktuCodes,
    description:   c.description,
    urls:          c.urls,
    ...(c.textData  ? { textData:  c.textData  } : {}),
    ...(c.mediaData ? { mediaData: c.mediaData } : {}),
  };

  const res = await ordRequest('POST', '/api/v7/creative', body);
  if (res._dry) return { erid: `DRY_RUN_${c.id}`, requestId: null, status: 'dry' };

  if (!res.token) {
    throw new Error(`token (erid) не получен: ${JSON.stringify(res)}`);
  }
  return {
    erid:      res.token,
    requestId: res.request_id,
    status:    res.status,
  };
}

async function pollStatus(requestId) {
  if (DRY_RUN || !requestId) return null;
  const TERMINAL_OK    = ['ERIR sync success', 'ERIR async success'];
  const TERMINAL_ERROR = ['ERIR sync error',   'ERIR async error', 'ORD error', 'ORD rejected'];
  for (let i = 0; i < 6; i++) {
    await sleep(2000 + i * 1500);
    try {
      const res = await ordRequest('GET', `/api/v7/status?reqid=${encodeURIComponent(requestId)}`);
      if (TERMINAL_OK.includes(res.status))    return { ok: true,  status: res.status };
      if (TERMINAL_ERROR.includes(res.status)) return { ok: false, status: res.status, error: res.error_message };
    } catch (e) {
      console.log(`     status check ${i + 1}: ${e.message}`);
    }
  }
  return { ok: null, status: 'pending' };
}

// ── Главный цикл ──────────────────────────────────────────────────────────────

async function run() {
  if (DRY_RUN) console.log('⚠️  DRY_RUN — запросы не отправляются\n');

  console.log(`📡 Издатель:    ${organizationId}`);
  console.log(`📜 Договор:     ${contractId}`);
  console.log(`🌐 Площадка:    ${platform?.url ?? '(не указано)'}`);

  if (SKIP_PLATFORM) {
    console.log('\nℹ️  SKIP_PLATFORM=1 — регистрацию площадки пропускаем\n');
  } else {
    console.log('\n── Регистрация площадки');
    try {
      await registerPlatform();
    } catch (err) {
      console.error(`  ❌ Площадка: ${err.message}`);
      console.error('     Если уже зарегистрирована вручную — запусти с SKIP_PLATFORM=1.');
      process.exit(1);
    }
  }

  const targets = ONLY ? creatives.filter((c) => c.bannerId === ONLY) : creatives;
  if (!targets.length) {
    console.log(ONLY ? `\n⚠️  bannerId="${ONLY}" не найден в ord-config.json` : '\nℹ️  Список creatives пуст.');
    return;
  }

  let registered = 0, skipped = 0, failed = 0;

  for (const c of targets) {
    console.log(`\n── ${c.bannerId} (${c.id})`);

    if (erids[c.bannerId] && !FORCE) {
      console.log(`  ⏭  erid уже есть: ${erids[c.bannerId]}`);
      skipped++;
      continue;
    }

    try {
      const { erid, requestId, status } = await registerCreative(c);
      console.log(`  ✅ erid=${erid}  status=${status}  request_id=${requestId}`);
      erids[c.bannerId] = erid;
      saveErids();
      registered++;

      const check = await pollStatus(requestId);
      if (check) {
        if (check.ok === true) {
          console.log(`     ERIR: ${check.status}`);
        } else if (check.ok === false) {
          console.log(`     ⚠️  ERIR ошибка: ${check.status}  ${JSON.stringify(check.error ?? '')}`);
        } else {
          console.log(`     ℹ️  ERIR: ещё обрабатывается (token уже валиден)`);
        }
      }
    } catch (err) {
      console.error(`  ❌ Ошибка: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ ${registered}  ⏭ ${skipped}  ❌ ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
