import { useEffect, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble from "./MessageBubble";
import { extractTextFromAgentMessage, type AgentMessage } from "@/types/chat";

interface ChatMessagesProps {
  messages: AgentMessage[];
  streamingMessage?: AgentMessage;
  isStreaming: boolean;
  error?: string | null;
}

export default function ChatMessages({
  messages,
  streamingMessage,
  isStreaming,
  error,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);

  const renderList = useMemo<AgentMessage[]>(() => {
    return streamingMessage ? [...messages, streamingMessage] : messages;
  }, [messages, streamingMessage]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
      isUserScrolledUpRef.current = !isAtBottom;
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const lastMessage = renderList[renderList.length - 1];
    const isNewUserMessage =
      renderList.length > prevMessagesLengthRef.current && lastMessage?.role === "user";

    if (isNewUserMessage) {
      isUserScrolledUpRef.current = false;
    }

    prevMessagesLengthRef.current = renderList.length;
  }, [renderList]);

  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isStreaming ? "instant" : "smooth",
      });
    }
  }, [renderList, isStreaming]);

  const turnByIndex = useMemo(() => {
    const turns: number[] = [];
    let userCount = 0;
    for (const msg of renderList) {
      if (msg.role === "user") userCount++;
      turns.push(Math.max(0, userCount - 1));
    }
    return turns;
  }, [renderList]);

  const lastMsg = renderList[renderList.length - 1];
  const showPending =
    isStreaming &&
    (!lastMsg || lastMsg.role !== "assistant" || !extractTextFromAgentMessage(lastMsg));

  return (
    <ScrollArea
      className="flex-1 overflow-hidden"
      data-testid="chat-area"
      data-teststate={error ? "error" : isStreaming ? "streaming" : "idle"}
      ref={(node: HTMLDivElement | null) => {
        if (node) {
          const viewport = node.querySelector(
            '[data-slot="scroll-area-viewport"]',
          ) as HTMLDivElement | null;
          if (viewport) {
            scrollViewportRef.current = viewport;
          }
        }
      }}
    >
      <div className="p-3">
        {renderList.length === 0 ? (
          <p className="text-center text-muted-foreground mt-6 text-sm">
            No messages yet. Start a conversation!
          </p>
        ) : (
          <>
            {renderList.map((msg, index) => {
              if (msg.role === "toolResult") return null;
              const turn = turnByIndex[index];
              return <MessageBubble key={index} message={msg} turn={turn} />;
            })}
            {showPending && (
              <div data-testid="streaming-indicator" className="flex justify-start mb-4">
                <div className="bg-muted px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-pulse [animation-delay:100ms]" />
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-pulse [animation-delay:200ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <div
        data-testid="chat-processing"
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          left: -9999,
          display: isStreaming ? "block" : "none",
        }}
      />
    </ScrollArea>
  );
}
