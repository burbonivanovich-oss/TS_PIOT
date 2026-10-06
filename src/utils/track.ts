// Утилита для отправки событий в Яндекс.Метрики из интерактивных
// компонентов. Счётчик подключён в src/components/BaseHead.astro
// (id 109130279). Здесь — единая обёртка, чтобы компоненты не
// дёргали window.ym напрямую.
//
// Устаревшие интерактивные события (flagship-*, quiz-ts-piot-*,
// calc-*, roi-ip-ooo-*, scenario-*, edo-puzzle-*,
// zakon-2026-filter-used, selector-task/result) подавляются
// централизованно через src/utils/obsolete-interactive-goals.mjs.
// Это только техническая пауза отправки — исторические цели в Метрике
// удаляются отдельным scoped-удалением, а не этим фильтром.
// Коммерция (lead-*, cpa-*, product-*, form-*, selector-product-click),
// engagement и неизвестные события отправляются как раньше.
//
// Использование:
//   import { track } from '../../utils/track';
//   track('product-view');
//
// Гранулярные события интерактивов больше не отправляем;
// список удалённых деклараций — см. src/data/metrika/goals.json.

import { isObsoleteInteractiveGoal } from './obsolete-interactive-goals.mjs';

declare global {
  interface Window {
    ym?: (counterId: number, action: string, target: string, params?: Record<string, unknown>) => void;
  }
}

const COUNTER_ID = 109130279;

export function track(event: string, params?: Record<string, unknown>): void {
  if (isObsoleteInteractiveGoal(event)) return;
  if (typeof window === 'undefined') return;
  if (!window.ym) return;
  window.ym(COUNTER_ID, 'reachGoal', event, params);
}

// Отправляет событие только один раз за сессию (по ключу).
// Полезно для целей вида «дошёл до шага N» — иначе при возврате
// назад-вперёд цели задвоятся.
const fired = new Set<string>();
export function trackOnce(event: string, params?: Record<string, unknown>): void {
  if (isObsoleteInteractiveGoal(event)) return;
  if (fired.has(event)) return;
  fired.add(event);
  track(event, params);
}
