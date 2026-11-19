'use client';

/**
 * useAiChatActions.ts
 *
 * Dedicated custom hook encapsulating AI chat interactions, editor integrations, and notifications:
 * - Insert AI-generated code at cursor in active document
 * - Replace active selection with AI code
 * - Propose interactive inline diff in CodeMirror
 * - Copy snippet to clipboard with feedback
 * - File upload and chat notifications
 * - Attachment notifications for Library, Storage, and Uploaded Documents
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 * Layer: Block 6 (UI Features) - Primary Sidebar AI Viewlet.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { editorCommandBus, getEditorEngineForFile, usePageStore } from '@/features/editor/core';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import { aiCoordinator } from '../coordinator/ai.coordinator';

export type AttachmentSource = 'library' | 'storage' | 'documents';

export interface UseAiChatActionsOptions {
  engine?: IEditorEngine | null;
  selectionFileId?: string | null;
}

export function useAiChatActions({ engine, selectionFileId }: UseAiChatActionsOptions = {}) {
  const insertAtCursor = useCallback(
    (text: string) => {
      if (engine?.isReadOnly?.()) {
        toast.info('Editor is in read-only mode', { id: 'ai-insert-readonly' });
        return;
      }
      editorCommandBus.dispatch({ type: 'editor:insert-text', text });
      editorCommandBus.dispatch({ type: 'editor:focus' });
      toast.success('Inserted code into document', { id: 'ai-insert-code' });
    },
    [engine],
  );

  const replaceSelection = useCallback(
    (text: string) => {
      const pageState = usePageStore.getState();
      const activeId = pageState.activeFilePage?.id || pageState.currentPage?.id || null;
      const targetEngine =
        selectionFileId && selectionFileId !== activeId
          ? getEditorEngineForFile(selectionFileId)
          : engine;

      if (!targetEngine) {
        toast.error(
          selectionFileId && selectionFileId !== activeId
            ? 'Switch back to the file where the selection originated to replace it'
            : 'Editor not ready',
          { id: 'ai-insert-code' },
        );
        return;
      }
      if (targetEngine.isReadOnly?.()) {
        toast.info('Editor is in read-only mode', { id: 'ai-insert-readonly' });
        return;
      }
      targetEngine.insertText(text);
      targetEngine.focus();
      toast.success('Replaced selection with AI code', { id: 'ai-insert-code' });
    },
    [engine, selectionFileId],
  );

  const proposeDiff = useCallback(
    (code: string, title?: string) => {
      const pageState = usePageStore.getState();
      const activeId = pageState.activeFilePage?.id || pageState.getActiveDocument()?.id || 'main.tex';
      const targetFileId = selectionFileId || activeId;
      const targetEngine = selectionFileId ? getEditorEngineForFile(selectionFileId) || engine : engine;

      if (!targetEngine) {
        toast.error('Editor not ready', { id: 'ai-insert-code' });
        return;
      }
      if (targetEngine.isReadOnly?.()) {
        toast.info('Editor is in read-only mode', { id: 'ai-insert-readonly' });
        return;
      }
      aiCoordinator.proposeDiff(targetFileId, code, { title });
      targetEngine.focus();
    },
    [engine, selectionFileId],
  );

  const copyCode = useCallback(async (code: string, onSuccess?: () => void) => {
    try {
      await navigator.clipboard.writeText(code);
      onSuccess?.();
      toast.success('Copied to clipboard', { id: 'copy-code' });
    } catch {
      toast.error('Failed to copy to clipboard', { id: 'copy-code' });
    }
  }, []);

  const notifyItemsAttached = useCallback((count: number, source: AttachmentSource) => {
    const messages: Record<AttachmentSource, { text: string; id: string }> = {
      library: { text: `Attached ${count} item(s) from Library`, id: 'attach-library' },
      storage: { text: `Attached ${count} file(s) from Storage`, id: 'attach-storage' },
      documents: { text: `Selected ${count} uploaded document(s)`, id: 'attach-docs' },
    };
    const { text, id } = messages[source];
    toast.success(text, { id });
  }, []);

  const notifyFileAttached = useCallback(
    (fileName: string) => toast.success(`Attached "${fileName}"`, { id: `attach-${fileName}` }),
    [],
  );

  const notifyFileError = useCallback(
    (fileName: string, errMessage?: string) =>
      toast.error(errMessage || `Failed to upload "${fileName}"`, { id: `attach-${fileName}` }),
    [],
  );

  const notifyChatError = useCallback(
    (errMessage?: string) => toast.error(errMessage || 'Failed to send message to AI', { id: 'ai-chat-error' }),
    [],
  );

  const notifyChatCleared = useCallback(
    () => toast.success('Conversation history cleared', { id: 'ai-chat-clear' }),
    [],
  );

  return {
    insertAtCursor,
    replaceSelection,
    proposeDiff,
    copyCode,
    notifyItemsAttached,
    notifyFileAttached,
    notifyFileError,
    notifyChatError,
    notifyChatCleared,
  };
}
