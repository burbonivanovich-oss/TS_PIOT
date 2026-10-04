#!/usr/bin/env node
// Квитанция доставки текста, а не разрешение публикации. Все гейты запускает settle.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import { readJson, writeJson, isMain, parseArgs } from './lib/content.mjs';
import { acquireLock, releaseLock, newRunId } from './lib/lock.mjs';
import { readRun, setStage } from './lib/run.mjs';
import { recoverSettle } from './lib/settle-snapshot.mjs';

function attempt(task) {
  if (!task.claimedAt || !Number.isInteger(task.failures) || !Number.isInteger(task.infraFailures)) throw new Error('Повреждена идентичность попытки написания');
  return `${task.claimedAt}/${task.failures}/${task.infraFailures}`;
}
function article(blog, slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('Некорректный slug наряда');
  const files = ['md', 'mdx'].map(ext => path.join(blog, `${slug}.${ext}`)).filter(existsSync);
  if (files.length > 1) throw new Error(`Две версии статьи ${slug}`);
  if (!files.length) return null;
  const file = realpathSync(files[0]);
  if (path.dirname(file) !== realpathSync(blog)) throw new Error('Файл наряда выходит за корпус');
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  return { file, sha256 };
}

export function writingStatus({ orders, state, receipts = { items: {} }, blog }) {
  if (!Array.isArray(orders.orders) || !Array.isArray(state.inFlight) || !receipts.items || typeof receipts.items !== 'object' || Array.isArray(receipts.items)) throw new Error('Повреждены входы статуса написания');
  if (new Set(orders.orders.map(order => order.slug)).size !== orders.orders.length) throw new Error('Повтор наряда в статусе написания');
  return orders.orders.map(order => {
    if (!['new', 'rewrite'].includes(order.kind)) throw new Error('Некорректный вид наряда');
    const task = state.inFlight.find(task => task.slug === order.slug);
    if (!task) return { slug: order.slug, action: 'closed' };
    if (task.kind !== order.kind) throw new Error('Вид слота не совпадает с нарядом');
    const identity = attempt(task);
    const current = article(blog, order.slug);
    const receipt = receipts.items[order.slug];
    const delivered = Boolean(current && receipt && receipt.attempt === identity && receipt.sha256 === current.sha256 && receipt.kind === order.kind);
    return { slug: order.slug, kind: order.kind, action: delivered ? 'settle' : 'write', attempt: identity, file: current?.file || null, sha256: current?.sha256 || null };
  });
}

export function checkpoint(slug, cfg = loadConfig()) {
  acquireLock({ cmd: 'writing-checkpoint', runId: newRunId() });
  try {
    assertContentRoot(cfg);
    // Незавершённый settle нельзя продолжать через запись квитанции.
    recoverSettle({ blog: cfg.resolved.blog, dataDir: cfg.resolved.dataDir }, { dry: true });
    const dir = cfg.resolved.dataDir;
    const orders = readJson(path.join(dir, 'orders.json'), null);
    const state = readJson(path.join(dir, 'autopilot.json'), null);
    const receiptsFile = path.join(dir, 'writing-receipts.json');
    const receipts = readJson(receiptsFile, { items: {} });
    if (!orders?.runId || !readRun(orders.runId, { dir })) throw new Error('Нет манифеста нарядов для квитанции');
    const run = readRun(orders.runId, { dir });
    if (run.stages.gated || run.stages.built || run.stages.committed) throw new Error('Проход уже принят; нужна новая попытка планирования');
    const statuses = writingStatus({ orders, state, receipts, blog: cfg.resolved.blog });
    const target = statuses.find(item => item.slug === slug);
    if (!target || target.action === 'closed' || !target.file) throw new Error('Нет активного наряда или написанного файла');
    receipts.items[slug] = { kind: target.kind, attempt: target.attempt, sha256: target.sha256, runId: orders.runId, at: new Date().toISOString() };
    writeJson(receiptsFile, receipts);
    const after = writingStatus({ orders, state, receipts, blog: cfg.resolved.blog });
    if (after.every(item => item.action !== 'write')) setStage(orders.runId, 'written', { delivered: after.filter(item => item.action === 'settle').length, meaning: 'bytes delivered; gates not passed yet' }, { dir });
    return receipts.items[slug];
  } finally { releaseLock(); }
}

if (isMain(import.meta.url)) {
  try {
    const cfg = loadConfig(); const args = parseArgs(process.argv.slice(3));
    if (process.argv[2] === 'record') {
      if (!args.slug) throw new Error('Нужен --slug');
      console.log(JSON.stringify(checkpoint(args.slug, cfg), null, 2));
    } else if (process.argv[2] === 'status') {
      const dir = cfg.resolved.dataDir;
      console.log(JSON.stringify(writingStatus({ orders: readJson(path.join(dir, 'orders.json'), { orders: [] }), state: readJson(path.join(dir, 'autopilot.json'), { inFlight: [] }), receipts: readJson(path.join(dir, 'writing-receipts.json'), { items: {} }), blog: cfg.resolved.blog }), null, 2));
    } else throw new Error('Использование: writing-checkpoint.mjs status|record --slug <slug>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
