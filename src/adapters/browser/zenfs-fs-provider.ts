/**
 * ZenFsProvider — FileSystemProvider backed by the ZenFS /vault mount.
 *
 * Routes calls to fs.promises.* from @zenfs/core. Paths are virtual absolute
 * paths under /vault. Consumers construct one instance per mounted handle.
 */

import type { FileSystemProvider } from "@/agent-kit/tools/fs-provider";
import { fs, VAULT_MOUNT } from "./zenfs-provider";

export class ZenFsProvider implements FileSystemProvider {
  readonly cwd = VAULT_MOUNT;
  readonly name: string;

  constructor(handleName: string) {
    this.name = handleName;
  }

  async readFile(absolutePath: string): Promise<Uint8Array> {
    const buf = await fs.promises.readFile(absolutePath);
    return new Uint8Array(buf as unknown as ArrayBuffer);
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    const lastSlash = absolutePath.lastIndexOf("/");
    if (lastSlash > 0) {
      await this.mkdir(absolutePath.slice(0, lastSlash));
    }
    await fs.promises.writeFile(absolutePath, content, { encoding: "utf8" });
  }

  async exists(absolutePath: string): Promise<boolean> {
    try {
      await fs.promises.stat(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(absolutePath: string): Promise<boolean> {
    try {
      const s = await fs.promises.stat(absolutePath);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  async readdir(absolutePath: string): Promise<string[]> {
    const entries = await fs.promises.readdir(absolutePath);
    return entries.map((e) =>
      typeof e === "string" ? e : (e as { name: string }).name,
    );
  }

  async mkdir(absolutePath: string): Promise<void> {
    try {
      await fs.promises.mkdir(absolutePath, { recursive: true });
    } catch (err: unknown) {
      if (
        err !== null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "EEXIST"
      ) {
        return;
      }
      throw err;
    }
  }
}
