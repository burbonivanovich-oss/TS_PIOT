#!/usr/bin/env node
// Единый отчёт о состоянии контура. Первое, что запускают, когда «что-то не
// так»: проверяет не отдельный скрипт, а связность всей конструкции — от
// доступности контент-репозитория до того, выбирается ли месячная норма.
//
//   node scripts/health-check.mjs [--json]
//
// Код выхода: 0 — всё в норме, 2 — есть отказы (для CI).
import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { loadArticles, readJson, isMain, parseArgs, daysBetween } from './lib/content.mjs';
import { readState, capacity } from './state.mjs';
import { inspectLock } from './lib/lock.mjs';
import { buildLinkGraph } from './interlink.mjs';

const cfg = loadConfig();

function check(name, fn) {
  try {
    const result = fn();
    return { name, ...result };
  } catch (error) {
    return { name, level: 'fail', detail: error.message };
  }
}

export function healthCheck() {
  const checks = [];

  checks.push(
    check('контент-репозиторий', () => {
      if (!existsSync(cfg.resolved.blog)) {
        return { level: 'fail', detail: `нет каталога ${cfg.resolved.blog}` };
      }
      const articles = loadArticles();
      return {
        level: articles.length ? 'ok' : 'fail',
        detail: `${articles.length} статей, ${articles.filter((a) => a.draft).length} черновиков`,
      };
    }),
  );

  checks.push(
    check('темп месяца', () => {
      const state = readState();
      const cap = capacity(state);
      // Свежая установка — не отказ: контур ещё ничего не должен был выдать.
      // Иначе первый же health-check на новом проекте показывает FAIL, и
      // сигнал перестают воспринимать всерьёз ровно там, где он важнее всего.
      const neverRan = state.history.length === 0 && cap.done === 0 && !state.inFlight.length;
      if (neverRan) return { level: 'warn', detail: `контур ещё не выдавал статей, норма ${cap.monthlyTarget}/мес` };
      const ratio = cap.expectedByToday ? cap.done / cap.expectedByToday : 1;
      return {
        level: ratio >= 0.8 ? 'ok' : ratio >= 0.5 ? 'warn' : 'fail',
        detail: `${cap.done}/${cap.monthlyTarget} за месяц, ожидалось к сегодня ${cap.expectedByToday}`,
      };
    }),
  );

  checks.push(
    check('бэклог', () => {
      const backlog = readJson(path.join(cfg.resolved.dataDir, 'backlog.json'), { topics: [] });
      const planned = backlog.topics.filter((t) => t.status === 'planned').length;
      const need = Math.ceil(cfg.throughput.monthlyTarget / 4);
      return {
        level: planned >= need ? 'ok' : planned > 0 ? 'warn' : 'fail',
        detail: `${planned} тем в запасе (минимум ${need})`,
      };
    }),
  );

  checks.push(
    check('карантин', () => {
      const state = readState();
      const n = state.quarantine.length;
      return {
        level: n === 0 ? 'ok' : n <= 10 ? 'warn' : 'fail',
        detail: n ? `${n} тем: ${state.quarantine.slice(0, 5).map((q) => q.slug).join(', ')}` : 'пусто',
      };
    }),
  );

  checks.push(
    check('зависшие наряды', () => {
      const state = readState();
      const now = new Date();
      const stuck = state.inFlight.filter((t) => daysBetween(new Date(t.claimedAt), now) >= 2);
      return {
        level: stuck.length === 0 ? 'ok' : 'fail',
        detail: stuck.length
          ? `${stuck.length} нарядов старше двух суток: ${stuck.map((t) => t.slug).join(', ')}`
          : `${state.inFlight.length} в работе, все свежие`,
      };
    }),
  );

  checks.push(
    check('согласованность', () => {
      const state = readState();
      const backlog = readJson(path.join(cfg.resolved.dataDir, 'backlog.json'), { topics: [] });
      const orders = readJson(path.join(cfg.resolved.dataDir, 'orders.json'), { orders: [] });
      const writing = new Set(backlog.topics.filter((t) => t.status === 'writing').map((t) => t.slug));
      const inFlight = new Set(state.inFlight.map((t) => t.slug));
      const newInFlight = new Set(state.inFlight.filter((t) => t.kind !== 'rewrite').map((t) => t.slug));
      const openOrders = new Set(orders.orders.map((o) => o.slug));
      const problems = [];

      const slotsNoOrder = [...inFlight].filter((s) => !openOrders.has(s));
      const ordersNoSlot = [...openOrders].filter((s) => !inFlight.has(s));
      if (slotsNoOrder.length) problems.push(`слоты без наряда: ${slotsNoOrder.join(', ')}`);
      if (ordersNoSlot.length) problems.push(`наряды без слота: ${ordersNoSlot.join(', ')}`);

      const writingNoSlot = [...writing].filter((s) => !newInFlight.has(s));
      if (writingNoSlot.length) problems.push(`writing без активного слота (${writingNoSlot.length}): ${writingNoSlot.join(', ')}`);
      const slotNoWriting = [...newInFlight].filter((s) => !writing.has(s));
      if (slotNoWriting.length) problems.push(`новый наряд без статуса writing: ${slotNoWriting.join(', ')}`);

      const releasedMissing = backlog.topics
        .filter((t) => t.status === 'released')
        .filter((t) => !['.md', '.mdx'].some((ext) => existsSync(path.join(cfg.resolved.blog, `${t.slug}${ext}`))));
      if (releasedMissing.length) problems.push(`released без файла: ${releasedMissing.map((t) => t.slug).join(', ')}`);

      const quarantine = state.quarantine.map((q) => q.slug);
      const duplicates = [...new Set(quarantine.filter((s, i) => quarantine.indexOf(s) !== i))];
      if (duplicates.length) problems.push(`дубли в карантине: ${duplicates.join(', ')}`);

      const lock = inspectLock();
      if (lock.ownerAlive) problems.push(`блокировка удерживается живым процессом ${lock.lock.pid}`);
      if (lock.reap && !lock.reaperAlive) problems.push(`остался reap-файл мёртвого процесса ${lock.reap.pid}`);

      if (problems.length) {
        return {
          level: 'fail',
          detail:
            problems.join(' | ') +
            ' | восстановление: `node scripts/backlog.mjs reconcile` (writing без слота → planned), затем `state.mjs unlock --force` при мёртвом lock',
        };
      }
      return { level: 'ok', detail: `${inFlight.size} в работе, writing и наряды согласованы` };
    }),
  );

  checks.push(
    check('граф ссылок', () => {
      const articles = loadArticles({ includeDrafts: false });
      if (!articles.length) return { level: 'fail', detail: 'нет статей' };
      const graph = buildLinkGraph(articles);
      const orphans = articles.filter((a) => (graph.inbound.get(a.slug)?.size || 0) < cfg.interlink.minInbound);
      const share = orphans.length / articles.length;
      const links = articles.reduce((s, a) => s + graph.outbound.get(a.slug).size, 0);
      const overLinked = articles.filter(
        (a) => !a.interlinkExempt && graph.outbound.get(a.slug).size > cfg.interlink.maxOutbound,
      );
      return {
        level: share <= 0.15 && !overLinked.length ? 'ok' : share <= 0.3 ? 'warn' : 'fail',
        detail:
          `${links} ссылок, сирот ${orphans.length} (${Math.round(share * 100)}%)` +
          (overLinked.length ? `, выше потолка исходящих ${overLinked.length}` : ''),
      };
    }),
  );

  checks.push(
    check('дубли в корпусе', () => {
      const dupes = readJson(path.join(cfg.resolved.dataDir, 'dupes.json'), null);
      if (!dupes) return { level: 'warn', detail: 'scan ещё не запускался' };
      const merge = dupes.pairs.filter((p) => p.verdict === 'merge').length;
      // По датам, а не по миллисекундам: generatedAt — это YYYY-MM-DD, и
      // сравнение с текущим моментом округляет сегодняшний отчёт до «1 дн.».
      const age = daysBetween(new Date(dupes.generatedAt), new Date(new Date().toISOString().slice(0, 10)));
      return {
        level: merge === 0 ? 'ok' : merge <= 5 ? 'warn' : 'fail',
        detail: `${merge} пар на разведение, отчёт от ${dupes.generatedAt} (${age} дн. назад)`,
      };
    }),
  );

  const worst = checks.some((c) => c.level === 'fail') ? 'fail' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok';
  return { level: worst, checks };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = healthCheck();
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const icon = { ok: '✔', warn: '▲', fail: '✖' };
    for (const c of report.checks) console.log(`${icon[c.level]} ${c.name.padEnd(22)} ${c.detail}`);
    console.log(`\nИтог: ${report.level.toUpperCase()}`);
  }
  process.exit(report.level === 'fail' ? 2 : 0);
}

if (isMain(import.meta.url)) main();
