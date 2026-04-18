/**
 * UI-agnostic contracts for an agent chat session.
 *
 * React components in chat-ui implement these contracts in their hooks. A CLI
 * renderer (ink, blessed, raw readline) could implement the same contracts
 * and reuse the agent-kit without touching this folder.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

export interface ChatUiState {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | undefined;
  isStreaming: boolean;
  error: string | null;
}

export interface ChatUiActions {
  sendMessage(text: string): Promise<void>;
  stop(): void;
  clearMessages(): void;
  clearError(): void;
}
