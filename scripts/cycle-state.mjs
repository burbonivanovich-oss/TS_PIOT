#!/usr/bin/env node
/**
 * Машина состояний редакционного цикла.
 *
 * Рутины запускаются в свежих сессиях без памяти — всё состояние цикла
 * живёт здесь, в src/data/editorial-cycle.json. Агенты не редактируют
 * JSON руками, только через этот CLI: так состояние не разъезжается.
 *
 * Состояния:
 *   idle            — цикла нет, можно запускать /cycle-plan
 *   awaiting_review — план отправлен редактору в Issue, ждём реакции
 *   approved        — редактор одобрил план, можно писать батчи
 *   batch_review    — батч статей в PR, ждём реакции редактора
 *   done            — все темы цикла выпущены
 *
 * Использование:
 *   node scripts/cycle-state.mjs get [--json]
 *   node scripts/cycle-state.mjs init --cycle 2026-08 --issue 42 --plan plan.json
 *   node scripts/cycle-state.mjs set-state approved
 *   node scripts/cycle-state.mjs seen-comment 1234567
 *   node scripts/cycle-state.mjs can-start-batch
 *   node scripts/cycle-state.mjs next-batch [--size 3]
 *   node scripts/cycle-state.mjs add-batch --slugs a,b,c --pr 51 --branch content/batch-1
 *   node scripts/cycle-state.mjs close-batch --pr 51
 *   node scripts/cycle-state.mjs drop-topic <slug>
 *   node scripts/cycle-state.mjs add-topic --slug x --title "..." --priority P1 --cluster ts-piot --keyword "..."
 *   node scripts/cycle-state.mjs reset
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const STATE_PATH = join(ROOT, 'src/data/editorial-cycle.json');

const STATES = ['idle', 'awaiting_review', 'approved', 'batch_review', 'done'];

const EMPTY = {
  cycleId: null,
  state: 'idle',
  issueNumber: null,
  createdAt: null,
  updatedAt: null,
  editorLogins: [],
  lastSeenCommentId: 0,
  batchSize: 3,
  plan: [],
  batches: [],
  log: [],
};

function load() {
  if (!existsSync(STATE_PATH)) return structuredClone(EMPTY);
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(STATE_PATH, 'utf8')) };
  } catch (e) {
    die(`editorial-cycle.json повреждён: ${e.message}. Почини вручную или запусти reset.`);
  }
}

function save(s, event) {
  s.updatedAt = new Date().toISOString();
  if (event) {
    s.log = [...(s.log || []), { at: s.updatedAt, event }].slice(-50);
  }
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n');
}

function die(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}

const cmd = process.argv[2];
const s = load();

switch (cmd) {
  /* ---------------------------------------------------------------- get */
  case 'get': {
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(s, null, 2));
      break;
    }
    const pending = s.plan.filter((t) => t.batchStatus === 'pending').length;
    const written = s.plan.filter((t) => t.batchStatus === 'written').length;
    const openBatch = s.batches.find((b) => b.state === 'open');
    console.log(`Цикл:      ${s.cycleId || '—'}`);
    console.log(`Состояние: ${s.state}`);
    console.log(`Issue:     ${s.issueNumber ? `#${s.issueNumber}` : '—'}`);
    console.log(`Темы:      ${s.plan.length} всего / ${pending} ждут / ${written} написано`);
    console.log(`Батчи:     ${s.batches.length}${openBatch ? ` (открыт #${openBatch.pr})` : ''}`);
    console.log(`Последний просмотренный комментарий: ${s.lastSeenCommentId}`);
    break;
  }

  /* --------------------------------------------------------------- init */
  case 'init': {
    if (s.state !== 'idle' && s.state !== 'done') {
      die(`цикл ${s.cycleId} уже идёт (${s.state}). Сначала заверши его или запусти reset.`);
    }
    const cycleId = arg('cycle') || new Date().toISOString().slice(0, 7);
    const issue = arg('issue');
    const planPath = arg('plan');
    if (!issue) die('нужен --issue <номер Issue с планом>');
    if (!planPath) die('нужен --plan <путь к JSON-массиву тем>');
    if (!existsSync(planPath)) die(`файл плана не найден: ${planPath}`);

    let topics;
    try {
      topics = JSON.parse(readFileSync(planPath, 'utf8'));
    } catch (e) {
      die(`план не парсится: ${e.message}`);
    }
    if (!Array.isArray(topics) || topics.length === 0) die('план пуст или не массив');

    for (const t of topics) {
      if (!t.slug || !t.title) die(`у темы нет slug или title: ${JSON.stringify(t)}`);
    }

    const next = structuredClone(EMPTY);
    next.cycleId = cycleId;
    next.state = 'awaiting_review';
    next.issueNumber = Number(issue);
    next.createdAt = new Date().toISOString();
    next.editorLogins = (arg('editors') || '').split(',').map((x) => x.trim()).filter(Boolean);
    next.batchSize = Number(arg('batch-size', 3));
    next.plan = topics.map((t) => ({
      slug: t.slug,
      title: t.title,
      priority: t.priority || 'P1',
      cluster: t.cluster || '',
      targetKeyword: t.targetKeyword || '',
      rationale: t.rationale || '',
      batchStatus: 'pending',
      batch: null,
    }));

    save(next, `init cycle ${cycleId}, issue #${issue}, ${topics.length} тем`);
    console.log(`✅ Цикл ${cycleId} создан: ${topics.length} тем, Issue #${issue}, состояние awaiting_review`);
    break;
  }

  /* ---------------------------------------------------------- set-state */
  case 'set-state': {
    const to = process.argv[3];
    if (!STATES.includes(to)) die(`неизвестное состояние "${to}". Допустимо: ${STATES.join(', ')}`);
    const from = s.state;
    s.state = to;
    save(s, `state ${from} → ${to}`);
    console.log(`✅ ${from} → ${to}`);
    break;
  }

  /* ------------------------------------------------------- seen-comment */
  case 'seen-comment': {
    const id = Number(process.argv[3]);
    if (!Number.isFinite(id)) die('нужен числовой id комментария');
    if (id <= s.lastSeenCommentId) {
      console.log(`= ${s.lastSeenCommentId} (не двигаем назад)`);
      break;
    }
    s.lastSeenCommentId = id;
    save(s, `seen comment ${id}`);
    console.log(`✅ lastSeenCommentId = ${id}`);
    break;
  }

  /* ---------------------------------------------------- can-start-batch */
  /* Главный предохранитель: не даём завалить редактора правками.        */
  case 'can-start-batch': {
    const open = s.batches.find((b) => b.state === 'open');
    if (s.state === 'idle' || s.state === 'done') {
      console.log(`НЕТ — цикл в состоянии ${s.state}, писать нечего`);
      process.exit(1);
    }
    if (s.state === 'awaiting_review') {
      console.log('НЕТ — план ещё не одобрен редактором');
      process.exit(1);
    }
    if (open) {
      console.log(`НЕТ — батч ${open.n} висит на ревью (PR #${open.pr}). Сначала закрыть его.`);
      process.exit(1);
    }
    const pending = s.plan.filter((t) => t.batchStatus === 'pending');
    if (pending.length === 0) {
      console.log('НЕТ — все темы цикла написаны');
      process.exit(1);
    }
    console.log(`ДА — ${pending.length} тем ждут, открытых батчей нет`);
    break;
  }

  /* ---------------------------------------------------------- next-batch */
  case 'next-batch': {
    const size = Number(arg('size', s.batchSize || 3));
    const order = { P0: 0, P1: 1, P2: 2 };
    const picked = s.plan
      .filter((t) => t.batchStatus === 'pending')
      .sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
      .slice(0, size);
    console.log(JSON.stringify(picked, null, 2));
    break;
  }

  /* ----------------------------------------------------------- add-batch */
  case 'add-batch': {
    const slugs = (arg('slugs') || '').split(',').map((x) => x.trim()).filter(Boolean);
    const pr = arg('pr');
    if (slugs.length === 0) die('нужен --slugs a,b,c');
    if (!pr) die('нужен --pr <номер PR>');

    const unknown = slugs.filter((sl) => !s.plan.some((t) => t.slug === sl));
    if (unknown.length) die(`этих тем нет в плане цикла: ${unknown.join(', ')}`);

    // Защита от повторной записи: в батч идут только темы со статусом pending.
    const notPending = slugs
      .map((sl) => s.plan.find((t) => t.slug === sl))
      .filter((t) => t.batchStatus !== 'pending');
    if (notPending.length) {
      die(
        `эти темы уже не ждут очереди: ` +
          notPending.map((t) => `${t.slug} (${t.batchStatus}, батч ${t.batch})`).join(', ')
      );
    }

    const n = s.batches.length + 1;
    s.batches.push({
      n,
      slugs,
      pr: Number(pr),
      branch: arg('branch') || null,
      state: 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
    });
    for (const t of s.plan) {
      if (slugs.includes(t.slug)) {
        t.batchStatus = 'in_review';
        t.batch = n;
      }
    }
    s.state = 'batch_review';
    save(s, `batch ${n} открыт: PR #${pr}, ${slugs.length} статей`);
    console.log(`✅ Батч ${n}: ${slugs.length} статей, PR #${pr}, состояние batch_review`);
    break;
  }

  /* --------------------------------------------------------- close-batch */
  case 'close-batch': {
    const pr = Number(arg('pr'));
    const b = pr ? s.batches.find((x) => x.pr === pr) : s.batches.find((x) => x.state === 'open');
    if (!b) die(pr ? `батч с PR #${pr} не найден` : 'открытых батчей нет');
    if (b.state !== 'open') die(`батч ${b.n} уже закрыт (${b.state})`);

    b.state = 'merged';
    b.closedAt = new Date().toISOString();
    for (const t of s.plan) {
      if (b.slugs.includes(t.slug)) t.batchStatus = 'written';
    }
    const pending = s.plan.filter((t) => t.batchStatus === 'pending').length;
    s.state = pending > 0 ? 'approved' : 'done';
    save(s, `batch ${b.n} закрыт, осталось тем: ${pending}`);
    console.log(`✅ Батч ${b.n} закрыт. Осталось ${pending} тем. Состояние: ${s.state}`);
    break;
  }

  /* ---------------------------------------------------------- drop-topic */
  case 'drop-topic': {
    const slug = process.argv[3];
    if (!slug) die('нужен slug');
    const before = s.plan.length;
    s.plan = s.plan.filter((t) => t.slug !== slug);
    if (s.plan.length === before) die(`темы "${slug}" нет в плане`);
    save(s, `тема снята редактором: ${slug}`);
    console.log(`✅ Тема "${slug}" снята. Осталось ${s.plan.length}.`);
    break;
  }

  /* ----------------------------------------------------------- add-topic */
  case 'add-topic': {
    const slug = arg('slug');
    const title = arg('title');
    if (!slug || !title) die('нужны --slug и --title');
    if (s.plan.some((t) => t.slug === slug)) die(`тема "${slug}" уже в плане`);
    s.plan.push({
      slug,
      title,
      priority: arg('priority', 'P1'),
      cluster: arg('cluster', ''),
      targetKeyword: arg('keyword', ''),
      rationale: arg('rationale', 'добавлено редактором'),
      batchStatus: 'pending',
      batch: null,
    });
    save(s, `тема добавлена редактором: ${slug}`);
    console.log(`✅ Тема "${slug}" добавлена. Всего ${s.plan.length}.`);
    break;
  }

  /* --------------------------------------------------------------- reset */
  case 'reset': {
    if (!process.argv.includes('--force')) {
      die('это сотрёт текущий цикл. Повтори с --force, если уверен.');
    }
    save(structuredClone(EMPTY), 'reset');
    console.log('✅ Состояние сброшено в idle');
    break;
  }

  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].split('/**')[1]);
    process.exit(cmd ? 1 : 0);
}
