'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPdfBlob } from '../services/items.service';
import { getErrorMessage } from '@/shared/utils/error.util';

export interface UsePdfReturn {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Fetches a PDF via authenticated blob request and manages
 * the resulting object URL lifecycle (create + revoke on unmount or retry).
 */
export function usePdf(url: string | null): UsePdfReturn {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    // Abort any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Revoke any previous object URL
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }

    if (!url) {
      setBlobUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let active = true;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setError(null);
        setBlobUrl(null);

        const blob = await fetchPdfBlob(url!, controller.signal);

        if (active) {
          const newObjectUrl = URL.createObjectURL(blob);
          currentBlobUrlRef.current = newObjectUrl;
          setBlobUrl(newObjectUrl);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        if (active) {
          console.error('[usePdf] PDF load error:', err);
          setError(getErrorMessage(err) || 'Không thể tải tài liệu PDF.');
          setBlobUrl(null);
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      active = false;
      controller.abort();
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [url, retryCount]);

  return { blobUrl, isLoading, error, retry };
}
