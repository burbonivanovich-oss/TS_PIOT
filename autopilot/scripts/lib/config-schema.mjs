// Схема конфигурации автопилота (AP-P0-03).
//
// Один источник порогов должен быть проверяемым: неполный, лишний, отрицательный
// или логически противоречивый конфиг обязан остановить проход до любой записи,
// а не проявиться как «странная» генерация тем или деление на ноль через месяц.
//
// Возвращает массив человекочитаемых ошибок; пустой массив — конфиг валиден.

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const inRange = (v, min, max) => isNum(v) && v >= min && v <= max;

export const SECTIONS = {
  throughput: ['monthlyTarget', 'batchesPerDay', 'maxBatchSize', 'maxParallelWriting', 'catchUpFactor'],
  mix: ['new', 'rewrite'],
  dedupe: ['canonicalExact', 'containmentBlock', 'containmentWarn', 'titleJaccardBlock', 'titleJaccardWarn', 'bodyShingleBlock', 'shingleSize', 'keywordOverlapBlock'],
  rewrite: ['staleAfterDays', 'hardStaleAfterDays', 'minDaysBetweenRewrites', 'npaTriggerBoost', 'thinContentChars'],
  interlink: ['minOutbound', 'maxOutbound', 'minInbound', 'maxInboundPerRun', 'maxLinksPerParagraph', 'anchorMinLength', 'reciprocalPenalty', 'protectedZones', 'minAnchorIdf', 'rareAnchorIdf', 'minRelevance'],
  gates: ['minScore', 'maxAiMarkerDensity', 'requireFactcheck', 'minChars', 'maxChars', 'quarantineAfterFailures'],
  publish: ['autoPublish', 'draftOnFail', 'maxPerDay'],
  backlog: ['targetBufferFactor', 'maxPerEntityShare', 'maxPerEntityPerBatch'],
};

// Необязательные ключи, которые код умеет читать через `?? default`.
export const OPTIONAL = {
  gates: ['sourceMaxAgeDays', 'infraRetryLimit'],
};

// Необязательный раздел защиты целевого checkout (AP-P0-04).
export const OPTIONAL_TOP = ['security'];
export const SECURITY_KEYS = ['strictContentRoot', 'expectedRemote', 'allowedBranches', 'buildCheck'];
const REQUIRED_TOP = ['contentRoot', 'paths', ...Object.keys(SECTIONS)];

export function validateConfig(cfg) {
  const errors = [];
  if (!isObject(cfg)) return ['конфиг должен быть JSON-объектом'];

  const allowedTop = [...REQUIRED_TOP, ...OPTIONAL_TOP];
  for (const key of REQUIRED_TOP) {
    if (!(key in cfg)) errors.push(`отсутствует обязательный раздел/ключ "${key}"`);
  }
  for (const key of Object.keys(cfg)) {
    if (!allowedTop.includes(key)) errors.push(`неизвестный ключ верхнего уровня "${key}"`);
  }

  if ('security' in cfg) {
    if (!isObject(cfg.security)) errors.push('security должен быть объектом');
    else {
      for (const key of Object.keys(cfg.security)) {
        if (!SECURITY_KEYS.includes(key)) errors.push(`неизвестный ключ security.${key}`);
      }
      if ('strictContentRoot' in cfg.security && typeof cfg.security.strictContentRoot !== 'boolean') {
        errors.push('security.strictContentRoot должен быть boolean');
      }
      if ('expectedRemote' in cfg.security && (typeof cfg.security.expectedRemote !== 'string' || cfg.security.expectedRemote.trim() === '')) {
        errors.push('security.expectedRemote должен быть непустой строкой');
      }
      if ('allowedBranches' in cfg.security && (!Array.isArray(cfg.security.allowedBranches) || cfg.security.allowedBranches.some((b) => typeof b !== 'string' || b.trim() === ''))) {
        errors.push('security.allowedBranches должен быть массивом непустых строк');
      }
      if ('buildCheck' in cfg.security && typeof cfg.security.buildCheck !== 'boolean') {
        errors.push('security.buildCheck должен быть boolean');
      }
    }
  }

  if ('contentRoot' in cfg && (typeof cfg.contentRoot !== 'string' || cfg.contentRoot.trim() === '')) {
    errors.push('contentRoot должен быть непустой строкой');
  }

  if ('paths' in cfg) {
    if (!isObject(cfg.paths)) errors.push('paths должен быть объектом');
    else {
      for (const key of ['blog', 'pillars', 'glossary', 'wiki']) {
        if (typeof cfg.paths[key] !== 'string' || cfg.paths[key].trim() === '') {
          errors.push(`paths.${key} должен быть непустой строкой`);
        }
      }
      for (const key of Object.keys(cfg.paths)) {
        if (!['blog', 'pillars', 'glossary', 'wiki'].includes(key)) errors.push(`неизвестный ключ paths.${key}`);
      }
    }
  }

  for (const [section, keys] of Object.entries(SECTIONS)) {
    if (!(section in cfg)) continue;
    if (!isObject(cfg[section])) {
      errors.push(`${section} должен быть объектом`);
      continue;
    }
    const allowed = new Set([...keys, ...(OPTIONAL[section] || [])]);
    for (const key of Object.keys(cfg[section])) {
      if (!allowed.has(key)) errors.push(`неизвестный ключ ${section}.${key}`);
    }
    for (const key of keys) {
      if (!(key in cfg[section])) errors.push(`отсутствует обязательный ключ ${section}.${key}`);
    }
  }

  const t = cfg.throughput || {};
  if (isNum(t.monthlyTarget) && !(isInt(t.monthlyTarget) && t.monthlyTarget > 0)) errors.push('throughput.monthlyTarget должен быть положительным целым');
  if (isNum(t.batchesPerDay) && !(isInt(t.batchesPerDay) && t.batchesPerDay >= 1)) errors.push('throughput.batchesPerDay должен быть ≥1');
  if (isNum(t.maxBatchSize) && !(isInt(t.maxBatchSize) && t.maxBatchSize >= 1)) errors.push('throughput.maxBatchSize должен быть ≥1');
  if (isNum(t.maxParallelWriting) && !(isInt(t.maxParallelWriting) && t.maxParallelWriting >= 1)) errors.push('throughput.maxParallelWriting должен быть ≥1');
  if (isNum(t.catchUpFactor) && t.catchUpFactor < 1) errors.push('throughput.catchUpFactor должен быть ≥1');
  if (isNum(t.maxBatchSize) && isNum(t.maxParallelWriting) && t.maxBatchSize > t.maxParallelWriting) {
    errors.push('throughput.maxBatchSize не может превышать maxParallelWriting (батч больше числа слотов не выполним)');
  }

  const mix = cfg.mix || {};
  if (isNum(mix.new) && isNum(mix.rewrite)) {
    if (mix.new < 0 || mix.rewrite < 0) errors.push('mix.new и mix.rewrite должны быть неотрицательными');
    if (Math.abs(mix.new + mix.rewrite - 1) > 1e-9) errors.push(`mix.new + mix.rewrite должны давать 1 (сейчас ${mix.new + mix.rewrite})`);
  }

  const d = cfg.dedupe || {};
  for (const key of ['containmentBlock', 'containmentWarn', 'titleJaccardBlock', 'titleJaccardWarn', 'bodyShingleBlock', 'keywordOverlapBlock']) {
    if (isNum(d[key]) && !inRange(d[key], 0, 1)) errors.push(`dedupe.${key} должен быть в диапазоне 0–1`);
  }
  if (isNum(d.containmentWarn) && isNum(d.containmentBlock) && d.containmentWarn > d.containmentBlock) {
    errors.push('dedupe.containmentWarn не может превышать containmentBlock');
  }
  if (isNum(d.shingleSize) && !(isInt(d.shingleSize) && d.shingleSize >= 2)) errors.push('dedupe.shingleSize должен быть ≥2');
  if ('canonicalExact' in d && typeof d.canonicalExact !== 'boolean') errors.push('dedupe.canonicalExact должен быть boolean');

  const i = cfg.interlink || {};
  if (isNum(i.minOutbound) && isNum(i.maxOutbound) && i.minOutbound > i.maxOutbound) {
    errors.push('interlink.minOutbound не может превышать maxOutbound');
  }
  if (isNum(i.minInbound) && i.minInbound < 0) errors.push('interlink.minInbound должен быть ≥0');
  if (isNum(i.maxInboundPerRun) && !(isInt(i.maxInboundPerRun) && i.maxInboundPerRun >= 1)) errors.push('interlink.maxInboundPerRun должен быть ≥1');
  if (isNum(i.maxLinksPerParagraph) && !(isInt(i.maxLinksPerParagraph) && i.maxLinksPerParagraph >= 1)) errors.push('interlink.maxLinksPerParagraph должен быть ≥1');
  if (isNum(i.anchorMinLength) && i.anchorMinLength < 1) errors.push('interlink.anchorMinLength должен быть ≥1');
  if (isNum(i.minRelevance) && !inRange(i.minRelevance, 0, 1)) errors.push('interlink.minRelevance должен быть в диапазоне 0–1');
  if (isNum(i.minAnchorIdf) && i.minAnchorIdf < 0) errors.push('interlink.minAnchorIdf должен быть ≥0');
  if (isNum(i.rareAnchorIdf) && i.rareAnchorIdf < 0) errors.push('interlink.rareAnchorIdf должен быть ≥0');
  if ('reciprocalPenalty' in i && typeof i.reciprocalPenalty !== 'boolean') errors.push('interlink.reciprocalPenalty должен быть boolean');
  if ('protectedZones' in i && (!Array.isArray(i.protectedZones) || i.protectedZones.some((z) => typeof z !== 'string'))) {
    errors.push('interlink.protectedZones должен быть массивом строк');
  }

  const g = cfg.gates || {};
  if (isNum(g.minScore) && !inRange(g.minScore, 0, 100)) errors.push('gates.minScore должен быть 0–100');
  if (isNum(g.maxAiMarkerDensity) && g.maxAiMarkerDensity < 0) errors.push('gates.maxAiMarkerDensity должен быть ≥0');
  if (isNum(g.minChars) && isNum(g.maxChars) && g.minChars > g.maxChars) errors.push('gates.minChars не может превышать maxChars');
  if (isNum(g.minChars) && g.minChars < 1) errors.push('gates.minChars должен быть ≥1');
  if (isNum(g.quarantineAfterFailures) && !(isInt(g.quarantineAfterFailures) && g.quarantineAfterFailures >= 1)) errors.push('gates.quarantineAfterFailures должен быть ≥1');
  if ('requireFactcheck' in g && typeof g.requireFactcheck !== 'boolean') errors.push('gates.requireFactcheck должен быть boolean');
  if ('sourceMaxAgeDays' in g && !(isNum(g.sourceMaxAgeDays) && g.sourceMaxAgeDays >= 1)) errors.push('gates.sourceMaxAgeDays должен быть ≥1');
  if ('infraRetryLimit' in g && !(isInt(g.infraRetryLimit) && g.infraRetryLimit >= 1)) errors.push('gates.infraRetryLimit должен быть ≥1');

  const p = cfg.publish || {};
  if (isNum(p.maxPerDay) && !(isInt(p.maxPerDay) && p.maxPerDay >= 1)) errors.push('publish.maxPerDay должен быть ≥1');
  if ('autoPublish' in p && typeof p.autoPublish !== 'boolean') errors.push('publish.autoPublish должен быть boolean');
  if ('draftOnFail' in p && typeof p.draftOnFail !== 'boolean') errors.push('publish.draftOnFail должен быть boolean');
  if (isNum(p.maxPerDay) && isNum(t.monthlyTarget) && p.maxPerDay > t.monthlyTarget) {
    errors.push('publish.maxPerDay не может превышать месячную норму');
  }

  const b = cfg.backlog || {};
  if (isNum(b.targetBufferFactor) && b.targetBufferFactor < 1) errors.push('backlog.targetBufferFactor должен быть ≥1');
  if (isNum(b.maxPerEntityShare) && !inRange(b.maxPerEntityShare, 0, 1)) errors.push('backlog.maxPerEntityShare должен быть в диапазоне 0–1');
  if ('maxPerEntityPerBatch' in b && !(isInt(b.maxPerEntityPerBatch) && b.maxPerEntityPerBatch >= 1)) errors.push('backlog.maxPerEntityPerBatch должен быть ≥1');

  return errors;
}
