'use client';

/**
 * useEditorInstance.ts
 *
 * Lightweight, Context-Free Hook for accessing active editor & viewer instances.
 * Replaces React Context providers to prevent tree-wide re-renders.
 * Uses useSyncExternalStore for reactive engine binding across viewlets.
 */

import { useSyncExternalStore } from 'react';
import {
  getActiveEditorEngine,
  getActiveEditorContent,
  subscribeEditorEngineChanges,
} from '../bus/command-bus';

export function useEditorInstance() {
  const engine = useSyncExternalStore(
    subscribeEditorEngineChanges,
    getActiveEditorEngine,
    () => null,
  );

  return {
    engine,
    getContent: getActiveEditorContent,
  };
}
