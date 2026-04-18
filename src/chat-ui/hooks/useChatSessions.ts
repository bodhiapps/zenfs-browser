/**
 * useChatSessions — tracks the list of persisted chat sessions + which one is
 * active, using a ChatStore port.
 *
 * The most recently selected session id is mirrored to localStorage (namespaced
 * by Vite BASE_URL) so a page reload restores the previously open chat.
 *
 * Callers are responsible for aborting any active stream before they honor a
 * switchSession — the hook calls the optional `onBeforeSwitch` callback first
 * and defers to the caller (see ChatColumn → useAgentSession.stop).
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  ChatSession,
  ChatStore,
} from "@/agent-kit/persistence/chat-store";

const BASE_PATH = import.meta.env.BASE_URL;
const STORAGE_KEY = `${BASE_PATH}chat:currentSessionId`;

function loadPersistedId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function persistId(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore quota / private-mode
  }
}

interface State {
  sessions: ChatSession[];
  currentSessionId: string | null;
  loaded: boolean;
}

type Action =
  | { type: "loaded"; sessions: ChatSession[]; currentSessionId: string | null }
  | { type: "set_current"; id: string | null }
  | { type: "set_sessions"; sessions: ChatSession[] };

const INITIAL: State = {
  sessions: [],
  currentSessionId: null,
  loaded: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return {
        sessions: action.sessions,
        currentSessionId: action.currentSessionId,
        loaded: true,
      };
    case "set_current":
      return { ...state, currentSessionId: action.id };
    case "set_sessions":
      return { ...state, sessions: action.sessions };
    default:
      return state;
  }
}

export interface UseChatSessionsOptions {
  chatStore: ChatStore | null;
  /** Display name of the currently mounted root dir, passed to createSession. */
  rootDirName: string | null;
  /**
   * Called right before switching away from the current session.
   * Use to abort any in-flight agent streaming before the hydration effect runs.
   */
  onBeforeSwitch?: () => void;
}

export interface UseChatSessionsResult {
  sessions: ChatSession[];
  currentSessionId: string | null;
  loaded: boolean;
  newSession: () => Promise<string | null>;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useChatSessions(
  options: UseChatSessionsOptions,
): UseChatSessionsResult {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  }, [options]);

  const refresh = useCallback(async () => {
    const store = optsRef.current.chatStore;
    if (!store) return;
    const sessions = await store.listSessions();
    dispatch({ type: "set_sessions", sessions });
  }, []);

  // Initial load.
  useEffect(() => {
    const store = options.chatStore;
    if (!store) return;
    let cancelled = false;
    (async () => {
      const sessions = await store.listSessions();
      if (cancelled) return;
      const persisted = loadPersistedId();
      let currentId: string | null = null;
      if (persisted && sessions.some((s) => s.id === persisted)) {
        currentId = persisted;
      } else if (sessions.length > 0) {
        currentId = sessions[0].id;
      } else {
        try {
          const created = await store.createSession(
            optsRef.current.rootDirName,
          );
          if (cancelled) return;
          const nextSessions = await store.listSessions();
          if (cancelled) return;
          currentId = created.id;
          persistId(currentId);
          dispatch({
            type: "loaded",
            sessions: nextSessions,
            currentSessionId: currentId,
          });
          return;
        } catch (err) {
          console.error("Failed to create initial chat session:", err);
        }
      }
      persistId(currentId);
      dispatch({
        type: "loaded",
        sessions,
        currentSessionId: currentId,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [options.chatStore]);

  const newSession = useCallback(async (): Promise<string | null> => {
    const store = optsRef.current.chatStore;
    if (!store) return null;
    optsRef.current.onBeforeSwitch?.();
    const created = await store.createSession(optsRef.current.rootDirName);
    const sessions = await store.listSessions();
    persistId(created.id);
    dispatch({
      type: "loaded",
      sessions,
      currentSessionId: created.id,
    });
    return created.id;
  }, []);

  const switchSession = useCallback((id: string) => {
    optsRef.current.onBeforeSwitch?.();
    persistId(id);
    dispatch({ type: "set_current", id });
    // Fire-and-forget metadata refresh; harmless if it lands a moment later.
    void refresh();
  }, [refresh]);

  const deleteSession = useCallback(async (id: string) => {
    const store = optsRef.current.chatStore;
    if (!store) return;
    await store.deleteSession(id);
    const sessions = await store.listSessions();
    dispatch({ type: "set_sessions", sessions });
    // If the deleted session was active, advance to the next available one,
    // or create a fresh empty session so the UI always has a current.
    // The update to currentSessionId is read from state via a second dispatch.
    // (We compute here because the reducer snapshot is already fresh.)
    // This runs after the list update so React has the latest sessions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevCurrent = (state as any).currentSessionId as string | null;
    if (prevCurrent === id) {
      if (sessions.length > 0) {
        persistId(sessions[0].id);
        dispatch({ type: "set_current", id: sessions[0].id });
      } else {
        try {
          const created = await store.createSession(
            optsRef.current.rootDirName,
          );
          const nextSessions = await store.listSessions();
          persistId(created.id);
          dispatch({
            type: "loaded",
            sessions: nextSessions,
            currentSessionId: created.id,
          });
        } catch (err) {
          console.error("Failed to create replacement session:", err);
        }
      }
    }
  }, [state]);

  const renameSession = useCallback(async (id: string, title: string) => {
    const store = optsRef.current.chatStore;
    if (!store) return;
    await store.updateSessionTitle(id, title);
    const sessions = await store.listSessions();
    dispatch({ type: "set_sessions", sessions });
  }, []);

  return {
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    loaded: state.loaded,
    newSession,
    switchSession,
    deleteSession,
    renameSession,
    refresh,
  };
}
