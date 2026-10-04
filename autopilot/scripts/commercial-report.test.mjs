import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  computeCommercialReport,
  formatMetric,
  formatReport,
  runReport,
} from './commercial-report.mjs';

function makeDataDir() {
  return mkdtempSync(path.join(tmpdir(), 'comm-'));
}

// Каталог данных подсовываем через AUTOPILOT_DATA_DIR — так понимает
// scripts/lib/config.mjs, и resolveDataDir читает её при каждом вызове.
function useDataDir(dir) {
  const prev = process.env.AUTOPILOT_DATA_DIR;
  process.env.AUTOPILOT_DATA_DIR = dir;
  return () => {
    if (prev === undefined) delete process.env.AUTOPILOT_DATA_DIR;
    else process.env.AUTOPILOT_DATA_DIR = prev;
  };
}

function cleanup(dir, restore) {
  restore();
  rmSync(dir, { recursive: true, force: true });
}

function writeExport(dir, obj, mtime = null) {
  const analyticsDir = path.join(dir, 'analytics');
  mkdirSync(analyticsDir, { recursive: true });
  const file = path.join(analyticsDir, 'export.json');
  writeFileSync(file, JSON.stringify(attachLeadReceipt(dir,obj)), 'utf8');
  if (mtime) utimesSync(file, mtime, mtime);
  return file;
}

function attachLeadReceipt(dir,obj) {
  const out={...obj};
  if(obj.confirmation?.validLeads) {
    mkdirSync(path.join(dir,'receipts'),{recursive:true});
    const bytes=JSON.stringify({fixtureOnly:true,reportedValues:obj});
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const evidenceRef=`receipts/lead-${sha256}.json`;writeFileSync(path.join(dir,evidenceRef),bytes);
    out.confirmation={validLeads:{...obj.confirmation.validLeads,evidenceRef,sha256}};
  }
  for(const key of ['bySource','byOffer']) if(obj[key]) out[key]=Object.fromEntries(Object.entries(obj[key]).map(([name,value])=>[name,attachLeadReceipt(dir,value)]));
  return out;
}

function window(now = new Date(), days = 7) {
  const from = new Date(now); from.setUTCDate(from.getUTCDate() - days + 1);
  return {from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),timeZone:'UTC'};
}
function partnerProof() { return {period:window(),currency:'RUB',verification:{source:'partner-cabinet',verifiedAt:new Date().toISOString(),evidenceRef:'fixture-cabinet-report'}}; }

function attachReceipt(dir, obj, filename='partner.csv') {
  mkdirSync(path.join(dir,'receipts'),{recursive:true});
  const bytes=JSON.stringify({fixtureOnly:true,reportedValues:obj});
  writeFileSync(path.join(dir,'receipts',filename),bytes);
  return obj.verification ? {...obj,verification:{...obj.verification,evidenceRef:`receipts/${filename}`,sha256:createHash('sha256').update(bytes).digest('hex')}} : obj;
}
function writePartner(dir, obj) {
  const partnerDir = path.join(dir, 'partner');
  mkdirSync(partnerDir, { recursive: true });
  const file = path.join(partnerDir, 'attribution.json');
  writeFileSync(file, JSON.stringify(attachReceipt(dir,{...partnerProof(), ...obj})), 'utf8');
  return file;
}

const freshExport = (over = {}) => ({
  period: window(),
  fetchedAt: new Date().toISOString(),
  users: 1000,
  offerImpressions: 2000,
  ctaCtr: 0.04,
  productViews: 300,
  formStarts: 120,
  validLeads: 80,
  paymentClicks: 25,
  ...over,
});

const auditNow = new Date('2026-10-04T12:00:00Z');
function datedExport(over = {}) { return freshExport({fetchedAt:auditNow.toISOString(),asOf:auditNow.toISOString(),period:window(auditNow),...over}); }
function datedPartner(over = {}) { return {fetchedAt:auditNow.toISOString(),period:window(auditNow),currency:'RUB',verification:{source:'partner-cabinet',verifiedAt:auditNow.toISOString(),evidenceRef:'fixture-audit-only'},...over}; }
function withData(fn) { const dir=makeDataDir(); try { fn(dir); } finally { rmSync(dir,{recursive:true,force:true}); } }

test('report window has exactly N inclusive UTC dates, and unrelated newer exports do not replace it', () => withData(dir => {
  writeExport(dir,datedExport({users:12}));
  writeFileSync(path.join(dir,'analytics','other-period.json'),JSON.stringify(datedExport({period:{...window(auditNow),from:'2026-10-01'},users:999,fetchedAt:'2026-10-04T12:01:00Z'})));
  const r=computeCommercialReport({dir,now:auditNow,days:7});
  assert.deepEqual(r.period,{from:'2026-09-28',to:'2026-10-04',days:7,timeZone:'UTC'});
  assert.equal(r.metrics.users.value,12);
}));
test('new file mtime cannot rehabilitate missing, stale, future, invalid-date or wrong-window data', () => withData(dir => {
  for (const overrides of [{fetchedAt:null},{fetchedAt:'2026-10-02T12:00:00Z'},{fetchedAt:'2026-10-05T12:00:00Z'},{fetchedAt:'2026-02-30T12:00:00Z'},{period:null},{period:{from:'2026-09-28',to:'2026-10-04'}},{period:{from:'2026-09-29',to:'2026-10-04',timeZone:'UTC'}}]) {
    writeExport(dir,datedExport(overrides));
    const m=computeCommercialReport({dir,now:auditNow}).metrics.users;
    assert.equal(m.status,'no-data',JSON.stringify(overrides)); assert.equal(m.value,null);
  }
}));
test('freshest actual matching collection wins independently of file copy times', () => withData(dir => {
  const file=writeExport(dir,datedExport({fetchedAt:'2026-10-04T11:00:00Z',users:10}));
  const newer=path.join(dir,'analytics','snapshot.json');
  writeFileSync(newer,JSON.stringify(datedExport({users:20})));
  utimesSync(newer,new Date('2020-01-01'),new Date('2020-01-01'));
  utimesSync(file,auditNow,auditNow);
  assert.equal(computeCommercialReport({dir,now:auditNow}).metrics.users.value,20);
}));
test('partner file presence is not verification; currency, period, freshness and evidence are required', () => withData(dir => {
  for (const overrides of [{verification:null},{currency:'USD'},{period:null},{fetchedAt:'2026-09-01T12:00:00Z'},{verification:{source:'partner-cabinet',verifiedAt:'2026-10-05T12:00:00Z',evidenceRef:'x'}}]) {
    writePartner(dir,datedPartner({paid:1000,commission:50,...overrides}));
    const r=computeCommercialReport({dir,now:auditNow});
    assert.equal(r.metrics.paid.status,'unverified'); assert.equal(r.revenue.value,null);
  }
}));
test('customer payments, accrued commission and cash payouts stay distinct, including zero', () => withData(dir => {
  writePartner(dir,datedPartner({paid:1000,commission:50,payout:0,invoices:4,invoicesAmount:2000}));
  const r=computeCommercialReport({dir,now:auditNow});
  assert.equal(r.customerPayments.value,1000);assert.equal(r.revenue.value,50);assert.equal(r.cashReceived.value,0);
  writePartner(dir,datedPartner({paid:1000,payout:0}));
  assert.equal(computeCommercialReport({dir,now:auditNow}).revenue.status,'unverified');
}));
test('attempt counts cannot become confirmed valid leads and invalid numeric fields remain unknown', () => withData(dir => {
  writeExport(dir,datedExport({users:-1,offerImpressions:2.5,ctaCtr:1.2,validLeads:10}));
  const r=computeCommercialReport({dir,now:auditNow});
  for (const key of ['users','offerImpressions','ctaCtr','validLeads']) assert.equal(r.metrics[key].status,'no-data',key);
  writeExport(dir,datedExport({validLeads:0,confirmation:{validLeads:{source:'server-accepted',evidenceRef:'fixture-server-receipt'}}}));
  assert.equal(computeCommercialReport({dir,now:auditNow}).metrics.validLeads.value,0);
}));
test('conversion requires unique complete comparable cohorts, never event intensity', () => withData(dir => {
  const basis={unit:'visitors',cohort:'same-window-and-offer',unique:true,complete:true,subsetOf:['users']};
  const good={users:10,offerImpressions:4,measurement:{users:basis,offerImpressions:basis}};
  writeExport(dir,datedExport(good));
  assert.equal(computeCommercialReport({dir,now:auditNow}).cr.offerReach.value,0.4);
  for (const bad of [{...basis,unit:'events'},{...basis,cohort:'different'},{...basis,unique:false},{...basis,complete:false},{...basis,subsetOf:[]}]) {
    writeExport(dir,datedExport({...good,measurement:{users:basis,offerImpressions:bad}}));
    assert.equal(computeCommercialReport({dir,now:auditNow}).cr.offerReach.status,'no-data');
  }
  writeExport(dir,datedExport({...good,offerImpressions:20}));
  assert.equal(computeCommercialReport({dir,now:auditNow}).cr.offerReach.value,null);
  writeExport(dir,datedExport({...good,asOf:null}));
  assert.equal(computeCommercialReport({dir,now:auditNow}).cr.offerReach.value,null);
  writeExport(dir,datedExport({...good,asOf:'2026-10-04T13:00:00Z'}));
  assert.equal(computeCommercialReport({dir,now:auditNow}).cr.offerReach.value,null);
}));
test('source and offer slices cannot revive unconfirmed leads or invalid counts', () => withData(dir => {
  writeExport(dir,datedExport({bySource:{organic:{users:10,validLeads:7,formStarts:-2}},byOffer:{demo:{users:1,validLeads:0,confirmation:{validLeads:{source:'server-accepted',evidenceRef:'fixture-only'}}}}}));
  const r=computeCommercialReport({dir,now:auditNow});
  assert.deepEqual(r.bySource,[{name:'organic',values:{users:10}}]);
  assert.deepEqual(r.byOffer,[{name:'demo',values:{users:1,validLeads:0}}]);
}));
test('economics stays unknown without full verified costs and a common cutoff, and preserves a real loss', () => withData(dir => {
  writePartner(dir,datedPartner({asOf:auditNow.toISOString(),paid:1000,commission:50,payout:40}));
  assert.equal(computeCommercialReport({dir,now:auditNow}).netResult.value,null);
  mkdirSync(path.join(dir,'costs'));
  const costs={fetchedAt:auditNow.toISOString(),asOf:auditNow.toISOString(),period:window(auditNow),currency:'RUB',verification:{source:'project-costs',verifiedAt:auditNow.toISOString(),evidenceRef:'fixture-cost-receipts'},complete:true,totalCosts:60};
  const save = over => writeFileSync(path.join(dir,'costs','reconciliation.json'),JSON.stringify(attachReceipt(dir,{...costs,...over},'costs.csv')));
  save({});
  const r=computeCommercialReport({dir,now:auditNow});
  assert.equal(r.netResult.value,-10);assert.equal(r.cashReceived.value,40);assert.equal(r.customerPayments.value,1000);
  for(const bad of [{complete:false},{totalCosts:-1},{asOf:'2026-10-04T11:00:00Z'},{verification:null},{currency:'USD'},{period:{from:'2026-09-01',to:'2026-09-30',timeZone:'UTC'}}]) {
    save(bad);assert.equal(computeCommercialReport({dir,now:auditNow}).netResult.value,null,JSON.stringify(bad));
  }
}));
test('missing, tampered or escaped primary receipts invalidate otherwise plausible partner numbers', () => withData(dir => {
  const file=writePartner(dir,datedPartner({paid:1000,commission:50}));
  const saved=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(computeCommercialReport({dir,now:auditNow}).revenue.value,50);
  writeFileSync(path.join(dir,saved.verification.evidenceRef),'tampered after reconciliation');
  assert.equal(computeCommercialReport({dir,now:auditNow}).revenue.value,null);
  for(const evidenceRef of ['../outside.json','/tmp/outside.json','receipts/missing.csv']) {
    writeFileSync(file,JSON.stringify({...saved,verification:{...saved.verification,evidenceRef}}));
    assert.equal(computeCommercialReport({dir,now:auditNow}).metrics.paid.status,'unverified');
  }
}));
test('confirmed lead receipt must remain accessible and unchanged', () => withData(dir => {
  const file=writeExport(dir,datedExport({validLeads:1,confirmation:{validLeads:{source:'server-accepted',evidenceRef:'fixture-only'}}}));
  const data=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(computeCommercialReport({dir,now:auditNow}).metrics.validLeads.value,1);
  rmSync(path.join(dir,data.confirmation.validLeads.evidenceRef));
  assert.equal(computeCommercialReport({dir,now:auditNow}).metrics.validLeads.value,null);
}));

test('ETK-P2-02: отсутствующий файл выгрузки даёт «нет данных», а не 0', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    const r = computeCommercialReport({ days: 7 });
    assert.equal(r.metrics.users.status, 'no-data');
    assert.equal(r.metrics.users.value, null);
    const text = formatMetric(r.metrics.users);
    assert.match(text, /нет данных/);
    const res = runReport({ days: 7 });
    assert.equal(res.exitCode, 0);
  } finally {
    cleanup(dir, restore);
  }
});

test('ETK-P2-02: честный ноль печатается иначе, чем «нет данных»', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    writeExport(dir, freshExport({ users: 0 }));
    const r = computeCommercialReport({ days: 7 });
    assert.equal(r.metrics.users.status, 'ok');
    assert.equal(r.metrics.users.value, 0);
    const zeroText = formatMetric(r.metrics.users);
    const noDataText = formatMetric(r.metrics.productViews.status === 'ok' ? { value: null, status: 'no-data', source: 'x', fetchedAt: null, reason: 'тест' } : r.metrics.productViews);
    assert.equal(zeroText, '0');
    assert.match(noDataText, /нет данных/);
    assert.notEqual(zeroText, noDataText);
    assert.match(formatReport(r), /пользователи: 0 /);
  } finally {
    cleanup(dir, restore);
  }
});

test('ETK-P2-02: время копирования файла не отменяет свежую фактическую выгрузку', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    // Числа в файле есть, fetchedAt свежий — но mtime старше порога.
    const old = new Date(Date.now() - 48 * 3600 * 1000);
    writeExport(dir, freshExport({ users: 123 }), old);
    const r = computeCommercialReport({ days: 7 });
    assert.equal(r.metrics.users.status, 'ok');
    assert.equal(r.metrics.users.value, 123);
  } finally {
    cleanup(dir, restore);
  }
});

test('ETK-P2-02: без файла сверки кабинетные метрики «не проверено в кабинете»', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    writeExport(dir, freshExport());
    const r = computeCommercialReport({ days: 7 });
    for (const key of ['partnerLeads', 'invoices', 'paid', 'payout']) {
      assert.equal(r.metrics[key].status, 'unverified', key);
      assert.equal(r.metrics[key].value, null, key);
      assert.match(formatMetric(r.metrics[key]), /не проверено в кабинете/);
    }
  } finally {
    cleanup(dir, restore);
  }
});

test('ETK-P2-02: счета и клиентские оплаты не подменяют комиссию проекта', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    writeExport(dir, freshExport());
    writePartner(dir, {
      fetchedAt: new Date().toISOString(),
      partnerLeads: 10,
      invoices: 5,
      invoicesAmount: 50000,
      paid: 0,
      commission: 0,
      paidCount: 0,
      payout: 0,
    });
    const r = computeCommercialReport({ days: 7 });
    assert.equal(r.metrics.invoices.value, 5);
    assert.equal(r.metrics.invoicesAmount.value, 50000);
    assert.equal(r.revenue.status, 'ok');
    assert.equal(r.revenue.value, 0);
    const text = formatReport(r);
    assert.match(text, /Доход проекта \(начисленная комиссия; оплаты клиентов и выплаты отдельно\): 0 ₽/);
  } finally {
    cleanup(dir, restore);
  }
});

test('ETK-P2-02: CR при нуле в знаменателе и при неполных данных — «нет данных»', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    writeExport(dir, freshExport({ users: 0, offerImpressions: 10 }));
    const r = computeCommercialReport({ days: 7 });
    assert.equal(r.cr.offerReach.status, 'no-data');
    assert.match(formatMetric(r.cr.offerReach, 'ratio'), /нет данных/);
    // Сквозной CR в кабинет без сверки — тоже «нет данных», а не 0/100%.
    assert.equal(r.cr.cabinetLead.status, 'no-data');
    const text = formatReport(r);
    assert.doesNotMatch(text, /NaN|Infinity|undefined|null/);
  } finally {
    cleanup(dir, restore);
  }
});

test('ETK-P2-02: битый JSON выгрузки даёт адресную ошибку и ненулевой код', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    const analyticsDir = path.join(dir, 'analytics');
    mkdirSync(analyticsDir, { recursive: true });
    writeFileSync(path.join(analyticsDir, 'export.json'), '{ битый json', 'utf8');
    const res = runReport({ days: 7 });
    assert.notEqual(res.exitCode, 0);
    assert.match(res.stderr, /export\.json/);
    assert.throws(() => computeCommercialReport({ days: 7 }), /export\.json/);
  } finally {
    cleanup(dir, restore);
  }
});

test('ETK-P2-02: счётные метрики кабинета не печатаются в рублях', () => {
  // «5 ₽» вместо «5 шт» — та самая путаница денег и штук, ради устранения
  // которой отчёт и писался. Лиды, счета и количество оплат — это штуки.
  const dir = mkdtempSync(path.join(tmpdir(), 'cr-units-'));
  try {
    mkdirSync(path.join(dir, 'partner'), { recursive: true });
    writeFileSync(
      path.join(dir, 'partner', 'attribution.json'),
      JSON.stringify(attachReceipt(dir,{
        ...partnerProof(),
        fetchedAt: new Date().toISOString(),
        partnerLeads: 4,
        invoices: 5,
        invoicesAmount: 500000,
        paid: 0,
        paidCount: 0,
        payout: 0,
      })),
      'utf8',
    );
    const text = formatReport(computeCommercialReport({ dir, days: 7 }));
    const line = (needle) => text.split('\n').find((l) => l.includes(needle)) ?? '';
    assert.ok(!/партнёрские лиды[^\n]*₽/.test(text), `лиды в рублях: ${line('партнёрские лиды')}`);
    assert.ok(!/счета выставлено \(invoices, шт\)[^\n]*₽/.test(text), `счета в рублях: ${line('invoices, шт')}`);
    assert.ok(!/оплачено \(счетов, шт\)[^\n]*₽/.test(text), `количество оплат в рублях: ${line('счетов, шт')}`);
    // А суммы — наоборот, обязаны быть в рублях.
    assert.match(line('сумма, справ.'), /₽/);
    assert.match(line('выплата (payout)'), /₽/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
