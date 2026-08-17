'use client';

import { useState, useCallback, useRef } from 'react';
import { apiPost, getAuthToken } from '@/shared/lib/api';
import { API_BASE_URL } from '@/shared/constants';

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

// Backward compatible options
export type UploadOptions = UseUploadOptions | {
  prefix?: string;
  onProgress?: (progress: number) => void;
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
};

export function useUpload() {
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  // For backward compatibility
  const [legacyProgress, setLegacyProgress] = useState(0);
  const [legacyError, setLegacyError] = useState<Error | null>(null);
  const lastUploadId = useRef<string | null>(null);

  const isUploading = Object.values(uploads).some(u => u.status === 'uploading');

  const updateUploadState = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploads(prev => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: { ...current, ...updates }
      };
    });
  }, []);

  const uploadFileInternal = useCallback(async (
    file: File,
    options: UseUploadOptions = {}
  ): Promise<{ id: string; url: string }> => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7);
    const prefix = options.prefix ?? "general";
    
    lastUploadId.current = id;
    setLegacyError(null);
    setLegacyProgress(0);

    // Initial state
    setUploads(prev => ({
      ...prev,
      [id]: {
        id,
        file,
        progress: 0,
        status: 'pending',
      }
    }));

    // Validation
    if (options.maxSize && file.size > options.maxSize) {
      const error = new Error(`File size exceeds limit of ${options.maxSize} bytes`);
      updateUploadState(id, { status: 'error', error });
      setLegacyError(error);
      options.onError?.(id, error);
      throw error;
    }
    
    if (options.allowedTypes && options.allowedTypes.length > 0) {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
      const mime = file.type?.toLowerCase() || '';

      const isValid = options.allowedTypes.some(type => {
        const t = type.toLowerCase();
        if (t.endsWith('/*')) {
          return mime.startsWith(t.replace('/*', ''));
        }
        if (t.startsWith('.')) {
          return ext === t;
        }
        if (t === 'application/pdf') {
          return mime === 'application/pdf' || ext === '.pdf';
        }
        return mime === t || (ext && t.includes(ext.replace('.', '')));
      });

      if (!isValid) {
        const error = new Error(`File type "${file.type || ext}" is not allowed`);
        updateUploadState(id, { status: 'error', error });
        setLegacyError(error);
        options.onError?.(id, error);
        throw error;
      }
    }

    updateUploadState(id, { status: 'uploading' });

    const controller = new AbortController();
    abortControllers.current[id] = controller;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);

      if (prefix) {
        const [scopeType, scopeId] = prefix.split("/");
        if (scopeType === "workspace" && scopeId) {
          formData.append("workspaceId", scopeId);
        } else if (scopeType === "project" && scopeId) {
          formData.append("projectId", scopeId);
        } else if (scopeType === "page" && scopeId) {
          formData.append("pageId", scopeId);
        }
      }

      // 1. Upload to backend proxy with XMLHttpRequest for progress tracking
      const uploadUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            updateUploadState(id, { progress: percentComplete });
            
            if (lastUploadId.current === id) {
              setLegacyProgress(percentComplete);
            }
            
            options.onProgress?.(id, percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              const rawUrl = response.url || response.file?.url || response.path || '';
              const resolvedUrl = rawUrl.startsWith('http') ? rawUrl : `${API_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
              resolve(resolvedUrl);
            } catch (err) {
              reject(new Error("Failed to parse backend response"));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted by user"));

        xhr.open("POST", `${API_BASE_URL}/api/files/upload-r2`, true);

        const token = getAuthToken();
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        xhr.send(formData);

        controller.signal.addEventListener("abort", () => {
          xhr.abort();
        });
      });

      updateUploadState(id, { status: 'success', progress: 100, url: uploadUrl });
      options.onSuccess?.(id, uploadUrl);
      return { id, url: uploadUrl };
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error("Unknown upload error");
      const isAborted = uploadError.message === "Upload aborted by user";
      
      updateUploadState(id, { 
        status: isAborted ? 'aborted' : 'error', 
        error: uploadError 
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
  }, [updateUploadState]);

  // Backward compatible uploadFile
  const uploadFile = useCallback(async (
    file: File, 
    optionsOrPrefix?: string | UploadOptions
  ): Promise<string> => {
    // Normalize options
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
      
      // Map legacy callbacks to new callbacks if necessary
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
        }
      });
      legacyOnSuccess?.(url);
      return url;
    } catch (err) {
      legacyOnError?.(err as Error);
      throw err;
    }
  }, [uploadFileInternal]);

  const uploadFiles = useCallback(async (
    files: File[], 
    options?: UploadOptions
  ): Promise<string[]> => {
    return Promise.all(files.map(file => uploadFile(file, options)));
  }, [uploadFile]);

  const cancelUpload = useCallback((id: string) => {
    const controller = abortControllers.current[id];
    if (controller) {
      controller.abort();
    }
  }, []);

  const removeUpload = useCallback((id: string) => {
    cancelUpload(id);
    setUploads(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [cancelUpload]);

  const clearAll = useCallback(() => {
    Object.keys(abortControllers.current).forEach(id => cancelUpload(id));
    setUploads({});
    setLegacyProgress(0);
    setLegacyError(null);
  }, [cancelUpload]);

  // Backward compatible abort (aborts the last started upload)
  const abortUpload = useCallback(() => {
    if (lastUploadId.current) {
      cancelUpload(lastUploadId.current);
    }
  }, [cancelUpload]);

  return {
    // New abstract API
    uploads,
    cancelUpload,
    removeUpload,
    clearAll,
    
    // Core uploading methods
    uploadFile,
    uploadFiles,
    
    // Legacy API
    isUploading,
    progress: legacyProgress,
    error: legacyError,
    abortUpload,
  };
}
