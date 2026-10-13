'use client';

/**
 * use-editor-instance.ts
 *
 * Lightweight, Context-Free Hook for accessing active editor & viewer instances.
 * Replaces React Context providers to prevent tree-wide re-renders.
 */

import {
  getActiveEditorEngine,
  getActiveEditorContent,
  getActivePdfViewer,
} from '@/features/editor/coordinators/command-bus';

export function useEditorInstance() {
  return {
    engine: getActiveEditorEngine(),
    getContent: getActiveEditorContent,
  };
}

export function useViewerInstance() {
  return {
    viewer: getActivePdfViewer(),
  };
}
