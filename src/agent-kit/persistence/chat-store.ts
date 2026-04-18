/**
 * ChatStore — the ports interface agent hosts use to persist chat sessions.
 *
 * This module is intentionally framework-free: no React, no Dexie, no @zenfs.
 * Host adapters (browser: DexieChatStore; CLI/tests: InMemoryChatStore) implement
 * this interface so the agent-kit and its consumers don't know where messages
 * are stored.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

/**
 * Session metadata — cheap-to-load row shown in the session list.
 * Full message transcripts live separately (see ChatStore.loadMessages).
 */
export interface ChatSession {
  id: string;
  title: string;
  /** First 200 characters of the most recent user/assistant turn. */
  preview: string;
  messageCount: number;
  /** Name of the mounted root directory at session creation time, if any. */
  rootDirName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatStore {
  /** Create a new, empty session. Returns the metadata row. */
  createSession(rootDirName: string | null): Promise<ChatSession>;
  /** List all sessions, sorted by updatedAt desc. Does not load message bodies. */
  listSessions(): Promise<ChatSession[]>;
  /** Fetch a single session's metadata row. */
  getSession(id: string): Promise<ChatSession | undefined>;
  /** Remove a session and all its messages. */
  deleteSession(id: string): Promise<void>;
  /**
   * Append one message to the session's transcript.
   * Implementations must also bump messageCount/updatedAt/preview on the
   * metadata row (ideally atomically).
   */
  appendMessage(sessionId: string, msg: AgentMessage): Promise<void>;
  /** Load the full transcript for a session. */
  loadMessages(sessionId: string): Promise<AgentMessage[]>;
  /** Update the human-readable title of a session. */
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
}
