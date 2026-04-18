import { extractTextFromAgentMessage, type AgentMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: AgentMessage;
  turn: number;
}

export default function MessageBubble({ message, turn }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const text = extractTextFromAgentMessage(message);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        data-testid={`chat-message-turn-${turn}`}
        data-messagetype={message.role}
        data-turn={turn}
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{text}</div>
      </div>
    </div>
  );
}
