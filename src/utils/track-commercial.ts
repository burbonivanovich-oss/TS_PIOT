import { track } from './track';
import { emitCommercial } from './commercial-events.mjs';

/** Только промежуточные события; локальные проверки не загрязняют счётчик. */
export function trackCommercial(event: string, fields: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;
  emitCommercial(event, fields, track);
}
