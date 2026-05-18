#!/usr/bin/env node
// Cosine similarity на embeddings.json.
// Для каждой статьи находит топ-N ближайших.
// Пороги:
//   ≥ 0.92  → возможный дубль / каннибализация (нужно слить или развести)
//   0.80–0.92 → семантически близкие (кандидаты на перелинковку / расширение)
//   < 0.80  → разные темы
//
// Артефакты:
//   src/data/audit/similarity.json    — полная матрица top-N
//   src/data/audit/similarity-report.md — markdown отчёт (только горячие пары)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IN_FILE = join(ROOT, "src", "data", "audit", "embeddings.json");
const OUT_DIR = join(ROOT, "src", "data", "audit");
const OUT_JSON = join(OUT_DIR, "similarity.json");
const OUT_MD = join(OUT_DIR, "similarity-report.md");

const TOP_N = 6;
const DUP_THRESHOLD = 0.92;
const CLOSE_THRESHOLD = 0.8;

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function main() {
  if (!existsSync(IN_FILE)) {
    console.error(`Нет ${IN_FILE}. Сначала запустите embed-articles.mjs.`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(IN_FILE, "utf8"));
  const arts = data.articles;
  console.log(`Загружено ${arts.length} embeddings (${data.provider}/${data.model}, dim=${data.dim})`);

  const matrix = arts.map((a) => ({ slug: a.slug, title: a.title, neighbors: [] }));
  for (let i = 0; i < arts.length; i++) {
    const sims = [];
    for (let j = 0; j < arts.length; j++) {
      if (i === j) continue;
      sims.push({ slug: arts[j].slug, title: arts[j].title, sim: cosine(arts[i].vector, arts[j].vector) });
    }
    sims.sort((x, y) => y.sim - x.sim);
    matrix[i].neighbors = sims.slice(0, TOP_N);
  }

  // Горячие пары — собираем уникальные (i<j) с sim ≥ CLOSE_THRESHOLD
  const seen = new Set();
  const hotPairs = [];
  for (let i = 0; i < arts.length; i++) {
    for (const n of matrix[i].neighbors) {
      if (n.sim < CLOSE_THRESHOLD) continue;
      const key = [arts[i].slug, n.slug].sort().join("||");
      if (seen.has(key)) continue;
      seen.add(key);
      hotPairs.push({ a: arts[i].slug, aTitle: arts[i].title, b: n.slug, bTitle: n.title, sim: n.sim });
    }
  }
  hotPairs.sort((x, y) => y.sim - x.sim);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString().slice(0, 10),
        provider: data.provider,
        model: data.model,
        thresholds: { dup: DUP_THRESHOLD, close: CLOSE_THRESHOLD },
        topN: TOP_N,
        matrix,
        hotPairs,
      },
      null,
      0
    )
  );

  const dups = hotPairs.filter((p) => p.sim >= DUP_THRESHOLD);
  const close = hotPairs.filter((p) => p.sim < DUP_THRESHOLD);

  const lines = [];
  lines.push(`# Семантическая похожесть статей`);
  lines.push("");
  lines.push(`Сгенерировано: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Провайдер: ${data.provider} / ${data.model} (dim=${data.dim})`);
  lines.push(`Корпус: ${arts.length} опубликованных статей.`);
  lines.push("");
  lines.push(`## Возможные дубли (cos ≥ ${DUP_THRESHOLD})`);
  lines.push("");
  if (dups.length === 0) {
    lines.push("_Не найдено._");
  } else {
    lines.push("Эти пары требуют решения: **слить**, **развести** (разные углы) или **canonical**.");
    lines.push("");
    for (const p of dups) {
      lines.push(`- **${p.sim.toFixed(3)}** — \`${p.a}\` ↔ \`${p.b}\``);
      lines.push(`  - ${p.aTitle}`);
      lines.push(`  - ${p.bTitle}`);
    }
  }
  lines.push("");
  lines.push(`## Близкие пары (${CLOSE_THRESHOLD} ≤ cos < ${DUP_THRESHOLD})`);
  lines.push("");
  if (close.length === 0) {
    lines.push("_Не найдено._");
  } else {
    lines.push("Кандидаты на взаимные ссылки и/или расширение одной из статей за счёт второй.");
    lines.push("");
    for (const p of close.slice(0, 50)) {
      lines.push(`- ${p.sim.toFixed(3)} — \`${p.a}\` ↔ \`${p.b}\``);
    }
    if (close.length > 50) lines.push(`- … и ещё ${close.length - 50} пар`);
  }
  lines.push("");
  writeFileSync(OUT_MD, lines.join("\n"));

  console.log(`✓ ${OUT_JSON}`);
  console.log(`✓ ${OUT_MD}`);
  console.log(`Дублей: ${dups.length}, близких пар: ${close.length}`);
}

main();
