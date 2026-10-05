import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDelivery, writerPrompt, codexDelivery, validateWriterChanges, writerFailureCode } from './writer.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, setStage } from './lib/run.mjs';

const before = { slug: 'article', kind: 'rewrite', action: 'write', attempt: 'now/0/0', sha256: 'old' };
const after = { ...before, file: '/blog/article.mdx', sha256: 'new' };
const result = { slug: 'article', attempt: before.attempt, status: 'delivered', sha256: 'new' };
test('writer refuses unchanged rewrite, stale attempt and mismatched bytes', () => {
  assert.equal(validateDelivery(before, after, result), after);
  assert.throws(() => validateDelivery(before, { ...after, sha256: 'old' }, { ...result, sha256: 'old' }), /не изменил/);
  assert.throws(() => validateDelivery(before, after, { ...result, attempt: 'other' }), /наряд/);
  assert.throws(() => validateDelivery(before, after, { ...result, sha256: 'fake' }), /байтами/);
  assert.throws(() => validateDelivery(before, after, { ...result, status: 'failed', reason: 'network unavailable' }), /network unavailable/);
  assert.throws(() => validateDelivery(before, { ...after, action: 'closed' }, result), /байтами/);
});
test('prompt chooses rewrite procedure and leaves state ownership with parent', () => {
  const prompt = writerPrompt({ slug: 'article', kind: 'rewrite' }, before, { resolved: { dataDir: '/data' } });
  assert.match(prompt, /auto-rewrite/); assert.match(prompt, /now\/0\/0/); assert.match(prompt, /Не запускай plan/);
  assert.match(prompt, /\/data\/claim-evidence\/article\.json/);
  assert.match(prompt, /Вывод самопроверок печатай в терминал/);
});
test('missing executable is infrastructure failure, never delivery', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'missing-writer-'));
  try { await assert.rejects(codexDelivery('test', { binary: '/nonexistent/autopilot-writer', cwd: process.cwd(), actorFile: path.join(root, '.actor') }), /ошибкой/); } finally { rmSync(root, { recursive: true, force: true }); }
});
test('writer permits current artifacts and rejects another article or state change', () => {
  validateWriterChanges([{ kind: 'blog', relative: 'article.mdx' }, { kind: 'hero', relative: 'article-v2.webp' }, { kind: 'data', relative: 'claim-evidence/article.json' }], 'article');
  for (const change of [{ kind: 'blog', relative: 'other.md' }, { kind: 'data', relative: 'autopilot.json' }, { kind: 'hero', relative: 'article-other/image.webp' }, { kind: 'research', relative: 'article-checks.json' }]) assert.throws(() => validateWriterChanges([change], 'article'), /Посторонняя/);
});
test('real writer/receipt path skips delivered order on repeat without model call', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'writer-path-'));
  const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const blog = path.join(root, 'src/content/blog'); const data = path.join(root, 'data');
    mkdirSync(blog, { recursive: true }); mkdirSync(data);
    const config = JSON.parse(readFileSync(path.join(engine, 'config/autopilot.config.json'), 'utf8')); config.security.strictContentRoot = false;
    const configFile = path.join(root, 'config.json'); writeFileSync(configFile, JSON.stringify(config));
    const run = createRun({ dir: data }); // production planner fills orders.json after creating an empty manifest setStage(run.runId, 'planned', {}, { dir: data });
    writeFileSync(path.join(data, 'orders.json'), JSON.stringify({ runId: run.runId, orders: [{ slug: 'article', kind: 'new' }] }));
    writeFileSync(path.join(data, 'autopilot.json'), JSON.stringify({ inFlight: [{ slug: 'article', kind: 'new', claimedAt: 'now', failures: 0, infraFailures: 0 }] }));
    const script = `import { writeOrders } from './scripts/writer.mjs'; import { writeFileSync, readFileSync, existsSync } from 'node:fs'; import { createHash } from 'node:crypto';
      let calls=0; const deliver=(prompt,options)=>{ calls++; options?.onObservation({reportedTokens:71644,tokenSource:'codex-cli-footer'}); const text='delivered bytes'; writeFileSync(${JSON.stringify(path.join(blog, 'article.md'))},text); return { slug:'article',attempt:'now/0/0',status:'delivered',sha256:createHash('sha256').update(text).digest('hex') }; };
      const first=await writeOrders({deliver}); const second=await writeOrders({deliver});
      writeFileSync(${JSON.stringify(path.join(data, 'writing-receipts.json'))},JSON.stringify({items:{}}));
      const failed=await writeOrders({deliver:()=>{writeFileSync(${JSON.stringify(path.join(blog, 'article.md'))},'partial');throw new Error('runtime failed');}});
      const restored=readFileSync(${JSON.stringify(path.join(blog, 'article.md'))},'utf8');
      const unrelated=await writeOrders({deliver:()=>{ const r=deliver();writeFileSync(${JSON.stringify(path.join(blog, 'other.md'))},'unexpected');return r;}});
      const otherExists=existsSync(${JSON.stringify(path.join(blog, 'other.md'))});
      const originalConfig=readFileSync(${JSON.stringify(configFile)},'utf8');
      const codeAttempt=await writeOrders({deliver:()=>{ const r=deliver();writeFileSync(${JSON.stringify(configFile)},'unauthorized code change');return r;}});
      const codeRestored=readFileSync(${JSON.stringify(configFile)},'utf8')===originalConfig;
      const {checkpoint}=await import('./scripts/writing-checkpoint.mjs');
      const {setStage}=await import('./scripts/lib/run.mjs');
      checkpoint('article');
      writeFileSync(${JSON.stringify(path.join(data, 'orders.json'))},JSON.stringify({runId:${JSON.stringify(run.runId)},orders:[{slug:'article',kind:'new'},{slug:'other',kind:'new'}]}));
      writeFileSync(${JSON.stringify(path.join(data, 'autopilot.json'))},JSON.stringify({inFlight:[{slug:'article',kind:'new',claimedAt:'now',failures:0,infraFailures:0},{slug:'other',kind:'new',claimedAt:'now',failures:0,infraFailures:0}]}));
      setStage(${JSON.stringify(run.runId)},'gated',{}, {dir:${JSON.stringify(data)}});
      let repeatedCalls=0;
      const selectedRepeat=await writeOrders({slug:'article',deliver:()=>{repeatedCalls++;throw new Error('unexpected');}});
      let openRefused=false;try{await writeOrders({slug:'other',deliver});}catch{openRefused=true;}
      console.log(JSON.stringify({first,second,calls,failed,restored,unrelated,otherExists,codeAttempt,codeRestored,selectedRepeat,repeatedCalls,openRefused}));`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: engine, encoding: 'utf8', env: { ...process.env, AUTOPILOT_CONFIG: configFile, CONTENT_ROOT: root, AUTOPILOT_DATA_DIR: data, AUTOPILOT_LOCK_FILE: path.join(data, '.autopilot.lock') } });
    assert.equal(child.status, 0, child.stderr); const output = JSON.parse(child.stdout);
    assert.equal(output.calls, 3); assert.equal(output.first.results[0].status, 'delivered'); assert.equal(output.second.results[0].reason, 'settle');
    assert.equal(output.failed.ok, false); assert.equal(output.restored, 'delivered bytes'); assert.equal(output.unrelated.ok, false); assert.equal(output.otherExists, false);
    assert.equal(output.codeAttempt.ok, false); assert.equal(output.codeRestored, true);
    assert.equal(output.selectedRepeat.results[0].status, 'skipped'); assert.equal(output.repeatedCalls, 0); assert.equal(output.openRefused, true);
    const manifest = JSON.parse(readFileSync(path.join(data, 'runs', run.runId + '.json'), 'utf8'));
    assert.equal(manifest.meta.modelInvocations.length, 4);
    assert.deepEqual(manifest.meta.modelInvocations.map(item=>item.status), ['delivered','failed','failed','failed']);
    assert.equal(manifest.meta.modelInvocations[0].reportedTokens, 71644);
    assert.equal(manifest.meta.modelInvocations[1].reportedTokens, null);
    assert.equal(manifest.meta.modelInvocations[1].failureCode, 'writer_failure');
    assert.equal(manifest.meta.modelInvocations[0].failureCode, null);
    assert.ok(!JSON.stringify(manifest).includes('runtime failed'));
    assert.ok(manifest.meta.modelInvocations.every(item=>item.durationMs >= 0 && item.finishedAt));
    assert.equal(new Set(manifest.meta.modelInvocations.map(item=>item.id)).size,4);
    assert.equal(manifest.stages.written.delivered, 1); assert.ok(manifest.stages.gated);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('failure categories preserve actionable diagnosis without raw model diagnostics', () => {
  assert.equal(writerFailureCode(new Error('ERROR: Selected model is at capacity. Please try a different model.')), 'model_capacity');
  assert.equal(writerFailureCode(new Error('stream disconnected: sensitive payload')), 'model_transport');
  assert.equal(writerFailureCode(new Error('Rate limit reached')), 'model_rate_limit');
  assert.equal(writerFailureCode(new Error('private arbitrary message')), 'writer_failure');
});
