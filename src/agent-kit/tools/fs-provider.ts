/**
 * FileSystemProvider — the ports interface the agent-kit tools consume.
 *
 * Implementations live in host-specific adapters:
 *   - src/adapters/browser/zenfs-fs-provider.ts (ZenFS over FSA)
 *   - Node CLI / tests can use InMemoryFsProvider below without pulling ZenFS.
 *
 * Interface shape aligned with pi-browser / karpathy-llm-wiki's contract.
 * All paths are virtual absolute paths under the provider's cwd.
 */

export interface FileSystemProvider {
  /** Virtual absolute path representing the root (e.g. "/vault"). */
  readonly cwd: string;
  /** Display name of the root directory. */
  readonly name: string;

  /** Read file contents as raw bytes. */
  readFile(absolutePath: string): Promise<Uint8Array>;
  /** Write string content; create parent directories as needed. */
  writeFile(absolutePath: string, content: string): Promise<void>;
  /** Check if a path exists (file or directory). */
  exists(absolutePath: string): Promise<boolean>;
  /** Check if a path is a directory. */
  isDirectory(absolutePath: string): Promise<boolean>;
  /** List entries in a directory (entry names only, not full paths). */
  readdir(absolutePath: string): Promise<string[]>;
  /** Create a directory (and its ancestors). Idempotent. */
  mkdir(absolutePath: string): Promise<void>;
}

/**
 * InMemoryFsProvider — zero-dependency reference implementation.
 *
 * Intended for unit tests, CLI bootstrap, and documentation examples. Stores
 * file bytes in a Map and directory markers in a Set. Deliberately small; does
 * not attempt to match every edge case of a real filesystem.
 */
export class InMemoryFsProvider implements FileSystemProvider {
  readonly cwd: string;
  readonly name: string;
  private readonly files = new Map<string, Uint8Array>();
  private readonly dirs = new Set<string>();

  constructor(options: { cwd?: string; name?: string } = {}) {
    this.cwd = options.cwd ?? "/vault";
    this.name = options.name ?? "in-memory";
    this.dirs.add(this.cwd);
  }

  async readFile(absolutePath: string): Promise<Uint8Array> {
    const bytes = this.files.get(absolutePath);
    if (bytes === undefined) {
      throw Object.assign(new Error(`ENOENT: no such file, ${absolutePath}`), {
        code: "ENOENT",
      });
    }
    return bytes;
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    const lastSlash = absolutePath.lastIndexOf("/");
    if (lastSlash > 0) {
      await this.mkdir(absolutePath.slice(0, lastSlash));
    }
    this.files.set(absolutePath, new TextEncoder().encode(content));
  }

  async exists(absolutePath: string): Promise<boolean> {
    return this.files.has(absolutePath) || this.dirs.has(absolutePath);
  }

  async isDirectory(absolutePath: string): Promise<boolean> {
    return this.dirs.has(absolutePath);
  }

  async readdir(absolutePath: string): Promise<string[]> {
    if (!this.dirs.has(absolutePath)) {
      throw Object.assign(
        new Error(`ENOTDIR: not a directory, ${absolutePath}`),
        { code: "ENOTDIR" },
      );
    }
    const prefix =
      absolutePath === "/" ? "/" : absolutePath.replace(/\/$/, "") + "/";
    const names = new Set<string>();
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        const rest = file.slice(prefix.length);
        const slash = rest.indexOf("/");
        names.add(slash === -1 ? rest : rest.slice(0, slash));
      }
    }
    for (const dir of this.dirs) {
      if (dir === absolutePath) continue;
      if (dir.startsWith(prefix)) {
        const rest = dir.slice(prefix.length);
        const slash = rest.indexOf("/");
        names.add(slash === -1 ? rest : rest.slice(0, slash));
      }
    }
    return [...names].sort();
  }

  async mkdir(absolutePath: string): Promise<void> {
    if (!absolutePath.startsWith("/")) {
      throw new Error(`mkdir requires an absolute path, got: ${absolutePath}`);
    }
    const parts = absolutePath.split("/").filter(Boolean);
    let cur = "";
    for (const part of parts) {
      cur += "/" + part;
      this.dirs.add(cur);
    }
  }
}
