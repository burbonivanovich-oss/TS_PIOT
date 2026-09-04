#!/usr/bin/env node
// Сводка по источникам аналитики: какие отдали свежие данные, а какие молчат.
//
// Зачем: шаги fetch-* в analytics-refresh.yml идут с continue-on-error,
// чтобы один сломанный источник не ронял остальные. Побочный эффект —
// прогон зеленел, даже когда не работал ни один источник, и поломка
// (истёкший GSC-токен, незаведённый токен Вебмастера) оставалась
// незамеченной месяцами. Этот шаг делает состояние видимым: печатает
// таблицу в сводку прогона и возвращает 1, если какой-то источник мёртв.
//
// Окружение:
//   FRESH_HOURS=48 — какой возраст выгрузки считать свежим.
//   SOFT=1         — не падать, только напечатать сводку.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'src', 'data', 'analytics');
const FRESH_HOURS = parseInt(process.env.FRESH_HOURS || '48', 10);
const SOFT = process.env.SOFT === '1';

const SOURCES = [
  {
    file: 'gsc.json',
    name: 'Google Search Console',
    secret: 'GSC_REFRESH_TOKEN, GSC_CLIENT_ID, GSC_CLIENT_SECRET',
    rows: (j) => (j.byPage ? Object.keys(j.byPage).length : 0),
  },
  {
    file: 'metrika.json',
    name: 'Яндекс.Метрика',
    secret: 'METRIKA_OAUTH_TOKEN',
    rows: (j) => (j.byPage ? Object.keys(j.byPage).length : 0),
  },
  {
    file: 'webmaster.json',
    name: 'Яндекс.Вебмастер',
    secret: 'WEBMASTER_OAUTH_TOKEN',
    rows: (j) => (j.queries ? j.queries.length : 0),
  },
];

const now = Date.now();
const report = [];

for (const src of SOURCES) {
  const path = join(DIR, src.file);
  if (!existsSync(path)) {
    report.push({ ...src, state: 'нет файла', ageHours: null, rows: 0 });
    continue;
  }
  let json;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    report.push({ ...src, state: 'битый JSON', ageHours: null, rows: 0 });
    continue;
  }
  const fetchedAt = json.fetchedAt ? Date.parse(json.fetchedAt) : NaN;
  const rows = src.rows(json) || 0;
  if (!fetchedAt || Number.isNaN(fetchedAt)) {
    report.push({ ...src, state: 'заглушка, ни одной выгрузки', ageHours: null, rows });
    continue;
  }
  const ageHours = Math.round((now - fetchedAt) / 3_600_000);
  const stale = ageHours > FRESH_HOURS;
  report.push({
    ...src,
    state: stale ? `выгрузка устарела (${ageHours} ч)` : 'свежие данные',
    ageHours,
    rows,
    ok: !stale && rows > 0,
  });
}

const lines = [
  '| Источник | Состояние | Строк | Возраст |',
  '|---|---|---|---|',
  ...report.map(
    (r) =>
      `| ${r.name} | ${r.ok ? 'работает' : r.state} | ${r.rows} | ${
        r.ageHours == null ? '—' : `${r.ageHours} ч`
      } |`,
  ),
];

const broken = report.filter((r) => !r.ok);
console.log(lines.join('\n'));

if (broken.length) {
  console.log('\nНе отвечают:');
  for (const r of broken) {
    console.log(`  ${r.name} — ${r.state}. Секреты: ${r.secret}. Гайд: docs/SECRETS.md`);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    ['## Источники аналитики', '', ...lines, ''].join('\n') +
      (broken.length
        ? `\nНе отвечают: ${broken
            .map((r) => `${r.name} (${r.secret})`)
            .join('; ')}. Гайд: docs/SECRETS.md\n`
        : '\nВсе источники отдали свежие данные.\n'),
  );
}

if (broken.length && !SOFT) {
  console.error(
    `::error::Источников без свежих данных: ${broken.length} из ${report.length} — ${broken
      .map((r) => r.name)
      .join(', ')}. Прогон помечен красным намеренно: иначе поломка не видна.`,
  );
  process.exit(1);
}
