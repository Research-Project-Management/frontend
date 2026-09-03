'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

export function useLibraryClipboard() {
  const copyToClipboard = useCallback((text: string, label: string = 'Copied to clipboard') => {
    if (!text || !text.trim()) {
      toast.error('Nothing to copy', { id: 'library-clipboard' });
      return;
    }
    try {
      navigator.clipboard.writeText(text);
      toast.success(label, { id: 'library-clipboard' });
    } catch {
      toast.error('Failed to copy to clipboard', { id: 'library-clipboard' });
    }
  }, []);

  return { copyToClipboard };
}
