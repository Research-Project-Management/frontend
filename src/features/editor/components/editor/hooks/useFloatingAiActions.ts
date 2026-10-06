'use client';

/**
 * useFloatingAiActions.ts
 *
 * Dedicated custom hook encapsulating floating AI assistant actions and notifications:
 * - Copy suggestion to clipboard with status toast
 * - Apply suggestion (replace selection or insert below) with status toast
 * - Error notification on AI failure
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

export function useFloatingAiActions() {
  const copySuggestion = useCallback((text?: string, onSuccess?: () => void) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (onSuccess) onSuccess();
    toast.success('Copied suggestion to clipboard');
  }, []);

  const applySuggestion = useCallback(
    (
      text: string,
      mode: 'replace' | 'insert-below',
      onApplyEdit: (text: string, mode: 'replace' | 'insert-below') => void,
      onClose: () => void,
    ) => {
      onApplyEdit(text, mode);
      toast.success(mode === 'replace' ? 'Selection replaced!' : 'Inserted below selection!');
      onClose();
    },
    [],
  );

  const notifyAiError = useCallback((message?: string) => {
    toast.error(message || 'Failed to generate AI suggestion');
  }, []);

  return {
    copySuggestion,
    applySuggestion,
    notifyAiError,
  };
}
