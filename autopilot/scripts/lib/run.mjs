// Манифест прохода и `runId` (AP-P0-11).
//
// `plan`, написание, `settle`, build и git-commit не были связаны одним
// подтверждаемым событием: повтор после частичного падения неоднозначен.
// Манифест `data/runs/<runId>.json` фиксирует стадии и позволяет однозначно
// продолжить проход, не создавая дубль статьи и не начисляя счётчик дважды.
//
// Стадии идут строго по порядку и идемпотентны: повторный вызов стадии не
// меняет манифест. `runId` дня переиспользуется, пока проход не дошёл до
// `committed`, поэтому ретрай после падения продолжает тот же проход.
import { readdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { readJson, writeJson, today } from './content.mjs';

export const STAGES = ['planned', 'written', 'gated', 'built', 'committed'];
const stageIndex = (stage) => STAGES.indexOf(stage);

const dataDir = () => loadConfig().resolved.dataDir;
export const runsDir = (dir = dataDir()) => path.join(dir, 'runs');
const runFile = (runId, dir) => path.join(runsDir(dir), `${runId}.json`);

export function newRunId(date = today()) {
  return `${date}-${randomUUID().slice(0, 8)}`;
}

function persist(dir, manifest) {
  manifest.updatedAt = new Date().toISOString();
  writeJson(runFile(manifest.runId, dir), manifest);
  return manifest;
}

export function createRun({ dir = dataDir(), date = today(), kind = 'day', orders = [], meta = {} } = {}) {
  const at = new Date().toISOString();
  const manifest = {
    runId: newRunId(date),
    date,
    kind,
    createdAt: at,
    updatedAt: at,
    stages: {},
    orders: orders.map((o) => (typeof o === 'string' ? o : o.slug)),
    history: [],
    meta,
  };
  return persist(dir, manifest);
}

export function readRun(runId, { dir = dataDir() } = {}) {
  return readJson(runFile(runId, dir), null);
}

export function listRuns({ dir = dataDir() } = {}) {
  const root = runsDir(dir);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((f) => /\.json$/.test(f))
    .map((f) => readRun(f.replace(/\.json$/, ''), { dir }))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function latestRun({ dir = dataDir() } = {}) {
  return listRuns({ dir })[0] || null;
}

/** Незавершённый проход за дату: его и продолжает ретрай. */
export function findResumableRun({ dir = dataDir(), date = today() } = {}) {
  return listRuns({ dir }).find((run) => run.date === date && !run.stages.committed) || null;
}

export function isStageDone(manifest, stage) {
  return Boolean(manifest && manifest.stages && manifest.stages[stage]);
}

/**
 * Отметить стадию. Идемпотентно: повтор возвращает `changed:false` и не
 * добавляет запись в историю. Стадии идут по порядку — более ранняя после
 * более поздней невозможна (это признак испорченного манифеста).
 */
export function setStage(runId, stage, payload = {}, { dir = dataDir() } = {}) {
  if (stageIndex(stage) === -1) throw new Error(`Неизвестная стадия: ${stage}`);
  const manifest = readRun(runId, { dir });
  if (!manifest) throw new Error(`Нет манифеста прохода ${runId}`);
  if (isStageDone(manifest, stage)) return { changed: false, manifest };

  const doneLater = STAGES.filter((s) => stageIndex(s) > stageIndex(stage) && isStageDone(manifest, s));
  if (doneLater.length) {
    throw new Error(`Стадия ${stage} позже уже отмеченной ${doneLater[0]} — манифест ${runId} испорчен`);
  }

  const at = new Date().toISOString();
  manifest.stages[stage] = { at, ...payload };
  manifest.history.push({ stage, at });
  persist(dir, manifest);
  return { changed: true, manifest };
}
