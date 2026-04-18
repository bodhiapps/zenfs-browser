/**
 * fs__ls — list directory contents of the mounted vault.
 *
 * Params: { path?, limit?, recursive? }
 * Result: { content: [{type:'text', text}], details: { path, entries, truncated, recursive } }
 *
 * Entries are sorted alphabetically; directories have a trailing '/'.
 * When `recursive: true`, performs a BFS walk with:
 *   - depth cap: RECURSIVE_DEPTH_CAP (4)
 *   - entry cap: RECURSIVE_ENTRY_CAP (500)
 * Recursive entries are prefixed with their path relative to the listed dir.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import type { FileSystemProvider } from "./fs-provider";
import { resolvePath, joinPath } from "./path";

const lsSchema = Type.Object({
  path: Type.Optional(
    Type.String({
      description: "Directory to list. Defaults to /vault (vault root).",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of entries to return. Default: 500.",
    }),
  ),
  recursive: Type.Optional(
    Type.Boolean({
      description:
        "If true, walk subdirectories BFS (depth<=4, entries<=500). Default: false.",
    }),
  ),
});

type LsInput = Static<typeof lsSchema>;

const DEFAULT_LIMIT = 500;
const RECURSIVE_DEPTH_CAP = 4;
const RECURSIVE_ENTRY_CAP = 500;

export function createLsTool(
  fs: FileSystemProvider,
): AgentTool<typeof lsSchema> {
  return {
    name: "fs__ls",
    label: "fs__ls",
    description:
      "List directory contents in the user's vault. Returns entries sorted " +
      "alphabetically; directories are marked with trailing '/'. Default " +
      "path: /vault. Set recursive=true for a BFS walk (depth<=4, " +
      "entries<=500); recursive entries include their relative path.",
    parameters: lsSchema,
    async execute(
      _toolCallId: string,
      { path, limit, recursive }: LsInput,
      signal?: AbortSignal,
    ) {
      if (signal?.aborted) throw new Error("Operation aborted");

      const dirPath = resolvePath(fs.cwd, path ?? ".");
      const effectiveLimit = limit ?? DEFAULT_LIMIT;

      if (!(await fs.exists(dirPath))) {
        throw new Error(`Path not found: ${dirPath}`);
      }
      if (!(await fs.isDirectory(dirPath))) {
        throw new Error(`Not a directory: ${dirPath}`);
      }

      if (recursive) {
        return await listRecursive(
          fs,
          dirPath,
          Math.min(effectiveLimit, RECURSIVE_ENTRY_CAP),
          signal,
        );
      }

      const rawEntries = await fs.readdir(dirPath);
      rawEntries.sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase()),
      );

      const entries: string[] = [];
      let truncated = false;

      for (const entry of rawEntries) {
        if (entries.length >= effectiveLimit) {
          truncated = true;
          break;
        }
        const fullPath = joinPath(dirPath, entry);
        let suffix = "";
        try {
          if (await fs.isDirectory(fullPath)) suffix = "/";
        } catch {
          continue;
        }
        entries.push(entry + suffix);
      }

      let output =
        entries.length === 0 ? "(empty directory)" : entries.join("\n");

      if (truncated) {
        output +=
          `\n\n[Limit of ${effectiveLimit} entries reached. ` +
          `Use limit=${effectiveLimit * 2} for more.]`;
      }

      return {
        content: [{ type: "text" as const, text: output }],
        details: { path: dirPath, entries, truncated, recursive: false },
      };
    },
  };
}

interface QueueItem {
  absPath: string;
  relPath: string;
  depth: number;
}

async function listRecursive(
  fs: FileSystemProvider,
  rootPath: string,
  entryCap: number,
  signal?: AbortSignal,
): Promise<{
  content: { type: "text"; text: string }[];
  details: {
    path: string;
    entries: string[];
    truncated: boolean;
    recursive: true;
  };
}> {
  const entries: string[] = [];
  const queue: QueueItem[] = [{ absPath: rootPath, relPath: "", depth: 0 }];
  let truncated = false;

  while (queue.length > 0) {
    if (signal?.aborted) throw new Error("Operation aborted");
    const { absPath, relPath, depth } = queue.shift()!;
    let rawEntries: string[];
    try {
      rawEntries = await fs.readdir(absPath);
    } catch {
      continue;
    }
    rawEntries.sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );

    for (const name of rawEntries) {
      if (entries.length >= entryCap) {
        truncated = true;
        break;
      }
      const childAbs = joinPath(absPath, name);
      const childRel = relPath ? `${relPath}/${name}` : name;
      let isDir = false;
      try {
        isDir = await fs.isDirectory(childAbs);
      } catch {
        continue;
      }
      entries.push(isDir ? `${childRel}/` : childRel);
      if (isDir && depth + 1 < RECURSIVE_DEPTH_CAP) {
        queue.push({
          absPath: childAbs,
          relPath: childRel,
          depth: depth + 1,
        });
      }
    }
    if (entries.length >= entryCap) {
      truncated = true;
      break;
    }
  }

  let output = entries.length === 0 ? "(empty directory)" : entries.join("\n");
  if (truncated) {
    output +=
      `\n\n[Recursive entry cap of ${entryCap} reached. ` +
      `Narrow the path or run non-recursively.]`;
  }

  return {
    content: [{ type: "text" as const, text: output }],
    details: { path: rootPath, entries, truncated, recursive: true as const },
  };
}
