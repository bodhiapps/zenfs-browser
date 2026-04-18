import { extractTextFromAgentMessage } from "@/types/chat";
import type { ToolRenderer } from "./types";

export const DefaultToolRenderer: ToolRenderer = {
  render({ message }) {
    const text = extractTextFromAgentMessage(message);
    return (
      <pre
        data-testid="div-tool-result-content"
        className="whitespace-pre-wrap break-words text-xs text-muted-foreground max-h-48 overflow-auto"
      >
        {text || "(empty result)"}
      </pre>
    );
  },
};
