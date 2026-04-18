import { useCallback, useEffect, useMemo, useRef } from "react";
import { useBodhi, LoginOptionsBuilder } from "@bodhiapp/bodhi-js-react";
import { streamSimple } from "@mariozechner/pi-ai";
import type { Model } from "@mariozechner/pi-ai";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildModel, getServerUrlOrThrow } from "@/lib/agent-model";
import type { FileSystemProvider } from "@/agent-kit/tools/fs-provider";
import { useAgentSession } from "@/chat-ui/hooks/useAgentSession";
import { useBodhiModels } from "@/chat-ui/hooks/useBodhiModels";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";

const SENTINEL_API_KEY = "bodhiapp_sentinel_api_key_ignored";

interface ChatColumnProps {
  className?: string;
  fsProvider: FileSystemProvider | null;
}

export default function ChatColumn({ className, fsProvider }: ChatColumnProps) {
  const { isOverallReady, isAuthenticated, login, showSetup, client, auth } =
    useBodhi();

  const {
    models,
    isLoadingModels,
    selectedModel,
    selectedApiFormat,
    setSelectedModel,
    loadModels,
  } = useBodhiModels();

  // Keep the most recent auth token accessible to the closure-captured streamFn
  // without rebuilding it on every token rotation.
  const tokenRef = useRef<string | null>(auth.accessToken);
  useEffect(() => {
    tokenRef.current = auth.accessToken;
  }, [auth.accessToken]);

  const streamFn = useMemo<StreamFn>(
    () => (model, context, options) => {
      const token = tokenRef.current;
      const headers = token
        ? { ...model.headers, Authorization: `Bearer ${token}`, "x-api-key": token }
        : model.headers;
      const patchedModel =
        headers !== model.headers ? { ...model, headers } : model;
      return streamSimple(patchedModel, context, options);
    },
    [],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getModel = useCallback((): Model<any> | null => {
    if (!selectedModel) return null;
    try {
      const serverUrl = getServerUrlOrThrow(client.getState());
      return buildModel(selectedModel, serverUrl, selectedApiFormat);
    } catch {
      return null;
    }
  }, [selectedModel, selectedApiFormat, client]);

  const getApiKey = useCallback(() => SENTINEL_API_KEY, []);

  const session = useAgentSession({
    fsProvider,
    getModel,
    streamFn,
    getApiKey,
  });

  const { error: chatError, clearError: clearChatError, stop } = session;

  useEffect(() => {
    if (chatError) {
      toast.error(chatError, {
        onDismiss: clearChatError,
        onAutoClose: clearChatError,
      });
    }
  }, [chatError, clearChatError]);

  useEffect(() => {
    if (!isAuthenticated) {
      stop();
    }
  }, [isAuthenticated, stop]);

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

  const sendWithModelGuard = useCallback(
    async (text: string) => {
      if (!selectedModel) {
        toast.error("Please select a model first");
        return;
      }
      await session.sendMessage(text);
    },
    [selectedModel, session],
  );

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
            messages={session.messages}
            streamingMessage={session.streamingMessage}
            isStreaming={session.isStreaming}
            error={chatError}
          />
          <ChatInput
            onSendMessage={sendWithModelGuard}
            onClearMessages={session.clearMessages}
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
