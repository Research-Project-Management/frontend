'use client';

/**
 * useFormatToolbarActions.ts
 *
 * Dedicated custom hook encapsulating toolbar notification feedback:
 * - Insert figure success feedback
 * - AI table prompt info feedback
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

export function useFormatToolbarActions() {
  const notifyFigureInserted = useCallback((fileName: string) => {
    toast.success(`Inserted figure for ${fileName}`);
  }, []);

  const notifyAiTablePrompt = useCallback(() => {
    toast.info('Ask AI to generate a table from text or image');
  }, []);

  return {
    notifyFigureInserted,
    notifyAiTablePrompt,
  };
}
