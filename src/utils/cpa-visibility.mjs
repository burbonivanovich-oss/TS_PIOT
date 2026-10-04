import { cpaClickPayload } from './cpa-tracking.mjs';
const registered = new WeakSet();

// One observation per rendered CTA per page. A page view is not an impression.
export function registerCpaVisibility({ document, send, Observer }) {
  if (!Observer || registered.has(document)) return false;
  registered.add(document);
  const seen = new WeakSet();
  const anchors = [...document.querySelectorAll('a[data-cpa-id]')];
  const observer = new Observer(entries => {
    if (document.visibilityState !== 'visible') return;
    for (const entry of entries) {
      const anchor = entry.target;
      if (seen.has(anchor) || !entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
      const payload = cpaClickPayload({ offer: anchor.dataset.cpaId,
        contentId: anchor.closest('article[data-commercial-content-id]')?.dataset.commercialContentId,
        placement: anchor.dataset.cpaPlacement || anchor.closest('[data-cpa-placement]')?.dataset.cpaPlacement,
        contextEnabled: true });
      if (!payload) continue;
      try { send('cpa-visible', payload.params); } catch { continue; }
      seen.add(anchor); observer.unobserve(anchor);
    }
  }, { threshold: [0, 0.5] });
  for (const anchor of anchors) observer.observe(anchor);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // Request fresh geometry after returning from a background tab.
    for (const anchor of anchors) if (!seen.has(anchor)) { observer.unobserve(anchor); observer.observe(anchor); }
  });
  return true;
}
