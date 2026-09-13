#!/usr/bin/env node
// Уведомления только по состояниям, требующим действия (AP-P1-15).
//
// Cron не должен присылать одно и то же сообщение каждый проход. Скрипт
// сравнивает подпись текущего здоровья с сохранённой и решает: молчать,
// сообщить о новой/сменившейся проблеме или закрыть её восстановлением.
//
//   node scripts/notify.mjs [--json]
//
// Состояние: data/notify-state.json (подпись, уровень, время).
import path from 'node:path';
import { readJson, writeJson, isMain, parseArgs } from './lib/content.mjs';
import { loadConfig } from './lib/config.mjs';
import { healthCheck } from './health-check.mjs';
import { envelope } from './lib/outcome.mjs';

const cfg = loadConfig();

/** Компактная подпись состояния: меняется только по значимым причинам. */
export function healthSignature(report, { quarantine = 0 } = {}) {
  const failed = report.checks.filter((c) => c.level === 'fail').map((c) => c.name).sort();
  return JSON.stringify({ level: report.level, failed, quarantine });
}

export function decideNotification(previous, current) {
  if (previous && previous.signature === current.signature) {
    return { notify: false, kind: 'none', message: 'состояние не изменилось' };
  }
  if (current.failed.length === 0) {
    return { notify: true, kind: 'recovery', message: 'контур восстановился: отказов нет' };
  }
  return {
    notify: true,
    kind: previous ? 'changed' : 'first',
    message: `отказы: ${current.failed.join(', ')}`,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = healthCheck();
  const stateFile = path.join(cfg.resolved.dataDir, 'notify-state.json');
  const previous = readJson(stateFile, null);
  const state = readJson(path.join(cfg.resolved.dataDir, 'autopilot.json'), { quarantine: [] });
  const signature = healthSignature(report, { quarantine: (state.quarantine || []).length });
  const failed = report.checks.filter((c) => c.level === 'fail').map((c) => c.name).sort();
  const decision = decideNotification(previous, { signature, failed, level: report.level });

  writeJson(stateFile, {
    signature,
    level: report.level,
    failed,
    at: new Date().toISOString(),
    lastNotifiedAt: decision.notify ? new Date().toISOString() : previous?.lastNotifiedAt || null,
  });

  const out = envelope({ ok: true, category: 'ok', exitCode: 0, ...decision, level: report.level });
  if (args.json) console.log(JSON.stringify(out, null, 2));
  else if (decision.notify) console.log(`${decision.kind}: ${decision.message}`);
  else console.log('уведомление не требуется');
}

if (isMain(import.meta.url)) main();
