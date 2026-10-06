#!/usr/bin/env node
// Scoped remover/planner for obsolete interactive Metrica goals.
// DEFAULT IS READONLY PLAN — generates zero writes.
// Absolutely no PRUNE-all / orphan sweep.
//
// Flow (root-owned remote step happens only after production delivery):
//   1. Deploy code cleanup first (goals.json + emission suppression).
//   2. Take a fresh authoritative backend backup (Management API GET goals).
//   3. Run this script with --backup <fresh-backup.json> to print a scoped plan.
//   4. Root verifies exact identities, concrete confirmation where required,
//      then runs with --execute --plan-hash <exact> --confirm <exact>
//      with METRIKA_OAUTH_TOKEN in env. Each remote record is re-read before
//      DELETE; any mismatch stops the batch (no blind retry, no scope expansion).
//
// Executor tests mock network entirely; this file performs no live calls
// unless --execute is passed explicitly with exact plan identity.
// Credentials come only from env; tokens are never logged.
//
// Docs: https://yandex.ru/dev/metrika/doc/api2/management/goals/goals.html

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const COUNTER_ID = 109130279;

// Exact root-pinned UI inventory (2026-10-05): 68 candidates + 15 protected.
// Hidden 561318811 is NOT included and never inferred.
export const CANDIDATE_REMOTE_IDS = Object.freeze([
  560947611, 560947612, 560947613, 560947614, 560947615, 560947616,
  560947617, 560947618, 560947619, 560947620, 560947621, 560947622,
  560947623, 560947624, 560947625, 560947626, 560947627, 560947628,
  560947629, 560947630, 560947631, 560947632, 560947633, 560947634,
  560947635, 561318807, 561318808, 561318809, 561318810, 561318812,
  561318813, 561318814, 561318815, 561318816, 561318817, 561318818,
  561318819, 561318820, 561318821, 561318822, 561318823, 561318824,
  561318825, 561318826, 561318827, 561318828, 561318829, 561318830,
  561318831, 561318832, 561318833, 561318834, 561318835, 561318836,
  561318837, 561318838, 561318839, 561318840, 561318841, 561318842,
  561318843, 561318844, 561318845, 561318846, 561318847, 561318848,
  668583902, 668583919,
]);

export const PROTECTED_REMOTE_IDS = Object.freeze([
  558249884, 558249885, 571046082, 571046083, 571046084, 601154647,
  668400602, 668583868, 668583869, 668583920, 668583937, 668583938,
  668586372, 668586373, 669054298,
]);

// Immutable canonical scope: the exact 68 + 15 pinned by the root UI inventory.
// Caller-supplied approved/protected lists can only narrow or equal this scope;
// they can never widen it or weaken protection (enforced below).
const CANONICAL_CANDIDATE_SET = new Set(CANDIDATE_REMOTE_IDS);
const CANONICAL_PROTECTED_SET = new Set(PROTECTED_REMOTE_IDS);

const OBSOLETE_EXACT = new Set([
  'flagship-ts-piot-completed',
  'quiz-ts-piot-completed',
  'calc-usn-nds-used',
  'calc-shtraf-markirovka-used',
  'roi-ip-ooo-used',
  'selector-task',
  'selector-result',
  'zakon-2026-filter-used',
]);

const OBSOLETE_PREFIXES = [
  'flagship-',
  'quiz-ts-piot-',
  'calc-',
  'roi-ip-ooo-',
  'scenario-',
  'edo-puzzle-',
];

// Management API ownership: goals created automatically by the counter
// (goal_source:auto) are never deletable by this task, even if their
// condition text looks obsolete. They belong to the 4 auto rows / keep-15.
// Any record carrying an auto marker is excluded in backup planning and
// rejected again on pre-DELETE re-read.
export function isAutoGoal(remote) {
  if (!remote || typeof remote !== 'object') return false;
  const source = remote.goal_source ?? remote.source;
  if (source === 'auto') return true;
  if (remote.is_auto === true || remote.auto === true) return true;
  const t = remote.type;
  if (t === 'automatic' || t === 'auto') return true;
  return false;
}

// DELETE receipts must prove success explicitly. A falsy, missing, or
// malformed receipt (false, null, {}, {ok:false}) is a failed delete:
// the ID stays uncompleted and the batch stops. Never fabricate {ok:true}.
export function isExplicitDeleteSuccess(receipt) {
  if (!receipt || typeof receipt !== 'object') return false;
  if (Array.isArray(receipt)) return false;
  if (receipt.errors != null && (!Array.isArray(receipt.errors) || receipt.errors.length > 0)) return false;
  if (Object.hasOwn(receipt, 'status') && (typeof receipt.status !== 'number' || receipt.status < 200 || receipt.status >= 300)) return false;
  const flags = ['ok', 'deleted', 'success'].filter((key) => Object.hasOwn(receipt, key));
  // Explicit denial or malformed flags override any positive adapter field.
  return flags.length > 0 && flags.every((key) => receipt[key] === true);
}

function sanitizeReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return { ok: false };
  const safe = {};
  for (const k of ['ok', 'deleted', 'success', 'status', 'remoteId', 'id']) {
    if (receipt[k] !== undefined && (typeof receipt[k] === 'boolean' || typeof receipt[k] === 'number' || typeof receipt[k] === 'string')) {
      safe[k] = receipt[k];
    }
  }
  if (!isExplicitDeleteSuccess(receipt)) safe.ok = false;
  return safe;
}
// Never deletable: commerce / quality / auto / unknown.
// Explicit guard so no blanket prefix can touch commercial 'lead-ts-piot-provider'.
function isDeletableObsoleteEvent(event) {
  if (typeof event !== 'string' || event.length === 0) return false;
  if (
    event.startsWith('lead-') ||
    event.startsWith('cpa-') ||
    event.startsWith('product-') ||
    event.startsWith('form-') ||
    event === 'selector-product-click' ||
    event.startsWith('engagement-')
  ) return false;
  if (OBSOLETE_EXACT.has(event)) return true;
  for (const p of OBSOLETE_PREFIXES) {
    if (event.startsWith(p)) return true;
  }
  return false;
}

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function backupHash(backup) {
  const goals = [...(backup.goals || [])].sort((a, b) => Number(a.id) - Number(b.id));
  return sha256Hex(JSON.stringify({ counterId: backup.counterId, goals }));
}

export function planHashFor({ counterId, bHash, targets }) {
  const pairs = targets.map((t) => [t.remoteId, t.event]).sort((a, b) => a[0] - b[0]);
  return sha256Hex(JSON.stringify({ counterId, backupHash: bHash, targets: pairs }));
}

// Canonical recomputation: the only accepted plan hash is the one recomputed
// from the plan's own backupHash + full target identities. Any tampering with
// targets/targetIds/backupHash after build changes the recomputation and
// rejects the plan before any callback runs.
export function canonicalPlanHash(plan) {
  if (!plan || typeof plan.backupHash !== 'string' || !Array.isArray(plan.targets)) {
    throw new Error('invalid-plan: backupHash/targets required for canonical hash');
  }
  return planHashFor({ counterId: plan.counterId, bHash: plan.backupHash, targets: plan.targets });
}

function assertNoCallerProtectWeakening(protectedIds) {
  for (const pid of CANONICAL_PROTECTED_SET) {
    if (!protectedIds.includes(pid)) {
      throw new Error(`caller-protect-override: protected list omits canonical ${pid}`);
    }
  }
}

function extractExactActionEvent(remote) {
  if (!remote || remote.type !== 'action') {
    return { ok: false, reason: 'non-action-or-mixed-goal' };
  }
  const conditions = remote.conditions || [];
  if (conditions.length !== 1 || conditions[0].type !== 'exact' || typeof conditions[0].url !== 'string' || conditions[0].url.length === 0) {
    return { ok: false, reason: 'missing-or-changed-action-condition' };
  }
  return { ok: true, event: conditions[0].url };
}

// Build a readonly scoped plan. Throws on any unsafe ambiguity.
// Never touches the network, never deletes.
export function buildScopedPlan({
  backup,
  approvedCandidates = [...CANDIDATE_REMOTE_IDS],
  protectedIds = [...PROTECTED_REMOTE_IDS],
  counterId = COUNTER_ID,
  expectedBackupHash = null,
} = {}) {
  if (!backup || !Array.isArray(backup.goals)) throw new Error('invalid-backup: goals[] required');
  if (counterId !== COUNTER_ID) throw new Error('wrong-counter: expected 109130279');
  if (backup.counterId !== COUNTER_ID) throw new Error('wrong-counter: backup counter mismatch');
  if (!Array.isArray(approvedCandidates) || approvedCandidates.length === 0) {
    throw new Error('empty-approval: no candidate IDs approved');
  }
  const approvedSet = new Set(approvedCandidates);
  if (approvedSet.size !== approvedCandidates.length) throw new Error('duplicated-ID: approved list has duplicates');
  const protectedSet = new Set(protectedIds);
  assertNoCallerProtectWeakening(protectedIds);
  for (const id of approvedSet) {
    if (protectedSet.has(id)) throw new Error(`keep-injected: remoteId ${id} is protected`);
    if (CANONICAL_PROTECTED_SET.has(id)) throw new Error(`keep-injected: remoteId ${id} is canonically protected`);
  }

  const bHash = backupHash(backup);
  if (expectedBackupHash && expectedBackupHash !== bHash) {
    throw new Error('stale-backup: backup hash mismatch, re-take fresh backend readback');
  }

  const byId = new Map();
  for (const g of backup.goals) {
    if (g == null || g.id == null) throw new Error('invalid-backup: goal without remoteID');
    if (byId.has(g.id)) throw new Error(`duplicated-ID: backup has duplicate remoteId ${g.id}`);
    byId.set(g.id, g);
  }

  // Display-name / event collision: same exact event URL on 2+ remote IDs is ambiguous.
  // Auto-owned records (goal_source:auto) are excluded from the collision map:
  // they are never deletable and handled as auto-ownership below.
  const eventToIds = new Map();
  for (const g of backup.goals) {
    if (isAutoGoal(g)) continue;
    const ex = extractExactActionEvent(g);
    if (!ex.ok) continue;
    if (!eventToIds.has(ex.event)) eventToIds.set(ex.event, []);
    eventToIds.get(ex.event).push(g.id);
  }
  const collidedEvents = new Set(
    [...eventToIds.entries()].filter(([, ids]) => ids.length > 1).map(([event]) => event),
  );

  const targets = [];
  const unavailableIds = [];
  const invalid = [];
  for (const id of approvedCandidates) {
    const remote = byId.get(id);
    if (!remote) {
      unavailableIds.push(id);
      continue;
    }
    if (isAutoGoal(remote)) {
      invalid.push({ remoteId: id, reason: 'auto-goal-ownership: goal_source:auto, never deletable' });
      continue;
    }
    const ex = extractExactActionEvent(remote);
    if (!ex.ok) {
      invalid.push({ remoteId: id, reason: ex.reason });
      continue;
    }
    if (collidedEvents.has(ex.event)) {
      invalid.push({ remoteId: id, reason: `display-name-collision: event ${ex.event} on multiple IDs` });
      continue;
    }
    if (!isDeletableObsoleteEvent(ex.event)) {
      invalid.push({ remoteId: id, reason: `not-obsolete-or-protected-action: ${ex.event}` });
      continue;
    }
    targets.push({ remoteId: id, event: ex.event, name: remote.name || '', type: remote.type });
  }

  const targetSet = new Set(targets.map((t) => t.remoteId));
  const preserveIds = backup.goals.map((g) => g.id).filter((id) => !targetSet.has(id));
  // Protected IDs present in backup must all survive.
  for (const pid of protectedSet) {
    if (byId.has(pid) && targetSet.has(pid)) {
      throw new Error(`keep-injected: protected remoteId ${pid} entered delete list`);
    }
  }

  const pHash = planHashFor({ counterId, bHash, targets });
  const plan = {
    kind: 'metrika-scoped-remove-plan',
    counterId,
    backupHash: bHash,
    planHash: pHash,
    targetIds: targets.map((t) => t.remoteId),
    targets,
    preserveIds,
    unavailableIds,
    invalid,
    receipts: [],
  };
  Object.freeze(plan.targetIds);
  Object.freeze(plan.targets);
  Object.freeze(plan.preserveIds);
  Object.freeze(plan.unavailableIds);
  Object.freeze(plan.invalid);
  Object.freeze(plan.receipts);
  return Object.freeze(plan);
}

// Execute a previously built plan with per-record re-read verification.
// readRemote(id) -> remote record or null; deleteRemote(id) -> receipt.
// All invalid plans throw BEFORE any callback runs (zero writes).
// Stops on the first failure; never expands scope, never retries blindly.
export async function executeScopedPlan({
  plan,
  expectedPlanHash,
  protectedIds = [...PROTECTED_REMOTE_IDS],
  counterId = COUNTER_ID,
  readRemote,
  deleteRemote,
} = {}) {
  // ─── Zero-write preflight: full identity + canonical hash, no callbacks ───
  if (!plan || plan.kind !== 'metrika-scoped-remove-plan') throw new Error('invalid-plan');
  if (counterId !== COUNTER_ID || plan.counterId !== COUNTER_ID) throw new Error('wrong-counter');
  if (typeof plan.backupHash !== 'string' || plan.backupHash.length === 0) throw new Error('invalid-plan: backupHash required');
  if (typeof plan.planHash !== 'string' || plan.planHash.length === 0) throw new Error('invalid-plan: planHash required');
  if (!Array.isArray(plan.targetIds) || plan.targetIds.length === 0) {
    throw new Error('empty-approval: nothing to delete');
  }
  if (!Array.isArray(plan.targets) || plan.targets.length !== plan.targetIds.length) {
    throw new Error('invalid-plan: targets/targetIds length mismatch');
  }
  assertNoCallerProtectWeakening(protectedIds);
  const seen = new Set();
  for (const id of plan.targetIds) {
    if (seen.has(id)) throw new Error(`duplicated-ID: plan has duplicate ${id}`);
    seen.add(id);
  }
  const protectedSet = new Set(protectedIds);
  const byTargetPre = new Map();
  for (const t of plan.targets) {
    if (!t || t.remoteId == null || typeof t.event !== 'string' || t.event.length === 0 || t.type !== 'action') {
      throw new Error('invalid-plan: every target needs remoteId/event(action)/type');
    }
    if (byTargetPre.has(t.remoteId)) throw new Error(`duplicated-ID: targets has duplicate ${t.remoteId}`);
    byTargetPre.set(t.remoteId, t);
  }
  for (const id of plan.targetIds) {
    if (!byTargetPre.has(id)) throw new Error(`unknown-target-ID: ${id} has no full target identity`);
    if (!CANONICAL_CANDIDATE_SET.has(id)) throw new Error(`unknown-target-ID: ${id} outside canonical 68`);
    if (protectedSet.has(id) || CANONICAL_PROTECTED_SET.has(id)) throw new Error(`keep-injected: ${id} is protected`);
    const t = byTargetPre.get(id);
    if (!isDeletableObsoleteEvent(t.event)) throw new Error(`invalid-plan: target ${id} event not deletable (${t.event})`);
  }
  // Canonical recomputation must match both the embedded and the caller hash.
  // A plan mutated after build (changed event, swapped ID) yields a different
  // recomputation, so an old/stale hash is rejected here with zero writes.
  const recomputed = canonicalPlanHash(plan);
  if (recomputed !== plan.planHash) {
    throw new Error('mismatched-plan-hash: plan tampered (canonical recomputation differs)');
  }
  if (!expectedPlanHash || plan.planHash !== expectedPlanHash || recomputed !== expectedPlanHash) {
    throw new Error('mismatched-plan-hash: explicit exact plan identity required');
  }
  if (typeof readRemote !== 'function' || typeof deleteRemote !== 'function') {
    throw new Error('invalid-executor: readRemote/deleteRemote required');
  }

  const byTarget2 = byTargetPre;
  const completed = [];
  const receipts = [];
  for (const id of plan.targetIds) {
    const expected = byTarget2.get(id);
    if (!expected) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: 'unknown-target' } };
    }
    let fresh = null;
    try {
      fresh = await readRemote(id);
    } catch (err) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: `read-failed: ${String(err && err.message || err).slice(0, 200)}` } };
    }
    if (!fresh || fresh.id !== id) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: 'missing-remoteID' } };
    }
    if (isAutoGoal(fresh)) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: 'auto-goal-ownership: goal_source:auto, never deletable' } };
    }
    if (fresh.counterId !== undefined && fresh.counterId !== COUNTER_ID) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: 'changed-counter-ID-type-event-condition' } };
    }
    const ex = extractExactActionEvent(fresh);
    if (!ex.ok || ex.event !== expected.event || fresh.type !== expected.type) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: 'changed-counter-ID-type-event-condition' } };
    }
    if (!isDeletableObsoleteEvent(ex.event)) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: `not-obsolete: ${ex.event}` } };
    }
    let receipt = null;
    try {
      receipt = await deleteRemote(id);
    } catch (err) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: `delete-failed: ${String(err && err.message || err).slice(0, 200)}` } };
    }
    if (!isExplicitDeleteSuccess(receipt)
        || (receipt.remoteId !== undefined && receipt.remoteId !== id)
        || (receipt.id !== undefined && receipt.id !== id)) {
      return { completed, remaining: plan.targetIds.slice(completed.length), receipts, failed: { remoteId: id, reason: 'delete-failed: malformed-or-false-receipt, explicit DELETE success required' } };
    }
    completed.push(id);
    receipts.push({ remoteId: id, event: ex.event, receipt: sanitizeReceipt(receipt) });
  }
  return { completed, remaining: [], receipts, failed: null };
}

// ─── CLI (readonly by default) ────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith('remove-obsolete-interactive.mjs');
if (isMain) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const backupPath = get('--backup');
  const wantExecute = args.includes('--execute');
  if (!backupPath) {
    console.error('Usage: node scripts/metrika/remove-obsolete-interactive.mjs --backup <fresh-backup.json> [--execute --plan-hash <exact> --confirm <exact>]');
    console.error('Default prints a readonly scoped plan and performs zero writes. No PRUNE sweep.');
    process.exit(2);
  }
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  const plan = buildScopedPlan({ backup });
  console.log(JSON.stringify(plan, null, 2));
  if (!wantExecute) {
    console.log('\nReadonly plan above — zero writes performed.');
    process.exit(0);
  }
  const planHash = get('--plan-hash');
  const confirm = get('--confirm');
  const token = process.env.METRIKA_OAUTH_TOKEN || '';
  if (!planHash || planHash !== plan.planHash || confirm !== plan.planHash) {
    console.error('Write requires explicit exact plan identity: --plan-hash <planHash> --confirm <same planHash>. Refusing.');
    process.exit(1);
  }
  if (!token) {
    console.error('METRIKA_OAUTH_TOKEN is required for --execute. Refusing.');
    process.exit(1);
  }
  const API = 'https://api-metrika.yandex.net/management/v1';
  const Authed = async (path, { method = 'GET' } = {}) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `OAuth ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  void API;
  const result = await executeScopedPlan({
    plan,
    expectedPlanHash: planHash,
    readRemote: async (id) => {
      const r = await Authed(`/counter/${COUNTER_ID}/goal/${id}`);
      // A request ID is not a returned-record identity: malformed GET cannot
      // fabricate an ID for the per-record safety check.
      return r && r.goal && r.goal.id === id
        && (r.counterId === undefined || r.counterId === COUNTER_ID) ? r.goal : null;
    },
    deleteRemote: async (id) => {
      const response = await Authed(`/counter/${COUNTER_ID}/goal/${id}`, { method: 'DELETE' });
      // Management DELETE schema is { success: boolean }. HTTP 200 alone
      // does not prove deletion; pass explicit denial through the same helper.
      if (!response || Array.isArray(response) || response.success !== true
          || !isExplicitDeleteSuccess(response)
          || (response.remoteId !== undefined && response.remoteId !== id)
          || (response.id !== undefined && response.id !== id)) return { success: false, remoteId: id };
      return { success: true, remoteId: id };
    },
  });
  console.log(JSON.stringify({ planHash: plan.planHash, result }, null, 2));
  if (result.failed) process.exit(1);
}
