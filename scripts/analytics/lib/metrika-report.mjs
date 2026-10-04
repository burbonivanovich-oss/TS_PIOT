// Reporting API totals are report-wide aggregates, not sums of page users.
// https://yandex.com/dev/metrika/ru/stat/openapi/data_1
const count = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

export function normalizeMetrikaReport(data) {
  if (!data || !Array.isArray(data.data)) throw new Error('Некорректный ответ Метрики: нет строк отчёта');
  const byPage = Object.create(null);
  for (const row of data.data) {
    const urlPath = row.dimensions?.[0]?.name;
    if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) continue;
    const clean = urlPath.split('?')[0].split('#')[0];
    const pageviews = count(row.metrics?.[0]); const users = count(row.metrics?.[1]);
    if (byPage[clean]) {
      const previous = byPage[clean];
      previous.pageviews = previous.pageviews === null || pageviews === null ? null : previous.pageviews + pageviews;
      // Distinct groups may contain the same visitors. No union is available.
      previous.users = null;
      previous.usersStatus = 'not_collected: overlapping normalized URL groups';
    } else byPage[clean] = { pageviews, visits: null, users, avgDuration: null };
  }
  const totalRows = Number.isInteger(data.total_rows) && data.total_rows >= 0 ? data.total_rows : null;
  const rounded = data.total_rows_rounded === true;
  return {
    totals: { pages: Object.keys(byPage).length, pageviews: count(data.totals?.[0]), visits: null, users: count(data.totals?.[1]) },
    coverage: { scope: 'API report totals; byPage contains returned rows', returnedRows: data.data.length, totalRows, totalRowsRounded: rounded, complete: totalRows === null || rounded ? null : data.data.length >= totalRows, sampled: typeof data.sampled === 'boolean' ? data.sampled : null, sampleShare: typeof data.sample_share === 'number' && data.sample_share >= 0 && data.sample_share <= 1 ? data.sample_share : null },
    byPage,
  };
}
