'use client';

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
import {
  uploadFile,
  uploadLargeFileResumable,
  createFileRecord,
  type CreateFileRecordParams,
  type ResumableUploadOptions,
} from '../services/upload.service';

export function useFileUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  const upload = useCallback(
    async (
      file: File,
      params: {
        projectId?: string;
        pageId?: string;
        parentId?: string | null;
        metaData?: Record<string, unknown>;
      } = {},
    ) => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      try {
        let result;
        if (file.size > 15 * 1024 * 1024) {
          // Use multipart chunked upload for files > 15MB
          result = await uploadLargeFileResumable(file, {
            projectId: params.projectId,
            parentId: params.parentId,
            pageId: params.pageId,
            onProgress: (p: number) => setProgress(p),
          });
        } else {
          result = await uploadFile(file, {
            ...params,
            onProgress: (p: number) => setProgress(p),
          });
        }

        queryClient.invalidateQueries({ queryKey: storageKeys.all });
        return result;
      } catch (err: unknown) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [queryClient],
  );

  const reset = useCallback(() => {
    setProgress(0);
    setIsUploading(false);
    setError(null);
  }, []);

  return {
    upload,
    progress,
    isUploading,
    error,
    reset,
  };
}

export function useMultipartUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const startUpload = useCallback(
    async (file: File, options: ResumableUploadOptions = {}) => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsUploading(true);
      setIsPaused(false);
      setProgress(0);

      try {
        const result = await uploadLargeFileResumable(file, {
          ...options,
          signal: abortController.signal,
          onProgress: (p) => setProgress(p),
        });
        queryClient.invalidateQueries({ queryKey: storageKeys.all });
        return result;
      } finally {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    },
    [queryClient],
  );

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
      setProgress(0);
    }
  }, []);

  return {
    startUpload,
    cancelUpload,
    progress,
    isUploading,
    isPaused,
  };
}

export const useCreateFileRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFileRecordParams) => createFileRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};
