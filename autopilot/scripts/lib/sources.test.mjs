import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditSourceUrl,
  evaluateEvidence,
  extractUrls,
  urlFromMatch,
  verifySources,
  hostAllowed,
} from './sources.mjs';

test('AP-P1-02: детерминированная проверка URL', () => {
  assert.equal(auditSourceUrl('https://publication.pravo.gov.ru/document/1').ok, true);
  assert.equal(auditSourceUrl('https://consultant.ru/document/cons_doc_LAW_1').ok, true);

  const homepage = auditSourceUrl('https://consultant.ru/');
  assert.equal(homepage.ok, false);
  assert.match(homepage.reason, /главную/);

  const foreign = auditSourceUrl('https://example.com/document/1');
  assert.equal(foreign.ok, false);
  assert.match(foreign.reason, /allowlist/);

  const creds = auditSourceUrl('https://user:pass@consultant.ru/document/1');
  assert.equal(creds.ok, false);
  assert.match(creds.reason, /учётные данные/);

  assert.equal(auditSourceUrl('not a url').ok, false);
  assert.equal(auditSourceUrl('ftp://consultant.ru/document/1').ok, false);
});

test('AP-P1-02: поддомены allowlist разрешены, похожие домены — нет', () => {
  assert.equal(hostAllowed('publication.pravo.gov.ru'), true);
  assert.equal(hostAllowed('pravo.gov.ru'), true);
  assert.equal(hostAllowed('consultant.ru.evil.com'), false);
  assert.equal(hostAllowed('notconsultant.ru'), false);
  assert.equal(hostAllowed(null), false);
});

test('AP-P1-02: вердикт по evidence — 404, редирект, устаревание', () => {
  const now = new Date('2026-09-13T00:00:00Z');
  assert.equal(
    evaluateEvidence({ url: 'https://consultant.ru/a', status: 404, finalUrl: 'https://consultant.ru/a', checkedAt: now.toISOString() }, { now }).ok,
    false,
  );
  const redirect = evaluateEvidence(
    { url: 'https://consultant.ru/a', status: 200, finalUrl: 'https://evil.example/a', checkedAt: now.toISOString() },
    { now },
  );
  assert.equal(redirect.ok, false);
  assert.match(redirect.reason, /редирект/);

  const stale = evaluateEvidence(
    { url: 'https://consultant.ru/a', status: 200, finalUrl: 'https://consultant.ru/a', checkedAt: '2025-01-01T00:00:00Z' },
    { now, maxAgeDays: 180 },
  );
  assert.equal(stale.ok, false);
  assert.equal(stale.stale, true);

  const fresh = evaluateEvidence(
    { url: 'https://consultant.ru/a', status: 200, finalUrl: 'https://consultant.ru/a', checkedAt: now.toISOString() },
    { now, maxAgeDays: 180 },
  );
  assert.equal(fresh.ok, true);

  assert.equal(evaluateEvidence(null, { now }).ok, false);
});

test('AP-P1-02: извлечение URL и markdown-вставок', () => {
  const body = 'Норма [закон](https://consultant.ru/doc/1) и [обзор](https://garant.ru/x).';
  assert.deepEqual(extractUrls(body), ['https://consultant.ru/doc/1', 'https://garant.ru/x']);
  assert.equal(urlFromMatch('](https://consultant.ru/doc/1)'), 'https://consultant.ru/doc/1');
  assert.equal(urlFromMatch('нет ссылки'), null);
});

test('AP-P1-02: сетевой этап фиксирует 404 и редирект вне allowlist', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(options.method);
    if (url.includes('/missing')) return { status: 404, url };
    if (url.includes('/redirect')) return { status: 200, url: 'https://evil.example/x' };
    return { status: 200, url };
  };
  const entries = await verifySources(
    ['https://consultant.ru/missing', 'https://consultant.ru/redirect', 'https://consultant.ru/redirect'],
    { fetcher, now: new Date('2026-09-13T00:00:00Z') },
  );
  assert.equal(Object.keys(entries).length, 2, 'дубликаты проверяются один раз');
  assert.equal(entries['https://consultant.ru/missing'].status, 404);
  assert.equal(entries['https://consultant.ru/redirect'].finalUrl, 'https://evil.example/x');
  assert.deepEqual(calls, ['HEAD', 'HEAD'], 'при 200 повторного GET нет');
});

test('AP-P1-02: HEAD 405 откатывается на GET, ошибка сети сохраняется', async () => {
  const methods = [];
  const fetcher = async (url, options) => {
    methods.push(options.method);
    if (options.method === 'HEAD') return { status: 405, url };
    return { status: 200, url };
  };
  const entries = await verifySources(['https://consultant.ru/only-get'], { fetcher });
  assert.deepEqual(methods, ['HEAD', 'GET']);
  assert.equal(entries['https://consultant.ru/only-get'].status, 200);

  const failing = await verifySources(['https://consultant.ru/down'], {
    fetcher: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(failing['https://consultant.ru/down'].status, null);
  assert.match(failing['https://consultant.ru/down'].error, /network down/);
});

test('AP-P1-02: CLI audit блокирует статью со ссылкой на главную', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sources-cli-'));
  const blog = path.join(root, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  writeFileSync(
    path.join(blog, 'a.md'),
    '---\ntitle: "A"\ndescription: "d"\npubDate: "2026-01-01"\n---\n\n' +
      'Норма [раз](https://consultant.ru/document/1) и [два](https://consultant.ru/).\n',
    'utf8',
  );
  const configFile = path.join(root, 'config.json');
  writeFileSync(
    configFile,
    JSON.stringify({
      contentRoot: root,
      paths: { blog: 'src/content/blog', pillars: 'src/content/pillars', glossary: 'src/content/glossary', wiki: 'src/content/wiki' },
      throughput: { monthlyTarget: 200, batchesPerDay: 2, maxBatchSize: 6, maxParallelWriting: 8, catchUpFactor: 1.35 },
      mix: { new: 0.75, rewrite: 0.25 },
      dedupe: { canonicalExact: true, containmentBlock: 0.72, containmentWarn: 0.5, titleJaccardBlock: 0.62, titleJaccardWarn: 0.45, bodyShingleBlock: 0.3, shingleSize: 5, keywordOverlapBlock: 0.7 },
      rewrite: { staleAfterDays: 180, hardStaleAfterDays: 365, minDaysBetweenRewrites: 90, npaTriggerBoost: 40, thinContentChars: 4500 },
      interlink: { minOutbound: 3, maxOutbound: 8, minInbound: 2, maxInboundPerRun: 4, maxLinksPerParagraph: 1, anchorMinLength: 8, reciprocalPenalty: true, protectedZones: ['frontmatter'], minAnchorIdf: 3.2, rareAnchorIdf: 3.0, minRelevance: 0.35 },
      gates: { minScore: 70, maxAiMarkerDensity: 0.6, requireFactcheck: true, minChars: 4000, maxChars: 22000, quarantineAfterFailures: 2 },
      publish: { autoPublish: true, draftOnFail: true, maxPerDay: 12 },
      backlog: { targetBufferFactor: 1.3, maxPerEntityShare: 0.06, maxPerEntityPerBatch: 2 },
    }),
    'utf8',
  );
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const proc = spawnSync(process.execPath, ['scripts/source-check.mjs', 'audit', '--slug', 'a', '--json'], {
    cwd: ROOT,
    env: { ...process.env, AUTOPILOT_CONFIG: configFile },
    encoding: 'utf8',
  });
  assert.equal(proc.status, 2, proc.stderr);
  const out = JSON.parse(proc.stdout);
  assert.equal(out.results.length, 2);
  assert.equal(out.bad, 1);
  assert.equal(out.results.find((r) => r.url === 'https://consultant.ru/').ok, false);
});
