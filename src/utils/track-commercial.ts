import { track } from './track';
import { emitCommercial, commercialEnabled } from './commercial-events.mjs';

/** Только промежуточные события; локальные проверки не загрязняют счётчик. */
export function trackCommercial(event: string, fields: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (!commercialEnabled(import.meta.env.PUBLIC_COMMERCIAL_EVENTS_ENABLED, window.location.hostname)) return;
  emitCommercial(event, fields, track);
}
