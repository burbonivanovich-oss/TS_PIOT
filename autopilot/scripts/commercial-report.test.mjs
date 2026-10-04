import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
  writeFileSync(file, JSON.stringify(obj), 'utf8');
  if (mtime) utimesSync(file, mtime, mtime);
  return file;
}

function writePartner(dir, obj) {
  const partnerDir = path.join(dir, 'partner');
  mkdirSync(partnerDir, { recursive: true });
  const file = path.join(partnerDir, 'attribution.json');
  writeFileSync(file, JSON.stringify(obj), 'utf8');
  return file;
}

const freshExport = (over = {}) => ({
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

test('ETK-P2-02: выгрузка старше 36 часов даёт «нет данных» с причиной устаревания', () => {
  const dir = makeDataDir();
  const restore = useDataDir(dir);
  try {
    // Числа в файле есть, fetchedAt свежий — но mtime старше порога.
    const old = new Date(Date.now() - 48 * 3600 * 1000);
    writeExport(dir, freshExport({ users: 123 }), old);
    const r = computeCommercialReport({ days: 7 });
    assert.equal(r.metrics.users.status, 'no-data');
    assert.equal(r.metrics.users.value, null);
    assert.match(r.metrics.users.reason, /устарела/);
    assert.match(formatReport(r), /устарела/);
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

test('ETK-P2-02: invoices не попадает в денежный результат', () => {
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
      paidCount: 0,
      payout: 0,
    });
    const r = computeCommercialReport({ days: 7 });
    assert.equal(r.metrics.invoices.value, 5);
    assert.equal(r.metrics.invoicesAmount.value, 50000);
    assert.equal(r.revenue.status, 'ok');
    assert.equal(r.revenue.value, 0);
    const text = formatReport(r);
    assert.match(text, /Выручка \(только paid; invoices в выручку не входит\): 0 ₽/);
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
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        partnerLeads: 4,
        invoices: 5,
        invoicesAmount: 500000,
        paid: 0,
        paidCount: 0,
        payout: 0,
      }),
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
