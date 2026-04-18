/**
 * fs__read — read a text file from the mounted vault.
 *
 * Params: { path, offset?, limit? }
 * Result: { content: [{type:'text', text}], details: { path, lines, truncated } }
 *
 * Offset/limit follow a 1-indexed line convention. Output is capped at
 * MAX_LINES; use offset+limit to paginate larger files.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import type { FileSystemProvider } from "./fs-provider";
import { resolvePath } from "./path";

const readSchema = Type.Object({
  path: Type.String({
    description: "Absolute or vault-relative path to the file to read",
  }),
  offset: Type.Optional(
    Type.Number({
      description: "Line number to start reading from (1-indexed). Default: 1",
    }),
  ),
  limit: Type.Optional(
    Type.Number({ description: "Maximum number of lines to read" }),
  ),
});

type ReadInput = Static<typeof readSchema>;

const MAX_LINES = 2000;

export function createReadTool(
  fs: FileSystemProvider,
): AgentTool<typeof readSchema> {
  return {
    name: "fs__read",
    label: "fs__read",
    description:
      "Read a text file from the user's vault. Returns UTF-8 content and " +
      `line count. Output is capped at ${MAX_LINES} lines; use offset+limit ` +
      "for larger files. Absolute paths (/vault/...) and relative paths " +
      "(README.md) both resolve under the vault root.",
    parameters: readSchema,
    async execute(
      _toolCallId: string,
      { path, offset, limit }: ReadInput,
      signal?: AbortSignal,
    ) {
      if (signal?.aborted) throw new Error("Operation aborted");

      const absolutePath = resolvePath(fs.cwd, path);

      if (!(await fs.exists(absolutePath))) {
        throw new Error(`File not found: ${path}`);
      }
      if (await fs.isDirectory(absolutePath)) {
        throw new Error(
          `Path is a directory: ${path}. Use fs__ls instead.`,
        );
      }

      const rawBytes = await fs.readFile(absolutePath);
      const text = new TextDecoder("utf-8").decode(rawBytes);

      const allLines = text.split("\n");
      const totalLines = allLines.length;

      const startIdx = offset !== undefined ? Math.max(0, offset - 1) : 0;
      if (startIdx >= allLines.length) {
        throw new Error(
          `offset ${offset} is beyond end of file (${totalLines} lines)`,
        );
      }

      const effectiveLimit = limit !== undefined ? limit : MAX_LINES;
      const endIdx = Math.min(startIdx + effectiveLimit, allLines.length);
      const selectedLines = allLines.slice(startIdx, endIdx);
      const content = selectedLines.join("\n");
      const truncated = endIdx < allLines.length;

      let output = content;
      if (truncated) {
        output +=
          `\n\n[Showing lines ${startIdx + 1}-${endIdx} of ${totalLines}. ` +
          `Use offset=${endIdx + 1} to continue.]`;
      }

      return {
        content: [{ type: "text" as const, text: output }],
        details: { path: absolutePath, lines: totalLines, truncated },
      };
    },
  };
}
