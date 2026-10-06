'use client';

/**
 * use-editor-save.ts
 *
 * Facade hook bridging legacy callers to the unified DocumentSessionCoordinator & useDocumentSession.
 */

import {
  useDocumentSession,
  extractStringContent,
  type UseDocumentSessionOptions,
} from '@/features/editor/core';

export { extractStringContent };
export type UseEditorSaveOptions = UseDocumentSessionOptions;

export function useEditorSave(options: UseEditorSaveOptions) {
  return useDocumentSession(options);
}
