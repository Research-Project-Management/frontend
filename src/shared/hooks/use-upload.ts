'use client';

import { useState, useCallback, useRef } from 'react';
import { validateFile, uploadFileXhr } from '@/shared/lib/file-client';

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

// Backward compatible options interface
export type UploadOptions =
  | UseUploadOptions
  | {
      prefix?: string;
      onProgress?: (progress: number) => void;
      onSuccess?: (url: string) => void;
      onError?: (error: Error) => void;
    };

/**
 * Universal file upload hook with XMLHttpRequest progress tracking,
 * cancellation support, and multiple file uploads.
 */
export function useUpload() {
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  const [legacyProgress, setLegacyProgress] = useState(0);
  const [legacyError, setLegacyError] = useState<Error | null>(null);
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
      options: UseUploadOptions = {},
    ): Promise<{ id: string; url: string }> => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(7);
      const prefix = options.prefix ?? 'general';

      lastUploadId.current = id;
      setLegacyError(null);
      setLegacyProgress(0);

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
        setLegacyError(validation.error);
        options.onError?.(id, validation.error);
        throw validation.error;
      }

      updateUploadState(id, { status: 'uploading' });

      const controller = new AbortController();
      abortControllers.current[id] = controller;

      try {
        const uploadUrl = await uploadFileXhr({
          file,
          prefix,
          signal: controller.signal,
          onProgress: (percentComplete) => {
            updateUploadState(id, { progress: percentComplete });
            if (lastUploadId.current === id) {
              setLegacyProgress(percentComplete);
            }
            options.onProgress?.(id, percentComplete);
          },
        });

        updateUploadState(id, { status: 'success', progress: 100, url: uploadUrl });
        options.onSuccess?.(id, uploadUrl);
        return { id, url: uploadUrl };
      } catch (err) {
        const uploadError = err instanceof Error ? err : new Error('Unknown upload error');
        const isAborted = uploadError.message === 'Upload aborted by user';

        updateUploadState(id, {
          status: isAborted ? 'aborted' : 'error',
          error: uploadError,
        });

        if (!isAborted) {
          if (lastUploadId.current === id) {
            setLegacyError(uploadError);
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
    async (file: File, optionsOrPrefix?: string | UploadOptions): Promise<string> => {
      let options: UseUploadOptions = {};
      let legacyOnSuccess: ((url: string) => void) | undefined;
      let legacyOnError: ((error: Error) => void) | undefined;
      let legacyOnProgress: ((progress: number) => void) | undefined;

      if (typeof optionsOrPrefix === 'string') {
        options.prefix = optionsOrPrefix;
      } else if (optionsOrPrefix) {
        options.prefix = optionsOrPrefix.prefix;
        options.maxSize = (optionsOrPrefix as UseUploadOptions).maxSize;
        options.allowedTypes = (optionsOrPrefix as UseUploadOptions).allowedTypes;

        if ('onSuccess' in optionsOrPrefix) {
          const os = optionsOrPrefix.onSuccess;
          if (os && os.length === 1) {
            legacyOnSuccess = os as (url: string) => void;
          } else {
            options.onSuccess = os as (id: string, url: string) => void;
          }
        }

        if ('onError' in optionsOrPrefix) {
          const oe = optionsOrPrefix.onError;
          if (oe && oe.length === 1) {
            legacyOnError = oe as (err: Error) => void;
          } else {
            options.onError = oe as (id: string, err: Error) => void;
          }
        }

        if ('onProgress' in optionsOrPrefix) {
          const op = optionsOrPrefix.onProgress;
          if (op && op.length === 1) {
            legacyOnProgress = op as (prog: number) => void;
          } else {
            options.onProgress = op as (id: string, prog: number) => void;
          }
        }
      }

      try {
        const { url } = await uploadFileInternal(file, {
          ...options,
          onProgress: (id, prog) => {
            options.onProgress?.(id, prog);
            legacyOnProgress?.(prog);
          },
        });
        legacyOnSuccess?.(url);
        return url;
      } catch (err) {
        legacyOnError?.(err as Error);
        throw err;
      }
    },
    [uploadFileInternal],
  );

  const uploadFiles = useCallback(
    async (files: File[], options?: UploadOptions): Promise<string[]> => {
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
    setLegacyProgress(0);
    setLegacyError(null);
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
    uploadFiles,
    isUploading,
    progress: legacyProgress,
    error: legacyError,
    abortUpload,
  };
}
