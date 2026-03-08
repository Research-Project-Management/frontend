import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";

export type ChatMode = "chat" | "wiki";

/** A single document source managed by the user (NotebookLM-style). */
export interface SourceDoc {
  id: string;
  name: string;
  enabled: boolean;
}

type ChatModeContextType = {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  /** All sources added in the current session. */
  sources: SourceDoc[];
  /** IDs of sources that are currently enabled (passed to RAG). */
  enabledDocumentIds: string[];
  /** Master toggle — when false, RAG is skipped even if sources exist. */
  fluxDataEnabled: boolean;
  setFluxDataEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  /** Add a new source (no-op if id already present). Auto-enables it. */
  addSource: (id: string, name: string) => void;
  /** Permanently remove a source by id. */
  removeSource: (id: string) => void;
  /** Toggle the enabled state of a source. */
  toggleSource: (id: string) => void;
  /** Restore sources from a saved session (IDs only, no names). */
  restoreSourceIds: (ids: string[]) => void;
  /** Fill in the name of a source that was restored with an empty name. No-op if already named. */
  updateSourceName: (id: string, name: string) => void;
  /** Clear all sources (e.g. when navigating to a new chat). */
  clearSources: () => void;
};

const ChatModeContext = createContext<ChatModeContextType | undefined>(
  undefined,
);

export function ChatModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ChatMode>("wiki");
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [fluxDataEnabled, setFluxDataEnabled] = useState(false);

  const setMode = useCallback((newMode: ChatMode) => setModeState(newMode), []);

  const enabledDocumentIds = useMemo(
    () => sources.filter((s) => s.enabled).map((s) => s.id),
    [sources],
  );

  const addSource = useCallback((id: string, name: string) => {
    setSources((prev) => {
      if (prev.some((s) => s.id === id)) return prev;
      return [...prev, { id, name, enabled: true }];
    });
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleSource = useCallback((id: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  }, []);

  const restoreSourceIds = useCallback((ids: string[]) => {
    setSources((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return ids.map((id) => byId.get(id) ?? { id, name: "", enabled: true });
    });
  }, []);

  const updateSourceName = useCallback((id: string, name: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: s.name || name } : s)),
    );
  }, []);

  const clearSources = useCallback(() => setSources([]), []);

  return (
    <ChatModeContext.Provider
      value={{
        mode,
        setMode,
        sources,
        enabledDocumentIds,
        fluxDataEnabled,
        setFluxDataEnabled,
        addSource,
        removeSource,
        toggleSource,
        restoreSourceIds,
        updateSourceName,
        clearSources,
      }}
    >
      {children}
    </ChatModeContext.Provider>
  );
}

export function useChatMode() {
  const context = useContext(ChatModeContext);
  if (context === undefined) {
    throw new Error("useChatMode must be used within a ChatModeProvider");
  }
  return context;
}
