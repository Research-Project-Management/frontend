'use client';

import { useState, useEffect } from 'react';
import { fetchPdfBlob } from '../../services/paper.service';

interface UsePdfReturn {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches a PDF via authenticated blob request and manages
 * the resulting object URL lifecycle (create + revoke on unmount).
 */
export function usePdf(url: string | null): UsePdfReturn {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let active = true;
    let currentBlobUrl: string | null = null;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setError(null);
        setBlobUrl(null);

        const blob = await fetchPdfBlob(url!);

        // Guard against JSON error responses disguised as blobs
        if (blob.type.includes('application/json') || blob.size < 100) {
          const text = await blob.text();
          if (text.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(text);
              throw new Error(parsed.message || parsed.error || 'Invalid response payload');
            } catch { /* re-throw only if JSON parsed a message */ }
          }
        }

        if (active) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (active) {
          console.error('PDF load error:', err);
          setError(err.message || 'Failed to load PDF file.');
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      active = false;
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [url]);

  return { blobUrl, isLoading, error };
}
