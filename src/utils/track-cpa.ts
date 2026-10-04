import { track } from './track';
import { commercialEnabled } from './commercial-events.mjs';
import { registerCpaVisibility } from './cpa-visibility.mjs';
import { registerCpaTracking } from './cpa-tracking.mjs';

export function initCpaTracking(): void {
  if (typeof window === 'undefined' || !commercialEnabled('true', window.location.hostname)) return;
  if (import.meta.env.PUBLIC_COMMERCIAL_EVENTS_ENABLED === 'true') {
    registerCpaVisibility({ document, send: track, Observer: window.IntersectionObserver });
  }
  registerCpaTracking({ document, send: track,
    contextEnabled: import.meta.env.PUBLIC_COMMERCIAL_EVENTS_ENABLED === 'true' });
}
