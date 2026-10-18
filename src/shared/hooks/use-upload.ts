'use client';

import { useState, useCallback, useRef } from 'react';
import { validateFile, uploadFileXhr, uploadFileWithDetails } from '@/shared/lib/file-client';

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'aborted';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  url?: string;
  error?: Error;
}

export interface UseUploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  prefix?: string;
  onSuccess?: (id: string, url: string) => void;
  onError?: (id: string, error: Error) => void;
  onProgress?: (id: string, progress: number) => void;
}

export type UploadOptions = UseUploadOptions;

/**
 * Universal file upload hook with XMLHttpRequest progress tracking,
 * cancellation support, and multiple file uploads.
 */
export function useUpload() {
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const lastUploadId = useRef<string | null>(null);

  const isUploading = Object.values(uploads).some((u) => u.status === 'uploading');

  const updateUploadState = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploads((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: { ...current, ...updates },
      };
    });
  }, []);

  const uploadFileInternal = useCallback(
    async (
      file: File,
      options: UploadOptions = {},
    ): Promise<{ id: string; url: string; fileId?: string }> => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(7);
      const prefix = options.prefix ?? 'general';

      lastUploadId.current = id;
      setError(null);
      setProgress(0);

      // Initial state
      setUploads((prev) => ({
        ...prev,
        [id]: {
          id,
          file,
          progress: 0,
          status: 'pending',
        },
      }));

      // Validation via file-client
      const validation = validateFile(file, {
        maxSize: options.maxSize,
        allowedTypes: options.allowedTypes,
      });

      if (!validation.valid && validation.error) {
        updateUploadState(id, { status: 'error', error: validation.error });
        setError(validation.error);
        options.onError?.(id, validation.error);
        throw validation.error;
      }

      updateUploadState(id, { status: 'uploading' });

      const controller = new AbortController();
      abortControllers.current[id] = controller;

      try {
        const { url: uploadUrl, fileId } = await uploadFileWithDetails({
          file,
          prefix,
          signal: controller.signal,
          onProgress: (percentComplete) => {
            updateUploadState(id, { progress: percentComplete });
            if (lastUploadId.current === id) {
              setProgress(percentComplete);
            }
            options.onProgress?.(id, percentComplete);
          },
        });

        updateUploadState(id, { status: 'success', progress: 100, url: uploadUrl });
        options.onSuccess?.(id, uploadUrl);
        return { id, url: uploadUrl, fileId };
      } catch (err) {
        const uploadError = err instanceof Error ? err : new Error('Unknown upload error');
        const isAborted = uploadError.message === 'Upload aborted by user';

        updateUploadState(id, {
          status: isAborted ? 'aborted' : 'error',
          error: uploadError,
        });

        if (!isAborted) {
          if (lastUploadId.current === id) {
            setError(uploadError);
          }
          options.onError?.(id, uploadError);
        }
        throw uploadError;
      } finally {
        delete abortControllers.current[id];
      }
    },
    [updateUploadState],
  );

  const uploadFile = useCallback(
    async (file: File, options: UploadOptions = {}): Promise<string> => {
      const { url } = await uploadFileInternal(file, options);
      return url;
    },
    [uploadFileInternal],
  );

  const uploadFileDetailed = useCallback(
    async (
      file: File,
      options: UploadOptions = {},
    ): Promise<{ url: string; fileId: string }> => {
      const { url, fileId } = await uploadFileInternal(file, options);
      return { url, fileId: fileId || '' };
    },
    [uploadFileInternal],
  );

  const uploadFiles = useCallback(
    async (files: File[], options: UploadOptions = {}): Promise<string[]> => {
      return Promise.all(files.map((file) => uploadFile(file, options)));
    },
    [uploadFile],
  );

  const cancelUpload = useCallback((id: string) => {
    const controller = abortControllers.current[id];
    if (controller) {
      controller.abort();
    }
  }, []);

  const removeUpload = useCallback(
    (id: string) => {
      cancelUpload(id);
      setUploads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [cancelUpload],
  );

  const clearAll = useCallback(() => {
    Object.keys(abortControllers.current).forEach((id) => cancelUpload(id));
    setUploads({});
    setProgress(0);
    setError(null);
  }, [cancelUpload]);

  const abortUpload = useCallback(() => {
    if (lastUploadId.current) {
      cancelUpload(lastUploadId.current);
    }
  }, [cancelUpload]);

  return {
    uploads,
    cancelUpload,
    removeUpload,
    clearAll,
    uploadFile,
    uploadFileDetailed,
    uploadFiles,
    isUploading,
    progress,
    error,
    abortUpload,
  };
}
