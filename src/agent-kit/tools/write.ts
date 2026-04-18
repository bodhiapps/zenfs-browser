/**
 * fs__write — write a text file to the mounted vault.
 *
 * Params: { path, content }
 * Result: { content: [{type:'text', text}], details: { path, bytesWritten } }
 *
 * Parent directories are created automatically via FileSystemProvider.mkdir
 * (which handles recursion — see src/agent-kit/tools/fs-provider.ts).
 * Overwrites the file if it already exists.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import type { FileSystemProvider } from "./fs-provider";
import { resolvePath } from "./path";

const writeSchema = Type.Object({
  path: Type.String({
    description: "Absolute or vault-relative path to write to",
  }),
  content: Type.String({ description: "UTF-8 text content to write" }),
});

type WriteInput = Static<typeof writeSchema>;

export function createWriteTool(
  fs: FileSystemProvider,
): AgentTool<typeof writeSchema> {
  return {
    name: "fs__write",
    label: "fs__write",
    description:
      "Write content to a file in the user's vault. Creates the file if it " +
      "does not exist, overwrites if it does. Parent directories are created " +
      "automatically. Absolute paths (/vault/...) and relative paths " +
      "(notes.md) both resolve under the vault root.",
    parameters: writeSchema,
    async execute(
      _toolCallId: string,
      { path, content }: WriteInput,
      signal?: AbortSignal,
    ) {
      if (signal?.aborted) throw new Error("Operation aborted");

      const absolutePath = resolvePath(fs.cwd, path);

      // Ensure parent dirs exist (provider.mkdir is recursive).
      const lastSlash = absolutePath.lastIndexOf("/");
      if (lastSlash > 0) {
        const parentDir = absolutePath.slice(0, lastSlash);
        await fs.mkdir(parentDir);
      }

      await fs.writeFile(absolutePath, content);

      const bytesWritten = new TextEncoder().encode(content).length;

      return {
        content: [
          {
            type: "text" as const,
            text: `Wrote ${bytesWritten} bytes to ${path}`,
          },
        ],
        details: { path: absolutePath, bytesWritten },
      };
    },
  };
}
