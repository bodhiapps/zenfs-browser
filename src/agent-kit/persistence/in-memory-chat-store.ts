/**
 * InMemoryChatStore — zero-dependency reference implementation of ChatStore.
 *
 * Intended for unit tests and the CLI reuse example. Keeps metadata and
 * messages in separate Maps to mirror the split-storage pattern used by the
 * browser Dexie adapter. No persistence across process restarts.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ChatSession, ChatStore } from "./chat-store";

function extractText(msg: AgentMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (!Array.isArray(msg.content)) return "";
  const parts: string[] = [];
  for (const p of msg.content) {
    if (p && typeof p === "object" && "type" in p && p.type === "text" && "text" in p) {
      parts.push(p.text as string);
    }
  }
  return parts.join("");
}

function computePreview(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" || m.role === "assistant") {
      const text = extractText(m).trim();
      if (text) return text.slice(0, 200);
    }
  }
  return "";
}

function deriveTitleFromMessages(messages: AgentMessage[]): string {
  for (const m of messages) {
    if (m.role === "user") {
      const text = extractText(m).trim();
      if (text) return text.slice(0, 60);
    }
  }
  return "New chat";
}

let counter = 0;
function simpleId(): string {
  counter += 1;
  return `mem-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export class InMemoryChatStore implements ChatStore {
  private readonly metadata = new Map<string, ChatSession>();
  private readonly messages = new Map<string, AgentMessage[]>();

  async createSession(rootDirName: string | null): Promise<ChatSession> {
    const now = Date.now();
    const session: ChatSession = {
      id: simpleId(),
      title: "New chat",
      preview: "",
      messageCount: 0,
      rootDirName,
      createdAt: now,
      updatedAt: now,
    };
    this.metadata.set(session.id, session);
    this.messages.set(session.id, []);
    return { ...session };
  }

  async listSessions(): Promise<ChatSession[]> {
    return Array.from(this.metadata.values())
      .map((s) => ({ ...s }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getSession(id: string): Promise<ChatSession | undefined> {
    const s = this.metadata.get(id);
    return s ? { ...s } : undefined;
  }

  async deleteSession(id: string): Promise<void> {
    this.metadata.delete(id);
    this.messages.delete(id);
  }

  async appendMessage(sessionId: string, msg: AgentMessage): Promise<void> {
    const meta = this.metadata.get(sessionId);
    if (!meta) return;
    const list = this.messages.get(sessionId) ?? [];
    list.push(msg);
    this.messages.set(sessionId, list);

    const updated: ChatSession = {
      ...meta,
      messageCount: list.length,
      updatedAt: Date.now(),
      preview: computePreview(list),
      title:
        meta.title === "New chat" ? deriveTitleFromMessages(list) : meta.title,
    };
    this.metadata.set(sessionId, updated);
  }

  async loadMessages(sessionId: string): Promise<AgentMessage[]> {
    const list = this.messages.get(sessionId);
    return list ? [...list] : [];
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const meta = this.metadata.get(sessionId);
    if (!meta) return;
    this.metadata.set(sessionId, {
      ...meta,
      title,
      updatedAt: Date.now(),
    });
  }
}
