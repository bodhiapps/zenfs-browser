/**
 * useBodhiModels — Bodhi-specific model listing + selection state.
 *
 * Extracted from the retired useAgent.ts so that agent state and transport
 * selection stay separate concerns. This hook lives in chat-ui because the
 * model-selector UI is a chat-ui concern.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useBodhi } from "@bodhiapp/bodhi-js-react";
import type { ApiFormat } from "@bodhiapp/bodhi-js-react/api";
import { fetchBodhiModels, type BodhiModelInfo } from "@/lib/bodhi-models";
import { getErrorMessage } from "@/lib/chat-utils";

const BASE_PATH = import.meta.env.BASE_URL;
const MODEL_STORAGE_KEY = `${BASE_PATH}chat:selectedModel`;

function loadPersisted(): { id: string; apiFormat: ApiFormat } | null {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.apiFormat === "string"
    ) {
      return { id: parsed.id, apiFormat: parsed.apiFormat };
    }
  } catch {
    // ignore malformed
  }
  return null;
}

function persist(id: string, apiFormat: ApiFormat): void {
  try {
    localStorage.setItem(
      MODEL_STORAGE_KEY,
      JSON.stringify({ id, apiFormat }),
    );
  } catch {
    // ignore quota / private-mode
  }
}

interface State {
  models: BodhiModelInfo[];
  isLoadingModels: boolean;
  selectedModel: string;
  selectedApiFormat: ApiFormat;
  error: string | null;
}

type Action =
  | { type: "load_start" }
  | {
      type: "load_success";
      models: BodhiModelInfo[];
      selectedModel: string;
      selectedApiFormat: ApiFormat;
    }
  | { type: "load_error"; message: string }
  | { type: "select"; id: string; apiFormat: ApiFormat };

const initial = (): State => {
  const persisted = loadPersisted();
  return {
    models: [],
    isLoadingModels: false,
    selectedModel: persisted?.id ?? "",
    selectedApiFormat: persisted?.apiFormat ?? "openai",
    error: null,
  };
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load_start":
      return { ...state, isLoadingModels: true, error: null };
    case "load_success":
      return {
        ...state,
        models: action.models,
        selectedModel: action.selectedModel,
        selectedApiFormat: action.selectedApiFormat,
        isLoadingModels: false,
      };
    case "load_error":
      return { ...state, isLoadingModels: false, error: action.message };
    case "select":
      return {
        ...state,
        selectedModel: action.id,
        selectedApiFormat: action.apiFormat,
      };
    default:
      return state;
  }
}

export interface UseBodhiModelsResult {
  models: BodhiModelInfo[];
  isLoadingModels: boolean;
  selectedModel: string;
  selectedApiFormat: ApiFormat;
  error: string | null;
  setSelectedModel: (id: string, fmt: ApiFormat) => void;
  loadModels: () => Promise<void>;
}

export function useBodhiModels(): UseBodhiModelsResult {
  const { client, isAuthenticated, isReady } = useBodhi();
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const loadingRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (loadingRef.current) return;
    if (!isAuthenticated) {
      dispatch({
        type: "load_error",
        message: "Please log in to load models",
      });
      return;
    }
    loadingRef.current = true;
    dispatch({ type: "load_start" });
    try {
      const list = await fetchBodhiModels(client);
      const persisted = loadPersisted();
      const keepPersisted =
        persisted && list.some((m) => m.id === persisted.id);
      const chosen = keepPersisted
        ? persisted
        : list.length > 0
          ? { id: list[0].id, apiFormat: list[0].apiFormat }
          : { id: "", apiFormat: "openai" as ApiFormat };
      dispatch({
        type: "load_success",
        models: list,
        selectedModel: chosen.id,
        selectedApiFormat: chosen.apiFormat,
      });
    } catch (err) {
      console.error("Failed to fetch models:", err);
      dispatch({
        type: "load_error",
        message: getErrorMessage(err, "Failed to fetch models"),
      });
    } finally {
      loadingRef.current = false;
    }
  }, [client, isAuthenticated]);

  useEffect(() => {
    if (
      isReady &&
      isAuthenticated &&
      state.models.length === 0 &&
      !loadingRef.current
    ) {
      void loadModels();
    }
  }, [isReady, isAuthenticated, state.models.length, loadModels]);

  const setSelectedModel = useCallback(
    (id: string, fmt: ApiFormat) => {
      dispatch({ type: "select", id, apiFormat: fmt });
      persist(id, fmt);
    },
    [],
  );

  return {
    models: isAuthenticated ? state.models : [],
    isLoadingModels: isAuthenticated ? state.isLoadingModels : false,
    selectedModel: isAuthenticated ? state.selectedModel : "",
    selectedApiFormat: state.selectedApiFormat,
    error: isAuthenticated ? state.error : null,
    setSelectedModel,
    loadModels,
  };
}
