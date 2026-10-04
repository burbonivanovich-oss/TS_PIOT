#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, assertContentRoot, ROOT } from './lib/config.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { readJson, isMain } from './lib/content.mjs';
import { beginGitDelivery, commitGitDelivery } from './lib/git-delivery.mjs';
import { recoverWriting } from './writer.mjs';

export function deliverGit(command) {
  const cfg = loadConfig(); assertContentRoot(cfg);
  acquireLock({ cmd: 'git-delivery' });
  try {
    if (command === 'begin') return beginGitDelivery(cfg.resolved.contentRoot);
    if (command !== 'commit') throw new Error('Использование: git-delivery.mjs begin | commit');
    const orders = readJson(path.join(cfg.resolved.dataDir, 'orders.json'), null);
    if (!orders?.runId) throw new Error('Нет текущего runId для доставки');
    return commitGitDelivery({ root: cfg.resolved.contentRoot, dataDir: cfg.resolved.dataDir, blog: cfg.resolved.blog, runId: orders.runId });
  } finally { releaseLock(); }
}
if (isMain(import.meta.url)) {
  try {
    recoverWriting();
    for (const args of [[path.join(ROOT, 'scripts/preflight.mjs')], ['--test', 'scripts/*.test.mjs', 'scripts/lib/*.test.mjs']]) {
      const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
      if (result.error || result.status !== 0) throw new Error('Preflight/тесты не пройдены; доставка запрещена');
    }
    console.log(JSON.stringify(deliverGit(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
