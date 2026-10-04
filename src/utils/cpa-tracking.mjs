import { commercialPayload } from './commercial-events.mjs';

const documents = new WeakSet();
const validContentId = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

// cpa-click keeps its historical meaning: a click, never an accepted lead.
export function cpaClickPayload({ offer, contentId, placement, contextEnabled = false }) {
  const safeOffer = commercialPayload('product-cta-click', { offer }).params.offer;
  if (!safeOffer) return null;
  const params = { offer: safeOffer };
  if (contextEnabled && validContentId(contentId)) {
    params.contentId = contentId;
    params.placement = ['inline', 'article-footer'].includes(placement) ? placement : 'other';
  }
  return { event: 'cpa-click', params };
}

export function registerCpaTracking({ document, send, contextEnabled = false }) {
  if (documents.has(document)) return false;
  documents.add(document);
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[data-cpa-id]');
    if (!anchor) return;
    const payload = cpaClickPayload({ offer: anchor.dataset.cpaId,
      contentId: anchor.closest('article[data-commercial-content-id]')?.dataset.commercialContentId,
      placement: anchor.dataset.cpaPlacement || anchor.closest('[data-cpa-placement]')?.dataset.cpaPlacement,
      contextEnabled });
    if (!payload) return;
    try { send(payload.event, payload.params); } catch { /* counter failure must not prevent navigation */ }
  });
  return true;
}
