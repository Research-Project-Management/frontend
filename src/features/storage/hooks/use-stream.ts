/**
 * @file use-stream.ts
 * @description Frontend hooks mirroring backend StreamController.
 * Provides hooks for authenticated streaming endpoints, RFC 7233 partial content, and file downloads.
 */

import { useState, useCallback, useMemo } from 'react';
import { resolveStreamUrl, downloadFile } from '../services/stream.service';

export function useStreamUrl(fileIdOrUrl?: string | null) {
  return useMemo(() => {
    return resolveStreamUrl(fileIdOrUrl);
  }, [fileIdOrUrl]);
}

export function useFileDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const download = useCallback(async (urlOrFileId: string, filename: string) => {
    setIsDownloading(true);
    setError(null);
    try {
      const streamUrl = resolveStreamUrl(urlOrFileId);
      if (!streamUrl) throw new Error('Invalid file URL or ID');
      downloadFile(streamUrl, filename);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    download,
    isDownloading,
    error,
  };
}
