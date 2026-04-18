import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { getToolRenderer } from "./tool-renderers";

interface ToolResultMessageProps {
  message: AgentMessage;
}

function readTopLevel<T>(msg: AgentMessage, key: string): T | undefined {
  const anyMsg = msg as unknown as Record<string, unknown>;
  return anyMsg[key] as T | undefined;
}

export default function ToolResultMessage({ message }: ToolResultMessageProps) {
  const toolName =
    readTopLevel<string>(message, "toolName") ?? "unknown";
  const isError = readTopLevel<boolean>(message, "isError") ?? false;
  const toolCallId = readTopLevel<string>(message, "toolCallId");
  const state = isError ? "error" : "success";
  const renderer = getToolRenderer(toolName);
  return (
    <div className="flex justify-start mb-4">
      <div
        data-testid={`div-tool-result-${toolName}`}
        data-test-state={state}
        className="max-w-[85%] rounded-md border bg-background px-2 py-1.5"
      >
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
          <span className="font-mono">{toolName}</span>
          <span>{state}</span>
        </div>
        {renderer.render({
          toolName,
          toolCallId,
          message,
        })}
      </div>
    </div>
  );
}
