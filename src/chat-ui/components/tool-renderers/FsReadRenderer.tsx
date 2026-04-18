import { extractTextFromAgentMessage } from "@/types/chat";
import type { ToolRenderer } from "./types";

/**
 * Renderer for fs__read tool results. Currently just displays the returned
 * text content verbatim. Extend in later phases with path badge, line-count,
 * collapse/expand, etc.
 */
export const FsReadRenderer: ToolRenderer = {
  render({ message }) {
    const text = extractTextFromAgentMessage(message);
    return (
      <pre
        data-testid="div-tool-result-content"
        className="whitespace-pre-wrap break-words text-xs max-h-48 overflow-auto"
      >
        {text || "(empty result)"}
      </pre>
    );
  },
};
