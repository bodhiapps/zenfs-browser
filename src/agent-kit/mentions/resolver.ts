/**
 * resolveMentions — expand `@path` tokens into fenced code blocks appended to
 * the user's message text.
 *
 * Kept in agent-kit so it is portable (CLI/backend). Only dependency is the
 * FileSystemProvider port.
 *
 * Caps:
 *   - maxTotalChars: once total emitted inline content crosses this budget,
 *     further mentions are replaced with a `// @path — skipped` marker block
 *     instead of their contents. Markers still iterate so every mention gets a
 *     visible line.
 *   - maxPerFileChars: per-file truncation with a footer hinting at fs__read.
 */

import type { FileSystemProvider } from "../tools/fs-provider";
import { parseMentions } from "./parser";
import { resolvePath } from "../tools/path";

export interface ResolveMentionsOptions {
  /** Overall cap on inlined characters across all mentions. */
  maxTotalChars?: number;
  /** Per-file character cap; content beyond is truncated with a footer. */
  maxPerFileChars?: number;
}

const DEFAULT_TOTAL = 40_000;
const DEFAULT_PER_FILE = 20_000;

const EXT_TO_LANG: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  json: "json",
  md: "md",
  markdown: "md",
  py: "py",
  rs: "rs",
  go: "go",
  java: "java",
  kt: "kt",
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  css: "css",
  html: "html",
  htm: "html",
  sh: "sh",
  bash: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
  sql: "sql",
};

function inferLang(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot < 0) return "";
  const ext = path.slice(lastDot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? "";
}

export async function resolveMentions(
  fs: FileSystemProvider,
  text: string,
  options?: ResolveMentionsOptions,
): Promise<string> {
  const { mentions } = parseMentions(text);
  if (mentions.length === 0) return text;

  const maxTotal = options?.maxTotalChars ?? DEFAULT_TOTAL;
  const maxPerFile = options?.maxPerFileChars ?? DEFAULT_PER_FILE;

  const blocks: string[] = [];
  let totalChars = 0;

  for (const rawPath of mentions) {
    const abs = resolvePath(fs.cwd, rawPath);
    const lang = inferLang(rawPath);

    // Budget already exhausted — emit a marker block and continue.
    if (totalChars >= maxTotal) {
      const marker = `\`\`\`\n// @${rawPath} — skipped (context budget exceeded)\n\`\`\``;
      blocks.push(marker);
      continue;
    }

    let exists = false;
    let isDir = false;
    try {
      exists = await fs.exists(abs);
      if (exists) isDir = await fs.isDirectory(abs);
    } catch {
      exists = false;
    }

    if (!exists) {
      const marker = `\`\`\`\n// @${rawPath} — not found\n\`\`\``;
      blocks.push(marker);
      continue;
    }
    if (isDir) {
      const marker = `\`\`\`\n// @${rawPath} — is a directory (skipped)\n\`\`\``;
      blocks.push(marker);
      continue;
    }

    let content = "";
    try {
      const bytes = await fs.readFile(abs);
      content = new TextDecoder("utf-8").decode(bytes);
    } catch {
      const marker = `\`\`\`\n// @${rawPath} — could not read\n\`\`\``;
      blocks.push(marker);
      continue;
    }

    let truncated = false;
    if (content.length > maxPerFile) {
      content = content.slice(0, maxPerFile);
      truncated = true;
    }

    const header = `// @${rawPath}`;
    const body = truncated
      ? `${header}\n${content}\n... (file truncated; use fs__read to continue)`
      : `${header}\n${content}`;
    const block = lang
      ? `\`\`\`${lang}\n${body}\n\`\`\``
      : `\`\`\`\n${body}\n\`\`\``;

    // If this block would push us over the total budget, emit skip marker.
    if (totalChars + block.length > maxTotal) {
      const marker = `\`\`\`\n// @${rawPath} — skipped (context budget exceeded)\n\`\`\``;
      blocks.push(marker);
      totalChars = maxTotal; // flip future iterations into marker-only mode
      continue;
    }

    blocks.push(block);
    totalChars += block.length;
  }

  return `${text}\n\n${blocks.join("\n\n")}`;
}
