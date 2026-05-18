#!/usr/bin/env node
// Семантические embeddings всех опубликованных статей.
// Источник смысла: title + description + первые 800 слов тела + seo.keywords.
// Провайдер: Jina AI (jina-embeddings-v3, multilingual, 1024 dim, бесплатно 1M
// токенов/мес) — нужен JINA_API_KEY. Альтернатива: OpenAI text-embedding-3-small
// (1536 dim) при OPENAI_API_KEY.
//
// Результат: src/data/audit/embeddings.json
// { provider, model, dim, generatedAt, articles: [{slug, title, vector}] }

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BLOG_DIR = join(ROOT, "src", "content", "blog");
const OUT_DIR = join(ROOT, "src", "data", "audit");
const OUT_FILE = join(OUT_DIR, "embeddings.json");

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return m ? { fm: m[1], body: md.slice(m[0].length) } : { fm: "", body: md };
}

function getField(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
  return m ? m[1].trim() : null;
}

function getList(fm, key) {
  const re = new RegExp(`^${key}:\\s*\\n((?:\\s+- .+\\n?)+)`, "m");
  const m = fm.match(re);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function getSeoKeywords(fm) {
  const m = fm.match(/^seo:\s*\n((?:\s{2,}.+\n?)+)/m);
  if (!m) return [];
  const block = m[1];
  const km = block.match(/^\s+keywords:\s*\n((?:\s+- .+\n?)+)/m);
  if (!km) return [];
  return km[1]
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function stripMarkdown(body) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCorpus() {
  const items = [];
  for (const f of readdirSync(BLOG_DIR)) {
    if (!f.endsWith(".md") && !f.endsWith(".mdx")) continue;
    const slug = f.replace(/\.(md|mdx)$/, "");
    const raw = readFileSync(join(BLOG_DIR, f), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    if (getField(fm, "draft") === "true") continue;
    const title = getField(fm, "title") || slug;
    const description = getField(fm, "description") || "";
    const keywords = getSeoKeywords(fm);
    const tags = getList(fm, "tags");
    const categories = getList(fm, "categories");
    const plain = stripMarkdown(body);
    const head = plain.split(" ").slice(0, 800).join(" ");
    const text = [
      title,
      description,
      keywords.join(", "),
      tags.join(", "),
      categories.join(", "),
      head,
    ]
      .filter(Boolean)
      .join("\n\n");
    items.push({ slug, title, text });
  }
  return items;
}

async function embedJina(texts, model = "jina-embeddings-v3") {
  const key = process.env.JINA_API_KEY;
  if (!key) throw new Error("JINA_API_KEY не задан");
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      task: "retrieval.passage",
      dimensions: 1024,
      input: texts,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Jina ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

async function embedOpenAI(texts, model = "text-embedding-3-small") {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY не задан");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

function chooseProvider() {
  const forced = process.env.EMBEDDINGS_PROVIDER;
  if (forced === "jina") return { name: "jina", model: "jina-embeddings-v3", dim: 1024, fn: embedJina };
  if (forced === "openai")
    return { name: "openai", model: "text-embedding-3-small", dim: 1536, fn: embedOpenAI };
  if (process.env.JINA_API_KEY)
    return { name: "jina", model: "jina-embeddings-v3", dim: 1024, fn: embedJina };
  if (process.env.OPENAI_API_KEY)
    return { name: "openai", model: "text-embedding-3-small", dim: 1536, fn: embedOpenAI };
  throw new Error(
    "Нет API-ключа. Задайте JINA_API_KEY (предпочтительно, бесплатный multilingual) или OPENAI_API_KEY"
  );
}

async function main() {
  const provider = chooseProvider();
  const corpus = buildCorpus();
  console.log(`Корпус: ${corpus.length} статей. Провайдер: ${provider.name} (${provider.model}).`);

  const BATCH = provider.name === "jina" ? 32 : 64;
  const articles = [];
  for (let i = 0; i < corpus.length; i += BATCH) {
    const slice = corpus.slice(i, i + BATCH);
    const vectors = await provider.fn(slice.map((c) => c.text));
    for (let j = 0; j < slice.length; j++) {
      articles.push({ slug: slice[j].slug, title: slice[j].title, vector: vectors[j] });
    }
    console.log(`  ${Math.min(i + BATCH, corpus.length)}/${corpus.length}`);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        provider: provider.name,
        model: provider.model,
        dim: provider.dim,
        generatedAt: new Date().toISOString().slice(0, 10),
        articles,
      },
      null,
      0
    )
  );
  console.log(`✓ ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
