'use client';

/**
 * useAiChatActions.ts
 *
 * Dedicated custom hook encapsulating AI chat interactions, editor integrations, and notifications:
 * - Insert AI-generated code at cursor in active document
 * - Replace active selection with AI code
 * - Copy snippet to clipboard with feedback
 * - File upload and chat notifications
 * - Attachment notifications for Library, Storage, and Uploaded Documents
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

export interface UseAiChatActionsOptions {
  engine?: any;
}

export function useAiChatActions({ engine }: UseAiChatActionsOptions = {}) {
  const insertAtCursor = useCallback(
    (text: string) => {
      if (!engine) {
        toast.error('Editor not ready');
        return;
      }
      engine.insertText(text);
      engine.focus();
      toast.success('Inserted code into document');
    },
    [engine],
  );

  const replaceSelection = useCallback(
    (text: string) => {
      if (!engine) {
        toast.error('Editor not ready');
        return;
      }
      engine.insertText(text);
      engine.focus();
      toast.success('Replaced selection with AI code');
    },
    [engine],
  );

  const proposeDiff = useCallback(
    (code: string, title?: string) => {
      if (!engine) {
        toast.error('Editor not ready');
        return;
      }

      if (typeof engine.proposeDiff === 'function') {
        const offsets = typeof engine.getSelectionOffsets === 'function' ? engine.getSelectionOffsets() : null;
        const originalText = engine.getSelectedText ? engine.getSelectedText() : '';
        const from = offsets?.from ?? 0;
        const to = offsets?.to ?? from;

        engine.proposeDiff({
          id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from,
          to,
          originalText,
          replacementText: code,
          title: title || (to > from ? 'AI Selection Diff' : 'AI Suggested Insertion'),
          createdAt: Date.now(),
        });
        engine.focus();
        toast.info('Active diff proposal in editor (⌘⏎ Accept, Esc Reject)');
      } else {
        engine.insertText(code);
        engine.focus();
        toast.success('Inserted AI code into document');
      }
    },
    [engine],
  );

  const copyCode = useCallback(async (code: string, onSuccess?: () => void) => {
    try {
      await navigator.clipboard.writeText(code);
      if (onSuccess) onSuccess();
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const notifyFileAttached = useCallback((fileName: string) => {
    toast.success(`Attached "${fileName}"`);
  }, []);

  const notifyFileError = useCallback((fileName: string, errMessage?: string) => {
    toast.error(errMessage || `Failed to upload "${fileName}"`);
  }, []);

  const notifyChatError = useCallback((errMessage?: string) => {
    toast.error(errMessage || 'Failed to send message to AI');
  }, []);

  const notifyChatCleared = useCallback(() => {
    toast.success('Conversation history cleared');
  }, []);

  const notifyLibraryAttached = useCallback((count: number) => {
    toast.success(`Attached ${count} item(s) from Library`);
  }, []);

  const notifyStorageAttached = useCallback((count: number) => {
    toast.success(`Attached ${count} file(s) from Storage`);
  }, []);

  const notifyDocumentsAttached = useCallback((count: number) => {
    toast.success(`Selected ${count} uploaded document(s)`);
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
