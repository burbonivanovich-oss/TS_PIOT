import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildScopedPlan,
  executeScopedPlan,
  backupHash,
  canonicalPlanHash,
  isAutoGoal,
  isExplicitDeleteSuccess,
  COUNTER_ID,
  CANDIDATE_REMOTE_IDS,
  PROTECTED_REMOTE_IDS,
} from '../metrika/remove-obsolete-interactive.mjs';
import { isObsoleteInteractiveGoal, OBSOLETE_DECLARATION_IDS } from '../../src/utils/obsolete-interactive-goals.mjs';
import { commercialPayload, emitCommercial } from '../../src/utils/commercial-events.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (p) => readFileSync(join(ROOT, p), 'utf8');

const REMOVED_IDS = [
  'flagship-ts-piot-completed',
  'quiz-ts-piot-completed',
  'calc-usn-nds-used',
  'calc-shtraf-markirovka-used',
  'roi-ip-ooo-used',
  'selector-task',
  'selector-result',
];
const PRESERVED_IDS = [
  'lead-kontur-market', 'lead-ts-piot-provider', 'cpa-click',
  'engagement-depth-3', 'engagement-time-2min', 'product-view',
  'product-cta-click', 'selector-product-click', 'form-start',
  'form-submit-attempt', 'cpa-visible',
];

// ─── Synthetic fixture: 79 manual + 4 auto = 83 rows ─────────────────────
// Synthetic only — cannot replace fresh live backup/identity verification.
function candidateEvents68() {
  const events = [...REMOVED_IDS];
  const extra = [
    'flagship-ts-piot-step-0-reached', 'flagship-ts-piot-step-1-reached',
    'flagship-ts-piot-step-2-reached', 'flagship-ts-piot-step-3-reached',
    'flagship-ts-piot-step-4-reached', 'flagship-ts-piot-step-5-reached',
    'flagship-ts-piot-step-6-reached', 'flagship-ts-piot-step-7-reached',
    'flagship-ts-piot-branch-valid-explored', 'flagship-ts-piot-request-online-explored',
    'flagship-ts-piot-status-valid-explored', 'flagship-ts-piot-module-tspot-explored',
    'flagship-ts-piot-dm-gtin-explored', 'flagship-ts-piot-ffd-before-viewed',
    'flagship-ts-piot-offline-toggle', 'flagship-teaser-clicked',
    'quiz-ts-piot-started', 'quiz-ts-piot-answered', 'quiz-ts-piot-restart',
    'calc-usn-nds-started', 'calc-shtraf-markirovka-started', 'calc-extra-tool-used',
    'roi-ip-ooo-started', 'roi-ip-ooo-compared',
    'scenario-kofeynya-started', 'scenario-kofeynya-25pct', 'scenario-kofeynya-50pct',
    'scenario-kofeynya-75pct', 'scenario-kofeynya-completed', 'scenario-kofeynya-task-checked',
    'scenario-kofeynya-reset', 'scenario-ip-ooo-started', 'scenario-ip-ooo-50pct',
    'scenario-ip-ooo-completed', 'scenario-ip-ooo-task-checked', 'scenario-ip-ooo-reset',
    'edo-puzzle-started', 'edo-puzzle-step-moved', 'edo-puzzle-solved',
    'edo-puzzle-check-failed', 'edo-puzzle-reset', 'zakon-2026-filter-used',
    'flagship-ts-piot-step-8-reached', 'flagship-ts-piot-error-branch-clicked',
    'quiz-ts-piot-hint-used', 'calc-roi-extra-used', 'roi-ip-ooo-reset',
    'scenario-extra-started', 'scenario-extra-completed', 'edo-puzzle-hint-used',
    'flagship-ts-piot-request-offline-explored', 'flagship-ts-piot-ffd-toggle',
    'quiz-ts-piot-abandoned', 'calc-nds-2026-used', 'roi-ip-ooo-shared',
    'scenario-draft-started', 'edo-puzzle-abandoned', 'flagship-ts-piot-share-clicked',
    'quiz-ts-piot-shared', 'calc-fines-extra-used', 'roi-ip-ooo-exported',
  ];
  for (const e of extra) {
    if (events.length >= 68) break;
    if (!events.includes(e)) events.push(e);
  }
  assert.equal(events.length, 68);
  assert.equal(new Set(events).size, 68);
  return events;
}

function makeBackup() {
  const events = candidateEvents68();
  const goals = CANDIDATE_REMOTE_IDS.map((id, i) => ({
    id, name: `Candidate ${i} ${events[i]}`, type: 'action', conditions: [{ type: 'exact', url: events[i] }],
  }));
  const preservedAction = [
    ['lead-kontur-market', 'Заявка Kontur'], ['lead-ts-piot-provider', 'Заявка TSPIOT'],
    ['cpa-click', 'CPA click'], ['cpa-visible', 'CPA visible'],
    ['product-view', 'Product view'], ['product-cta-click', 'Product CTA'],
    ['selector-product-click', 'Selector product'], ['form-start', 'Form start'],
    ['form-submit-attempt', 'Form attempt'],
  ];
  preservedAction.forEach(([event, name], i) => {
    goals.push({ id: PROTECTED_REMOTE_IDS[i], name, type: 'action', conditions: [{ type: 'exact', url: event }] });
  });
  goals.push({ id: PROTECTED_REMOTE_IDS[9], name: 'Quality depth', type: 'number', depth: 3 });
  goals.push({ id: PROTECTED_REMOTE_IDS[10], name: 'Quality time', type: 'visit_duration', duration: 119 });
  for (let i = 11; i < 15; i++) {
    goals.push({ id: PROTECTED_REMOTE_IDS[i], name: `Auto ${i}`, type: 'automatic', conditions: [] });
  }
  assert.equal(goals.length, 83);
  return { counterId: COUNTER_ID, goals };
}

test('declarations: exactly 7 removed, 11 preserved byte-for-byte IDs', () => {
  const config = JSON.parse(readSrc('src/data/metrika/goals.json'));
  assert.equal(config.counterId, 109130279);
  const ids = config.goals.map((g) => g.id);
  assert.equal(ids.length, 11);
  for (const r of REMOVED_IDS) assert.ok(!ids.includes(r), `${r} must be gone`);
  assert.deepEqual(ids, PRESERVED_IDS);
  assert.deepEqual([...OBSOLETE_DECLARATION_IDS].sort(), [...REMOVED_IDS].sort());
});

test('suppression policy covers obsolete groups, preserves commerce/unknown', () => {
  for (const e of REMOVED_IDS) assert.equal(isObsoleteInteractiveGoal(e), true);
  for (const e of ['flagship-ts-piot-step-3-reached', 'quiz-ts-piot-started', 'calc-usn-nds-used',
    'roi-ip-ooo-used', 'scenario-kofeynya-completed', 'edo-puzzle-solved', 'zakon-2026-filter-used',
    'selector-task', 'selector-result', 'flagship-teaser-clicked']) {
    assert.equal(isObsoleteInteractiveGoal(e), true, e);
  }
  for (const e of ['lead-ts-piot-provider', 'lead-kontur-market', 'cpa-click', 'cpa-visible',
    'product-view', 'product-cta-click', 'selector-product-click', 'form-start',
    'form-submit-attempt', 'engagement-depth-3', 'some-future-2027-event', '', 'unknown-event']) {
    assert.equal(isObsoleteInteractiveGoal(e), false, e);
  }
});

test('emitter cleanup: obsolete sends removed, business logic and commerce intact', () => {
  const quiz = readSrc('src/components/interactive/TsPiotReadinessQuiz.tsx');
  assert.ok(!quiz.includes("from '../../utils/track'"));
  assert.ok(!quiz.includes('trackOnce(') && !quiz.includes('track('));
  assert.ok(quiz.includes('RECOMMENDATIONS') && quiz.includes('visibleQuestions'));
  const usn = readSrc('src/components/interactive/UsnNdsCalc.tsx');
  assert.ok(!usn.includes("from '../../utils/track'") && !usn.includes('trackOnce('));
  assert.ok(usn.includes('ndsRate') && usn.includes('Итого налогов'));
  const roi = readSrc('src/components/interactive/RoiIpVsOoo.tsx');
  assert.ok(!roi.includes("from '../../utils/track'") && !roi.includes('trackOnce('));
  assert.ok(roi.includes('calcIp') && roi.includes('На руки в год'));
  const slider = readSrc('src/components/interactive/MarkingFineSlider.tsx');
  assert.ok(!slider.includes("from '../../utils/track'") && !slider.includes('trackOnce('));
  assert.ok(slider.includes('FINES') && slider.includes('Конфискация'));
  const flagship = readSrc('src/pages/kak-rabotaet-ts-piot.astro');
  assert.ok(!flagship.includes('flagship-ts-piot-completed') && !flagship.includes('trackOnce'));
  assert.ok(flagship.includes('sim-progress-bar'));
  const podbor = readSrc('src/pages/podbor/index.astro');
  assert.ok(!podbor.includes("trackCommercial('selector-task'") && !podbor.includes("trackCommercial('selector-result'"));
  assert.ok(podbor.includes("trackCommercial('selector-product-click'"));
  const track = readSrc('src/utils/track.ts');
  assert.ok(track.includes('isObsoleteInteractiveGoal'));
  const commercial = readSrc('src/utils/commercial-events.mjs');
  assert.ok(!commercial.includes("'selector-task'") || commercial.includes('удалены из allowlist'));
  // Commerce still sends through the allowlist.
  assert.ok(commercialPayload('product-view', { offer: 'kontur-market' }));
  assert.ok(commercialPayload('selector-product-click', { offer: 'kontur-market' }));
  assert.ok(commercialPayload('form-submit-attempt', { offer: 'kontur-market' }));
  assert.equal(commercialPayload('selector-task', { task: 'kassa' }), null);
  assert.equal(commercialPayload('selector-result', { task: 'etrn' }), null);
  const sent = [];
  assert.equal(emitCommercial('form-submit-attempt', { offer: 'kontur-market' }, (e, p) => sent.push(e)), true);
});

test('scoped plan: 68 approved candidates vs 15 preserved, zero writes by default', () => {
  const backup = makeBackup();
  const plan = buildScopedPlan({ backup });
  assert.equal(plan.counterId, COUNTER_ID);
  assert.equal(plan.targetIds.length, 68);
  assert.deepEqual([...plan.targetIds].sort((a, b) => a - b), [...CANDIDATE_REMOTE_IDS].sort((a, b) => a - b));
  assert.equal(plan.preserveIds.length, 15);
  assert.deepEqual(new Set(plan.preserveIds), new Set(PROTECTED_REMOTE_IDS));
  assert.deepEqual(plan.unavailableIds, []);
  assert.deepEqual(plan.invalid, []);
  assert.deepEqual(plan.receipts, []);
  assert.equal(plan.backupHash, backupHash(backup));
});

test('mock execute deletes only intended IDs with per-record re-read', async () => {
  const backup = makeBackup();
  const plan = buildScopedPlan({ backup });
  const byId = new Map(backup.goals.map((g) => [g.id, g]));
  const deleted = [];
  const result = await executeScopedPlan({
    plan,
    expectedPlanHash: plan.planHash,
    readRemote: async (id) => byId.get(id) || null,
    deleteRemote: async (id) => { deleted.push(id); return { ok: true }; },
  });
  assert.equal(result.failed, null);
  assert.deepEqual(new Set(deleted), new Set(CANDIDATE_REMOTE_IDS));
  assert.deepEqual(new Set(result.completed), new Set(CANDIDATE_REMOTE_IDS));
  assert.deepEqual(result.receipts.map((r) => r.remoteId).sort((a, b) => a - b),
    [...CANDIDATE_REMOTE_IDS].sort((a, b) => a - b));
});

test('negative: wrong counter rejected', () => {
  const backup = makeBackup();
  assert.throws(() => buildScopedPlan({ backup: { ...backup, counterId: 1 } }), /wrong-counter/);
  assert.throws(() => buildScopedPlan({ backup, counterId: 1 }), /wrong-counter/);
});

test('negative: missing/changed action condition rejected', () => {
  const backup = makeBackup();
  backup.goals.find((g) => g.id === CANDIDATE_REMOTE_IDS[0]).conditions = [];
  const plan = buildScopedPlan({ backup });
  assert.ok(!plan.targetIds.includes(CANDIDATE_REMOTE_IDS[0]));
  assert.ok(plan.invalid.some((x) => x.remoteId === CANDIDATE_REMOTE_IDS[0]));

  const backup2 = makeBackup();
  backup2.goals.find((g) => g.id === CANDIDATE_REMOTE_IDS[1]).conditions = [{ type: 'contain', url: 'quiz-ts-piot-completed' }];
  const plan2 = buildScopedPlan({ backup: backup2 });
  assert.ok(!plan2.targetIds.includes(CANDIDATE_REMOTE_IDS[1]));
});

test('negative: display-name collision and mixed multistep rejected', () => {
  const backup = makeBackup();
  const dupEvent = backup.goals.find((g) => g.id === CANDIDATE_REMOTE_IDS[0]).conditions[0].url;
  backup.goals.find((g) => g.id === CANDIDATE_REMOTE_IDS[1]).conditions = [{ type: 'exact', url: dupEvent }];
  const plan = buildScopedPlan({ backup });
  assert.ok(!plan.targetIds.includes(CANDIDATE_REMOTE_IDS[0]));
  assert.ok(!plan.targetIds.includes(CANDIDATE_REMOTE_IDS[1]));

  const backup2 = makeBackup();
  backup2.goals.find((g) => g.id === CANDIDATE_REMOTE_IDS[2]).conditions = [
    { type: 'exact', url: 'calc-usn-nds-used' }, { type: 'exact', url: 'product-view' },
  ];
  const plan2 = buildScopedPlan({ backup: backup2 });
  assert.ok(!plan2.targetIds.includes(CANDIDATE_REMOTE_IDS[2]));
});

test('negative: duplicated ID, stale backup, keep injected, empty approval', () => {
  const backup = makeBackup();
  const dup = makeBackup();
  dup.goals.push({ ...dup.goals[0] });
  assert.throws(() => buildScopedPlan({ backup: dup }), /duplicated-ID/);
  assert.throws(() => buildScopedPlan({ backup, approvedCandidates: [1, 1] }), /duplicated-ID/);
  assert.throws(() => buildScopedPlan({ backup, expectedBackupHash: 'deadbeef' }), /stale-backup/);
  assert.throws(
    () => buildScopedPlan({ backup, approvedCandidates: [CANDIDATE_REMOTE_IDS[0], PROTECTED_REMOTE_IDS[0]] }),
    /keep-injected/,
  );
  assert.throws(() => buildScopedPlan({ backup, approvedCandidates: [] }), /empty-approval/);
});

test('negative: unknown orphan survives, future event and commercial never deletable', () => {
  const backup = makeBackup();
  backup.goals.push({ id: 999999999, name: 'Unknown orphan', type: 'action', conditions: [{ type: 'exact', url: 'some-unknown-orphan' }] });
  backup.goals.push({ id: 999999998, name: 'Future', type: 'action', conditions: [{ type: 'exact', url: 'some-future-2027-event' }] });
  const plan = buildScopedPlan({ backup, approvedCandidates: [...CANDIDATE_REMOTE_IDS, 999999999, 999999998] });
  assert.ok(!plan.targetIds.includes(999999999));
  assert.ok(!plan.targetIds.includes(999999998));
  assert.ok(plan.preserveIds.includes(999999999));

  const backup2 = makeBackup();
  backup2.goals.find((g) => g.id === CANDIDATE_REMOTE_IDS[3]).conditions = [{ type: 'exact', url: 'lead-ts-piot-provider' }];
  const plan2 = buildScopedPlan({ backup: backup2 });
  assert.ok(!plan2.targetIds.includes(CANDIDATE_REMOTE_IDS[3]), 'no blanket prefix match against commercial lead');
});

test('negative: mismatched plan hash, missing remoteID, partial DELETE stops batch', async () => {
  const backup = makeBackup();
  const plan = buildScopedPlan({ backup });
  const byId = new Map(backup.goals.map((g) => [g.id, g]));
  await assert.rejects(
    () => executeScopedPlan({
      plan, expectedPlanHash: 'wrong', readRemote: async (id) => byId.get(id), deleteRemote: async () => ({}),
    }),
    /mismatched-plan-hash/,
  );
  await assert.rejects(
    () => executeScopedPlan({ plan: { ...plan, targetIds: [] }, expectedPlanHash: plan.planHash, readRemote: async () => null, deleteRemote: async () => ({}) }),
    /empty-approval/,
  );
  const missing = await executeScopedPlan({
    plan, expectedPlanHash: plan.planHash,
    readRemote: async () => null, deleteRemote: async () => ({}),
  });
  assert.ok(missing.failed && /missing-remoteID/.test(missing.failed.reason));
  assert.equal(missing.completed.length, 0);

  // Changed event on re-read stops before mutation of that record.
  const changed = await executeScopedPlan({
    plan, expectedPlanHash: plan.planHash,
    readRemote: async (id) => (id === plan.targetIds[0]
      ? { id, name: 'X', type: 'action', conditions: [{ type: 'exact', url: 'changed-event' }] }
      : byId.get(id)),
    deleteRemote: async () => ({}),
  });
  assert.ok(changed.failed && /changed-counter-ID-type-event-condition/.test(changed.failed.reason));
  assert.equal(changed.completed.length, 0);

  // Partial DELETE failure: first two succeed, third fails, rest untouched.
  const order = plan.targetIds;
  let calls = 0;
  const deleted = [];
  const partial = await executeScopedPlan({
    plan, expectedPlanHash: plan.planHash,
    readRemote: async (id) => byId.get(id),
    deleteRemote: async (id) => {
      calls++;
      if (calls === 3) throw new Error('DELETE 500');
      deleted.push(id);
      return { ok: true };
    },
  });
  assert.equal(partial.completed.length, 2);
  assert.deepEqual(partial.completed, order.slice(0, 2));
  assert.ok(partial.failed && partial.failed.remoteId === order[2]);
  assert.deepEqual(deleted, order.slice(0, 2));
  assert.ok(partial.remaining.length === order.length - 2);
});

test('MK1: canonical plan hash recomputed; changed plan with old hash rejected before any callback', async () => {
  const backup = makeBackup();
  const plan = buildScopedPlan({ backup });
  assert.equal(canonicalPlanHash(plan), plan.planHash);
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.targetIds) && Object.isFrozen(plan.targets));

  // Tamper: swap one target event, keep the old hash -> must throw, zero writes.
  const tampered = {
    ...plan,
    targets: plan.targets.map((t, i) => (i === 0 ? { ...t, event: 'flagship-ts-piot-step-0-reached' } : t)),
    targetIds: [...plan.targetIds],
  };
  let reads = 0;
  let writes = 0;
  await assert.rejects(
    () => executeScopedPlan({
      plan: tampered, expectedPlanHash: plan.planHash,
      readRemote: async () => { reads++; return null; },
      deleteRemote: async () => { writes++; return { ok: true }; },
    }),
    /mismatched-plan-hash/,
  );
  assert.equal(reads, 0);
  assert.equal(writes, 0);

  // Unknown target ID hand-injected into an otherwise valid plan -> reject before writes.
  const unknownPlan = {
    ...plan,
    targetIds: [...plan.targetIds.slice(0, 67), 999999999],
    targets: [...plan.targets.slice(0, 67), { remoteId: 999999999, event: 'flagship-ts-piot-step-0-reached', name: 'X', type: 'action' }],
  };
  let r2 = 0;
  let w2 = 0;
  await assert.rejects(
    () => executeScopedPlan({
      plan: { ...unknownPlan, planHash: 'deadbeef', backupHash: plan.backupHash, counterId: plan.counterId, kind: plan.kind },
      expectedPlanHash: 'deadbeef',
      readRemote: async () => { r2++; return null; },
      deleteRemote: async () => { w2++; return { ok: true }; },
    }),
    /unknown-target-ID|mismatched-plan-hash|invalid-plan/,
  );
  assert.equal(r2, 0);
  assert.equal(w2, 0);
});

test('MK1b: caller protect override rejected; canonical keep-15 always enforced', async () => {
  const backup = makeBackup();
  // Caller tries to weaken protection by omitting canonical protected IDs.
  assert.throws(
    () => buildScopedPlan({ backup, protectedIds: [PROTECTED_REMOTE_IDS[0]] }),
    /caller-protect-override/,
  );
  // Caller tries to sneak a protected ID into the approval list.
  assert.throws(
    () => buildScopedPlan({ backup, approvedCandidates: [CANDIDATE_REMOTE_IDS[0], PROTECTED_REMOTE_IDS[1]] }),
    /keep-injected/,
  );
  // Hand-crafted plan that targets a canonically protected ID is rejected
  // even when the caller passes an empty/weakened protectedIds override.
  const plan = buildScopedPlan({ backup });
  const evil = {
    ...plan,
    targetIds: [PROTECTED_REMOTE_IDS[0]],
    targets: [{ remoteId: PROTECTED_REMOTE_IDS[0], event: 'lead-kontur-market', name: 'X', type: 'action' }],
  };
  const { planHashFor } = await import('../metrika/remove-obsolete-interactive.mjs');
  const bHash = backupHash(backup);
  const evilHash = planHashFor({ counterId: COUNTER_ID, bHash, targets: evil.targets });
  const evilPlan = { ...evil, planHash: evilHash };
  let reads = 0;
  await assert.rejects(
    () => executeScopedPlan({
      plan: evilPlan, expectedPlanHash: evilHash, protectedIds: [],
      readRemote: async () => { reads++; return null; },
      deleteRemote: async () => ({ ok: true }),
    }),
    /caller-protect-override|keep-injected/,
  );
  assert.equal(reads, 0);
});

test('MK2: goal_source:auto excluded in planning and rejected on re-read', async () => {
  assert.equal(isAutoGoal({ id: 1, type: 'action', goal_source: 'auto', conditions: [{ type: 'exact', url: 'flagship-ts-piot-completed' }] }), true);
  assert.equal(isAutoGoal({ id: 1, type: 'automatic', conditions: [] }), true);
  assert.equal(isAutoGoal({ id: 1, type: 'action', conditions: [{ type: 'exact', url: 'flagship-ts-piot-completed' }] }), false);

  const backup = makeBackup();
  // Auto-owned record wearing an obsolete event text must not become a target.
  backup.goals.find((g) => g.id === CANDIDATE_REMOTE_IDS[0]).goal_source = 'auto';
  const plan = buildScopedPlan({ backup });
  assert.ok(!plan.targetIds.includes(CANDIDATE_REMOTE_IDS[0]));
  assert.ok(plan.invalid.some((x) => x.remoteId === CANDIDATE_REMOTE_IDS[0] && /auto-goal/.test(x.reason)));

  // Re-read turning into auto mid-flight stops the batch, preserving progress.
  const fresh = makeBackup();
  const plan2 = buildScopedPlan({ backup: fresh });
  const byId = new Map(fresh.goals.map((g) => [g.id, g]));
  const order = plan2.targetIds;
  const res = await executeScopedPlan({
    plan: plan2, expectedPlanHash: plan2.planHash,
    readRemote: async (id) => (id === order[1]
      ? { ...byId.get(id), goal_source: 'auto' }
      : byId.get(id)),
    deleteRemote: async () => ({ ok: true }),
  });
  assert.equal(res.completed.length, 1);
  assert.deepEqual(res.completed, order.slice(0, 1));
  assert.ok(res.failed && res.failed.remoteId === order[1] && /auto-goal/.test(res.failed.reason));
  assert.deepEqual(res.remaining, order.slice(1));
});

test('MK3: explicit DELETE success required; false/malformed receipts fail safely', async () => {
  assert.equal(isExplicitDeleteSuccess({ ok: true }), true);
  assert.equal(isExplicitDeleteSuccess({ deleted: true }), true);
  assert.equal(isExplicitDeleteSuccess({ success: true }), true);
  for (const bad of [null, undefined, false, 0, '', {}, { ok: false }, { ok: 1 }, []]) {
    assert.equal(isExplicitDeleteSuccess(bad), false, JSON.stringify(bad));
  }

  const backup = makeBackup();
  for (const [idx, badReceipt] of [false, null, {}, { ok: false }].entries()) {
    void idx;
    const plan = buildScopedPlan({ backup });
    const byId = new Map(backup.goals.map((g) => [g.id, g]));
    let reads = 0;
    const res = await executeScopedPlan({
      plan, expectedPlanHash: plan.planHash,
      readRemote: async (id) => { reads++; return byId.get(id); },
      deleteRemote: async () => badReceipt,
    });
    // First record fails on malformed receipt: zero completed, full remaining preserved.
    assert.equal(res.completed.length, 0, JSON.stringify(badReceipt));
    assert.ok(res.failed && /malformed-or-false-receipt|delete-failed/.test(res.failed.reason), JSON.stringify(badReceipt));
    assert.equal(res.remaining.length, plan.targetIds.length);
    assert.equal(res.receipts.length, 0);
    assert.ok(reads >= 1);
  }

  // Receipts carry only safe fields (no tokens), and success receipts keep proof.
  const plan = buildScopedPlan({ backup });
  const byId = new Map(backup.goals.map((g) => [g.id, g]));
  const ok = await executeScopedPlan({
    plan, expectedPlanHash: plan.planHash,
    readRemote: async (id) => byId.get(id),
    deleteRemote: async (id) => ({ ok: true, remoteId: id, token: 'SECRET-MUST-NOT-PROPAGATE' }),
  });
  assert.equal(ok.failed, null);
  assert.equal(ok.receipts.length, 68);
  for (const r of ok.receipts) {
    assert.ok(!JSON.stringify(r).includes('SECRET-MUST-NOT-PROPAGATE'));
    assert.equal(r.receipt.ok, true);
  }
});

test('invalid plans throw before zero writes; partial read-fail preserves completed/remaining', async () => {
  const backup = makeBackup();
  const plan = buildScopedPlan({ backup });
  // Invalid plan shapes: zero callbacks.
  for (const bad of [
    { ...plan, targetIds: [...plan.targetIds, plan.targetIds[0]] },
    { ...plan, targets: plan.targets.slice(1) },
    { ...plan, backupHash: '' },
  ]) {
    let reads = 0;
    let writes = 0;
    await assert.rejects(
      () => executeScopedPlan({
        plan: bad, expectedPlanHash: bad.planHash ?? plan.planHash,
        readRemote: async () => { reads++; return null; },
        deleteRemote: async () => { writes++; return { ok: true }; },
      }),
      /invalid-plan|duplicated-ID|mismatched-plan-hash/,
    );
    assert.equal(reads, 0);
    assert.equal(writes, 0);
  }

  // Mid-batch read exception: first succeeds, second throws, rest untouched.
  const byId = new Map(backup.goals.map((g) => [g.id, g]));
  const order = plan.targetIds;
  let n = 0;
  const deleted = [];
  const partial = await executeScopedPlan({
    plan, expectedPlanHash: plan.planHash,
    readRemote: async (id) => {
      n++;
      if (n === 2) throw new Error('GET 503');
      return byId.get(id);
    },
    deleteRemote: async (id) => { deleted.push(id); return { ok: true }; },
  });
  assert.deepEqual(partial.completed, order.slice(0, 1));
  assert.ok(partial.failed && partial.failed.remoteId === order[1] && /read-failed/.test(partial.failed.reason));
  assert.deepEqual(partial.remaining, order.slice(1));
  assert.deepEqual(deleted, order.slice(0, 1));
  assert.equal(partial.receipts.length, 1);
});
