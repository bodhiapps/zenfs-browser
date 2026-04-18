/**
 * fs__edit — replace or insert lines in a text file in the vault.
 *
 * Params: { path, startLine, endLine, content }
 *   - 1-indexed inclusive line range [startLine..endLine].
 *   - To insert WITHOUT replacing, pass endLine = startLine - 1.
 *   - `content` is the replacement text (no trailing newline needed);
 *     split on '\n' and spliced into the file's lines.
 *
 * Result: {
 *   content: [{type:'text', text}],
 *   details: { path, startLine, endLine, replacedLines, newLines }
 * }
 *
 * Errors: file not found, path is directory, range out of bounds, aborted.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import type { FileSystemProvider } from "./fs-provider";
import { resolvePath } from "./path";

const editSchema = Type.Object({
  path: Type.String({ description: "Path to the file to edit" }),
  startLine: Type.Number({ description: "1-indexed inclusive start line" }),
  endLine: Type.Number({
    description:
      "1-indexed inclusive end line. Use startLine-1 to insert without replacing.",
  }),
  content: Type.String({
    description: "New content (no trailing newline needed)",
  }),
});

type EditInput = Static<typeof editSchema>;

export function createEditTool(
  fs: FileSystemProvider,
): AgentTool<typeof editSchema> {
  return {
    name: "fs__edit",
    label: "fs__edit",
    description:
      "Edit a text file by replacing a range of lines with new content. " +
      "Line ranges are 1-indexed inclusive. Pass endLine = startLine - 1 to " +
      "insert content without replacing. Call fs__read first so your line " +
      "numbers are correct.",
    parameters: editSchema,
    async execute(
      _toolCallId: string,
      { path, startLine, endLine, content }: EditInput,
      signal?: AbortSignal,
    ) {
      if (signal?.aborted) throw new Error("Operation aborted");

      const absolutePath = resolvePath(fs.cwd, path);

      if (!(await fs.exists(absolutePath))) {
        throw new Error(`File not found: ${path}`);
      }
      if (await fs.isDirectory(absolutePath)) {
        throw new Error(
          `Path is a directory: ${path}. fs__edit operates on files only.`,
        );
      }

      const rawBytes = await fs.readFile(absolutePath);
      const text = new TextDecoder("utf-8").decode(rawBytes);
      const lines = text.split("\n");
      const totalLines = lines.length;

      if (startLine < 1) {
        throw new Error(
          `startLine must be >= 1, got ${startLine}`,
        );
      }
      // endLine = startLine - 1 means pure insertion (no replacement).
      if (endLine < startLine - 1) {
        throw new Error(
          `endLine (${endLine}) must be >= startLine-1 (${startLine - 1})`,
        );
      }
      // For replacement, endLine must not exceed file length.
      const isInsert = endLine === startLine - 1;
      if (!isInsert && endLine > totalLines) {
        throw new Error(
          `endLine ${endLine} is beyond end of file (${totalLines} lines)`,
        );
      }
      if (startLine > totalLines + 1) {
        throw new Error(
          `startLine ${startLine} is beyond end of file (${totalLines} lines)`,
        );
      }

      const replacedLines = isInsert ? 0 : endLine - startLine + 1;
      const newLinesArr = content.split("\n");

      // splice [startLine-1 .. endLine) — for insertion, deleteCount is 0.
      lines.splice(startLine - 1, replacedLines, ...newLinesArr);

      const newText = lines.join("\n");
      await fs.writeFile(absolutePath, newText);

      return {
        content: [
          {
            type: "text" as const,
            text: `Edited ${path}: replaced ${replacedLines} line(s) with ${newLinesArr.length} new line(s)`,
          },
        ],
        details: {
          path: absolutePath,
          startLine,
          endLine,
          replacedLines,
          newLines: newLinesArr.length,
        },
      };
    },
  };
}
