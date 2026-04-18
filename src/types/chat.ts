import type { AgentMessage } from "@mariozechner/pi-agent-core";

export type { AgentMessage };

export function extractTextFromAgentMessage(msg: AgentMessage): string {
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
