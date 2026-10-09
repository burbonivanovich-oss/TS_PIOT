// Врезка с платным предложением в середине статьи. До нижней кнопки
// доходит меньшинство читателей, поэтому та же реклама (тот же erid)
// ставится перед третьим разделом. Статьи со своей врезкой <CpaCallout>
// не трогаются; короткие статьи (меньше четырёх разделов) — тоже.
//
// Блок рендерится на сервере в <template id="inline-offer"> со стилями
// шаблона статьи, скрипт только переносит его в текст. Без JS врезки нет —
// для рекламного блока это допустимо.

export const INLINE_OFFER_MIN_SECTIONS = 4;
export const INLINE_OFFER_BEFORE_SECTION = 2; // индекс h2: перед третьим разделом

export function inlineOfferTarget(prose) {
  if (!prose) return null;
  if (prose.querySelector('[data-cpa-placement="inline"]')) return null;
  const sections = [...prose.querySelectorAll(':scope > h2')];
  if (sections.length < INLINE_OFFER_MIN_SECTIONS) return null;
  return sections[INLINE_OFFER_BEFORE_SECTION] ?? null;
}

export function placeInlineOffer(document) {
  const template = document.getElementById('inline-offer');
  const prose = document.querySelector('.prose');
  const target = inlineOfferTarget(prose);
  if (!template || !target) return false;
  target.before(template.content.cloneNode(true));
  return true;
}
