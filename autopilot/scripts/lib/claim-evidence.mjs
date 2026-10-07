import { createHash } from 'node:crypto';
import { auditSourceUrl } from './sources.mjs';
import { monetaryValues, criticalDateValues } from './critical-claims.mjs';

// Точный текст утверждения связывает результат сверки с конкретной версией.
// Перелинковка сохраняет слова якоря и не меняет идентификатор утверждения.
export const normalizeClaim = text => String(text).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
export const claimHash = text => createHash('sha256').update(normalizeClaim(text)).digest('hex');
const digest = text => createHash('sha256').update(text).digest('hex');

export function checkClaimEvidence({ claims, evidence, now = new Date(), maxAgeDays = 180 }) {
  const problems = [];
  const fresh = value => {
    const stamp = Date.parse(value);
    const age = now.getTime() - stamp;
    return Number.isFinite(stamp) && age >= 0 && age <= maxAgeDays * 86400000;
  };
  for (const claim of claims) {
    const id = claimHash(claim.sentence);
    const entry = (Array.isArray(evidence?.claims) ? evidence.claims : []).find(c => c.claimHash === id && c.source === claim.source);
    const reject = reason => problems.push({ claimHash: id, text: claim.text, reason });
    if (!entry || entry.result !== 'verified' || (typeof entry.rationale !== 'string' || !entry.rationale.trim())) {
      reject('нет сохранённой содержательной сверки утверждения'); continue;
    }
    if (!fresh(entry.checkedAt)) { reject('сверка устарела или датирована будущим'); continue; }
    if (!auditSourceUrl(entry.source).ok) { reject('непригодный первоисточник'); continue; }
    const doc = (Array.isArray(evidence?.documents) ? evidence.documents : []).find(d => d.url === entry.source);
    if (!doc || typeof doc.text !== 'string' || doc.status !== 200 || !fresh(doc.fetchedAt) || digest(doc.text) !== doc.sha256) {
      reject('нет целого свежего снимка первоисточника'); continue;
    }
    if ((typeof entry.excerpt !== 'string' || !entry.excerpt.trim()) || !normalizeClaim(doc.text).includes(normalizeClaim(entry.excerpt))) {
      reject('подтверждающий фрагмент отсутствует в снимке документа'); continue;
    }
    // Детерминированная сверка числовой части не заменяет смысловую проверку
    // исполнителем. Она ловит перенос evidence от другой даты или суммы.
    if (claim.id === 'date') {
      const dates = criticalDateValues(claim.text), excerptDates = criticalDateValues(entry.excerpt);
      if (!dates.length || dates.some(d=>!excerptDates.some(e=>e.year===d.year && e.month===d.month && (d.day===null || e.day===d.day)))) {
        reject('дата утверждения отсутствует в подтверждающем фрагменте');
      }
      continue;
    }
    const numbers = claim.id === 'fine' ? monetaryValues(claim.text) : (String(claim.text).match(/\d+/g) || []);
    const excerptNumbers = claim.id === 'fine' ? monetaryValues(entry.excerpt) : (entry.excerpt.match(/\d+/g) || []);
    if (numbers.some(n => !excerptNumbers.includes(n))) reject('числа утверждения отсутствуют в подтверждающем фрагменте');
  }
  return { ok: problems.length === 0, problems };
}
