import type { AgentMessage } from "@mariozechner/pi-agent-core";

interface ToolCallPart {
  type: "toolCall";
  id?: string;
  name: string;
  arguments?: unknown;
}

export type ToolCallPhase = "pending" | "executing" | "complete" | "error";

interface ToolCallMessageProps {
  message: AgentMessage;
  /** Tool call ids that have already produced a toolResult (i.e. are done). */
  completedCallIds: Set<string>;
  /** Whether the agent is still streaming (affects pending vs executing). */
  isStreaming: boolean;
}

function getToolCalls(message: AgentMessage): ToolCallPart[] {
  if (!Array.isArray(message.content)) return [];
  const parts: ToolCallPart[] = [];
  for (const p of message.content) {
    if (
      p &&
      typeof p === "object" &&
      "type" in p &&
      (p as { type: unknown }).type === "toolCall" &&
      "name" in p
    ) {
      parts.push(p as unknown as ToolCallPart);
    }
  }
  return parts;
}

function tryStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Renders each toolCall part in an assistant message as a small "tool invoked"
 * bubble. The data-test-state flips to "complete" once the corresponding
 * tool result is in `completedCallIds`, giving Playwright a terminal state.
 */
export default function ToolCallMessage({
  message,
  completedCallIds,
  isStreaming,
}: ToolCallMessageProps) {
  const calls = getToolCalls(message);
  if (calls.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mb-2">
      {calls.map((call, i) => {
        const done = call.id ? completedCallIds.has(call.id) : false;
        const phase: ToolCallPhase = done
          ? "complete"
          : isStreaming
            ? "executing"
            : "pending";
        return (
          <div
            key={`${call.id ?? i}`}
            data-testid={`div-tool-call-${call.name}`}
            data-test-state={phase}
            className="self-start max-w-[85%] rounded-md border bg-muted/40 px-2 py-1 text-xs font-mono"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{call.name}</span>
              <span className="text-muted-foreground">{phase}</span>
            </div>
            {call.arguments !== undefined && (
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
                {tryStringify(call.arguments)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
