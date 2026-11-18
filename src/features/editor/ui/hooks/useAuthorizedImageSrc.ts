'use client';

import { useEffect, useState } from 'react';
import { fetchAuthorized, resolveFileUrl } from '@/shared/lib/file-client';

/**
 * Fetches protected filestore binary image assets with `Authorization: Bearer`
 * headers and exposes a lifecycle-managed Blob URL for `<img>` tags.
 */
export function useAuthorizedImageSrc(rawUrl?: string | null): string {
  const resolved = rawUrl ? resolveFileUrl(rawUrl) || '' : '';
  const isInlineOrBlob = resolved.startsWith('blob:') || resolved.startsWith('data:');
  const [loaded, setLoaded] = useState<{ sourceUrl: string; blobUrl: string }>({
    sourceUrl: '',
    blobUrl: '',
  });

  useEffect(() => {
    if (!resolved || isInlineOrBlob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return;
    }

    let active = true;
    let createdUrl = '';
    const controller = new AbortController();

    fetchAuthorized(resolved, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setLoaded({ sourceUrl: resolved, blobUrl: createdUrl });
      })
      .catch(() => {
        if (active) {
          setLoaded({ sourceUrl: resolved, blobUrl: '' });
        }
      });

    return () => {
      active = false;
      controller.abort();
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [resolved, isInlineOrBlob]);

  if (!resolved) return '';
  if (isInlineOrBlob) return resolved;
  return loaded.sourceUrl === resolved ? loaded.blobUrl : '';
}
