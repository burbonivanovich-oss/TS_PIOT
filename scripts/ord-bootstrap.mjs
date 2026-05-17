#!/usr/bin/env node
/**
 * Bootstrap: регистрирует через API организации, договор и площадку,
 * на которые потом ссылаются креативы. Запускается один раз.
 *
 * UI-кабинет и API в Яндекс-ОРД ведут разные коллекции — объекты из кабинета
 * через API не существуют. Поэтому всю цепочку приходится создавать тем же
 * методом, которым будут регистрироваться креативы.
 *
 *   ORD_API_KEY=y0_... node scripts/ord-bootstrap.mjs
 *   ORD_API_KEY=y0_... DRY_RUN=1 node scripts/ord-bootstrap.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const API_KEY  = process.env.ORD_API_KEY;
const DRY_RUN  = process.env.DRY_RUN === '1';
const BASE_URL = 'https://ord.yandex.net';

if (!API_KEY) {
  console.error('❌  ORD_API_KEY не задан.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(join(ROOT, 'src/data/ord-config.json'), 'utf8'));
const { organizationId, bootstrap, platform } = config;

if (!bootstrap?.organizations?.length || !bootstrap?.contract) {
  console.error('❌  В ord-config.json нет секции bootstrap.organizations / bootstrap.contract.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ord(method, path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] ${method} ${path}  ${body ? JSON.stringify(body) : ''}`);
    return { _dry: true };
  }
  for (let i = 0; i < 4; i++) {
    if (i > 0) { console.log(`  ⏳ retry ${i}...`); await sleep(2 ** i * 1000); }
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`${res.status}: ${text}`);
    return JSON.parse(text);
  }
  throw new Error('429: rate limit exhausted');
}

async function pollStatus(requestId, label) {
  if (DRY_RUN || !requestId) return;
  const OK = ['ERIR sync success', 'ERIR async success'];
  const ER = ['ERIR sync error',   'ERIR async error', 'ORD error', 'ORD rejected'];
  for (let i = 0; i < 8; i++) {
    await sleep(2000 + i * 1500);
    try {
      const r = await ord('GET', `/api/v7/status?reqid=${encodeURIComponent(requestId)}`);
      if (OK.includes(r.status)) { console.log(`     ${label}: ${r.status}`); return; }
      if (ER.includes(r.status)) {
        console.log(`     ⚠️  ${label}: ${r.status}  ${JSON.stringify(r.error_message ?? '')}`);
        return;
      }
    } catch (e) {
      console.log(`     status check ${i + 1}: ${e.message}`);
    }
  }
  console.log(`     ${label}: ещё обрабатывается`);
}

async function registerOrg(org) {
  console.log(`\n── Организация ${org.id}  (${org.name})`);
  const res = await ord('POST', '/api/v7/organization', org);
  if (res._dry) return;
  console.log(`  ✅ erir_id=${res.erir_id ?? '-'}  status=${res.status}  request_id=${res.request_id}`);
  await pollStatus(res.request_id, 'ERIR');
}

async function registerContract(c) {
  console.log(`\n── Договор ${c.id}  (${c.number})`);
  const res = await ord('POST', '/api/v7/contract', c);
  if (res._dry) return;
  console.log(`  ✅ erir_id=${res.erir_id ?? '-'}  status=${res.status}  request_id=${res.request_id}`);
  await pollStatus(res.request_id, 'ERIR');
}

async function registerPlatform() {
  if (!platform) {
    console.log('\nℹ️  platform в конфиге не указан — пропуск.');
    return;
  }
  console.log(`\n── Площадка ${platform.platformId}  (${platform.url})`);
  const res = await ord('POST', '/api/v7/platforms', {
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
  console.log(`  ✅ status=${res.status}  request_id=${res.request_id}`);
  await pollStatus(res.request_id, 'ERIR');
}

async function main() {
  if (DRY_RUN) console.log('⚠️  DRY_RUN — запросы не отправляются\n');
  console.log('📡 Bootstrap ОРД');

  for (const org of bootstrap.organizations) {
    try { await registerOrg(org); }
    catch (e) { console.error(`  ❌ ${e.message}`); process.exit(1); }
  }

  try { await registerContract(bootstrap.contract); }
  catch (e) { console.error(`  ❌ ${e.message}`); process.exit(1); }

  try { await registerPlatform(); }
  catch (e) { console.error(`  ❌ ${e.message}`); process.exit(1); }

  console.log('\n✅ Bootstrap завершён. Запусти ORD Sync для регистрации креативов.');
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
