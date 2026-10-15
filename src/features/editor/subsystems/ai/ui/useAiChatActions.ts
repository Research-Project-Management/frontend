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
import { editorCommandBus } from '@/features/editor/core';
import type { EditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

export interface UseAiChatActionsOptions {
  engine?: EditorEngine | null;
}

export function useAiChatActions({ engine }: UseAiChatActionsOptions = {}) {
  const insertAtCursor = useCallback(
    (text: string) => {
      editorCommandBus.dispatch({ type: 'editor:insert-text', text });
      editorCommandBus.dispatch({ type: 'editor:focus' });
      toast.success('Inserted code into document', { id: 'ai-insert-code' });
    },
    [],
  );

  const replaceSelection = useCallback(
    (text: string) => {
      if (!engine) {
        toast.error('Editor not ready', { id: 'ai-insert-code' });
        return;
      }
      engine.insertText(text);
      engine.focus();
      toast.success('Replaced selection with AI code', { id: 'ai-insert-code' });
    },
    [engine],
  );

  const proposeDiff = useCallback(
    (code: string, title?: string) => {
      if (!engine) {
        toast.error('Editor not ready', { id: 'ai-insert-code' });
        return;
      }

      if (typeof engine.proposeDiff === 'function') {
        const offsets = typeof engine.getSelectionOffsets === 'function' ? engine.getSelectionOffsets() : null;
        const originalText = engine.getSelectedText ? engine.getSelectedText() : '';
        const from = offsets?.from ?? 0;
        const to = offsets?.to ?? from;

        const proposal = {
          id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from,
          to,
          originalText,
          replacementText: code,
          title: title || (to > from ? 'AI Selection Diff' : 'AI Suggested Insertion'),
          createdAt: Date.now(),
        };

        editorCommandBus.dispatch({ type: 'ai:propose-diff', proposal });
        engine.focus();
        toast.info('Review AI diff proposal (Tab to Accept, Esc to Reject)', { id: 'ai-diff-proposal' });
      } else {
        engine.insertText(code);
        engine.focus();
        toast.success('Inserted AI code into document', { id: 'ai-diff-status' });
      }
    },
    [engine],
  );

  const copyCode = useCallback(async (code: string, onSuccess?: () => void) => {
    try {
      await navigator.clipboard.writeText(code);
      if (onSuccess) onSuccess();
      toast.success('Copied to clipboard', { id: 'copy-code' });
    } catch {
      toast.error('Failed to copy to clipboard', { id: 'copy-code' });
    }
  }, []);

  const notifyFileAttached = useCallback((fileName: string) => {
    toast.success(`Attached "${fileName}"`, { id: `attach-${fileName}` });
  }, []);

  const notifyFileError = useCallback((fileName: string, errMessage?: string) => {
    toast.error(errMessage || `Failed to upload "${fileName}"`, { id: `attach-${fileName}` });
  }, []);

  const notifyChatError = useCallback((errMessage?: string) => {
    toast.error(errMessage || 'Failed to send message to AI', { id: 'ai-chat-error' });
  }, []);

  const notifyChatCleared = useCallback(() => {
    toast.success('Conversation history cleared', { id: 'ai-chat-clear' });
  }, []);

  const notifyLibraryAttached = useCallback((count: number) => {
    toast.success(`Attached ${count} item(s) from Library`, { id: 'attach-library' });
  }, []);

  const notifyStorageAttached = useCallback((count: number) => {
    toast.success(`Attached ${count} file(s) from Storage`, { id: 'attach-storage' });
  }, []);

  const notifyDocumentsAttached = useCallback((count: number) => {
    toast.success(`Selected ${count} uploaded document(s)`, { id: 'attach-docs' });
  }, []);

  return {
    insertAtCursor,
    replaceSelection,
    proposeDiff,
    copyCode,
    notifyFileAttached,
    notifyFileError,
    notifyChatError,
    notifyChatCleared,
    notifyLibraryAttached,
    notifyStorageAttached,
    notifyDocumentsAttached,
  };
}
