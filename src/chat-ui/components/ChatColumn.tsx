import { useEffect } from "react";
import { useBodhi, LoginOptionsBuilder } from "@bodhiapp/bodhi-js-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAgent } from "@/hooks/useAgent";
import { cn } from "@/lib/utils";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";

interface ChatColumnProps {
  className?: string;
}

export default function ChatColumn({ className }: ChatColumnProps) {
  const { isOverallReady, isAuthenticated, login, showSetup } = useBodhi();

  const {
    messages,
    streamingMessage,
    isStreaming,
    selectedModel,
    setSelectedModel,
    sendMessage,
    clearMessages,
    error: chatError,
    clearError: clearChatError,
    models,
    isLoadingModels,
    loadModels,
  } = useAgent();

  useEffect(() => {
    if (chatError) {
      toast.error(chatError, {
        onDismiss: clearChatError,
        onAutoClose: clearChatError,
      });
    }
  }, [chatError, clearChatError]);

  const handleLogin = async () => {
    const loginOptions = new LoginOptionsBuilder()
      .setFlowType("redirect")
      .setRole("scope_user_user")
      .build();
    const authState = await login(loginOptions);
    if (authState?.status === "error" && authState.error) {
      toast.error(authState.error.message);
    }
  };

  return (
    <aside
      data-testid="div-chat-column"
      className={cn("flex flex-col bg-background", className)}
    >
      {!isOverallReady ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Bodhi is not connected. Install the browser extension or start the server.
          </p>
          <Button data-testid="btn-chat-setup" onClick={showSetup} size="sm">
            Setup Bodhi
          </Button>
        </div>
      ) : !isAuthenticated ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">Log in to start chatting.</p>
          <Button data-testid="btn-chat-login" onClick={handleLogin} size="sm">
            Login to chat
          </Button>
        </div>
      ) : (
        <>
          <ChatMessages
            messages={messages}
            streamingMessage={streamingMessage}
            isStreaming={isStreaming}
            error={chatError}
          />
          <ChatInput
            onSendMessage={sendMessage}
            onClearMessages={clearMessages}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            models={models}
            isLoadingModels={isLoadingModels}
            onRefreshModels={loadModels}
          />
        </>
      )}
    </aside>
  );
}
