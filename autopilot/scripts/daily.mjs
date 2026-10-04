#!/usr/bin/env node
// One owner of plan -> model delivery -> settle/build -> optional Git/push.
// Deployment confirmation remains pending.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadConfig, assertContentRoot, ROOT } from './lib/config.mjs';
import { readJson, writeJson, loadArticles, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { readRun } from './lib/run.mjs';
import { recoverWriting, writeOrders } from './writer.mjs';
import { plan, settle } from './pipeline.mjs';
import { monitorSources } from './source-monitor.mjs';
import { recoverSettle } from './lib/settle-snapshot.mjs';
import { readDeliveryJournal, beginGitDelivery, commitGitDelivery } from './lib/git-delivery.mjs';
import { pushGitDelivery } from './lib/git-push.mjs';

export function readPendingOrders(dataDir) {
  const orders = readJson(path.join(dataDir, 'orders.json'), null);
  if (!orders) return null;
  if (!orders.runId) {
    const state = readJson(path.join(dataDir, 'autopilot.json'), null);
    // Legacy empty orders contain no work to resume. Unknown or occupied slots
    // must not be discarded while bootstrapping the manifest-based executor.
    if (Array.isArray(orders.orders) && orders.orders.length === 0 && Array.isArray(state?.inFlight) && state.inFlight.length === 0) return null;
    throw new Error('Старые наряды или слоты без runId; требуется сверка состояния');
  }
  const manifest = readRun(orders.runId, { dir: dataDir });
  if (!manifest) throw new Error('Наряды без действующего манифеста; новый plan запрещён');
  return { orders, manifest };
}

export async function coordinateCycle({ pending, refresh, plan: makePlan, write, settle: accept, deliver }) {
  const current = pending();
  if (current && current.manifest.stages.gated && !current.manifest.stages.committed) {
    if (deliver) return { status: 'committed', runId: current.orders.runId, delivery: await deliver(current.orders.runId), modelCalled: false };
    return { status: 'delivery_pending', runId: current.orders.runId, modelCalled: false };
  }
  let orders;
  if (current && !current.manifest.stages.gated) orders = current.orders;
  else { await refresh(); orders = makePlan(); }
  const writing = orders.orders.length ? await write() : { ok: true, results: [] };
  // Even an infrastructure failure must reach settle for retry accounting;
  // write has already stopped the actor and restored its partial changes.
  const acceptance = accept();
  if (deliver) return { status: 'committed', runId: orders.runId, writing, acceptance, delivery: await deliver(orders.runId) };
  return { status: 'delivery_pending', runId: orders.runId, writing, acceptance };
}

export async function dailyCycle({ commit = false, push = false, remote = 'origin', targetRef } = {}) {
  if (push && (!commit || !targetRef)) throw new Error('Push требует --commit и явный --target-ref');
  const cfg = loadConfig();
  assertContentRoot(cfg);
  acquireLock({ cmd: 'daily-cycle' });
  try {
    recoverWriting(cfg);
    recoverSettle({ blog: cfg.resolved.blog, dataDir: cfg.resolved.dataDir });
    const pending = () => readPendingOrders(cfg.resolved.dataDir);
    const root = cfg.resolved.contentRoot;
    const journal = existsSync(path.join(root, '.git')) ? readDeliveryJournal(root) : null;
    if (!push && journal?.push?.phase === 'pending') return { status: 'push_pending', runId: journal.runId, modelCalled: false };
    const publish = () => pushGitDelivery({ root, remote, targetRef });
    const deliver = runId => {
      const delivery = commitGitDelivery({ root, dataDir: cfg.resolved.dataDir, blog: cfg.resolved.blog, runId });
      return push ? { ...delivery, publication: publish() } : delivery;
    };
    // Recover a failed/lost push before archiving its journal or planning another run.
    if (push && journal?.phase === 'committed' && journal.push?.phase !== 'verified') {
      return { status: 'pushed', runId: journal.runId, publication: publish(), modelCalled: false };
    }
    if (push && journal?.push && (journal.push.remote !== remote || journal.push.targetRef !== targetRef)) throw new Error('Push destination changed');
    if (journal?.contentCommit && journal.phase !== 'committed') {
      if (!commit) return { status: 'git_delivery_pending', runId: journal.runId, modelCalled: false };
      return { status: 'committed', runId: journal.runId, delivery: deliver(journal.runId), modelCalled: false };
    }
    if (commit) {
      const current = pending();
      if (!journal && current && !current.manifest.stages.committed) throw new Error('Чистая исходная точка не записана до plan; автоматический коммит запрещён');
      if (!journal || journal.phase === 'committed') beginGitDelivery(root);
    }
    return await coordinateCycle({
      pending,
      refresh: async () => {
        const file = path.join(cfg.resolved.dataDir, 'source-observations.json');
        const report = await monitorSources({ articles: loadArticles({ includeDrafts: false }), previous: readJson(file, { byUrl: {} }), limit: cfg.rewrite.sourceChecksPerRun ?? 10, intervalDays: cfg.rewrite.sourceCheckIntervalDays ?? 1, coverageDays: cfg.rewrite.sourceObservationMaxAgeDays ?? 7 });
        writeJson(file, report);
      },
      plan,
      write: () => writeOrders(),
      settle,
      deliver: commit ? deliver : undefined,
    });
  } finally { releaseLock(); }
}

if (isMain(import.meta.url)) {
  try {
    recoverWriting();
    for (const args of [[path.join(ROOT, 'scripts/preflight.mjs')], ['--test', 'scripts/*.test.mjs', 'scripts/lib/*.test.mjs']]) {
      const check = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
      if (check.error || check.status !== 0) throw new Error('Preflight/тесты не пройдены; цикл не запускается');
    }
    const args = parseArgs(process.argv.slice(2));
    console.log(JSON.stringify(await dailyCycle({ commit: args.commit !== undefined, push: args.push !== undefined, remote: args.remote || 'origin', targetRef: args['target-ref'] }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
