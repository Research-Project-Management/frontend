'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export const READER_TOAST_IDS = {
  clipboard: 'reader-clipboard',
  download: 'reader-download',
  exportAnnotatedPdf: 'reader-export-annotated-pdf',
  ocr: 'reader-ocr-trigger',
  itemUpdate: 'reader-item-update',
  note: 'reader-note-toast',
  annotation: 'reader-annotation-toast',
  conversion: 'reader-type-conversion',
  retraction: 'reader-retraction-check',
  batchAction: 'reader-batch-action',
} as const;

/**
 * Standardized Clipboard Hook for Reader
 * Ensures single-toast deduplication, standard messages, and reactive copied state.
 */
export function useReaderClipboard(resetDelay = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const copy = useCallback(
    async (text: string | null | undefined, label?: string): Promise<boolean> => {
      const clean = text?.trim();
      if (!clean) {
        toast.error('Nothing to copy', { id: READER_TOAST_IDS.clipboard });
        return false;
      }

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(clean);
        } else if (typeof document !== 'undefined') {
          const textarea = document.createElement('textarea');
          textarea.value = clean;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        } else {
          throw new Error('Clipboard API not available');
        }

        const successMessage = label ? `Copied ${label} to clipboard` : 'Copied to clipboard';
        toast.success(successMessage, { id: READER_TOAST_IDS.clipboard });

        const activeKey = label || 'copied';
        setCopiedKey(activeKey);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCopiedKey(null);
        }, resetDelay);

        return true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Could not copy to clipboard';
        toast.error(errorMsg, { id: READER_TOAST_IDS.clipboard });
        return false;
      }
    },
    [resetDelay],
  );

  return {
    copy,
    copiedKey,
    isCopied: (key?: string) => (key ? copiedKey === key : Boolean(copiedKey)),
  };
}

/**
 * Standardized File Download Hook for Reader
 * Ensures safe browser trigger and single-toast feedback.
 */
export function useReaderFileDownload() {
  const download = useCallback(
    (filename: string, content: string | null | undefined, mimeType = 'text/plain;charset=utf-8') => {
      if (!content || !content.trim()) {
        toast.error('No content available to download', { id: READER_TOAST_IDS.download });
        return false;
      }

      try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 200);

        toast.success(`Downloaded ${filename}`, { id: READER_TOAST_IDS.download });
        return true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Download failed';
        toast.error(errorMsg, { id: READER_TOAST_IDS.download });
        return false;
      }
    },
    [],
  );

  return { download };
}
