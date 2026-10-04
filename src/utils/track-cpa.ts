import { track } from './track';
import { commercialEnabled } from './commercial-events.mjs';
import { registerCpaTracking } from './cpa-tracking.mjs';

export function initCpaTracking(): void {
  if (typeof window === 'undefined' || !commercialEnabled('true', window.location.hostname)) return;
  registerCpaTracking({ document, send: track,
    contextEnabled: import.meta.env.PUBLIC_COMMERCIAL_EVENTS_ENABLED === 'true' });
}
