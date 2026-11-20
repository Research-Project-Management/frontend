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
 * - Attachment notifications for Library and Uploaded Documents
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 * Layer: Block 6 (UI Features) - Primary Sidebar AI Viewlet.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { EditorPatchItem } from '@/features/ai';
import {
  editorCommandBus,
  getActiveEditorEngine,
  getEditorEngineForFile,
  usePageStore,
} from '@/features/editor/core';
import {
  computePreambleInsertion,
  isPreambleOnlySnippet,
} from '@/features/editor/domain/latex/latex-preamble-patch';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import { aiCoordinator } from '../coordinator/ai.coordinator';

export type AttachmentSource = 'library' | 'documents';

export interface UseAiChatActionsOptions {
  engine?: IEditorEngine | null;
  selectionFileId?: string | null;
}

export function useAiChatActions({ engine, selectionFileId }: UseAiChatActionsOptions = {}) {
  const insertAtCursor = useCallback(
    (text: string) => {
      const targetEngine = engine ?? getActiveEditorEngine();
      if (targetEngine?.isReadOnly?.()) {
        toast.info('Editor is in read-only mode', { id: 'ai-insert-readonly' });
        return;
      }
      if (isPreambleOnlySnippet(text) && typeof targetEngine?.getContent === 'function') {
        const patch = computePreambleInsertion(targetEngine.getContent(), text);
        if (patch) {
          if (!patch.changed) {
            toast.info('Package(s) already present in preamble', { id: 'ai-insert-code' });
            return;
          }
          if (typeof targetEngine.replaceRange === 'function') {
            targetEngine.replaceRange(patch.insertText, patch.from, patch.to);
          } else if (typeof targetEngine.setContent === 'function') {
            targetEngine.setContent(patch.updated);
          } else {
            editorCommandBus.dispatch({ type: 'editor:set-content', content: patch.updated });
          }
          editorCommandBus.dispatch({ type: 'editor:focus' });
          toast.success('Added package(s) to preamble', { id: 'ai-insert-code' });
          return;
        }
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

  const reviewEditorPatch = useCallback((patch: EditorPatchItem) => {
    aiCoordinator.proposePatch(patch);
  }, []);

  const applyAllEditorPatches = useCallback((patches: EditorPatchItem[]) => {
    const result = aiCoordinator.applyAllPatches(patches);
    if (result.applied > 0 && result.failed === 0) {
      toast.success(`Applied ${result.applied} verified patch(es)`, {
        id: 'ai-diff-status',
      });
    } else if (result.applied > 0) {
      toast.info(
        `Applied ${result.applied} patch(es); ${result.failed} skipped for manual review`,
        { id: 'ai-diff-status' },
      );
    } else if (result.failed > 0) {
      toast.error('Could not apply patches directly; click Review Diff per hunk.', {
        id: 'ai-diff-status',
      });
    }
  }, []);

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
    reviewEditorPatch,
    applyAllEditorPatches,
    copyCode,
    notifyItemsAttached,
    notifyFileAttached,
    notifyFileError,
    notifyChatError,
    notifyChatCleared,
  };
}
