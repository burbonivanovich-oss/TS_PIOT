#!/usr/bin/env node
/**
 * Диагностика — печатает статус организаций, договора и (опционально) креативов в ОРД/ЕРИР.
 *
 * Запуск:
 *   ORD_API_KEY=y0_... node scripts/ord-status.mjs              # организации + договор
 *   ORD_API_KEY=y0_... CREATIVES=1 node scripts/ord-status.mjs  # + все креативы из ord-config.json
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const API_KEY  = process.env.ORD_API_KEY;
const BASE_URL = 'https://ord.yandex.net';
const SHOW_CREATIVES = process.env.CREATIVES === '1';

if (!API_KEY) {
  console.error('❌  ORD_API_KEY не задан.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(join(ROOT, 'src/data/ord-config.json'), 'utf8'));

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const text = await res.text();
  if (!res.ok) return { _httpStatus: res.status, _body: text };
  return JSON.parse(text);
}

function pretty(obj, label) {
  console.log(`\n── ${label}`);
  if (obj._httpStatus) {
    console.log(`  HTTP ${obj._httpStatus}: ${obj._body}`);
    return;
  }
  console.log(`  object_id : ${obj.object_id}`);
  console.log(`  erir_id   : ${obj.erir_id}`);
  console.log(`  status    : ${obj.status}`);
  if (obj.sent_time) console.log(`  sent_time : ${new Date(obj.sent_time * 1000).toISOString()}`);
  if (obj.token) console.log(`  token     : ${obj.token}`);
  if (obj.error_message?.length) {
    console.log(`  errors    :`);
    for (const e of obj.error_message) console.log(`    - ${JSON.stringify(e)}`);
  }
}

async function main() {
  const advertiserId = 'c-FWKJ-MRLBKCtzZcc2U1JLHpZUrW';
  const publisherId  = config.organizationId;
  const contractId   = config.contractId;

  console.log(`📡 ОРД статус-чек\n`);

  pretty(await get(`/api/v7/organization?object_id=${publisherId}`),  `Организация (издатель)   ${publisherId}`);
  pretty(await get(`/api/v7/organization?object_id=${advertiserId}`), `Организация (рекламодат.) ${advertiserId}`);
  pretty(await get(`/api/v7/contract?object_id=${contractId}`),       `Договор                   ${contractId}`);

  if (SHOW_CREATIVES) {
    for (const c of config.creatives) {
      pretty(await get(`/api/v7/creative?object_id=${c.id}`), `Креатив ${c.bannerId} (${c.id})`);
    }
  }
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
