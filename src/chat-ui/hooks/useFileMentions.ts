/**
 * useFileMentions — build a searchable list of files in the mounted vault for
 * the @-mention popup.
 *
 * Walks the FileSystemProvider recursively (lazy, cache-on-first-use). The
 * walker is intentionally conservative:
 *   - Depth cap: MAX_DEPTH
 *   - Entry cap: MAX_ENTRIES
 *   - Ignores common noise directories (node_modules, .git, anything starting with '.')
 *
 * The hook returns a `search(query)` callback backed by Fuse.js; consumers
 * treat the list as opaque. Callers can invalidate the cache (e.g. after a
 * fs__write) via the returned `invalidate()`.
 *
 * Fuse.js is a UI concern — allowed here per our layer boundaries. agent-kit
 * stays Fuse-free.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { FileSystemProvider } from "@/agent-kit/tools/fs-provider";

const MAX_DEPTH = 6;
const MAX_ENTRIES = 2000;
const MAX_RESULTS = 20;
const IGNORE_NAMES = new Set(["node_modules", ".git"]);

export interface UseFileMentionsResult {
  files: string[];
  search: (query: string) => string[];
  invalidate: () => void;
}

async function walkVault(
  fs: FileSystemProvider,
): Promise<string[]> {
  const files: string[] = [];
  interface QueueItem {
    absPath: string;
    relPath: string;
    depth: number;
  }
  const queue: QueueItem[] = [
    { absPath: fs.cwd, relPath: "", depth: 0 },
  ];
  while (queue.length > 0 && files.length < MAX_ENTRIES) {
    const { absPath, relPath, depth } = queue.shift()!;
    let entries: string[];
    try {
      entries = await fs.readdir(absPath);
    } catch {
      continue;
    }
    entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    for (const name of entries) {
      if (files.length >= MAX_ENTRIES) break;
      if (name.startsWith(".")) continue;
      if (IGNORE_NAMES.has(name)) continue;
      const childRel = relPath ? `${relPath}/${name}` : name;
      const childAbs = `${absPath}/${name}`.replace(/\/+/g, "/");
      let isDir = false;
      try {
        isDir = await fs.isDirectory(childAbs);
      } catch {
        continue;
      }
      if (isDir) {
        if (depth + 1 < MAX_DEPTH) {
          queue.push({
            absPath: childAbs,
            relPath: childRel,
            depth: depth + 1,
          });
        }
      } else {
        files.push(childRel);
      }
    }
  }
  return files;
}

export function useFileMentions(
  fsProvider: FileSystemProvider | null,
): UseFileMentionsResult {
  const [files, setFiles] = useState<string[]>([]);
  const [trackedProvider, setTrackedProvider] = useState<FileSystemProvider | null>(fsProvider);
  const [version, setVersion] = useState(0);

  // Adjust state during render when the provider changes — the React-recommended
  // pattern for resetting derived state without an effect.
  if (fsProvider !== trackedProvider) {
    setTrackedProvider(fsProvider);
    setFiles([]);
  }

  useEffect(() => {
    if (!fsProvider) return;
    let cancelled = false;
    void walkVault(fsProvider).then((list) => {
      if (!cancelled) setFiles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [fsProvider, version]);

  const fuse = useMemo(() => {
    if (files.length === 0) return null;
    return new Fuse(files, {
      includeScore: false,
      threshold: 0.4,
      ignoreLocation: true,
      keys: [
        // Single identity key: the path string itself.
        { name: "path", getFn: (s: string) => s },
      ],
    });
  }, [files]);

  const invalidate = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const search = useCallback(
    (query: string): string[] => {
      const q = (query ?? "").trim();
      if (!q) return files.slice(0, MAX_RESULTS);
      if (!fuse) return [];
      return fuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item);
    },
    [files, fuse],
  );

  return { files, search, invalidate };
}
