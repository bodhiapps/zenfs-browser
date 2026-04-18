import type { ReactNode } from "react";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

/**
 * ToolRenderer — maps a tool's result message into a React node.
 *
 * Inspired by pi-web-ui's `tools/renderer-registry.ts`. Decouples tool
 * rendering from the tool definition so new tools plug in without editing
 * ToolResultMessage.
 */
export interface ToolRenderer {
  /** Render the body content of a tool-result bubble. */
  render(params: {
    toolName: string;
    toolCallId: string | undefined;
    message: AgentMessage;
  }): ReactNode;
}
