#!/usr/bin/env node
// Оркестратор суточного прохода. Разделён на две половины намеренно:
//
//   plan   — детерминированная часть: пополнить бэклог, пересчитать очередь
//            рерайтов, взять ровно столько работы, сколько влезает в норму,
//            и выдать наряды. ИИ здесь не нужен, это чистая арифметика.
//   settle — тоже детерминированная: прогнать гейты по написанному, решить
//            публиковать или в карантин, разложить перелинковку, закрыть
//            счётчики.
//
// Между ними — единственный шаг, где нужна языковая модель: собственно
// написание текста по наряду (см. .agents/skills/auto-write/SKILL.md). Такое
// разделение даёт проверяемость: всё, кроме текста, воспроизводится запуском
// скрипта и не зависит от того, какая модель сегодня отвечает.
//
//   node scripts/pipeline.mjs plan [--json]
//   node scripts/pipeline.mjs settle [--dry]
//   node scripts/pipeline.mjs report
import path from 'node:path';
import {preservePublishedRewrite,stageQueuedRewrite,queuedRewriteFile,promoteQueuedRewrite,forgetPublishedRewrite,retainFailedRewrite,retainRepairCandidate,activateRepairCandidate,forgetRepairCandidate} from './lib/queued-rewrite.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadConfig, assertContentRoot } from './lib/config.mjs';
import {
  readJson,
  writeJson,
  today,
  isMain,
  parseArgs,
  parseFrontmatter,
  setFrontmatterField,
  removeFrontmatterField,
  writeArticle,
  loadArticles,
} from './lib/content.mjs';
import { readState, saveState, capacity, claim, claimAcceptedRepair, done, fail } from './state.mjs';
import { acquireLock, releaseLock, newRunId } from './lib/lock.mjs';
import { refill, take as takeTopics, setStatus, reconcile } from './backlog.mjs';
import { buildQueue, takeRewrites, markRewritten, activeRewrites, releaseReservation } from './rewrite-queue.mjs';
import { runGates, bodyDuplication } from './gates.mjs';
import { lateCorrectionPriority } from './lib/fact-corrections.mjs';
import { readSourceEvidence } from './lib/sources.mjs';
import { allocateReleases, releaseCalendar, publicationCapacity } from './lib/release.mjs';
import { findResumableRun, createRun, setStage, readRun } from './lib/run.mjs';
import { envelope, classifyError, EXIT } from './lib/outcome.mjs';
import { runSiteBuild } from './lib/site.mjs';
import { applyLinks } from './interlink.mjs';
import { snapshotSettle, recoverSettle } from './lib/settle-snapshot.mjs';
import { writingStatus } from './writing-checkpoint.mjs';

const cfg = loadConfig();
const ORDERS_FILE = path.join(cfg.resolved.dataDir, 'orders.json');
const RELEASE_FILE = path.join(cfg.resolved.dataDir, 'release-queue.json');
const PUBLISH_LOG_FILE = path.join(cfg.resolved.dataDir, 'publish-log.json');

/** Наряды на день: что писать заново и что переписывать. */
export function plan({ correctionsOnly = false } = {}) {
  // Единый lock на весь проход (AP-P0-09): второй plan отказывает до чтения
  // состояния, а не затирает чужой результат после.
  acquireLock({ cmd: 'plan', runId: newRunId() });
  try {
    assertContentRoot(cfg);
    recoverSettle({ blog: cfg.resolved.blog, dataDir: cfg.resolved.dataDir });
    const snapshot=snapshotSettle({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir});
    try {const result=planInner({correctionsOnly});snapshot.commit();return result;}
    catch(error){snapshot.restore();throw error;}
  } finally {
    releaseLock();
  }
}

function planInner({ correctionsOnly = false } = {}) {
  assertContentRoot(cfg);
  const state = readState();
  const waitingForRelease = readJson(RELEASE_FILE, { items: [] }).items;

  // Сначала самолечение, потом пополнение: иначе refill добьёт запас до нормы,
  // считая зависшие темы живыми, и бэклог раздуется на каждом сбое.
  const healed = reconcile(state.inFlight.map((t) => t.slug));
  refill();
  const rewriteQueue = buildQueue();
  const unavailableRewrites = new Set([...state.inFlight, ...state.quarantine, ...waitingForRelease].map(item => item.slug));
  const urgentRewrites = rewriteQueue.items.filter(item => item.factCorrections?.length && !unavailableRewrites.has(item.slug)).length;
  let cap = capacity(state, new Date(), cfg, waitingForRelease, { urgentRewrites });
  if (correctionsOnly) {
    if (cfg.throughput.monthlyRewriteTarget === undefined) throw new Error('Corrections-only requires a separate rewrite budget');
    cap = { ...cap, canTake: cap.urgentRewriteSlots, takeByKind: { new: 0, rewrite: cap.urgentRewriteSlots }, correctionsOnly: true };
  }

  // Проход дня создаём/переиспользуем до выдачи рерайтов: reservation должна
  // нести тот же runId, что и наряд (AP-P1-09).
  const date = today();
  const previousRun = findResumableRun({ date });
  // Приёмка закрывает попытку; её повторные отказы требуют нового манифеста,
  // чтобы written следующего захода не оказался после старого gated.
  const run = previousRun && !previousRun.stages.gated ? previousRun : createRun({ date, kind: 'day' });

  const rewriteShare = cfg.mix.rewrite;
  const wantRewrite = cap.takeByKind?.rewrite ?? Math.min(Math.round(cap.canTake * rewriteShare), cap.canTake);
  const wantNew = cap.takeByKind?.new ?? (cap.canTake - wantRewrite);

  const orders = [];

  // Незакрытые наряды прошлого прохода — первыми и заново. Слот они уже
  // занимают, так что новой ёмкости не съедают. Без переноса получается
  // утечка: наряд, по которому статья не написана, остаётся в inFlight, но
  // выпадает из orders.json — и settle его больше не видит, значит счётчик
  // неудач не растёт, карантин не наступает, а слот занят навсегда.
  const previous = readJson(ORDERS_FILE, { orders: [] }).orders;
  const inFlight = new Set(state.inFlight.map((t) => t.slug));
  const carried = previous
    .filter((o) => inFlight.has(o.slug) && !state.inFlight.find(t=>t.slug===o.slug)?.acceptedRepair)
    .map((o) => ({ ...o, retry: true }));
  orders.push(...carried);
  const carriedSlugs = new Set(carried.map((o) => o.slug));

  // Потеря orders.json не должна оставить активный рерайт без наряда: очередь
  // — второй источник правды о том, что уже в работе (AP-P1-09).
  for (const item of activeRewrites([...inFlight])) {
    if (carriedSlugs.has(item.slug) || state.inFlight.find(t=>t.slug===item.slug)?.acceptedRepair) continue;
    carried.push({
      kind: 'rewrite',
      slug: item.slug,
      title: item.title,
      reasons: item.reasons || ['продолжение зарезервированного рерайта'],
      score: item.score,
      factCorrections: item.factCorrections || [],
      targetFile: path.join(cfg.paths.blog, `${item.slug}.md`),
      retry: true,
      runId: item.runId || run.runId,
    });
    carriedSlugs.add(item.slug);
    orders.push(carried[carried.length - 1]);
  }

  for(const task of state.inFlight.filter(t=>t.acceptedRepair)) {
    const repair=task.acceptedRepair;
    const file=repair.plannedRunId===run.runId ? (resolveArticleFile(task.slug) || activateRepairCandidate({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,slug:task.slug,backupFile:repair.backupFile,kind:task.kind})) : activateRepairCandidate({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,slug:task.slug,backupFile:repair.backupFile,kind:task.kind});
    repair.plannedRunId=run.runId;
    const topic=readJson(path.join(cfg.resolved.dataDir,'backlog.json'),{topics:[]}).topics.find(t=>t.slug===task.slug)||{};
    const frontmatter=parseFrontmatter(readFileSync(file,'utf8')).data;
    orders.push({kind:task.kind,slug:task.slug,title:task.title,keywords:topic.keywords||frontmatter.seo?.keywords||[],entity:topic.entity,intent:topic.intent,format:topic.format,segment:topic.segment,dedupe:topic.dedupe,reasons:[task.lastFailure],acceptedRepair:repair,targetFile:path.relative(cfg.resolved.contentRoot,file),retry:true,runId:run.runId});
    carriedSlugs.add(task.slug);
  }

  const wantNewAdjusted = wantNew;
  const wantRewriteAdjusted = wantRewrite;

  for (const topic of takeTopics(wantNewAdjusted)) {
    if (carriedSlugs.has(topic.slug)) continue;
    orders.push({
      kind: 'new',
      slug: topic.slug,
      title: topic.title,
      keywords: topic.keywords,
      entity: topic.entity,
      intent: topic.intent,
      format: topic.format,
      segment: topic.segment,
      dedupe: topic.dedupe,
      targetFile: path.join(cfg.paths.blog, `${topic.slug}.md`),
    });
  }

  for (const item of takeRewrites(wantRewriteAdjusted, { runId: run.runId, active: [...inFlight], excluded: [...state.quarantine.map(item => item.slug),...readJson(RELEASE_FILE,{items:[]}).items.map(item=>item.slug)] })) {
    if (carriedSlugs.has(item.slug)) continue;
    preservePublishedRewrite({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,slug:item.slug});
    orders.push({
      kind: 'rewrite',
      slug: item.slug,
      title: item.title,
      reasons: item.reasons,
      score: item.score,
      factCorrections: item.factCorrections || [],
      targetFile: path.join(cfg.paths.blog, `${item.slug}.md`),
    });
  }

  // Слот занимается здесь, а не после написания: иначе два прохода подряд
  // (крон сработал дважды, ретрай после падения) выдадут один и тот же наряд
  // дважды и получатся две статьи на одну тему — ровно тот дубль, который
  // весь контур и старается не допустить.
  for (const order of orders) {
    if (order.retry) continue; // слот уже занят прошлым проходом
    try {
      claim(state, { slug: order.slug, kind: order.kind, title: order.title });
      if (order.kind === 'new') setStatus(order.slug, 'writing');
    } catch (error) {
      order.skipped = error.message;
    }
  }
  saveState(state);

  // Манифест прохода (AP-P0-11): наряды дня привязываются к одному runId, а
  // повторный plan до приёмки продолжает проход за ту же дату. После gated
  // новая попытка получает отдельный манифест. Слоты уже заняты, поэтому продолжение не выдаёт тему дважды.
  const finalOrders = orders.filter((o) => !o.skipped);
  const skipped = orders.filter((o) => o.skipped);
  for (const order of finalOrders) if (!order.runId) order.runId = run.runId;
  setStage(run.runId, 'planned', {
    orderCount: finalOrders.length,
    skipped: skipped.length,
    capacity: { canTake: cap.canTake, todayTarget: cap.todayTarget, debt: cap.debt },
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    date,
    runId: run.runId,
    capacity: cap,
    healed,
    orders: finalOrders,
    skipped,
  };
  writeJson(ORDERS_FILE, payload);
  return payload;
}

/**
 * Приёмка написанного. Проверяет каждый наряд из orders.json: есть ли файл,
 * проходит ли гейты, не дубль ли по телу. Прошло — публикуется (draft: false),
 * не прошло — остаётся черновиком и уходит на второй заход, после второй
 * неудачи в карантин.
 */
export function settle({ dry = false } = {}) {
  acquireLock({ cmd: dry ? 'settle-dry' : 'settle', runId: newRunId() });
  try {
    assertContentRoot(cfg);
    recoverSettle({ blog: cfg.resolved.blog, dataDir: cfg.resolved.dataDir }, { dry });
    const snapshot = dry ? null : snapshotSettle({ blog: cfg.resolved.blog, dataDir: cfg.resolved.dataDir });
    try {
      const report = settleInner({ dry });
      snapshot?.commit();
      return report;
    } catch (error) {
      snapshot?.restore();
      throw error;
    }
  } finally {
    releaseLock();
  }
}

function settleInner({ dry = false } = {}) {
  assertContentRoot(cfg);
  const state = readState();
  const orders = readJson(ORDERS_FILE, { orders: [] });
  const results = [];
  // Сохранённый evidence сетевой проверки первоисточников (AP-P1-02). Сеть в
  // settle не ходит: учитывается только то, что уже записано отдельным этапом.
  const sourceEvidence = readSourceEvidence().entries;

  // Суточная квота публикаций (AP-P0-17): без неё после простоя settle
  // публиковал все прошедшие наряды разом и давал неконтролируемый всплеск.
  const maxPerDay = cfg.publish.maxPerDay;
  const day = today();
  const publishLog = readJson(PUBLISH_LOG_FILE, { days: {} });
  publishLog.days = prunePublishDays(publishLog.days, day);
  const todaySlugs = publishLog.days[day] || [];
  const calendar = cfg.publish.calendar ? releaseCalendar({ config: cfg, publishLog }) : null;
  const releaseQueue = readJson(RELEASE_FILE, { items: [] });

  const inFlight = new Set(state.inFlight.map((t) => t.slug));
  const accepted = [];
  const delivery = cfg.gates.requireWritingReceipt
    ? new Map(writingStatus({ orders, state, receipts: readJson(path.join(cfg.resolved.dataDir, 'writing-receipts.json'), { items: {} }), blog: cfg.resolved.blog }).map(item => [item.slug, item]))
    : null;

  for (const order of orders.orders) {
    // Идемпотентность повторного settle: наряд, уже закрытый прошлым проходом,
    // не публикуется и не пересчитывается второй раз (AP-P0-11/AP-P0-17).
    if (!inFlight.has(order.slug)) {
      results.push({ slug: order.slug, status: 'skipped', detail: 'наряд уже обработан ранее' });
      continue;
    }

    const file = resolveArticleFile(order.slug);
    const notDelivered = delivery && delivery.get(order.slug)?.action !== 'settle';
    if (!file || notDelivered) {
      const missingReason = notDelivered ? 'нет квитанции доставки текущих байтов и попытки' : 'файл не создан исполнителем';
      // Отсутствие файла — инфраструктурный отказ, а не редакционный:
      // выключенный исполнитель не должен дважды загонять тему в карантин
      // (AP-P0-12). Повторы ограничены, после лимита слот освобождается.
      const res = fail(state, { slug: order.slug, reason: missingReason, kind: 'infra' });
      Object.assign(state, res.state);
      if (res.released) {
        if(order.acceptedRepair) {
          const repair=order.acceptedRepair;
          if(!dry) {
          const restored=activateRepairCandidate({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,slug:order.slug,backupFile:repair.backupFile,kind:order.kind});
          if(order.kind==='rewrite')retainFailedRewrite({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,slug:order.slug,file:restored});
          else forgetRepairCandidate({dataDir:cfg.resolved.dataDir,slug:order.slug,backupFile:repair.backupFile});
          }
          releaseQueue.items.push({...repair,recheckFailures:1});
          if(order.kind==='new' && readJson(path.join(cfg.resolved.dataDir,'backlog.json'),{topics:[]}).topics.some(t=>t.slug===order.slug))setStatus(order.slug,'accepted_waiting_release');
        } else releaseTopic(order);
        // Активный рерайт, снятый с производства, освобождает резервацию,
        // иначе очередь навсегда считает его выданным (AP-P1-09).
        if (order.kind === 'rewrite') releaseReservation(order.slug);
      }
      results.push({
        slug: order.slug,
        status: res.released ? 'infra_released' : 'infra_missing',
        detail: res.released
          ? `${missingReason}, ${res.infraFailures} попыток — слот освобождён, тема возвращена`
          : `${missingReason} (инфраструктура, попытка ${res.infraFailures})`,
      });
      continue;
    }

    const gates = runGates({ file, sourceEvidence, requiredPubDate: cfg.gates.requireWritingReceipt && order.kind === 'new' ? (orders.date || '') : null });
    const dupe = bodyDuplication({ file });
    const passed = gates.passed && dupe.verdict === 'ok';

    if (!passed) {
      const reason = [...gates.blockers, dupe.verdict === 'ok' ? null : 'duplication']
        .filter(Boolean)
        .join(', ');
      const res = fail(state, { slug: order.slug, reason: reason || `score ${gates.score}`, kind: 'gate' });
      Object.assign(state, res.state);
      if (res.quarantined) {
        retireTopic(order);
        if (order.kind === 'rewrite') releaseReservation(order.slug);
        if(!dry && order.acceptedRepair)forgetRepairCandidate({dataDir:cfg.resolved.dataDir,slug:order.slug,backupFile:order.acceptedRepair.backupFile});
      }
      if (!dry) {hold(file, reason || `score ${gates.score}`);if(order.kind==='rewrite')retainFailedRewrite({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,slug:order.slug,file});}
      results.push({
        slug: order.slug,
        status: res.quarantined ? 'quarantined' : 'rejected',
        score: gates.score,
        detail: reason || `балл ниже порога: ${gates.score}`,
      });
      continue;
    }

    if(!dry && order.acceptedRepair)forgetRepairCandidate({dataDir:cfg.resolved.dataDir,slug:order.slug,backupFile:order.acceptedRepair.backupFile});
    accepted.push({ slug: order.slug, kind: order.kind, order, ...(order.kind === 'rewrite' && (order.factCorrections?.length || order.acceptedRepair?.factualCorrection) ? { factualCorrection: true } : {}), score: gates.score, file, acceptedAt: new Date().toISOString() });
  }

  // Распределяем квоту: ожидавшие ранее + принятые сейчас, старейшие первыми.
  const waiting = [];
  for (let item of releaseQueue.items) {
    const file = item.stagedFile ? queuedRewriteFile({dataDir:cfg.resolved.dataDir,...item}) : resolveArticleFile(item.slug);
    if (!file) {
      results.push({ slug: item.slug, status: 'release_missing', detail: 'ожидающая статья отсутствует; запись удержана до восстановления файла' });
      waiting.push({...item,file:null,waiting:true,recheckFailed:true});
      continue;
    }
    const gates = runGates({ file, sourceEvidence, requiredPubDate: cfg.gates.requireWritingReceipt && item.kind === 'new' ? String(item.acceptedAt || '').slice(0, 10) : null });
    const dupe = bodyDuplication({ file, excludeSlug: item.stagedFile ? item.slug : undefined });
    if (!gates.passed || dupe.verdict !== 'ok') {
      if (!dry) hold(file, 'waiting_recheck_failed');
      const failedChecks = gates.checks.filter(check => !check.ok);
      const blockers = [...gates.blockers, ...(dupe.verdict === 'ok' ? [] : ['duplication'])];
      const detail = [
        ...failedChecks.map(check => `${check.id}: ${check.detail}`),
        ...(dupe.verdict === 'ok' ? [] : [`duplication: ${dupe.verdict}, ${dupe.slug || 'корпус'}, ${dupe.detail || `body=${dupe.body}, topic=${dupe.topic}`}`]),
        ...(!gates.passed && blockers.length === 0 ? [`score: ${gates.score}, минимум ${cfg.gates.minScore}`] : []),
      ].join('; ');
      results.push({
        slug: item.slug, status: 'release_rejected', score: gates.score,
        detail, blockers, failedChecks,
        duplication: dupe, checkedAt: new Date().toISOString(),
      });
      // Сохраняем в ожидании; устаревший результат не разрешает публикацию.
      item.recheckFailed = true;
      if(!dry) {
        const retry=claimAcceptedRepair(state,{item:{...item,title:parseFrontmatter(readFileSync(file,'utf8')).data.title},reason:detail,maxSlots:Math.min(cfg.throughput.maxBatchSize,cfg.throughput.maxParallelWriting)});
        if(retry.claimed) {
          retry.task.acceptedRepair.backupFile=retainRepairCandidate({dataDir:cfg.resolved.dataDir,slug:item.slug,file,stagedFile:item.stagedFile});
          item.repairStarted=true;
          if(item.kind==='new' && readJson(path.join(cfg.resolved.dataDir,'backlog.json'),{topics:[]}).topics.some(t=>t.slug===item.slug))setStatus(item.slug,'writing');
          results.push({slug:item.slug,status:'release_repair_started',detail:'слот исправления зарезервирован; повторный отказ ведёт в карантин'});
        }
      }
    }
    if (!item.recheckFailed && item.kind === 'rewrite' && item.stagedFile) {
      const publishedFile = resolveArticleFile(item.slug);
      if (publishedFile) item = lateCorrectionPriority({ item,
        publishedBody: parseFrontmatter(readFileSync(publishedFile, 'utf8')).body,
        candidateBody: parseFrontmatter(readFileSync(file, 'utf8')).body,
        evidence: readJson(path.join(cfg.resolved.dataDir, 'fact-corrections', `${item.slug}.json`), null),
        maxAgeDays: cfg.gates.sourceMaxAgeDays ?? 180 });
    }
    if(!item.repairStarted)waiting.push({ ...item, file, waiting: true });
  }
  const { release, wait } = allocateReleases({ waiting: waiting.filter(i => !i.recheckFailed), accepted, alreadyToday: todaySlugs.length, maxPerDay, calendar });
  wait.push(...waiting.filter(i => i.recheckFailed));
  const releasedSlugs = [];

  for (const item of release) {
    const file = item.file || resolveArticleFile(item.slug);
    if (!file) {
      results.push({ slug: item.slug, status: 'release_missing', detail: 'файл ожидающей статьи не найден, снято с очереди' });
      continue;
    }
    if (!dry) {publish(file, item);if(item.stagedFile)promoteQueuedRewrite({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,...item});}
    releasedSlugs.push(item.slug);
    if(!dry && item.kind==='rewrite')forgetPublishedRewrite({dataDir:cfg.resolved.dataDir,slug:item.slug});
    if(!dry && item.waiting && item.kind==='new' && readJson(path.join(cfg.resolved.dataDir,'backlog.json'),{topics:[]}).topics.some(t=>t.slug===item.slug))setStatus(item.slug,'released');
    if (item.waiting) {
      state.counters.published += 1; // работа была закрыта ранее
      if (!String(item.acceptedAt || '').startsWith(day.slice(0, 7))) {
        state.counters[item.kind === 'rewrite' ? 'rewrite' : 'new'] += 1;
      }
      results.push({ slug: item.slug, status: 'published', score: item.score, detail: 'из очереди ожидания' });
    } else {
      const finished = done(state, { slug: item.slug, score: item.score, published: true });
      Object.assign(state, finished.state);
      if (item.kind === 'new' && (!item.order?.acceptedRepair || readJson(path.join(cfg.resolved.dataDir,'backlog.json'),{topics:[]}).topics.some(t=>t.slug===item.slug))) setStatus(item.slug, 'released');
      if (item.kind === 'rewrite') markRewritten(item.slug);
      results.push({ slug: item.slug, status: 'published', score: item.score });
    }
  }

  for (const item of wait) {
    if (item.waiting) continue; // уже в очереди и уже удержан
    const file = item.file || resolveArticleFile(item.slug);
    if (!dry && file) {hold(file, 'accepted_waiting_release');if(item.kind==='rewrite')item.stagedFile=stageQueuedRewrite({blog:cfg.resolved.blog,dataDir:cfg.resolved.dataDir,slug:item.slug,file});}
    const finished = done(state, { slug: item.slug, score: item.score, published: false });
    Object.assign(state, finished.state);
    // Работа по рерайту завершена и принята; отложен только выпуск.
    // Резервацию снимаем, иначе очередь считает его выданным навсегда.
    if (item.kind === 'rewrite') markRewritten(item.slug);
    if (item.kind === 'new' && readJson(path.join(cfg.resolved.dataDir,'backlog.json'),{topics:[]}).topics.some(t=>t.slug===item.slug)) setStatus(item.slug,'accepted_waiting_release');
    results.push({ slug: item.slug, status: 'accepted_waiting_release', score: item.score });
  }

  // Перелинковка — последним шагом: новые статьи уже в корпусе, и граф
  // пересчитывается с ними, а не без них.
  const links = applyLinks({ dry });

  // Проверяем окончательный корпус после выпуска и перелинковки.
  const hasReleases = releasedSlugs.length > 0 || links.inserted > 0;
  const manifestBeforeBuild = orders.runId ? readRun(orders.runId) : null;
  const pendingDeliveredBuild = (manifestBeforeBuild?.stages.written?.delivered || 0) > 0 && !manifestBeforeBuild.stages.built && !manifestBeforeBuild.stages.committed;
  const needsBuild = hasReleases || accepted.length > 0 || pendingDeliveredBuild;
  let buildEvidence = { checked: false, reason: dry ? 'dry-run' : needsBuild ? 'build-check-disabled' : 'no-content-work' };
  if (!dry && needsBuild && (cfg.security?.buildCheck === true || process.env.AUTOPILOT_BUILD === '1')) {
    const corpusHash = createHash('sha256');
    for (const article of loadArticles({ includeDrafts: true }).sort((a, b) => a.path.localeCompare(b.path))) {
      const bytes = readFileSync(article.path);
      corpusHash.update(path.relative(cfg.resolved.blog, article.path));
      corpusHash.update('\0' + bytes.length + '\0');
      corpusHash.update(bytes);
    }
    const build = runSiteBuild({ contentRoot: cfg.resolved.contentRoot });
    if (!build.ok) {
      const tail = String(build.stderr || '').split('\n').slice(-5).join('\n');
      throw new Error(`build принимающего сайта не прошёл (AP-P0-16): ${build.error || `код ${build.code}`}${tail ? `\n${tail}` : ''}`);
    }
    buildEvidence = { checked: true, ok: true, code: build.code, at: new Date().toISOString(), corpusSha256: corpusHash.digest('hex'), scope: 'blog Markdown/MDX bytes at build start' };
  }


  // Манифест прохода (AP-P0-11): стадия `gated` фиксируется до записи счётчиков.
  // Если наряд принадлежит проходу, а манифест потерян — это испорченное
  // состояние, приёмка останавливается (fail-closed).
  let runStage = null;
  if (!dry && orders.runId) {
    if (!readRun(orders.runId)) {
      throw new Error(`Нет манифеста прохода ${orders.runId}; наряды повреждены, приёмка остановлена`);
    }
    const staged = setStage(orders.runId, 'gated', {
      ...(cfg.throughput.monthlyRewriteTarget !== undefined ? { publicationCapacity: publicationCapacity({ config: cfg, publishLog: { ...publishLog, days: { ...publishLog.days, [day]: [...todaySlugs, ...releasedSlugs] }, kinds: { ...(publishLog.kinds || {}), [day]: { ...(publishLog.kinds?.[day] || {}), ...Object.fromEntries(release.filter(item => releasedSlugs.includes(item.slug)).map(item => [item.slug, item.kind])) } } } }) } : {}),
      published: releasedSlugs.length,
      acceptedWaiting: wait.length,
      results: results.map(r=>({...r})),
      links: {linksInserted:links.inserted,orphansBefore:links.orphansBefore,orphansAfter:links.orphansAfter},
    });
    runStage = staged.changed ? 'set' : 'already';
    if (buildEvidence.checked) setStage(orders.runId, 'built', buildEvidence);
  }

  if (!dry) {
    publishLog.days[day] = [...todaySlugs, ...releasedSlugs];
    publishLog.kinds = prunePublishDays(publishLog.kinds || {}, day);
    publishLog.kinds[day] = { ...(publishLog.kinds[day] || {}), ...Object.fromEntries(release.filter(item => releasedSlugs.includes(item.slug)).map(item => [item.slug, item.kind])) };
    writeJson(PUBLISH_LOG_FILE, publishLog);
    writeJson(RELEASE_FILE, { generatedAt: day, items: wait.map((i) => ({ slug: i.slug, kind: i.kind, score: i.score, acceptedAt: i.acceptedAt, ...(i.factualCorrection === true ? { factualCorrection: true } : {}), ...(i.stagedFile ? {stagedFile:i.stagedFile} : {}) })) });
    saveState(state);
  }

  const report = {
    date: day,
    dry,
    runId: orders.runId || null,
    runStage,
    build: buildEvidence,
    results,
    published: releasedSlugs.length,
    acceptedWaiting: wait.length,
    rejected: results.filter((r) => r.status === 'rejected').length,
    quarantined: results.filter((r) => r.status === 'quarantined').length,
    infraMissing: results.filter((r) => r.status === 'infra_missing').length,
    infraReleased: results.filter((r) => r.status === 'infra_released').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    linksInserted: links.inserted,
    orphansBefore: links.orphansBefore,
    orphansAfter: links.orphansAfter,
    month: capacity(state, new Date(), cfg, wait),
  };
  if (!dry) writeJson(path.join(cfg.resolved.dataDir, `report-${day}.json`), report);
  return report;
}

/** Оставить в журнале публикаций только последние 30 дней. */
function prunePublishDays(days, todayStr) {
  const cutoff = new Date(todayStr);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const limit = cutoff.toISOString().slice(0, 10);
  const out = {};
  for (const [date, slugs] of Object.entries(days)) {
    if (date >= limit) out[date] = slugs;
  }
  return out;
}

/**
 * Тема, ушедшая в карантин, снимается с бэклога. Иначе она навсегда остаётся
 * в статусе writing: занимает место в запасе тем, попадает в индекс дублей и
 * блокирует сама себя при следующей генерации.
 */
function retireTopic(order) {
  if (order.kind !== 'new') return;
  try {
    setStatus(order.slug, 'dropped', { dropReason: 'карантин после двух неудач' });
  } catch {
    // Темы может не быть в бэклоге — например, наряд был на рерайт. Не повод
    // ронять приёмку остальных.
  }
}

/**
 * Инфраструктурный отказ (нет файла от исполнителя): тема возвращается в план,
 * чтобы её можно было выдать снова, когда исполнитель появится. Слот уже
 * освобождён в `state.fail`.
 */
function releaseTopic(order) {
  if (order.kind !== 'new') return;
  try {
    setStatus(order.slug, 'planned', { releasedReason: 'исполнитель не создал файл; возврат в очередь' });
  } catch {
    // Рерайты и темы, которых нет в бэклоге, отпускаются plan.reconcile.
  }
}

function resolveArticleFile(slug) {
  for (const ext of ['.md', '.mdx']) {
    const candidate = path.join(cfg.resolved.blog, `${slug}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Пометить завёрнутый черновик как удержанный автопилотом.
 *
 * Без этого маркера гейты декоративны: в принимающем репозитории работает
 * auto-publish.yml, который четыре раза в сутки берёт старейший файл с
 * `draft: true` и снимает флаг вообще без проверок. Статья, которую гейт
 * только что завернул, ушла бы в публикацию через несколько часов — и именно
 * та, что не прошла проверку. Публикатор такие файлы пропускает по полю
 * `autopilotHold`.
 */
function hold(file, reason) {
  const article = loadArticles().find((a) => a.path === file);
  if (!article) return;
  let fm = setFrontmatterField(article.fm, 'autopilotHold', true);
  fm = setFrontmatterField(fm, 'autopilotHoldReason', reason);
  // publish.draftOnFail: завёрнутый текст не должен оставаться опубликованным.
  // Для рерайта это критично — статья уже была в индексе, и неудачная правка
  // обязана вернуть её в черновики, а не оставить в выдаче.
  if (cfg.publish.draftOnFail) fm = setFrontmatterField(fm, 'draft', true);
  writeArticle(article, { fm });
}

/** Публикация: снять draft и проставить даты. Больше ничего. */
function publish(file, order) {
  const articles = loadArticles();
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  const article = articles.find((a) => a.path === file) || { ...parsed, path: file, fm: parsed.raw };
  if (!article.fm) throw new Error('Missing article frontmatter');
  let fm = article.fm;
  // Со второго захода статья приходит с маркером удержания — снимаем его,
  // иначе прошедший гейты текст останется невидимым для публикатора.
  fm = removeFrontmatterField(fm, 'autopilotHold');
  fm = removeFrontmatterField(fm, 'autopilotHoldReason');
  if (cfg.publish.autoPublish) fm = setFrontmatterField(fm, 'draft', false);
  if (order.kind === 'rewrite') {
    fm = setFrontmatterField(fm, 'updatedDate', today());
    const review = new Date();
    review.setUTCDate(review.getUTCDate() + cfg.rewrite.staleAfterDays);
    fm = setFrontmatterField(fm, 'reviewDate', review.toISOString().slice(0, 10));
  }
  writeArticle(article, { fm });
}

function main() {
  const cmd = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  const json = args.json !== undefined;

  // Машинный конверт (AP-P1-14): при ошибке scheduler получает `category` и
  // стабильный exit code, а не стек и русский текст.
  try {
    if (cmd === 'plan') {
      const payload = plan({ correctionsOnly: args['corrections-only'] !== undefined });
      const out = envelope({ ok: true, ...payload, category: 'ok', exitCode: 0 });
      if (json) {
        console.log(JSON.stringify(out, null, 2));
        return;
      }
      const retries = payload.orders.filter((o) => o.retry).length;
      console.log(
        `План на ${payload.date}: нарядов ${payload.orders.length}` +
          (retries ? ` (из них повторных ${retries})` : '') +
          ` — норма дня ${payload.capacity.todayTarget}, долг ${payload.capacity.debt}`,
      );
      for (const order of payload.orders) {
        console.log(`   [${order.kind}${order.retry ? ', повтор' : ''}] ${order.slug}`);
        console.log(`      ${order.title}`);
        if (order.kind === 'rewrite') console.log(`      причины: ${order.reasons.join('; ')}`);
        if (order.dedupe?.verdict === 'warn') console.log(`      ⚠ ${order.dedupe.advice}`);
      }
      if (payload.skipped.length) console.log(`Пропущено: ${payload.skipped.map((s) => s.slug).join(', ')}`);
      return;
    }

    if (cmd === 'settle') {
      const report = settle({ dry: args.dry !== undefined });
      const out = envelope({ ok: true, ...report, category: 'ok', exitCode: 0 });
      if (json) {
        console.log(JSON.stringify(out, null, 2));
        return;
      }
      console.log(
        `${report.dry ? '[dry] ' : ''}Приёмка ${report.date}: опубликовано ${report.published}, ` +
          `в ожидании выпуска ${report.acceptedWaiting}, отклонено ${report.rejected}, ` +
          `инфра-пропусков ${report.infraMissing + report.infraReleased}, в карантин ${report.quarantined}, ` +
          `ссылок вставлено ${report.linksInserted}, сирот ${report.orphansBefore} → ${report.orphansAfter}`,
      );
      for (const r of report.results) {
        if (r.status !== 'published') console.log(`   ${r.status}: ${r.slug} — ${r.detail}`);
      }
      console.log(`Новые принятые материалы за месяц: ${report.month.done}/${report.month.monthlyTarget}`);
      if (report.month.byKind) console.log(`Обновления: ${report.month.byKind.rewrite.done}/${report.month.byKind.rewrite.target}`);
      return;
    }

    if (cmd === 'report') {
      const state = readState();
      console.log(JSON.stringify(envelope({ ok: true, category: 'ok', exitCode: 0, capacity: capacity(state), quarantine: state.quarantine, history: state.history }), null, 2));
      return;
    }

    console.log('Использование: pipeline.mjs plan|settle|report');
    process.exit(EXIT.usage);
  } catch (error) {
    const { category, exitCode } = classifyError(error);
    if (json) {
      console.log(JSON.stringify(envelope({ ok: false, category, exitCode, error: error.message }), null, 2));
    } else {
      console.error(`${category}: ${error.message}`);
    }
    process.exit(exitCode);
  }
}

if (isMain(import.meta.url)) main();
