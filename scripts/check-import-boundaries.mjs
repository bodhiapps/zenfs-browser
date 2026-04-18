#!/usr/bin/env node
// check-import-boundaries.mjs
// CI guardrail: substring-match imports in the three layers against their
// forbidden-imports lists. Runs independently of ESLint so a broken eslint
// config (or a forgotten lint step) can't let boundary violations land.
//
// See ai-docs/karpathy-llm-wiki/01-architecture-mapping.md for the layer
// contracts this enforces.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const LAYERS = [
  {
    name: "agent-kit",
    dir: "src/agent-kit",
    forbidden: [
      { match: /(^|[^\w])from\s+["']react["']/, label: "react" },
      { match: /from\s+["']react-dom["']/, label: "react-dom" },
      { match: /from\s+["']react\//, label: "react/*" },
      { match: /from\s+["']@zenfs\//, label: "@zenfs/*" },
      { match: /from\s+["']dexie["']/, label: "dexie" },
      { match: /from\s+["']@bodhiapp\//, label: "@bodhiapp/*" },
      { match: /from\s+["']@\/adapters\//, label: "@/adapters/*" },
      { match: /from\s+["']@\/chat-ui\//, label: "@/chat-ui/*" },
      { match: /from\s+["'](?:\.\.\/)+adapters\//, label: "../adapters/" },
      { match: /from\s+["'](?:\.\.\/)+chat-ui\//, label: "../chat-ui/" },
    ],
  },
  {
    name: "chat-ui",
    dir: "src/chat-ui",
    forbidden: [
      { match: /from\s+["']@\/adapters\//, label: "@/adapters/*" },
      { match: /from\s+["'](?:\.\.\/)+adapters\//, label: "../adapters/" },
      { match: /from\s+["']@zenfs\//, label: "@zenfs/*" },
      { match: /from\s+["']dexie["']/, label: "dexie" },
    ],
  },
  {
    name: "adapters/browser",
    dir: "src/adapters",
    forbidden: [
      { match: /from\s+["']@\/chat-ui\//, label: "@/chat-ui/*" },
      { match: /from\s+["'](?:\.\.\/)+chat-ui\//, label: "../chat-ui/" },
    ],
  },
];

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return out;
    throw err;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function lineNumber(source, index) {
  let n = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") n++;
  }
  return n;
}

async function scanLayer(layer) {
  const abs = join(ROOT, layer.dir);
  const files = await walk(abs);
  const violations = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const rule of layer.forbidden) {
      rule.match.lastIndex = 0;
      const m = rule.match.exec(source);
      if (m) {
        violations.push({
          file: relative(ROOT, file),
          line: lineNumber(source, m.index),
          rule: rule.label,
          snippet: source.slice(m.index, m.index + 80).split("\n")[0],
        });
      }
    }
  }
  return violations;
}

async function main() {
  const allViolations = [];
  for (const layer of LAYERS) {
    const v = await scanLayer(layer);
    for (const x of v) allViolations.push({ layer: layer.name, ...x });
  }

  if (allViolations.length === 0) {
    console.log(
      `OK: import-boundary audit passed across ${LAYERS.length} layers.`,
    );
    process.exit(0);
  }

  console.error(
    `FAIL: ${allViolations.length} forbidden import(s) across layers:`,
  );
  for (const v of allViolations) {
    console.error(
      `  [${v.layer}] ${v.file}:${v.line} imports ${v.rule}`,
    );
    console.error(`    ${v.snippet}`);
  }
  console.error("");
  console.error(
    "See ai-docs/karpathy-llm-wiki/01-architecture-mapping.md for the allowed deps per layer.",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("check-import-boundaries: unexpected error:", err);
  process.exit(2);
});
