#!/usr/bin/env node
// Недельный коммерческий отчёт: воронка от показов до денег (ETK-P2-02).
//
// ПОЧЕМУ этот скрипт существует. Сейчас в отчётности две системные лжи:
//  1. «нет данных» выглядит как честный ноль — воронка кажется работающей,
//     когда она на самом деле мёртвая (источник не настроен, выгрузка
//     устарела). Отчёт обязан различать число (в т.ч. 0), «нет данных»
//     и «не проверено в кабинете» и никогда их не схлопывать в ноль.
//  2. оплаты клиентов смешиваются с доходом проекта. Доход проекта — его
//     начисленная комиссия; оплаченные счета и фактические выплаты отдельно.
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
// При нескольких *.json берётся самая свежая фактическая fetchedAt; mtime не используется.
//
// Формат data/partner/attribution.json (ручная сверка из кабинета):
//   { "fetchedAt": "2026-09-20T10:00:00.000Z", "partnerLeads": 12,
//     "invoices": 5, "invoicesAmount": 50000,
//     "paid": 30000, "paidCount": 3, "payout": 25000 }
// где invoices — выставлено (шт), paid — оплаты клиентов партнёру (₽),
// commission — начисленная комиссия проекта (₽), payout — выплата (₽).
// Обязательны period с UTC, fetchedAt, currency:RUB и verification источника.
// Поля invoices/paid принимают и число, и объект
// вида { "count": 5, "amount": 50000 }.
//
//   node scripts/commercial-report.mjs [--days 7] [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { readJson, isMain } from './lib/content.mjs';
import { envelope, EXIT, classifyError } from './lib/outcome.mjs';
import { timestamp, sourceProblem, basisFor, validMetric, confirmedLeads, receiptProblem } from './lib/commercial-source.mjs';

// Порог свежести фактической выгрузки и сверки — 36 часов. mtime не доказательство.
export const ANALYTICS_FRESHNESS_MS = 36 * 3600 * 1000;
export const ANALYTICS_HINT = 'data/analytics/*.json';
export const PARTNER_HINT = 'data/partner/attribution.json';

// Каталог данных: переменная окружения важнее кэша конфига, чтобы песочница
// и тесты подсовывали свой каталог без правки файлов (config.mjs это понимает,
// но loadConfig кэшируется — поэтому env проверяем при каждом вызове).
export function resolveDataDir() {
  if (process.env.AUTOPILOT_COMMERCIAL_DATA_DIR) return process.env.AUTOPILOT_COMMERCIAL_DATA_DIR;
  if (process.env.AUTOPILOT_DATA_DIR) return process.env.AUTOPILOT_DATA_DIR;
  return loadConfig().resolved.dataDir;
}

// Трёхзначная обёртка метрики: число (в т.ч. честный 0), «нет данных»,
// «не проверено в кабинете». value=null означает отсутствие числа, и это
// единственный допустимый null — форматирование обязано идти через
// formatMetric, а не через подстановку нуля.
export function metricOk(value, source, fetchedAt, basis = null) {
  return { value, basis, status: 'ok', source, fetchedAt: fetchedAt ?? null, reason: null };
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
// CR требует одинаковые уникальные единицы, период и явно связанную когорту.
const CR_DEFS = [
  { key: 'offerReach', label: 'CR: пользователи с показом / пользователи', num: 'offerImpressions', den: 'users' },
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

function pickNumber(obj, names, kind = 'int') {
  for (const name of names) {
    const v = finiteNumber(obj[name]);
    if (v !== null && validMetric(v, kind)) return v;
  }
  return null;
}

// Самый свежий *.json в data/analytics. null — выгрузки нет вообще.
function findAnalyticsFile(dir, period) {
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
  const matching = files.filter(file => { const p = readJson(file, undefined)?.period; return p?.from === period.from && p?.to === period.to && p?.timeZone === 'UTC'; });
  const ranked = matching.length ? matching : files;
  ranked.sort((a, b) => (timestamp(readJson(b, undefined)?.fetchedAt) ?? -Infinity) - (timestamp(readJson(a, undefined)?.fetchedAt) ?? -Infinity));
  return ranked[0];
}

// Чтение телеметрии: свежий файл → ok/поштучные no-data, нет файла или
// просрочка → все метрики no-data с причиной. Битый JSON — настоящая ошибка
// с именем файла (читаем через строгий readJson, он называет файл сам).
function readAnalytics(dir, now, period) {
  const file = findAnalyticsFile(dir, period);
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
  const fetchedAt = parsed.fetchedAt ?? null;
  const problem = sourceProblem(parsed, { period, now, maxAgeMs: ANALYTICS_FRESHNESS_MS });
  if (problem) return { ...empty(problem), fetchedAt };
  const source = `аналитика: ${path.basename(file)}`;
  const metrics = {};
  for (const def of TELEMETRY_DEFS) {
    const v = pickNumber(parsed, def.names, def.kind);
    if (def.key === 'validLeads' && (!confirmedLeads(parsed) || receiptProblem(dir, parsed.confirmation.validLeads))) {
      metrics[def.key] = metricNoData('нет подтверждения приёма заявки сервером или кабинетом; попытки формы не являются валидными лидами', source, fetchedAt);
      continue;
    }
    metrics[def.key] = v !== null
      ? metricOk(v, source, fetchedAt, basisFor(parsed, def.key, period))
      : metricNoData(`нет поля «${def.names[0]}» в выгрузке ${path.basename(file)}`, source, fetchedAt);
  }
  return { metrics, bySource: readSlices(parsed.bySource, dir), byOffer: readSlices(parsed.byOffer, dir), file, fetchedAt, fresh: true, reason: null };
}

// Разрезы по источнику/офферу — только сырые конечные числа из свежей выгрузки.
// Свежесть уже проверена на уровне файла: несвежий файл сюда не доходит.
function readSlices(raw, dir) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const out = [];
  for (const [name, slice] of Object.entries(raw)) {
    if (!slice || typeof slice !== 'object') continue;
    const values = {};
    for (const def of TELEMETRY_DEFS) {
      if (def.key === 'validLeads' && (!confirmedLeads(slice) || receiptProblem(dir, slice.confirmation.validLeads))) continue;
      const v = pickNumber(slice, def.names, def.kind);
      if (v !== null) values[def.key] = v;
    }
    if (Object.keys(values).length) out.push({ name, values });
  }
  return out;
}

// Чтение ручной сверки из кабинета. Файла нет — все четыре метрики unverified.
// Битый JSON или не-объект — настоящая ошибка с именем файла, а не «нет данных».
function readPartner(dir, now, period) {
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
        commission: missing('commission'),
      },
      file: null,
      fetchedAt: null,
    };
  }
  const parsed = readJson(file, undefined);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Файл сверки ${file} должен содержать объект`);
  }
  const fetchedAt = parsed.fetchedAt ?? null;
  const problem = sourceProblem(parsed, { period, now, maxAgeMs: ANALYTICS_FRESHNESS_MS, partner: true }) || receiptProblem(dir, parsed.verification);
  if (problem) return { metrics: Object.fromEntries(['partnerLeads','invoices','invoicesAmount','paid','paidCount','payout','commission'].map(key => [key, metricUnverified(problem, source)])), file, fetchedAt };
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
  const take = (value, name) => (value !== null && validMetric(value, ['invoicesAmount','paid','payout','commission'].includes(name) ? 'money' : 'int')
    ? metricOk(value, fileSource, fetchedAt, basisFor(parsed, name, period))
    : metricUnverified(`нет поля «${name}» в сверке ${PARTNER_HINT}; подтверждается только в кабинете`, fileSource));
  return {
    metrics: {
      partnerLeads: take(finiteNumber(parsed.partnerLeads ?? parsed.partner_leads), 'partnerLeads'),
      invoices: take(invoices, 'invoices'),
      invoicesAmount: take(invoicesAmount, 'invoicesAmount'),
      paid: take(paid, 'paid'),
      paidCount: take(paidCount, 'paidCount'),
      payout: take(finiteNumber(parsed.payout), 'payout'),
      commission: take(finiteNumber(parsed.commission), 'commission'),
    },
    file,
    fetchedAt,
    asOf: timestamp(parsed.asOf) !== null && timestamp(parsed.asOf) <= timestamp(parsed.fetchedAt) ? new Date(timestamp(parsed.asOf)).toISOString() : null,
  };
}

function readCosts(dir, now, period) {
  const file = path.join(dir, 'costs', 'reconciliation.json');
  const source = 'сверка затрат проекта';
  if (!existsSync(file)) return { total: metricNoData('нет сверки полных затрат проекта', source), asOf: null };
  const parsed = readJson(file, undefined);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Файл затрат ${file} должен содержать объект`);
  const problem = sourceProblem(parsed, { period, now, maxAgeMs: ANALYTICS_FRESHNESS_MS, verificationSource: 'project-costs' }) || receiptProblem(dir, parsed.verification);
  const cutoff = timestamp(parsed.asOf), fetched = timestamp(parsed.fetchedAt);
  if (problem || parsed.complete !== true || !validMetric(parsed.totalCosts, 'money') || cutoff === null || cutoff > fetched) return { total: metricNoData(problem || 'нет полной сверки суммы затрат и момента среза', source, parsed.fetchedAt), asOf: null };
  return { total: metricOk(parsed.totalCosts, source, parsed.fetchedAt), asOf: new Date(cutoff).toISOString() };
}

// CR только между двумя метриками со статусом ok. Любой другой случай —
// «нет данных»: неполные данные и деление на ноль не дают 0/100%/Infinity.
export function conversionRate(current, previous) {
  if (current.status !== 'ok' || previous.status !== 'ok') {
    return metricNoData('нет подтверждённых данных для CR (нужны два статуса ok)', 'расчёт отчёта');
  }
  const a = current.basis, b = previous.basis;
  if (!a || !b || !a.unique || !b.unique || !a.complete || !b.complete || !['visitors','visits','leads'].includes(a.unit) || a.unit !== b.unit || a.cohort !== b.cohort || a.asOf !== b.asOf || a.period.from !== b.period.from || a.period.to !== b.period.to) return metricNoData('несопоставимые единицы, период, момент среза или когорта; CR не доказан', 'расчёт отчёта');
  if (!a.subsetOf.includes(b.metric)) return metricNoData('не подтверждено, что числитель является подмножеством знаменателя', 'расчёт отчёта');
  if (current.value > previous.value) return metricNoData('числитель превышает размер когорты; это не доказанная конверсия', 'расчёт отчёта');
  if (previous.value === 0) {
    return metricNoData('деление на ноль: знаменатель 0', 'расчёт отчёта');
  }
  return metricOk(current.value / previous.value, 'расчёт отчёта', current.fetchedAt || previous.fetchedAt);
}

export function computeCommercialReport({ dir = resolveDataDir(), days = 7, now = new Date() } = {}) {
  if (!Number.isInteger(days) || days < 1 || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid report days or current date');
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - days + 1);
  const from = fromDate.toISOString().slice(0, 10);

  const period = { from, to, days, timeZone: 'UTC' };
  const analytics = readAnalytics(dir, now, period);
  const partner = readPartner(dir, now, period);
  const metrics = { ...analytics.metrics, ...partner.metrics };

  const cr = {};
  for (const def of CR_DEFS) cr[def.key] = conversionRate(metrics[def.num], metrics[def.den]);

  // Customer payments belong to the merchant; project income is its commission.
  const revenue = partner.metrics.commission;
  const costs = readCosts(dir, now, period);
  const netResult = revenue.status === 'ok' && costs.total.status === 'ok' && partner.asOf && partner.asOf === costs.asOf
    ? metricOk(Math.round((revenue.value - costs.total.value) * 100) / 100, 'комиссия минус сверенные полные затраты', partner.fetchedAt)
    : metricNoData('нужны сверенные комиссия и полные затраты за один период и момент среза', 'расчёт экономики');

  return {
    period,
    generatedAt: now.toISOString(),
    metrics,
    cr,
    revenue,
    projectIncome: revenue,
    customerPayments: partner.metrics.paid,
    cashReceived: partner.metrics.payout,
    totalProjectCosts: costs.total,
    netResult,
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
  { key: 'commission', label: 'начисленная комиссия проекта', kind: 'money' },
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
  // Комиссия, оплаченные счета и выплаты не подменяют друг друга.
  lines.push(`Доход проекта (начисленная комиссия; оплаты клиентов и выплаты отдельно): ${formatMetric(r.revenue, 'money')}${sourceSuffix(r.revenue)}`);
  lines.push(`Полные затраты проекта: ${formatMetric(r.totalProjectCosts, 'money')}${sourceSuffix(r.totalProjectCosts)}`);
  lines.push(`Результат (комиссия минус полные затраты; не денежный поток): ${formatMetric(r.netResult, 'money')}${sourceSuffix(r.netResult)}`);
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
