/**
 * useAgentSession — React hook binding a pi-agent-core Agent to a chat UI.
 *
 * Ports-based: the app supplies a FileSystemProvider (via useVaultMount), a
 * streamFn (to route through Bodhi / a custom transport), a model resolver,
 * and an error reporter. This hook knows nothing about Bodhi, ZenFS, Dexie,
 * or shadcn — those live in the app, adapters, and UI components respectively.
 *
 * Persistence (Phase 4): when a `chatStore` + `sessionId` are supplied, the
 * hook hydrates `agent.state.messages` from the store on mount/session switch
 * and appends newly produced messages to the store on `message_end`. A
 * high-water-mark ref tracks the messages-length at hydration time so we
 * never re-write loaded history.
 *
 * Streaming updates are coalesced via requestAnimationFrame to avoid DOM
 * thrash under fast token streams (pattern from pi-web-ui's
 * StreamingMessageContainer).
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Agent } from "@mariozechner/pi-agent-core";
import type {
  AgentEvent,
  AgentMessage,
  StreamFn,
} from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import type { FileSystemProvider } from "@/agent-kit/tools/fs-provider";
import type { ChatStore } from "@/agent-kit/persistence/chat-store";
import { createFsTools } from "@/agent-kit/tools/registry";
import { buildSystemPrompt } from "@/agent-kit/agent/prompt";
import { resolveMentions } from "@/agent-kit/mentions/resolver";
import { registerBuiltInRenderers } from "@/chat-ui/components/tool-renderers";
import type { ChatUiActions, ChatUiState } from "@/chat-ui/contracts/ui-session";

// Register built-in tool renderers once.
registerBuiltInRenderers();

export interface AgentSessionPorts {
  /** FileSystemProvider for fs__* tools; null disables tools. */
  fsProvider: FileSystemProvider | null;
  /** Resolve the model to use for the next prompt. Returning null disables sending. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getModel: () => Model<any> | null;
  /** Stream transport; typically a bearer-token-patched streamSimple. */
  streamFn: StreamFn;
  /** Sentinel API key used by pi-agent-core; app decides. */
  getApiKey: () => string;
  /** Persistence backend. When null, messages live only in memory. */
  chatStore?: ChatStore | null;
  /** Active session id. When null, persistence is disabled for this run. */
  sessionId?: string | null;
  /** Report errors that can't be surfaced via the chat state (optional). */
  onError?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Module-level singletons (same pattern the retired useAgent.ts used).
// Keeps the Agent identity stable across hook remounts.
// ---------------------------------------------------------------------------

let _agent: Agent | null = null;
let _unsub: (() => void) | null = null;

function getOrCreateAgent(
  streamFn: StreamFn,
  getApiKey: () => string,
): Agent {
  if (!_agent) {
    _agent = new Agent({
      streamFn,
      getApiKey,
    });
  }
  return _agent;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type State = ChatUiState;

type Action =
  | { type: "agent_start" }
  | { type: "messages_update"; messages: AgentMessage[]; streaming?: AgentMessage }
  | { type: "agent_end"; messages: AgentMessage[]; errorMessage?: string | null }
  | { type: "error"; message: string }
  | { type: "clear_error" }
  | { type: "reset" };

const INITIAL_STATE: State = {
  messages: [],
  streamingMessage: undefined,
  isStreaming: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "agent_start":
      return { ...state, isStreaming: true, error: null };
    case "messages_update":
      return {
        ...state,
        messages: action.messages,
        streamingMessage: action.streaming,
      };
    case "agent_end":
      return {
        ...state,
        messages: action.messages,
        streamingMessage: undefined,
        isStreaming: false,
        error: action.errorMessage ?? state.error,
      };
    case "error":
      return { ...state, error: action.message };
    case "clear_error":
      return { ...state, error: null };
    case "reset":
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAgentSessionResult extends ChatUiState, ChatUiActions {}

export function useAgentSession(
  ports: AgentSessionPorts,
): UseAgentSessionResult {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Keep ports in a ref so reads inside the effect/callback see the latest.
  const portsRef = useRef(ports);
  useEffect(() => {
    portsRef.current = ports;
  }, [ports]);

  // rAF coalescer for streaming updates.
  const rafPendingRef = useRef<number | null>(null);
  const pendingRef = useRef<{
    messages: AgentMessage[];
    streaming?: AgentMessage;
  } | null>(null);

  // High-water mark — the messages.length right after hydration. Messages at
  // indexes >= highWaterMarkRef.current are "new" and need persistence on the
  // next message_end / turn_end event.
  const highWaterMarkRef = useRef<number>(0);
  // Track which sessionId the high-water mark belongs to so we don't cross
  // the streams between sessions.
  const hydratedSessionIdRef = useRef<string | null>(null);
  // Guards concurrent persistMessageDelta runs by serialising appends.
  const persistLockRef = useRef<Promise<void>>(Promise.resolve());

  const flushMessagesUpdate = useCallback(() => {
    rafPendingRef.current = null;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    dispatch({
      type: "messages_update",
      messages: pending.messages,
      streaming: pending.streaming,
    });
  }, []);

  const scheduleMessagesUpdate = useCallback(
    (messages: AgentMessage[], streaming?: AgentMessage) => {
      pendingRef.current = { messages, streaming };
      if (rafPendingRef.current != null) return;
      rafPendingRef.current = requestAnimationFrame(flushMessagesUpdate);
    },
    [flushMessagesUpdate],
  );

  // Persist any messages beyond the high-water mark. Serialised so that two
  // back-to-back events can't interleave their appendMessage calls.
  const persistMessageDelta = useCallback(() => {
    const p = portsRef.current;
    const store = p.chatStore;
    const sid = p.sessionId;
    if (!store || !sid) return;
    // If the hydrated session doesn't match the active session id (e.g. a
    // switch happened mid-turn), skip persistence to avoid writing into the
    // wrong session. The agent should have been aborted in that path.
    if (hydratedSessionIdRef.current !== sid) return;
    const agent = _agent;
    if (!agent) return;
    // Snapshot the new messages now; the append is async.
    const snapshot = [...agent.state.messages];
    const from = highWaterMarkRef.current;
    if (snapshot.length <= from) return;
    const toAppend = snapshot.slice(from);
    highWaterMarkRef.current = snapshot.length;
    persistLockRef.current = persistLockRef.current.then(async () => {
      for (const msg of toAppend) {
        try {
          await store.appendMessage(sid, msg);
        } catch (err) {
          console.error("Failed to persist chat message:", err);
        }
      }
    });
  }, []);

  useEffect(() => {
    const agent = getOrCreateAgent(ports.streamFn, ports.getApiKey);

    _unsub?.();
    _unsub = agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case "agent_start":
          dispatch({ type: "agent_start" });
          break;
        case "message_update":
          scheduleMessagesUpdate(
            [...agent.state.messages],
            event.message,
          );
          break;
        case "message_end":
          scheduleMessagesUpdate([...agent.state.messages], undefined);
          persistMessageDelta();
          break;
        case "turn_end":
          scheduleMessagesUpdate([...agent.state.messages], undefined);
          persistMessageDelta();
          break;
        case "agent_end":
          // Flush any pending rAF before final dispatch.
          if (rafPendingRef.current != null) {
            cancelAnimationFrame(rafPendingRef.current);
            rafPendingRef.current = null;
            pendingRef.current = null;
          }
          dispatch({
            type: "agent_end",
            messages: [...agent.state.messages],
            errorMessage: agent.state.errorMessage ?? null,
          });
          // Final sweep — covers any remaining unpersisted messages.
          persistMessageDelta();
          break;
      }
    });

    return () => {
      _unsub?.();
      _unsub = null;
      if (rafPendingRef.current != null) {
        cancelAnimationFrame(rafPendingRef.current);
        rafPendingRef.current = null;
      }
    };
    // Only re-subscribe if the transport fns change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate agent transcript from the chat store whenever the active sessionId changes.
  useEffect(() => {
    const p = portsRef.current;
    const store = p.chatStore;
    const sid = ports.sessionId ?? null;
    // Abort any streaming before switching transcripts.
    _agent?.abort();
    if (!store || !sid) {
      // No persistence — reset to in-memory empty.
      if (_agent) _agent.state.messages = [];
      highWaterMarkRef.current = 0;
      hydratedSessionIdRef.current = null;
      dispatch({ type: "reset" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const loaded = await store.loadMessages(sid);
        if (cancelled) return;
        const agent = getOrCreateAgent(p.streamFn, p.getApiKey);
        agent.state.messages = loaded;
        highWaterMarkRef.current = loaded.length;
        hydratedSessionIdRef.current = sid;
        dispatch({
          type: "messages_update",
          messages: [...loaded],
          streaming: undefined,
        });
        dispatch({
          type: "agent_end",
          messages: [...loaded],
          errorMessage: null,
        });
      } catch (err) {
        console.error("Failed to load chat session:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ports.sessionId]);

  const sendMessage = useCallback(async (prompt: string) => {
    const p = portsRef.current;
    const model = p.getModel();
    if (!model) {
      dispatch({ type: "error", message: "No model selected." });
      return;
    }
    const agent = getOrCreateAgent(p.streamFn, p.getApiKey);
    agent.state.model = model;
    agent.state.tools = p.fsProvider ? createFsTools(p.fsProvider) : [];
    agent.state.systemPrompt = buildSystemPrompt({
      rootDirName: p.fsProvider?.name ?? null,
    });
    // Resolve @path mentions into fenced code blocks appended to the user
    // message. The resolved text goes into both the LLM turn context AND the
    // UI bubble / persistence — a single-source-of-truth choice documented
    // in the Phase 5 review notes. If no fsProvider or no mentions, the
    // resolver returns the original string unchanged.
    let resolved = prompt;
    if (p.fsProvider) {
      try {
        resolved = await resolveMentions(p.fsProvider, prompt);
      } catch (err) {
        console.error("Failed to resolve @-mentions:", err);
        resolved = prompt;
      }
    }
    try {
      await agent.prompt(resolved);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "error", message });
      p.onError?.(message);
    }
  }, []);

  const stop = useCallback(() => {
    _agent?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    _agent?.abort();
    if (_agent) _agent.state.messages = [];
    highWaterMarkRef.current = 0;
    hydratedSessionIdRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "clear_error" });
  }, []);

  return {
    ...state,
    sendMessage,
    stop,
    clearMessages,
    clearError,
  };
}
