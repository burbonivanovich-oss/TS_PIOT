// Wordstat is a demand signal, not unique people, leads or predicted traffic.
const DAY = 86400000;
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
function isoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function rankByDemand(topics, evidence, settings, now = Date.now()) {
  const index = new Map();
  const maxBoost = settings.demandMaxBoost || 0;
  if (maxBoost > 0 && evidence?.schemaVersion === 1) {
    for (const snapshot of evidence.snapshots || []) {
      const start = isoDay(snapshot.periodStart), end = isoDay(snapshot.periodEnd);
      const captured = Date.parse(snapshot.capturedAt);
      let url;
      try { url = new URL(snapshot.url); } catch { continue; }
      if (url.protocol !== 'https:' || url.hostname !== 'wordstat.yandex.ru' || url.username || url.password ||
          String(snapshot.region) !== String(settings.demandRegion) || url.searchParams.get('region') !== String(settings.demandRegion) ||
          snapshot.devices !== 'all' || snapshot.match !== 'broad' ||
          !Number.isFinite(start) || !Number.isFinite(end) || start > end || end > now ||
          !Number.isFinite(captured) || captured > now || captured < end ||
          now - end > settings.demandMaxAgeDays * DAY || now - captured > settings.demandMaxAgeDays * DAY) continue;
      for (const row of snapshot.rows || []) {
        if (typeof row.phrase !== 'string' || !row.phrase.trim() || !Number.isSafeInteger(row.count) || row.count < 0) continue;
        const key = normalize(row.phrase), previous = index.get(key);
        // Overlapping queries and duplicate snapshots are never added together.
        if (!previous || end > previous.end || (end === previous.end && captured > previous.captured)) {
          index.set(key, { ...row, end, captured, periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd, url: snapshot.url, region: snapshot.region });
        }
      }
    }
  }
  return topics.map(topic => {
    // Segment templates append their specific query last. Broad entity demand
    // does not prove demand for retail, pharmacies or marketplace sellers.
    const keywords = topic.segment && topic.segment !== 'none' ? (topic.keywords || []).slice(-1) : (topic.keywords || []);
    const matches = keywords.map(key => index.get(normalize(key))).filter(Boolean);
    const match = matches.sort((a, b) => b.count - a.count)[0];
    const boost = match ? Math.min(maxBoost, Math.log10(1 + match.count) * maxBoost / 5) : 0;
    const demand = match ? { status: 'collected', phrase: match.phrase, count: match.count, match: 'broad', region: match.region, periodStart: match.periodStart, periodEnd: match.periodEnd, source: match.url } : { status: 'not_collected', count: null, reason: 'Нет свежей выборки с совпадающим запросом и регионом' };
    return { ...topic, demand, priorityScore: Math.round(((topic.score || 0) + boost) * 10) / 10 };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
