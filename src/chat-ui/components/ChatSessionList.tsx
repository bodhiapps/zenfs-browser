import { useState } from "react";
import { IconPlus, IconTrash, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/agent-kit/persistence/chat-store";

interface ChatSessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export default function ChatSessionList({
  sessions,
  currentSessionId,
  onNew,
  onSwitch,
  onDelete,
  disabled,
}: ChatSessionListProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      data-testid="div-chat-session-list"
      className="flex flex-col border-b bg-muted/30"
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Button
          data-testid="btn-chat-session-toggle"
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sessions" : "Collapse sessions"}
        >
          {collapsed ? (
            <IconChevronRight className="size-3" />
          ) : (
            <IconChevronDown className="size-3" />
          )}
        </Button>
        <span className="text-xs font-medium text-muted-foreground">
          Chats
        </span>
        <Button
          data-testid="btn-chat-session-new"
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={onNew}
          disabled={disabled}
          title="New chat"
        >
          <IconPlus className="size-3" />
        </Button>
      </div>
      {!collapsed && (
        <div className="flex flex-col max-h-40 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No chats yet.
            </p>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              const label = s.title?.trim() || "New chat";
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-xs",
                    isActive && "bg-accent",
                  )}
                >
                  <button
                    type="button"
                    data-testid={`btn-chat-session-${s.id}`}
                    data-test-state={isActive ? "active" : "inactive"}
                    onClick={() => onSwitch(s.id)}
                    disabled={disabled}
                    className={cn(
                      "flex-1 truncate text-left rounded px-1 py-0.5 hover:bg-muted",
                      isActive && "font-medium",
                    )}
                    title={label}
                  >
                    {label}
                  </button>
                  <Button
                    data-testid={`btn-chat-session-delete-${s.id}`}
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    disabled={disabled}
                    title="Delete chat"
                  >
                    <IconTrash className="size-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
