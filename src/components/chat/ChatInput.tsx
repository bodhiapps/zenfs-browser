import { useState } from "react";
import { useBodhi } from "@bodhiapp/bodhi-js-react";
import { IconPlus, IconRefresh, IconArrowUp } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModelCombobox from "./ModelCombobox";
import type { BodhiModelInfo } from "@/lib/bodhi-models";
import type { ApiFormat } from "@bodhiapp/bodhi-js-react/api";

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  onClearMessages: () => void;
  selectedModel: string;
  setSelectedModel: (id: string, fmt: ApiFormat) => void;
  models: BodhiModelInfo[];
  isLoadingModels: boolean;
  onRefreshModels: () => void;
}

export default function ChatInput({
  onSendMessage,
  onClearMessages,
  selectedModel,
  setSelectedModel,
  models,
  isLoadingModels,
  onRefreshModels,
}: ChatInputProps) {
  const { isReady, isAuthenticated } = useBodhi();
  const [message, setMessage] = useState("");

  const isDisabled = !isReady || !isAuthenticated;

  const hint = !isReady
    ? "Client not ready"
    : !isAuthenticated
      ? "Please log in to send messages"
      : "Type a message...";

  const handleSubmit = async () => {
    if (isDisabled || !message.trim()) return;
    const messageToSend = message;
    setMessage("");
    await onSendMessage(messageToSend);
  };

  const handleNewChat = () => {
    onClearMessages();
    setMessage("");
  };

  return (
    <div className="border-t p-3">
      <div className="flex flex-col gap-2 rounded-2xl border bg-background p-2 shadow-sm">
        <div className="flex items-center gap-1">
          <Button
            onClick={handleNewChat}
            variant="ghost"
            size="icon-sm"
            title="New chat"
            disabled={isDisabled}
          >
            <IconPlus className="size-4" />
          </Button>
          <Input
            data-testid="chat-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={hint}
            disabled={isDisabled}
            className="border-0 shadow-none focus-visible:ring-0"
          />
          <Button
            data-testid="send-button"
            onClick={handleSubmit}
            disabled={isDisabled || !message.trim()}
            variant="ghost"
            size="icon-sm"
            title="Send message"
          >
            <IconArrowUp className="size-4" />
          </Button>
        </div>
        <div className="flex items-center justify-end gap-1">
          <ModelCombobox
            models={models}
            selected={selectedModel}
            onSelect={setSelectedModel}
            disabled={isDisabled}
          />
          <Button
            data-testid="btn-refresh-models"
            onClick={onRefreshModels}
            variant="ghost"
            size="icon-sm"
            title="Refresh models"
            disabled={isLoadingModels}
          >
            <IconRefresh className={isLoadingModels ? "animate-spin size-4" : "size-4"} />
          </Button>
        </div>
      </div>
    </div>
  );
}
