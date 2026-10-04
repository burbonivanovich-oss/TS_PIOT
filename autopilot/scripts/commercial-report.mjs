#!/usr/bin/env node
// Недельный коммерческий отчёт: воронка от показов до денег (ETK-P2-02).
//
// ПОЧЕМУ этот скрипт существует. Сейчас в отчётности две системные лжи:
//  1. «нет данных» выглядит как честный ноль — воронка кажется работающей,
//     когда она на самом деле мёртвая (источник не настроен, выгрузка
//     устарела). Отчёт обязан различать число (в т.ч. 0), «нет данных»
//     и «не проверено в кабинете» и никогда их не схлопывать в ноль.
//  2. выставленные счета смешиваются с оплаченными — воронка выглядит живой
//     за счёт invoices, хотя денег (paid) ноль. Выручкой считается ТОЛЬКО paid,
//     invoices в денежный результат не входит никогда.
//
// Источники данных (клиентской телеметрии ETK-P0-08 и доступа к кабинету НЕТ):
//  - телеметрия (пользователи, показы оффера, CTA CTR, просмотры, формы, лиды,
//    клики на оплату) читается из выгрузки data/analytics/*.json. Нет файла
//    или файл старше порога свежести — метрика «нет данных» с причиной.
//  - partner leads / invoices / paid / payout подтверждаются только вручную
//    в партнёрском кабинете: без файла ручной сверки они всегда
//    «не проверено в кабинете», а не 0.
//
// Формат data/analytics/export.json (все числовые поля опциональны;
// отсутствующее поле — «нет данных» именно по этой метрике):
//   { "fetchedAt": "2026-09-20T12:00:00.000Z", "users": 1234,
//     "offerImpressions": 2345, "ctaCtr": 0.04, "productViews": 345,
//     "formStarts": 120, "validLeads": 80, "paymentClicks": 25,
//     "bySource": { "organic": { "users": 100 } },
//     "byOffer": { "offer-1": { "users": 50 } } }
// При нескольких *.json берётся самый свежий по mtime.
//
// Формат data/partner/attribution.json (ручная сверка из кабинета):
//   { "fetchedAt": "2026-09-20T10:00:00.000Z", "partnerLeads": 12,
//     "invoices": 5, "invoicesAmount": 50000,
//     "paid": 30000, "paidCount": 3, "payout": 25000 }
// где invoices — выставлено (шт, НЕ выручка), paid — оплачено (₽, выручка),
// payout — выплата (₽). Поля invoices/paid принимают и число, и объект
// вида { "count": 5, "amount": 50000 }.
//
//   node scripts/commercial-report.mjs [--days 7] [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { readJson, isMain } from './lib/content.mjs';
import { envelope, EXIT, classifyError } from './lib/outcome.mjs';

// Порог свежести выгрузки — 36 часов. Совпадает с Gate M1: та же граница,
// за которой данным уже нельзя доверять, действует и здесь. Выгрузка старше
// порога — это «нет данных» с причиной устаревания, даже если числа в файле есть.
export const ANALYTICS_FRESHNESS_MS = 36 * 3600 * 1000;
export const ANALYTICS_HINT = 'data/analytics/*.json';
export const PARTNER_HINT = 'data/partner/attribution.json';

// Каталог данных: переменная окружения важнее кэша конфига, чтобы песочница
// и тесты подсовывали свой каталог без правки файлов (config.mjs это понимает,
// но loadConfig кэшируется — поэтому env проверяем при каждом вызове).
export function resolveDataDir() {
  if (process.env.AUTOPILOT_DATA_DIR) return process.env.AUTOPILOT_DATA_DIR;
  return loadConfig().resolved.dataDir;
}

// Трёхзначная обёртка метрики: число (в т.ч. честный 0), «нет данных»,
// «не проверено в кабинете». value=null означает отсутствие числа, и это
// единственный допустимый null — форматирование обязано идти через
// formatMetric, а не через подстановку нуля.
export function metricOk(value, source, fetchedAt) {
  return { value, status: 'ok', source, fetchedAt: fetchedAt ?? null, reason: null };
}
export function metricNoData(reason, source, fetchedAt) {
  return { value: null, status: 'no-data', source, fetchedAt: fetchedAt ?? null, reason };
}
export function metricUnverified(reason, source) {
  return { value: null, status: 'unverified', source, fetchedAt: null, reason };
}

// Единственная функция форматирования трёхзначных метрик. Печатает ok,
// no-data и unverified по-разному — честный 0 и отсутствие данных визуально
// несмешиваемы. kind: 'int' | 'money' | 'ratio'.
export function formatMetric(m, kind = 'int') {
  if (m.status === 'no-data') return `нет данных${m.reason ? ` — ${m.reason}` : ''}`;
  if (m.status === 'unverified') return `не проверено в кабинете${m.reason ? ` — ${m.reason}` : ''}`;
  if (typeof m.value !== 'number' || !Number.isFinite(m.value)) {
    // Защита от нечислового значения в выгрузке: лучше честные «нет данных»,
    // чем NaN/Infinity в отчёте.
    return 'нет данных — нечисловое значение в выгрузке';
  }
  if (kind === 'money') return `${m.value.toLocaleString('ru-RU')} ₽`;
  if (kind === 'ratio') return `${(m.value * 100).toFixed(1)}%`;
  return m.value.toLocaleString('ru-RU');
}

// Метрики телеметрии: ключ отчёта, допустимые имена полей в выгрузке,
// русская подпись, вид форматирования.
const TELEMETRY_DEFS = [
  { key: 'users', names: ['users', 'usersCount'], label: 'пользователи', kind: 'int' },
  { key: 'offerImpressions', names: ['offerImpressions', 'offer_impressions'], label: 'показы оффера (offer impressions)', kind: 'int' },
  { key: 'ctaCtr', names: ['ctaCtr', 'cta_ctr', 'ctr'], label: 'CTA CTR', kind: 'ratio' },
  { key: 'productViews', names: ['productViews', 'product_views'], label: 'просмотры карточек (product views)', kind: 'int' },
  { key: 'formStarts', names: ['formStarts', 'form_starts'], label: 'начала форм (form starts)', kind: 'int' },
  { key: 'validLeads', names: ['validLeads', 'valid_leads'], label: 'валидные лиды (valid leads)', kind: 'int' },
  { key: 'paymentClicks', names: ['paymentClicks', 'payment_clicks'], label: 'клики на оплату (payment clicks)', kind: 'int' },
];

// CR стадий: числитель/знаменатель по ключам metrics. Деньги сюда не входят:
// CR считается только между счётчиками, иначе смешались бы штуки и рубли.
const CR_DEFS = [
  { key: 'offerReach', label: 'CR: показы оффера / пользователи', num: 'offerImpressions', den: 'users' },
  { key: 'productInterest', label: 'CR: просмотры / показы', num: 'productViews', den: 'offerImpressions' },
  { key: 'formStart', label: 'CR: формы / просмотры', num: 'formStarts', den: 'productViews' },
  { key: 'leadValid', label: 'CR: валидные лиды / формы', num: 'validLeads', den: 'formStarts' },
  { key: 'payClick', label: 'CR: клики на оплату / валидные лиды', num: 'paymentClicks', den: 'validLeads' },
  { key: 'cabinetLead', label: 'CR: партнёрские лиды / клики на оплату', num: 'partnerLeads', den: 'paymentClicks' },
  { key: 'invoicePerLead', label: 'CR: счета / партнёрские лиды', num: 'invoices', den: 'partnerLeads' },
];

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickNumber(obj, names) {
  for (const name of names) {
    const v = finiteNumber(obj[name]);
    if (v !== null) return v;
  }
  return null;
}

// Самый свежий *.json в data/analytics. null — выгрузки нет вообще.
function findAnalyticsFile(dir) {
  const analyticsDir = path.join(dir, 'analytics');
  if (!existsSync(analyticsDir)) return null;
  const files = readdirSync(analyticsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(analyticsDir, f))
    .filter((f) => {
      try {
        return statSync(f).isFile();
      } catch {
        return false;
      }
    });
  if (!files.length) return null;
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0];
}

// Чтение телеметрии: свежий файл → ok/поштучные no-data, нет файла или
// просрочка → все метрики no-data с причиной. Битый JSON — настоящая ошибка
// с именем файла (читаем через строгий readJson, он называет файл сам).
function readAnalytics(dir, now) {
  const file = findAnalyticsFile(dir);
  const empty = (reason) => {
    const metrics = {};
    for (const def of TELEMETRY_DEFS) metrics[def.key] = metricNoData(reason, 'аналитика');
    return { metrics, bySource: [], byOffer: [], file, fetchedAt: null, fresh: false, reason };
  };
  if (!file) return empty(`нет файла выгрузки ${ANALYTICS_HINT}`);
  const parsed = readJson(file, undefined);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Выгрузка ${file} должна содержать объект с метриками`);
  }
  const mtimeMs = statSync(file).mtimeMs;
  const mtimeIso = new Date(mtimeMs).toISOString();
  const fetchedAt = typeof parsed.fetchedAt === 'string' && !Number.isNaN(Date.parse(parsed.fetchedAt))
    ? parsed.fetchedAt
    : mtimeIso;
  // Устаревание считаем и по mtime файла, и по fetchedAt внутри: врёт любой —
  // доверять уже нельзя ничему из файла.
  const fetchedMs = Date.parse(fetchedAt);
  const staleByMtime = now.getTime() - mtimeMs > ANALYTICS_FRESHNESS_MS;
  const staleByFetchedAt = !Number.isNaN(fetchedMs) && now.getTime() - fetchedMs > ANALYTICS_FRESHNESS_MS;
  if (staleByMtime || staleByFetchedAt) {
    const ageHours = Math.round((staleByMtime ? now.getTime() - mtimeMs : now.getTime() - fetchedMs) / 3600000);
    return {
      ...empty(`выгрузка устарела: возраст ${ageHours} ч при пороге 36 ч (${path.basename(file)})`),
      file,
      fetchedAt,
    };
  }
  const source = `аналитика: ${path.basename(file)}`;
  const metrics = {};
  for (const def of TELEMETRY_DEFS) {
    const v = pickNumber(parsed, def.names);
    metrics[def.key] = v !== null
      ? metricOk(v, source, fetchedAt)
      : metricNoData(`нет поля «${def.names[0]}» в выгрузке ${path.basename(file)}`, source, fetchedAt);
  }
  return { metrics, bySource: readSlices(parsed.bySource), byOffer: readSlices(parsed.byOffer), file, fetchedAt, fresh: true, reason: null };
}

// Разрезы по источнику/офферу — только сырые конечные числа из свежей выгрузки.
// Свежесть уже проверена на уровне файла: несвежий файл сюда не доходит.
function readSlices(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const out = [];
  for (const [name, slice] of Object.entries(raw)) {
    if (!slice || typeof slice !== 'object') continue;
    const values = {};
    for (const def of TELEMETRY_DEFS) {
      const v = pickNumber(slice, def.names);
      if (v !== null) values[def.key] = v;
    }
    if (Object.keys(values).length) out.push({ name, values });
  }
  return out;
}

// Чтение ручной сверки из кабинета. Файла нет — все четыре метрики unverified.
// Битый JSON или не-объект — настоящая ошибка с именем файла, а не «нет данных».
function readPartner(dir) {
  const file = path.join(dir, 'partner', 'attribution.json');
  const source = 'партнёрский кабинет (ручная сверка)';
  const missing = (name) => metricUnverified(
    `нет файла ручной сверки ${PARTNER_HINT}; метрика «${name}» подтверждается только в кабинете`,
    source,
  );
  if (!existsSync(file)) {
    return {
      metrics: {
        partnerLeads: missing('partner leads'),
        invoices: missing('invoices'),
        invoicesAmount: missing('invoicesAmount'),
        paid: missing('paid'),
        paidCount: missing('paidCount'),
        payout: missing('payout'),
      },
      file: null,
      fetchedAt: null,
    };
  }
  const parsed = readJson(file, undefined);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Файл сверки ${file} должен содержать объект`);
  }
  const fetchedAt = typeof parsed.fetchedAt === 'string' && !Number.isNaN(Date.parse(parsed.fetchedAt))
    ? parsed.fetchedAt
    : new Date(statSync(file).mtimeMs).toISOString();
  const fileSource = `ручная сверка: ${PARTNER_HINT}`;
  // invoices/paid принимают число или объект {count, amount} — оба варианта
  // разбираем явно, чтобы суммы и штуки не перепутались.
  const invoicesRaw = parsed.invoices ?? parsed.invoicesCount;
  const paidRaw = parsed.paid ?? parsed.paidAmount;
  const invoices = typeof invoicesRaw === 'object' && invoicesRaw !== null
    ? finiteNumber(invoicesRaw.count ?? invoicesRaw.cnt)
    : finiteNumber(invoicesRaw);
  const invoicesAmount = typeof invoicesRaw === 'object' && invoicesRaw !== null
    ? finiteNumber(invoicesRaw.amount ?? invoicesRaw.sum)
    : finiteNumber(parsed.invoicesAmount ?? parsed.invoices_amount);
  const paid = typeof paidRaw === 'object' && paidRaw !== null
    ? finiteNumber(paidRaw.amount ?? paidRaw.sum)
    : finiteNumber(paidRaw);
  const paidCount = typeof paidRaw === 'object' && paidRaw !== null
    ? finiteNumber(paidRaw.count ?? paidRaw.cnt)
    : finiteNumber(parsed.paidCount ?? parsed.paid_count);
  const take = (value, name) => (value !== null
    ? metricOk(value, fileSource, fetchedAt)
    : metricUnverified(`нет поля «${name}» в сверке ${PARTNER_HINT}; подтверждается только в кабинете`, fileSource));
  return {
    metrics: {
      partnerLeads: take(finiteNumber(parsed.partnerLeads ?? parsed.partner_leads), 'partnerLeads'),
      invoices: take(invoices, 'invoices'),
      invoicesAmount: take(invoicesAmount, 'invoicesAmount'),
      paid: take(paid, 'paid'),
      paidCount: take(paidCount, 'paidCount'),
      payout: take(finiteNumber(parsed.payout), 'payout'),
    },
    file,
    fetchedAt,
  };
}

// CR только между двумя метриками со статусом ok. Любой другой случай —
// «нет данных»: неполные данные и деление на ноль не дают 0/100%/Infinity.
export function conversionRate(current, previous) {
  if (current.status !== 'ok' || previous.status !== 'ok') {
    return metricNoData('нет подтверждённых данных для CR (нужны два статуса ok)', 'расчёт отчёта');
  }
  if (previous.value === 0) {
    return metricNoData('деление на ноль: знаменатель 0', 'расчёт отчёта');
  }
  return metricOk(current.value / previous.value, 'расчёт отчёта', current.fetchedAt || previous.fetchedAt);
}

export function computeCommercialReport({ dir = resolveDataDir(), days = 7, now = new Date() } = {}) {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - days);
  const from = fromDate.toISOString().slice(0, 10);

  const analytics = readAnalytics(dir, now);
  const partner = readPartner(dir);
  const metrics = { ...analytics.metrics, ...partner.metrics };

  const cr = {};
  for (const def of CR_DEFS) cr[def.key] = conversionRate(metrics[def.num], metrics[def.den]);

  // Выручка — ТОЛЬКО paid. invoices (выставлено, invoicesAmount) в денежный
  // результат не входит: статус выручки зеркалит статус paid один в один.
  const revenue = partner.metrics.paid.status === 'ok'
    ? metricOk(partner.metrics.paid.value, `выручка: только paid (${partner.metrics.paid.source})`, partner.metrics.paid.fetchedAt)
    : partner.metrics.paid.status === 'unverified'
      ? metricUnverified(partner.metrics.paid.reason, 'выручка: только paid')
      : metricNoData(partner.metrics.paid.reason, 'выручка: только paid', partner.metrics.paid.fetchedAt);

  return {
    period: { from, to, days },
    generatedAt: now.toISOString(),
    metrics,
    cr,
    revenue,
    bySource: analytics.bySource,
    byOffer: analytics.byOffer,
    analyticsFile: analytics.file,
    partnerFile: partner.file,
    analyticsReason: analytics.reason,
  };
}

function sourceSuffix(m) {
  if (!m.source) return '';
  return ` [${m.source}${m.fetchedAt ? ` · выгрузка ${m.fetchedAt}` : ''}]`;
}

// Единица измерения задаётся вместе с меткой: счета и лиды — это штуки, а не
// рубли. Печатать «5 ₽» вместо «5 шт» в денежном отчёте — ровно та путаница,
// ради устранения которой отчёт и писался.
const CABINET_DEFS = [
  { key: 'partnerLeads', label: 'партнёрские лиды (partner leads)', kind: 'int' },
  { key: 'invoices', label: 'счета выставлено (invoices, шт)', kind: 'int' },
  { key: 'invoicesAmount', label: 'счета выставлено (сумма, справ. — не выручка)', kind: 'money' },
  { key: 'paid', label: 'оплачено (paid, ₽)', kind: 'money' },
  { key: 'paidCount', label: 'оплачено (счетов, шт)', kind: 'int' },
  { key: 'payout', label: 'выплата (payout)', kind: 'money' },
];

export function formatReport(r) {
  const lines = [];
  lines.push(`Коммерческий отчёт за ${r.period.from}…${r.period.to} (окно ${r.period.days} дн.)`);
  lines.push('Воронка:');
  for (const def of TELEMETRY_DEFS) {
    const m = r.metrics[def.key];
    lines.push(`  ${def.label}: ${formatMetric(m, def.kind)}${sourceSuffix(m)}`);
  }
  lines.push('Кабинет (подтверждается только вручную):');
  for (const def of CABINET_DEFS) {
    const m = r.metrics[def.key];
    lines.push(`  ${def.label}: ${formatMetric(m, def.kind)}${sourceSuffix(m)}`);
  }
  lines.push('CR стадий (только между подтверждёнными метриками):');
  for (const def of CR_DEFS) {
    const m = r.cr[def.key];
    lines.push(`  ${def.label}: ${formatMetric(m, 'ratio')}${sourceSuffix(m)}`);
  }
  // Отдельная строка про деньги: выручка — только paid, invoices не считается.
  lines.push(`Выручка (только paid; invoices в выручку не входит): ${formatMetric(r.revenue, 'money')}${sourceSuffix(r.revenue)}`);
  const sliceBlock = (title, slices) => {
    if (!slices.length) {
      const reason = r.analyticsReason ? ` — ${r.analyticsReason}` : '';
      lines.push(`${title}: нет данных${reason}`);
      return;
    }
    lines.push(`${title}:`);
    for (const { name, values } of slices) {
      const parts = [];
      for (const def of TELEMETRY_DEFS) {
        if (typeof values[def.key] === 'number') parts.push(`${def.label} ${formatMetric(metricOk(values[def.key], '', null), def.kind)}`);
      }
      lines.push(`    ${name}: ${parts.join(' · ')}`);
    }
  };
  sliceBlock('Разрез по источнику', r.bySource);
  sliceBlock('Разрез по офферу', r.byOffer);
  return lines.join('\n');
}

// Машинное выполнение без выхода из процесса — для тестов кода выхода.
export function runReport({ dir = resolveDataDir(), days = 7, json = false, now = new Date() } = {}) {
  if (!Number.isInteger(days) || days < 1) {
    return { exitCode: EXIT.usage, stdout: '', stderr: 'Использование: node scripts/commercial-report.mjs [--days N] [--json] (N — целое >= 1)' };
  }
  try {
    const report = computeCommercialReport({ dir, days, now });
    if (json) {
      return { exitCode: EXIT.ok, stdout: JSON.stringify(envelope({ ok: true, category: 'ok', exitCode: EXIT.ok, ...report }), null, 2), stderr: '' };
    }
    return { exitCode: EXIT.ok, stdout: formatReport(report), stderr: '' };
  } catch (error) {
    const { exitCode } = classifyError(error);
    return { exitCode, stdout: '', stderr: String(error?.message || error) };
  }
}

function main() {
  const args = process.argv.slice(2);
  const daysIdx = args.indexOf('--days');
  let days = 7;
  if (daysIdx !== -1) {
    const raw = Number(args[daysIdx + 1]);
    days = Number.isInteger(raw) ? raw : NaN;
  }
  const res = runReport({ days, json: args.includes('--json') });
  if (res.stdout) console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
  process.exitCode = res.exitCode;
}

if (isMain(import.meta.url)) main();
