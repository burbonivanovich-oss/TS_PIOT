// Пригодность и свежесть первоисточников (AP-P1-02).
//
// Детерминированная часть работает без сети: домен, схема, ссылка на главную.
// Сетевой этап (HTTP status, редиректы) вынесен отдельно и только сохраняет
// evidence в data/source-evidence.json. Гейты читают сохранённый evidence, а
// не сеть: недоступность сети не должна менять вердикт без записи о проверке.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.mjs';

// Canonical allowlist первоисточников. Тот же набор, что в SOURCE_RE гейтов;
// домены в ASCII (punycode), потому что `new URL().hostname` нормализует
// кириллицу именно так.
export const SOURCE_DOMAINS = [
  'consultant.ru',
  'garant.ru',
  'nalog.gov.ru',
  'publication.pravo.gov.ru',
  'pravo.gov.ru',
  'crpt.ru',
  'kremlin.ru',
  'duma.gov.ru',
  'regulation.gov.ru',
  'xn--80ajghhoc2aj1c8b.xn--p1ai',
];

const GENERAL_URL_RE = /https?:\/\/[^\s)\]}"'<>]+/gi;
const SOURCE_EVIDENCE_RE = /https?:\/\/[^\s)\]}"'<>]+/i;

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Домен разрешён, если он сам в allowlist или является его поддоменом. */
export function hostAllowed(host) {
  if (!host) return false;
  return SOURCE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Все http(s)-ссылки в теле статьи. */
export function extractUrls(body) {
  return [...String(body || '').matchAll(GENERAL_URL_RE)].map((m) => m[0]);
}

/** Ссылку из markdown-вставки `](url)` в чистом виде. */
export function urlFromMatch(matchText) {
  const m = matchText.match(SOURCE_EVIDENCE_RE);
  return m ? m[0].replace(/\)+$/, '') : null;
}

/**
 * Детерминированная проверка одного URL. Возвращает { ok, reason }.
 * «Ссылка на главную» — это путь `/` или пустой: норма не опознаётся по
 * корню сайта, такой источник не подтверждает конкретное утверждение.
 */
export function auditSourceUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'некорректный URL' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: `неподдерживаемая схема ${parsed.protocol}` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'учётные данные в URL' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!hostAllowed(host)) {
    return { ok: false, reason: `домен вне allowlist: ${host}` };
  }
  if (parsed.pathname === '' || parsed.pathname === '/') {
    return { ok: false, reason: 'ссылка на главную страницу, а не на норму' };
  }
  return { ok: true, reason: null, host };
}

/**
 * Вердикт по сохранённому evidence. Без evidence источник не подтверждён
 * сетевым этапом, но и не опровергнут: детерминированная проверка уже прошла.
 * Сеть способна только ухудшить вердикт — и только если evidence записан.
 */
export function evaluateEvidence(entry, { now = new Date(), maxAgeDays = 180 } = {}) {
  if (!entry) return { ok: false, reason: 'нет сохранённого evidence проверки', stale: false };
  if (entry.error) return { ok: false, reason: `проверка не удалась: ${entry.error}`, stale: false };
  if (typeof entry.status === 'number' && entry.status >= 400) {
    return { ok: false, reason: `HTTP ${entry.status}`, stale: false };
  }
  const finalHost = hostOf(entry.finalUrl || entry.url);
  if (entry.finalUrl && !hostAllowed(finalHost)) {
    return { ok: false, reason: `редирект за пределы allowlist: ${finalHost}`, stale: false };
  }
  const checked = entry.checkedAt ? new Date(entry.checkedAt) : null;
  if (!checked || Number.isNaN(checked.getTime())) {
    return { ok: false, reason: 'evidence без корректной даты проверки', stale: true };
  }
  const ageDays = Math.floor((now - checked) / 86400000);
  if (ageDays > maxAgeDays) {
    return { ok: false, reason: `evidence устарело (${ageDays} дн.)`, stale: true, ageDays };
  }
  return { ok: true, reason: null, ageDays };
}

/** Сохранённый evidence для статей. Отсутствие файла — не ошибка. */
export function readSourceEvidence(file = path.join(loadConfig().resolved.dataDir, 'source-evidence.json')) {
  if (!existsSync(file)) return { generatedAt: null, entries: {} };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    // Fail-closed: повреждённый evidence нельзя молча игнорировать — иначе
    // гейт решит, что проверки не было, и пропустит нормативный материал.
    throw new Error(`Повреждён source-evidence ${file}: ${error.message}`);
  }
  return { generatedAt: parsed.generatedAt || null, entries: parsed.entries || {} };
}

/**
 * Сетевой этап: проверить URL и собрать evidence. `fetcher` инъектируется,
 * чтобы тесты не ходили в сеть. Сначала HEAD, при 405/501 — GET.
 */
export async function verifySources(urls, { fetcher = fetch, now = new Date(), timeoutMs = 10000 } = {}) {
  const entries = {};
  for (const raw of [...new Set(urls)]) {
    const entry = { url: raw, checkedAt: now.toISOString(), status: null, finalUrl: raw, error: null };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetcher(raw, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
        if (response.status === 405 || response.status === 501) {
          response = await fetcher(raw, { method: 'GET', redirect: 'follow', signal: controller.signal });
        }
      } finally {
        clearTimeout(timer);
      }
      entry.status = response.status;
      entry.finalUrl = response.url || raw;
    } catch (error) {
      entry.error = error.name === 'AbortError' ? `таймаут ${timeoutMs} мс` : error.message;
    }
    entries[raw] = entry;
  }
  return entries;
}
