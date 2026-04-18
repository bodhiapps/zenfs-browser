/**
 * DexieChatStore — IndexedDB-backed ChatStore adapter.
 *
 * Uses the split-storage pattern (inspired by @mariozechner/pi-web-ui):
 *   - chatSessionMetadata: small rows fast to list (id, title, preview,
 *     messageCount, rootDirName, createdAt, updatedAt).
 *   - chatSessionData:     full message transcripts as JSON strings, keyed
 *     by the same session id.
 *
 * Session list views load only metadata. Loading messages is an explicit
 * call. appendMessage bumps both tables inside a single rw transaction so
 * list UIs never see a session in an inconsistent state.
 */

import Dexie, { type EntityTable } from "dexie";
import { nanoid } from "nanoid";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  ChatSession,
  ChatStore,
} from "@/agent-kit/persistence/chat-store";

interface ChatSessionMetadataRow {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  rootDirName: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ChatSessionDataRow {
  id: string;
  messagesJson: string;
}

class AppDatabase extends Dexie {
  chatSessionMetadata!: EntityTable<ChatSessionMetadataRow, "id">;
  chatSessionData!: EntityTable<ChatSessionDataRow, "id">;

  constructor() {
    super("zenfs-browser");
    this.version(1).stores({
      chatSessionMetadata: "id, updatedAt, rootDirName",
      chatSessionData: "id",
    });
  }
}

// Local copy of the pure text extractor from src/types/chat.ts. Duplicated
// deliberately to keep the adapters layer free of chat-ui imports (and the
// kit free of adapters imports).
function extractTextFromAgentMessage(msg: AgentMessage): string {
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
      const text = extractTextFromAgentMessage(m).trim();
      if (text) return text.slice(0, 200);
    }
  }
  return "";
}

function deriveTitleFromMessages(messages: AgentMessage[]): string {
  for (const m of messages) {
    if (m.role === "user") {
      const text = extractTextFromAgentMessage(m).trim();
      if (text) return text.slice(0, 60);
    }
  }
  return "New chat";
}

function metadataToSession(row: ChatSessionMetadataRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview,
    messageCount: row.messageCount,
    rootDirName: row.rootDirName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DexieChatStore implements ChatStore {
  private readonly db: AppDatabase;

  constructor(db?: AppDatabase) {
    this.db = db ?? new AppDatabase();
  }

  async createSession(rootDirName: string | null): Promise<ChatSession> {
    const now = Date.now();
    const row: ChatSessionMetadataRow = {
      id: nanoid(),
      title: "New chat",
      preview: "",
      messageCount: 0,
      rootDirName,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.transaction(
      "rw",
      this.db.chatSessionMetadata,
      this.db.chatSessionData,
      async () => {
        await this.db.chatSessionMetadata.add(row);
        await this.db.chatSessionData.add({ id: row.id, messagesJson: "[]" });
      },
    );
    return metadataToSession(row);
  }

  async listSessions(): Promise<ChatSession[]> {
    const rows = await this.db.chatSessionMetadata
      .orderBy("updatedAt")
      .reverse()
      .toArray();
    return rows.map(metadataToSession);
  }

  async getSession(id: string): Promise<ChatSession | undefined> {
    const row = await this.db.chatSessionMetadata.get(id);
    return row ? metadataToSession(row) : undefined;
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.transaction(
      "rw",
      this.db.chatSessionMetadata,
      this.db.chatSessionData,
      async () => {
        await this.db.chatSessionMetadata.delete(id);
        await this.db.chatSessionData.delete(id);
      },
    );
  }

  async appendMessage(sessionId: string, msg: AgentMessage): Promise<void> {
    await this.db.transaction(
      "rw",
      this.db.chatSessionMetadata,
      this.db.chatSessionData,
      async () => {
        const meta = await this.db.chatSessionMetadata.get(sessionId);
        if (!meta) return;
        const dataRow = await this.db.chatSessionData.get(sessionId);
        const current: AgentMessage[] = dataRow
          ? (JSON.parse(dataRow.messagesJson) as AgentMessage[])
          : [];
        current.push(msg);
        await this.db.chatSessionData.put({
          id: sessionId,
          messagesJson: JSON.stringify(current),
        });
        const nextTitle =
          meta.title === "New chat"
            ? deriveTitleFromMessages(current)
            : meta.title;
        await this.db.chatSessionMetadata.put({
          ...meta,
          messageCount: current.length,
          preview: computePreview(current),
          title: nextTitle,
          updatedAt: Date.now(),
        });
      },
    );
  }

  async loadMessages(sessionId: string): Promise<AgentMessage[]> {
    const row = await this.db.chatSessionData.get(sessionId);
    if (!row) return [];
    try {
      const parsed = JSON.parse(row.messagesJson);
      return Array.isArray(parsed) ? (parsed as AgentMessage[]) : [];
    } catch {
      return [];
    }
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const meta = await this.db.chatSessionMetadata.get(sessionId);
    if (!meta) return;
    await this.db.chatSessionMetadata.put({
      ...meta,
      title,
      updatedAt: Date.now(),
    });
  }
}
