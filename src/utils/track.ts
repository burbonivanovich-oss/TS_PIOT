// Утилита для отправки событий в Яндекс.Метрику из интерактивных
// компонентов. Счётчик подключён в src/components/BaseHead.astro
// (id 109130279). Здесь — единая обёртка, чтобы компоненты не
// дёргали window.ym напрямую.
//
// Использование:
//   import { track } from '../../utils/track';
//   track('flagship-ts-piot-step-1-reached');
//
// Все события для флагмана-симулятора префиксуем
// `flagship-ts-piot-`, для калькуляторов — `calc-<имя>-`.
// Список целей, которые надо завести в Метрике, — см.
// src/content/wiki/flagship-ts-piot-simulator.md, раздел «Аналитика».

declare global {
  interface Window {
    ym?: (counterId: number, action: string, target: string, params?: Record<string, unknown>) => void;
  }
}

const COUNTER_ID = 109130279;

export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!window.ym) return;
  window.ym(COUNTER_ID, 'reachGoal', event, params);
}

// Отправляет событие только один раз за сессию (по ключу).
// Полезно для целей вида «дошёл до шага N» — иначе при возврате
// назад-вперёд цели задвоятся.
const fired = new Set<string>();
export function trackOnce(event: string, params?: Record<string, unknown>): void {
  if (fired.has(event)) return;
  fired.add(event);
  track(event, params);
}
