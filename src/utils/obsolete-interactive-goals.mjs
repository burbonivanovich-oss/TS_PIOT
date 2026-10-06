// Bounded suppression policy for obsolete interactive Metrica events.
// Technical event suppression only — NOT deletion of historical goals.
// Historical goals are removed only by a scoped remover with exact backup
// confirmation and root ownership (see scripts/metrika/remove-obsolete-interactive.mjs).
//
// Covers candidate groups from the authenticated UI inventory:
//   flagship-*, quiz-ts-piot-*, calc-*, roi-ip-ooo-*,
//   scenario-*, edo-puzzle-*, exact zakon-2026-filter-used,
//   exact selector-task / selector-result.
// Explicitly preserves commerce and quality signals:
//   lead-kontur-market, lead-ts-piot-provider, cpa-click, cpa-visible,
//   product-view, product-cta-click, selector-product-click,
//   form-start, form-submit-attempt, engagement-*, automatic goals,
//   and any unknown unrelated events (fail-open: only listed patterns suppress).

export const OBSOLETE_DECLARATION_IDS = Object.freeze([
  'flagship-ts-piot-completed',
  'quiz-ts-piot-completed',
  'calc-usn-nds-used',
  'calc-shtraf-markirovka-used',
  'roi-ip-ooo-used',
  'selector-task',
  'selector-result',
]);

// Exact single events outside the prefix groups.
const OBSOLETE_EXACT = new Set([
  ...OBSOLETE_DECLARATION_IDS,
  'zakon-2026-filter-used',
]);

// Bounded prefixes. NOTE: no bare 'ts-piot' and no bare 'selector-':
// 'lead-ts-piot-provider' must keep sending, and 'selector-product-click'
// must keep sending.
const OBSOLETE_PREFIXES = Object.freeze([
  'flagship-',
  'quiz-ts-piot-',
  'calc-',
  'roi-ip-ooo-',
  'scenario-',
  'edo-puzzle-',
]);

export function isObsoleteInteractiveGoal(event) {
  if (typeof event !== 'string' || event.length === 0) return false;
  if (OBSOLETE_EXACT.has(event)) return true;
  for (const p of OBSOLETE_PREFIXES) {
    if (event.startsWith(p)) return true;
  }
  return false;
}
