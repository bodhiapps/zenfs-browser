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
import type { ChatStore } from "@/agent-kit/persistence/chat-store";
import { useAgentSession } from "@/chat-ui/hooks/useAgentSession";
import { useBodhiModels } from "@/chat-ui/hooks/useBodhiModels";
import { useChatSessions } from "@/chat-ui/hooks/useChatSessions";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import ChatSessionList from "./ChatSessionList";

const SENTINEL_API_KEY = "bodhiapp_sentinel_api_key_ignored";

interface ChatColumnProps {
  className?: string;
  fsProvider: FileSystemProvider | null;
  chatStore?: ChatStore | null;
}

export default function ChatColumn({
  className,
  fsProvider,
  chatStore = null,
}: ChatColumnProps) {
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

  // Stable ref to agent session's stop() — needed by useChatSessions'
  // onBeforeSwitch to abort any active stream before hydrating the next
  // session's transcript.
  const stopRef = useRef<() => void>(() => {});

  const sessions = useChatSessions({
    chatStore,
    rootDirName: fsProvider?.name ?? null,
    onBeforeSwitch: () => stopRef.current(),
  });

  const session = useAgentSession({
    fsProvider,
    getModel,
    streamFn,
    getApiKey,
    chatStore,
    sessionId: sessions.currentSessionId,
  });

  useEffect(() => {
    stopRef.current = session.stop;
  }, [session.stop]);

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

  const handleNewChat = useCallback(async () => {
    if (chatStore) {
      await sessions.newSession();
    } else {
      session.clearMessages();
    }
  }, [chatStore, sessions, session]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await sessions.deleteSession(id);
    },
    [sessions],
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
          {chatStore && (
            <ChatSessionList
              sessions={sessions.sessions}
              currentSessionId={sessions.currentSessionId}
              onNew={() => void handleNewChat()}
              onSwitch={sessions.switchSession}
              onDelete={(id) => void handleDeleteSession(id)}
            />
          )}
          <ChatMessages
            messages={session.messages}
            streamingMessage={session.streamingMessage}
            isStreaming={session.isStreaming}
            error={chatError}
          />
          <ChatInput
            onSendMessage={sendWithModelGuard}
            onClearMessages={() => void handleNewChat()}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            models={models}
            isLoadingModels={isLoadingModels}
            onRefreshModels={loadModels}
            fsProvider={fsProvider}
          />
        </>
      )}
    </aside>
  );
}
