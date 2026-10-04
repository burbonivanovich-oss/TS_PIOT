// A malformed count is unavailable evidence, never measured zero.
export function queryCount(value) {
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) value = Number(value);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid Wordstat count');
  return value;
}
export function topRows(data) {
  if (!Array.isArray(data?.results)) throw new Error('Missing Wordstat results');
  return data.results.map(row => {
    if (typeof row?.phrase !== 'string' || !row.phrase.trim()) throw new Error('Invalid Wordstat phrase');
    return { phrase: row.phrase.trim(), count: queryCount(row.count) };
  });
}
export function topScope(region) {
  if (!/^[1-9]\d*$/.test(String(region))) throw new Error('Invalid Wordstat region');
  return { schemaVersion: 1, source: 'Yandex Cloud Wordstat GetTop', endpoint: 'https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests', region: String(region), devices: 'all', match: 'broad', window: { kind: 'provider_last_30_days', exactDatesVerified: false }, complete: false };
}
