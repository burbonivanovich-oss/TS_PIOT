#!/usr/bin/env node
// Миграция исторического состояния (AP-P0-05).
//
// После переезда в TS_PIOT в `data/` остались темы `writing` без активных
// слотов и старый `orders.json`. Обычный `settle` поверх такого состояния
// запрещён: он начислит редакционные неудачи за работу, которой никто не делал.
//
//   node scripts/migrate-reconcile.mjs --dry     # отчёт без изменений
//   node scripts/migrate-reconcile.mjs --apply   # backup + миграция
//
// Правила:
//   • тема `writing` без файла → `planned` (без failure);
//   • тема `writing` с файлом → гейты: прошла → `released`, не прошла → `planned`;
//   • orders вне inFlight удаляются, inFlight без orders — ошибка (не снимаем);
//   • перед apply — backup `data/` в `data/backups/`;
//   • идемпотентно: повторный запуск не меняет ничего.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { readJson, writeJson, today, isMain, parseArgs } from './lib/content.mjs';
import { runGates } from './gates.mjs';
import { createBackup } from './backup.mjs';
import { acquireLock, releaseLock } from './lib/lock.mjs';
import { envelope } from './lib/outcome.mjs';

const cfg = loadConfig();

function fileFor(blog, slug) {
  for (const ext of ['.md', '.mdx']) {
    const candidate = path.join(blog, `${slug}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Read-only план миграции. `gates` инъектируется для тестов. */
export function planReconcile({ dataDir, blog, gates = runGates }) {
  const backlog = readJson(path.join(dataDir, 'backlog.json'), { topics: [] });
  const state = readJson(path.join(dataDir, 'autopilot.json'), { inFlight: [] });
  const orders = readJson(path.join(dataDir, 'orders.json'), { orders: [] });
  const inFlight = new Set((state.inFlight || []).map((t) => t.slug));
  const openOrders = new Set((orders.orders || []).map((o) => o.slug));

  const actions = [];
  for (const topic of backlog.topics || []) {
    if (topic.status !== 'writing') continue;
    const file = fileFor(blog, topic.slug);
    if (!file) {
      actions.push({ slug: topic.slug, action: 'planned', reason: 'файла в корпусе нет — возврат в план' });
      continue;
    }
    const gate = gates({ file });
    actions.push({
      slug: topic.slug,
      action: gate.passed ? 'released' : 'planned',
      reason: gate.passed
        ? 'статья существует и проходит гейты'
        : `гейты не пройдены: ${gate.blockers.length ? gate.blockers.join(', ') : `балл ${gate.score}`}`,
      gateScore: gate.score,
      blockers: gate.blockers,
    });
  }

  const dropOrders = [...openOrders].filter((slug) => !inFlight.has(slug));
  const keepOrders = [...openOrders].filter((slug) => inFlight.has(slug));
  const orphanInFlight = [...inFlight].filter((slug) => !openOrders.has(slug));
  return { backlog, state, orders, actions, dropOrders, keepOrders, orphanInFlight };
}

/** Применить план. Возвращает отчёт. */
export function applyReconcile({ dataDir, blog, gates = runGates, backup = true } = {}) {
  const plan = planReconcile({ dataDir, blog, gates });
  const changes = plan.actions.length + plan.dropOrders.length + plan.orphanInFlight.length;

  if (backup && changes > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    createBackup({ from: dataDir, to: path.join(dataDir, 'backups', `reconcile-${stamp}`) });
  }

  if (changes > 0) {
    for (const action of plan.actions) {
      const topic = plan.backlog.topics.find((t) => t.slug === action.slug);
      topic.status = action.action;
      topic.updatedAt = today();
      topic.migration = { at: new Date().toISOString(), reason: action.reason };
    }
    writeJson(path.join(dataDir, 'backlog.json'), plan.backlog);

    plan.orders.orders = (plan.orders.orders || []).filter((o) => plan.keepOrders.includes(o.slug));
    writeJson(path.join(dataDir, 'orders.json'), plan.orders);

    for (const slug of plan.orphanInFlight) {
      plan.state.inFlight = (plan.state.inFlight || []).filter((t) => t.slug !== slug);
    }
    plan.state.lastMigration = { at: new Date().toISOString(), actions: plan.actions.length, droppedOrders: plan.dropOrders.length };
    writeJson(path.join(dataDir, 'autopilot.json'), plan.state);
  }

  const report = {
    at: new Date().toISOString(),
    changed: changes > 0,
    actions: plan.actions,
    droppedOrders: plan.dropOrders,
    keptOrders: plan.keepOrders,
    orphanInFlight: plan.orphanInFlight,
  };
  if (changes > 0) writeJson(path.join(dataDir, `reconcile-report-${today()}.json`), report);
  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertContentRoot(cfg);
  acquireLock({ cmd: 'migrate-reconcile' });
  try {
    const dataDir = cfg.resolved.dataDir;
    const blog = cfg.resolved.blog;
    if (args.apply) {
      const report = applyReconcile({ dataDir, blog });
      console.log(
        `Миграция применена: тем ${report.actions.length} (${report.actions.filter((a) => a.action === 'released').length} released), ` +
          `снято orders ${report.droppedOrders.length}, orphan inFlight ${report.orphanInFlight.length}`,
      );
      for (const action of report.actions) console.log(`   ${action.action.padEnd(8)} ${action.slug} — ${action.reason}`);
      return;
    }
    const plan = planReconcile({ dataDir, blog });
    const out = envelope({
      ok: true,
      category: 'ok',
      exitCode: 0,
      dry: true,
      actions: plan.actions,
      dropOrders: plan.dropOrders,
      keepOrders: plan.keepOrders,
      orphanInFlight: plan.orphanInFlight,
    });
    if (args.json) console.log(JSON.stringify(out, null, 2));
    else {
      console.log(`[dry] тем к разбору: ${plan.actions.length}, orders к снятию: ${plan.dropOrders.length}, orphan inFlight: ${plan.orphanInFlight.length}`);
      for (const action of plan.actions) console.log(`   ${action.action.padEnd(8)} ${action.slug} — ${action.reason}`);
      for (const slug of plan.dropOrders) console.log(`   drop-order ${slug}`);
    }
  } finally {
    releaseLock();
  }
}

if (isMain(import.meta.url)) main();
