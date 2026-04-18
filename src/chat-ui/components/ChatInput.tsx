import { useCallback, useMemo, useRef, useState } from "react";
import { useBodhi } from "@bodhiapp/bodhi-js-react";
import { IconPlus, IconRefresh, IconArrowUp } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModelCombobox from "./ModelCombobox";
import FileMentionPopup from "./FileMentionPopup";
import { useFileMentions } from "@/chat-ui/hooks/useFileMentions";
import type { FileSystemProvider } from "@/agent-kit/tools/fs-provider";
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
  fsProvider: FileSystemProvider | null;
}

// Matches the last whitespace-delimited token ending at the caret if it starts
// with `@`. The capture group is the fragment following the `@`.
const AT_TOKEN_RE = /(?:^|\s)@([a-zA-Z0-9_./-]*)$/;

export default function ChatInput({
  onSendMessage,
  onClearMessages,
  selectedModel,
  setSelectedModel,
  models,
  isLoadingModels,
  onRefreshModels,
  fsProvider,
}: ChatInputProps) {
  const { isReady, isAuthenticated } = useBodhi();
  const [message, setMessage] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionActive, setMentionActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mentionTokenStartRef = useRef<number>(-1);

  const { search } = useFileMentions(fsProvider);

  const mentionOptions = useMemo(
    () => (mentionOpen ? search(mentionQuery) : []),
    [mentionOpen, mentionQuery, search],
  );

  const isDisabled = !isReady || !isAuthenticated;

  const hint = !isReady
    ? "Client not ready"
    : !isAuthenticated
      ? "Please log in to send messages"
      : "Type a message...";

  const computeMentionContext = useCallback(
    (text: string, caret: number) => {
      const upToCaret = text.slice(0, caret);
      const match = AT_TOKEN_RE.exec(upToCaret);
      if (!match) {
        return { open: false, query: "", tokenStart: -1 };
      }
      const tokenStart = (match.index ?? 0) + match[0].indexOf("@");
      return { open: true, query: match[1] ?? "", tokenStart };
    },
    [],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setMessage(next);
      const caret = e.target.selectionStart ?? next.length;
      if (!fsProvider) {
        setMentionOpen(false);
        mentionTokenStartRef.current = -1;
        return;
      }
      const ctx = computeMentionContext(next, caret);
      if (ctx.open) {
        setMentionOpen(true);
        setMentionQuery(ctx.query);
        setMentionActive(0);
        mentionTokenStartRef.current = ctx.tokenStart;
      } else {
        setMentionOpen(false);
        mentionTokenStartRef.current = -1;
      }
    },
    [fsProvider, computeMentionContext],
  );

  const handleSubmit = useCallback(async () => {
    if (isDisabled || !message.trim()) return;
    const messageToSend = message;
    setMessage("");
    setMentionOpen(false);
    await onSendMessage(messageToSend);
  }, [isDisabled, message, onSendMessage]);

  const handleNewChat = () => {
    onClearMessages();
    setMessage("");
    setMentionOpen(false);
  };

  const pickMention = useCallback(
    (path: string) => {
      const tokenStart = mentionTokenStartRef.current;
      if (tokenStart < 0) {
        setMentionOpen(false);
        return;
      }
      const input = inputRef.current;
      const caret = input?.selectionStart ?? message.length;
      const before = message.slice(0, tokenStart);
      const after = message.slice(caret);
      const insertion = `@${path} `;
      const next = before + insertion + after;
      const nextCaret = before.length + insertion.length;
      setMessage(next);
      setMentionOpen(false);
      mentionTokenStartRef.current = -1;
      // Defer caret placement to next microtask so React commits the new value first.
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(nextCaret, nextCaret);
          } catch {
            // ignore on browsers that don't support setSelectionRange here
          }
        }
      });
    },
    [message],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (mentionOpen && mentionOptions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionActive((i) => (i + 1) % mentionOptions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionActive(
            (i) => (i - 1 + mentionOptions.length) % mentionOptions.length,
          );
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const idx = Math.min(mentionActive, mentionOptions.length - 1);
          pickMention(mentionOptions[idx]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionOpen(false);
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [mentionOpen, mentionOptions, mentionActive, pickMention, handleSubmit],
  );

  return (
    <div className="border-t p-3">
      <div className="flex flex-col gap-2 rounded-2xl border bg-background p-2 shadow-sm">
        <div className="flex items-center gap-1 relative">
          <Button
            onClick={handleNewChat}
            variant="ghost"
            size="icon-sm"
            title="New chat"
            disabled={isDisabled}
          >
            <IconPlus className="size-4" />
          </Button>
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              data-testid="chat-input"
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Let onMouseDown handlers on popup items run first; the pick
                // path calls preventDefault so blur won't actually fire before
                // pick. We still close the popup here to handle tab-aways.
                setTimeout(() => setMentionOpen(false), 0);
              }}
              placeholder={hint}
              disabled={isDisabled}
              className="border-0 shadow-none focus-visible:ring-0"
            />
            <FileMentionPopup
              open={mentionOpen}
              query={mentionQuery}
              options={mentionOptions}
              activeIndex={mentionActive}
              onHover={setMentionActive}
              onPick={pickMention}
            />
          </div>
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
