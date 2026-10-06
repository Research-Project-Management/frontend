'use client';

/**
 * useEditorSearchActions.ts
 *
 * Dedicated custom hook encapsulating search & replace notification feedback:
 * - Replacement count summary toast
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

export function useEditorSearchActions() {
  const notifyReplaceAll = useCallback((count: number) => {
    toast.success(
      count > 0
        ? `Replaced ${count} occurrence${count > 1 ? 's' : ''}`
        : 'Replaced all occurrences',
    );
  }, []);

  return {
    notifyReplaceAll,
  };
}
