#!/usr/bin/env node
/**
 * Auditoria automática de consistência entre o código do frontend/servidor
 * e o schema real do Supabase (extraído de src/integrations/supabase/types.ts,
 * que é regenerado pelo Supabase CLI e reflete o banco atualmente conectado).
 *
 * Detecta:
 *   - .from('<tabela|view>') apontando para nomes que não existem no schema
 *   - .rpc('<fn>') apontando para funções que não existem
 *   - Colunas usadas em .select() / .eq() / .order() / .update() etc.
 *     que não existem na tabela ou view referida
 *   - Enums referenciados via Database["public"]["Enums"]["x"] inexistentes
 *   - Objetos do schema (tabelas/views/rpcs/enums) sem nenhuma referência
 *     no código (potencial código morto ou tabela órfã)
 *
 * Uso:
 *   node scripts/audits/schema-consistency.mjs
 *   node scripts/audits/schema-consistency.mjs --json
 *   node scripts/audits/schema-consistency.mjs --fail-on-error   # exit 1 se houver refs inexistentes
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const TYPES_PATH = path.join(ROOT, "src/integrations/supabase/types.ts");
const SCAN_DIRS = ["src", "supabase/functions"].map((d) => path.join(ROOT, d));
const IGNORE_DIR_NAMES = new Set(["node_modules", ".git", "dist", "build", ".vite", ".tanstack"]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORE_FILES = new Set([
  "types.ts",
  "types.extra.ts",
  "client.ts",
  "client.server.ts",
  "auth-attacher.ts",
  "auth-middleware.ts",
]);

const args = process.argv.slice(2);
const OUT_JSON = args.includes("--json");
const FAIL_ON_ERROR = args.includes("--fail-on-error");

// ---------- schema parser ----------------------------------------------------
function parseSchema(source) {
  const schema = {
    tables: new Map(), // name -> Set(columns)
    views: new Map(),
    functions: new Set(),
    enums: new Set(),
  };

  // Find the "public: {" block.
  const publicIdx = source.indexOf("public: {");
  if (publicIdx < 0) throw new Error("public schema block not found");

  const sections = ["Tables", "Views", "Functions", "Enums"];
  const sectionRanges = {};
  for (const s of sections) {
    const re = new RegExp(`\\n\\s{4}${s}: \\{`);
    const m = re.exec(source.slice(publicIdx));
    if (m) sectionRanges[s] = publicIdx + m.index + m[0].length;
  }

  // helper: from a start index, collect top-level identifier keys at column 7 (6 spaces).
  function collectTopKeys(start, indent) {
    const keys = [];
    const re = new RegExp(`\\n {${indent}}([a-zA-Z_][a-zA-Z0-9_]*): \\{`, "g");
    re.lastIndex = start;
    let m;
    // Stop when we dedent back to 4 spaces closing brace of section.
    const endRe = new RegExp(`\\n {4}\\}`, "g");
    endRe.lastIndex = start;
    const endMatch = endRe.exec(source);
    const endIdx = endMatch ? endMatch.index : source.length;
    while ((m = re.exec(source)) && m.index < endIdx) {
      keys.push({ name: m[1], at: m.index + m[0].length });
    }
    return { keys, endIdx };
  }

  // Tables & Views: parse Row: { col: type; ... }
  function parseRelation(startIdx, endIdx) {
    const cols = new Set();
    const rowRe = /\n\s+Row: \{([\s\S]*?)\n\s+\}/;
    const m = rowRe.exec(source.slice(startIdx, endIdx));
    if (!m) return cols;
    const body = m[1];
    const colRe = /\n\s+([a-zA-Z_][a-zA-Z0-9_]*)(\??):/g;
    let c;
    while ((c = colRe.exec(body))) cols.add(c[1]);
    return cols;
  }

  for (const kind of ["Tables", "Views"]) {
    if (!sectionRanges[kind]) continue;
    const { keys, endIdx } = collectTopKeys(sectionRanges[kind], 6);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const nextAt = i + 1 < keys.length ? keys[i + 1].at : endIdx;
      const cols = parseRelation(k.at, nextAt);
      const bucket = kind === "Tables" ? schema.tables : schema.views;
      bucket.set(k.name, cols);
    }
  }

  if (sectionRanges.Functions) {
    const { keys } = collectTopKeys(sectionRanges.Functions, 6);
    for (const k of keys) schema.functions.add(k.name);
  }
  if (sectionRanges.Enums) {
    const { keys } = collectTopKeys(sectionRanges.Enums, 6);
    for (const k of keys) schema.enums.add(k.name);
  }
  return schema;
}

// ---------- code scanner -----------------------------------------------------
function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (IGNORE_DIR_NAMES.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && CODE_EXT.has(path.extname(e.name)) && !IGNORE_FILES.has(e.name)) yield p;
  }
}

function scanFile(file) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  const usages = {
    from: [], // { name, line, chained: [{op, args}] }
    rpc: [],
    enums: [],
  };

  const lineOf = (idx) => src.slice(0, idx).split("\n").length;

  const fromRe = /\.from\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]\s*\)/g;
  let m;
  while ((m = fromRe.exec(src))) {
    const name = m[1];
    const line = lineOf(m.index);
    // Grab a window after the .from(...) to sniff column-referencing methods.
    const tail = src.slice(m.index, m.index + 1200);
    const chained = [];
    const chainRe = /\.(select|eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|order|update|insert|upsert|match)\(\s*(["'`])([^`'"]*?)\2/g;
    let c;
    while ((c = chainRe.exec(tail))) {
      chained.push({ op: c[1], arg: c[3] });
    }
    usages.from.push({ name, line, chained });
  }

  const rpcRe = /\.rpc\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]/g;
  while ((m = rpcRe.exec(src))) {
    usages.rpc.push({ name: m[1], line: lineOf(m.index) });
  }

  const enumRe = /Database\[\s*["']public["']\s*\]\[\s*["']Enums["']\s*\]\[\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*\]/g;
  while ((m = enumRe.exec(src))) {
    usages.enums.push({ name: m[1], line: lineOf(m.index) });
  }

  return { file: rel, ...usages };
}

// ---------- audit ------------------------------------------------------------
function auditColumns(from, schema) {
  // Only validate simple, comma-separated column lists on select/order/eq/etc.
  // Skip anything with parentheses (foreign-table joins), '*', or 'count'.
  const relCols =
    schema.tables.get(from.name) || schema.views.get(from.name) || null;
  if (!relCols) return [];
  const bad = [];
  for (const c of from.chained) {
    if (c.op === "select") {
      const arg = c.arg.trim();
      if (!arg || arg === "*" || arg.includes("(") || arg.includes(":")) continue;
      for (const col of arg.split(",")) {
        const name = col.trim().replace(/^!?/, "").split("::")[0].split("->")[0].trim();
        if (!name || name === "*" || name === "count") continue;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue;
        if (!relCols.has(name)) bad.push({ op: "select", col: name });
      }
    } else {
      // single-column ops
      const name = c.arg.trim().split(",")[0].trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue;
      if (name === "count") continue;
      if (!relCols.has(name)) bad.push({ op: c.op, col: name });
    }
  }
  return bad;
}

function run() {
  if (!fs.existsSync(TYPES_PATH)) {
    console.error(`Types file not found: ${TYPES_PATH}`);
    process.exit(2);
  }
  const schema = parseSchema(fs.readFileSync(TYPES_PATH, "utf8"));

  const files = [];
  for (const d of SCAN_DIRS) for (const f of walk(d)) files.push(f);

  const missingRelations = []; // .from() to unknown table/view
  const missingRpcs = [];
  const missingEnums = [];
  const badColumns = [];
  const usedRelations = new Set();
  const usedRpcs = new Set();
  const usedEnums = new Set();

  for (const f of files) {
    const u = scanFile(f);
    for (const x of u.from) {
      const known = schema.tables.has(x.name) || schema.views.has(x.name);
      if (!known) missingRelations.push({ file: u.file, line: x.line, name: x.name });
      else {
        usedRelations.add(x.name);
        const bad = auditColumns(x, schema);
        for (const b of bad)
          badColumns.push({ file: u.file, line: x.line, relation: x.name, ...b });
      }
    }
    for (const x of u.rpc) {
      if (!schema.functions.has(x.name)) missingRpcs.push({ file: u.file, line: x.line, name: x.name });
      else usedRpcs.add(x.name);
    }
    for (const x of u.enums) {
      if (!schema.enums.has(x.name)) missingEnums.push({ file: u.file, line: x.line, name: x.name });
      else usedEnums.add(x.name);
    }
  }

  const unusedTables = [...schema.tables.keys()].filter((t) => !usedRelations.has(t)).sort();
  const unusedViews = [...schema.views.keys()].filter((t) => !usedRelations.has(t)).sort();
  const unusedRpcs = [...schema.functions].filter((t) => !usedRpcs.has(t)).sort();
  const unusedEnums = [...schema.enums].filter((t) => !usedEnums.has(t)).sort();

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      typesFile: path.relative(ROOT, TYPES_PATH),
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      supabaseProject: process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID || null,
    },
    schemaCounts: {
      tables: schema.tables.size,
      views: schema.views.size,
      functions: schema.functions.size,
      enums: schema.enums.size,
    },
    errors: {
      missingRelations,
      missingRpcs,
      missingEnums,
      badColumns,
    },
    warnings: {
      unusedTables,
      unusedViews,
      unusedRpcs,
      unusedEnums,
    },
  };

  const outDir = path.join(ROOT, "scripts/audits/out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "schema-consistency.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "schema-consistency.md"), toMarkdown(report));

  if (OUT_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  const errorCount =
    missingRelations.length + missingRpcs.length + missingEnums.length + badColumns.length;
  if (FAIL_ON_ERROR && errorCount > 0) process.exit(1);
}

function printHuman(r) {
  const c = r.errors;
  console.log(`\n📋 Auditoria de consistência schema ↔ código`);
  console.log(`   Schema: ${r.schemaCounts.tables} tabelas · ${r.schemaCounts.views} views · ${r.schemaCounts.functions} funções · ${r.schemaCounts.enums} enums`);
  console.log(`   Fonte: ${r.source.typesFile}`);
  if (r.source.supabaseUrl) console.log(`   Supabase: ${r.source.supabaseUrl}`);
  const totalErr = c.missingRelations.length + c.missingRpcs.length + c.missingEnums.length + c.badColumns.length;
  console.log(`\n❌ Erros: ${totalErr}`);
  section("Tabelas/views inexistentes", c.missingRelations, (x) => `${x.file}:${x.line}  →  .from("${x.name}")`);
  section("RPCs inexistentes", c.missingRpcs, (x) => `${x.file}:${x.line}  →  .rpc("${x.name}")`);
  section("Enums inexistentes", c.missingEnums, (x) => `${x.file}:${x.line}  →  Enums["${x.name}"]`);
  section("Colunas inexistentes", c.badColumns, (x) => `${x.file}:${x.line}  →  ${x.relation}.${x.col} (via .${x.op})`);
  const w = r.warnings;
  console.log(`\n⚠️  Sem referências no código:`);
  console.log(`   ${w.unusedTables.length} tabelas, ${w.unusedViews.length} views, ${w.unusedRpcs.length} funções, ${w.unusedEnums.length} enums`);
  console.log(`\n📄 Relatórios: scripts/audits/out/schema-consistency.{json,md}\n`);
}

function section(title, items, fmt) {
  if (!items.length) return;
  console.log(`\n  ${title} (${items.length}):`);
  for (const i of items.slice(0, 40)) console.log(`    • ${fmt(i)}`);
  if (items.length > 40) console.log(`    … +${items.length - 40} outros (ver relatório)`);
}

function toMarkdown(r) {
  const lines = [];
  lines.push(`# Auditoria de consistência — código ↔ schema Supabase`);
  lines.push(`Gerado em ${r.generatedAt}`);
  if (r.source.supabaseUrl) lines.push(`Supabase: \`${r.source.supabaseUrl}\``);
  lines.push(`Fonte do schema: \`${r.source.typesFile}\``);
  lines.push(``);
  lines.push(`## Totais no schema`);
  lines.push(`- Tabelas: ${r.schemaCounts.tables}`);
  lines.push(`- Views: ${r.schemaCounts.views}`);
  lines.push(`- Funções (RPC): ${r.schemaCounts.functions}`);
  lines.push(`- Enums: ${r.schemaCounts.enums}`);
  lines.push(``);
  const c = r.errors;
  lines.push(`## ❌ Erros`);
  mdList(lines, "Tabelas/views usadas no código mas ausentes do schema", c.missingRelations,
    (x) => `\`${x.file}:${x.line}\` → \`.from("${x.name}")\``);
  mdList(lines, "RPCs ausentes", c.missingRpcs,
    (x) => `\`${x.file}:${x.line}\` → \`.rpc("${x.name}")\``);
  mdList(lines, "Enums ausentes", c.missingEnums,
    (x) => `\`${x.file}:${x.line}\` → \`Enums["${x.name}"]\``);
  mdList(lines, "Colunas ausentes", c.badColumns,
    (x) => `\`${x.file}:${x.line}\` → \`${x.relation}.${x.col}\` (\`.${x.op}\`)`);
  const w = r.warnings;
  lines.push(`\n## ⚠️ Objetos do schema sem uso no código`);
  mdList(lines, "Tabelas", w.unusedTables, (n) => `\`${n}\``);
  mdList(lines, "Views", w.unusedViews, (n) => `\`${n}\``);
  mdList(lines, "Funções", w.unusedRpcs, (n) => `\`${n}\``);
  mdList(lines, "Enums", w.unusedEnums, (n) => `\`${n}\``);
  return lines.join("\n") + "\n";
}

function mdList(lines, title, items, fmt) {
  lines.push(`\n### ${title} (${items.length})`);
  if (!items.length) { lines.push(`_Nenhum._`); return; }
  for (const i of items) lines.push(`- ${fmt(i)}`);
}

run();