#!/usr/bin/env node
// Просмотр манифестов проходов (AP-P0-11).
//
//   node scripts/run.mjs latest [--json]
//   node scripts/run.mjs list [--json]
//   node scripts/run.mjs show --id <runId> [--json]
import { isMain, parseArgs } from './lib/content.mjs';
import { listRuns, latestRun, readRun } from './lib/run.mjs';

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  let out;

  if (cmd === 'latest') {
    out = latestRun();
  } else if (cmd === 'list') {
    out = listRuns().slice(0, Number(args.limit || 20));
  } else if (cmd === 'show') {
    out = readRun(args.id);
    if (!out) {
      console.error(`Нет манифеста ${args.id}`);
      process.exit(1);
    }
  } else {
    console.log('Использование: run.mjs latest|list|show --id <runId> [--json]');
    process.exit(1);
  }

  if (args.json || cmd !== 'latest') {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  if (!out) {
    console.log('манифестов нет');
    return;
  }
  const stages = Object.keys(out.stages).join(' → ') || 'нет стадий';
  console.log(`${out.runId} (${out.date}, ${out.kind}): ${stages}; нарядов ${out.orders.length}`);
}

if (isMain(import.meta.url)) main();
