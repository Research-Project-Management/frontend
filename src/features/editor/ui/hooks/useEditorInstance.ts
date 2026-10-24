'use client';

/**
 * use-editor-instance.ts
 *
 * Lightweight, Context-Free Hook for accessing active editor & viewer instances.
 * Replaces React Context providers to prevent tree-wide re-renders.
 * Uses useSyncExternalStore for reactive engine binding across viewlets.
 */

import { useSyncExternalStore } from 'react';
import {
  getActiveEditorEngine,
  getActiveEditorContent,
  getActivePdfViewer,
  subscribeEditorEngineChanges,
} from '@/features/editor/core';

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

export function useViewerInstance() {
  return {
    viewer: getActivePdfViewer(),
  };
}
