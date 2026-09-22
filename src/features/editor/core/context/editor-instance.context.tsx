'use client';

/**
 * editor-instance.context.tsx
 *
 * React lifecycle provider for the active IEditorEngine.
 * Automatically wires IEditorEngine to the EditorCommandBus, eliminating
 * imperative { current: null } refs stored in Zustand stores.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { IEditorEngine } from '../../ports/editor-engine.port';
import { editorCommandBus } from '../command-bus/editor-command-bus';

interface EditorInstanceContextValue {
  engine: IEditorEngine | null;
  setEngine: (engine: IEditorEngine | null) => void;
  getContent: () => string;
}

const EditorInstanceContext = createContext<EditorInstanceContextValue | null>(null);

export function EditorInstanceProvider({ children }: { children: React.ReactNode }) {
  const [engine, setEngineState] = useState<IEditorEngine | null>(null);

  const setEngine = useCallback((newEngine: IEditorEngine | null) => {
    setEngineState(newEngine);
  }, []);

  const getContent = useCallback(() => {
    return engine?.getContent() ?? '';
  }, [engine]);

  // Wire incoming CommandBus commands to the active engine
  useEffect(() => {
    if (!engine) return;

    const unsubs = [
      editorCommandBus.subscribe('editor:jump-to-line', (cmd) => {
        engine.jumpToLine(cmd.line, cmd.highlight);
      }),
      editorCommandBus.subscribe('editor:format', (cmd) => {
        engine.format(cmd.format);
      }),
      editorCommandBus.subscribe('editor:insert-text', (cmd) => {
        engine.insertText(cmd.text);
      }),
      editorCommandBus.subscribe('editor:wrap-selection', (cmd) => {
        engine.wrapSelection(cmd.prefix, cmd.suffix, cmd.placeholder);
      }),
      editorCommandBus.subscribe('editor:undo', () => {
        engine.undo();
      }),
      editorCommandBus.subscribe('editor:redo', () => {
        engine.redo();
      }),
      editorCommandBus.subscribe('editor:focus', () => {
        engine.focus();
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [engine]);

  const value = useMemo(
    () => ({
      engine,
      setEngine,
      getContent,
    }),
    [engine, setEngine, getContent],
  );

  return (
    <EditorInstanceContext.Provider value={value}>
      {children}
    </EditorInstanceContext.Provider>
  );
}

export function useEditorInstance(): EditorInstanceContextValue {
  const ctx = useContext(EditorInstanceContext);
  if (!ctx) {
    throw new Error('useEditorInstance must be used within an EditorInstanceProvider');
  }
  return ctx;
}
