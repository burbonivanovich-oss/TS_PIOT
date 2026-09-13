import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig } from './config-schema.mjs';

const valid = () => ({
  contentRoot: '../TS_PIOT',
  paths: { blog: 'src/content/blog', pillars: 'src/content/pillars', glossary: 'src/content/glossary', wiki: 'src/content/wiki' },
  throughput: { monthlyTarget: 200, batchesPerDay: 2, maxBatchSize: 6, maxParallelWriting: 8, catchUpFactor: 1.35 },
  mix: { new: 0.75, rewrite: 0.25 },
  dedupe: { canonicalExact: true, containmentBlock: 0.72, containmentWarn: 0.5, titleJaccardBlock: 0.62, titleJaccardWarn: 0.45, bodyShingleBlock: 0.3, shingleSize: 5, keywordOverlapBlock: 0.7 },
  rewrite: { staleAfterDays: 180, hardStaleAfterDays: 365, minDaysBetweenRewrites: 90, npaTriggerBoost: 40, thinContentChars: 4500 },
  interlink: { minOutbound: 3, maxOutbound: 8, minInbound: 2, maxInboundPerRun: 4, maxLinksPerParagraph: 1, anchorMinLength: 8, reciprocalPenalty: true, protectedZones: ['frontmatter'], minAnchorIdf: 3.2, rareAnchorIdf: 3.0, minRelevance: 0.35 },
  gates: { minScore: 70, maxAiMarkerDensity: 0.6, requireFactcheck: true, minChars: 4000, maxChars: 22000, quarantineAfterFailures: 2, sourceMaxAgeDays: 180 },
  publish: { autoPublish: true, draftOnFail: true, maxPerDay: 12 },
  backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2 },
});

test('AP-P0-03: полный конфиг проходит схему', () => {
  assert.deepEqual(validateConfig(valid()), []);
});

test('AP-P0-03: реальный config/autopilot.config.json валиден', async () => {
  const { loadConfig } = await import('./config.mjs');
  assert.doesNotThrow(() => loadConfig());
});

test('AP-P0-03: неполный и лишний конфиг отвергаются', () => {
  const missing = valid();
  delete missing.publish;
  assert.match(validateConfig(missing).join('\n'), /отсутствует обязательный раздел\/ключ "publish"/);

  const extra = valid();
  extra.mystery = 1;
  assert.match(validateConfig(extra).join('\n'), /неизвестный ключ верхнего уровня "mystery"/);

  const nested = valid();
  nested.interlink.mystery = 1;
  assert.match(validateConfig(nested).join('\n'), /неизвестный ключ interlink\.mystery/);

  const missingKey = valid();
  delete missingKey.backlog.targetBufferFactor;
  assert.match(validateConfig(missingKey).join('\n'), /отсутствует обязательный ключ backlog\.targetBufferFactor/);
});

test('AP-P0-03: отрицательные и противоречивые значения отвергаются', () => {
  const negative = valid();
  negative.throughput.monthlyTarget = -5;
  assert.match(validateConfig(negative).join('\n'), /monthlyTarget/);

  const mix = valid();
  mix.mix = { new: 0.5, rewrite: 0.2 };
  assert.match(validateConfig(mix).join('\n'), /mix\.new \+ mix\.rewrite должны давать 1/);

  const links = valid();
  links.interlink.minOutbound = 9;
  assert.match(validateConfig(links).join('\n'), /minOutbound не может превышать maxOutbound/);

  const lengths = valid();
  lengths.gates.minChars = 30000;
  assert.match(validateConfig(lengths).join('\n'), /minChars не может превышать maxChars/);

  const batch = valid();
  batch.throughput.maxBatchSize = 100;
  assert.match(validateConfig(batch).join('\n'), /maxBatchSize не может превышать maxParallelWriting/);

  const publish = valid();
  publish.publish.maxPerDay = 999;
  assert.match(validateConfig(publish).join('\n'), /maxPerDay не может превышать месячную норму/);

  const zeroSlot = valid();
  zeroSlot.throughput.maxParallelWriting = 0;
  assert.match(validateConfig(zeroSlot).join('\n'), /maxParallelWriting должен быть ≥1/);

  const types = valid();
  types.gates.requireFactcheck = 'yes';
  assert.match(validateConfig(types).join('\n'), /requireFactcheck должен быть boolean/);
});

test('AP-P0-03: loadConfig падает до записи при плохом файле', () => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = mkdtempSync(path.join(tmpdir(), 'cfg-bad-'));
  const file = path.join(dir, 'bad.json');
  writeFileSync(file, JSON.stringify({ contentRoot: '..' }), 'utf8');
  const code = `
    import { loadConfig } from ${JSON.stringify(path.join(ROOT, 'scripts', 'lib', 'config.mjs'))};
    try { loadConfig(); console.log('NO_THROW'); }
    catch (e) { console.error(e.message); process.exit(3); }
  `;
  const proc = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: dir,
    env: { ...process.env, AUTOPILOT_CONFIG: file, AUTOPILOT_DATA_DIR: dir },
    encoding: 'utf8',
  });
  assert.equal(proc.status, 3, `ожидался отказ, stdout: ${proc.stdout}`);
  assert.match(proc.stderr, /Некорректный конфиг/);
  assert.match(proc.stderr, /отсутствует обязательный/);
});
