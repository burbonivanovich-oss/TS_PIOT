// События интереса и попыток, без подтверждения оплаты или приёма лида.
const OFFERS = new Set(["chestny-znak", "default-ts-piot", "default-markirovka", "default-zakonodatelstvo", "ts-piot-provider", "online-buh", "edo-operator", "kontur-ofd", "kontur-markirovka", "kontur-diadoc", "diadoc-logistika", "kontur-elba", "kontur-extern", "kontur-focus", "diadoc-kedo", "kontur-mchd", "kontur-market", "bank-elba", "kontur-podpis", "kontur-merkuriy", "kontur-zarplata", "kontur-nds", "kontur-prizma", "kontur-dokumenty", "tbank-rko", "tochka-rko", "tbank-acquiring", "tochka-acquiring", "alfa-credit-msb"]);
const EVENTS = new Set(['product-view', 'product-cta-click', 'selector-task', 'selector-result', 'selector-product-click', 'form-start', 'form-submit-attempt']);
const TASKS = new Set(['kassa', 'ofd', 'markirovka', 'buh', 'edo', 'etrn', 'kadry', 'kontragenty']);
const ROLES = new Set(['sender', 'carrier', 'recipient', 'mixed']);
const FORMS = new Set(['ip-solo', 'ip-staff', 'ooo']);

export function commercialEnabled(enabled, hostname) {
  return enabled === 'true' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(String(hostname).toLowerCase());
}

export function commercialPayload(event, fields = {}) {
  if (!EVENTS.has(event)) return null;
  const params = {};
  // Только идентификаторы интерфейса: никаких значений полей, URL и запросов.
  if (OFFERS.has(fields.offer)) params.offer = fields.offer;
  if (TASKS.has(fields.task)) params.task = fields.task;
  if (ROLES.has(fields.role)) params.role = fields.role;
  if (FORMS.has(fields.form)) params.form = fields.form;
  if (['lead', 'external'].includes(fields.action)) params.action = fields.action;
  return { event, params };
}

export function emitCommercial(event, fields, send) {
  const payload = commercialPayload(event, fields);
  if (!payload) return false;
  try { send(payload.event, payload.params); return true; }
  catch { return false; } // аналитика не должна ломать подбор или переход
}
