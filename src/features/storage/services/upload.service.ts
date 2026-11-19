/**
 * @file upload.service.ts
 * @description Frontend service mirroring backend UploadController.
 * Handles direct uploads, presigned S3 uploads, and S3 multipart resumable chunked uploads with progress tracking.
 */

import { apiPost, apiDelete, apiGet, getAuthToken } from '@/shared/lib/api';
import { API_BASE_URL } from '@/config/env';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { smartUpload } from '@/shared/lib/smart-upload-engine';
import type { UploadFileParams } from '../types/storage.types';
export type { UploadFileParams };

export interface PresignUploadDto {
  filename: string;
  mimeType?: string;
  size?: number;
  spaceId?: string;
  projectId?: string;
  pageId?: string;
  parentId?: string | null;
  contentHash?: string;
  metaData?: Record<string, unknown> | null;
}

export interface PresignUploadResult {
  uploadUrl: string;
  storageKey: string;
  fileUuid: string;
  expiresIn: number;
  deduplicated?: boolean;
  fileId?: string;
  path?: string;
  url?: string;
}

export interface CompletePresignedParams {
  storageKey: string;
  filename: string;
  size?: number;
  sizeBytes?: number;
  mimeType?: string;
  spaceId?: string;
  projectId?: string;
  pageId?: string;
  parentId?: string | null;
  contentHash?: string;
  metaData?: Record<string, unknown> | null;
}

export interface InitiateMultipartResult {
  sessionId: string;
  uploadId: string;
  partSize: number;
  totalParts: number;
  deduplicated?: boolean;
  fileId?: string;
  url?: string;
  filename?: string;
  size?: number;
}

export interface PartUrlResult {
  partNumber: number;
  uploadUrl: string;
}

export interface MultipartPartDto {
  partNumber: number;
  eTag: string;
}

export interface ResumableUploadOptions {
  spaceId?: string;
  projectId?: string;
  pageId?: string;
  parentId?: string | null;
  chunkSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

// ── 1. Presigned & Direct Upload ─────────────────────────────────────────────

export const presignUpload = (dto: PresignUploadDto) => {
  const { projectId, spaceId, ...rest } = dto;
  const effectiveSpaceId = spaceId ?? projectId;
  return apiPost<PresignUploadResult>('/api/v1/experiments/files/presign', {
    ...rest,
    ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
  });
};

export const completePresigned = (params: CompletePresignedParams) => {
  const { projectId, spaceId, ...rest } = params;
  const effectiveSpaceId = spaceId ?? projectId;
  return apiPost<{
    id: string;
    fileId: string;
    blobId: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  }>('/api/v1/experiments/files/presign/complete', {
    ...rest,
    ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
  });
};

export const uploadDirectWithProgress = (
  blob: Blob | File,
  fileName: string,
  onProgress?: (progress: number) => void,
  options?: {
    spaceId?: string;
    projectId?: string;
    pageId?: string;
    parentId?: string | null;
    signal?: AbortSignal;
  },
): Promise<{ url: string; path: string; fileId: string }> => {
  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted) {
      return reject(new Error('Upload aborted'));
    }

    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('fileName', fileName);
    const effectiveSpaceId = options?.spaceId ?? options?.projectId;
    if (effectiveSpaceId) formData.append('spaceId', effectiveSpaceId);
    if (options?.pageId) formData.append('pageId', options.pageId);
    if (options?.parentId) formData.append('parentId', options.parentId);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          interface UploadResponsePayload {
            fileId?: string;
            id?: string;
            url?: string;
            path?: string;
            file?: { id?: string; url?: string };
          }
          const response = JSON.parse(xhr.responseText) as UploadResponsePayload & { data?: UploadResponsePayload };
          const payload = response.data || response;
          const fileId = payload.fileId || payload.file?.id || payload.id || '';
          const url = payload.url || payload.file?.url || payload.path || '';
          const path = payload.path || payload.url || url;
          resolve({ url, path, fileId });
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        reject(new Error(`Failed to upload file. Status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    if (options?.signal) {
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    const targetUploadUrl =
      typeof window !== 'undefined'
        ? '/api/v1/experiments/files/upload'
        : `${API_BASE_URL}/api/v1/experiments/files/upload`;
    xhr.open('POST', targetUploadUrl, true);
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
};

export const uploadBlobWithPresigned = async (
  blob: Blob | File,
  fileName: string,
  options?: {
    spaceId?: string;
    projectId?: string;
    pageId?: string;
    parentId?: string | null;
    metaData?: Record<string, unknown> | null;
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
  } | ((progress: number) => void),
): Promise<{ url: string; path: string; fileId?: string }> => {
  const onProgress = typeof options === 'function' ? options : options?.onProgress;
  const spaceId =
    typeof options === 'object' ? (options?.spaceId ?? options?.projectId) : undefined;
  const pageId = typeof options === 'object' ? options?.pageId : undefined;
  const parentId = typeof options === 'object' ? options?.parentId : undefined;
  const metaData = typeof options === 'object' ? options?.metaData : undefined;
  const signal = typeof options === 'object' ? options?.signal : undefined;

  const result = await smartUpload(blob, {
    baseEndpoint: '/api/v1/experiments/files',
    filename: fileName,
    mimeType: blob.type || 'application/octet-stream',
    spaceId,
    pageId,
    parentId,
    metaData,
    multipartThresholdBytes: Number.MAX_SAFE_INTEGER,
    signal,
    onProgress,
  });

  return {
    url: result.path || result.url,
    path: result.path || result.url,
    fileId: result.fileId,
  };
};

// ── 2. Multipart Chunked Upload (S3 Protocol for Large Files) ───────────────

export const initiateMultipart = (
  filename: string,
  mimeType: string,
  totalSize: number,
  spaceId?: string | null,
  parentId?: string | null,
  expectedHash?: string,
  pageId?: string | null,
) => {
  return apiPost<InitiateMultipartResult>('/api/v1/experiments/files/multipart/initiate', {
    filename,
    mimeType,
    totalSize,
    sizeBytes: totalSize,
    spaceId,
    pageId,
    parentId,
    expectedHash,
  });
};

export const getMultipartPartUrl = (
  sessionId: string,
  partNumber: number,
) => {
  return apiGet<PartUrlResult>(
    `/api/v1/experiments/files/multipart/${encodeURIComponent(sessionId)}/part-url?partNumber=${partNumber}`,
  );
};

export const uploadPartToS3 = (
  uploadUrl: string,
  partNumber: number,
  chunk: Blob,
  signal?: AbortSignal,
  onChunkProgress?: (loaded: number, total: number) => void,
): Promise<MultipartPartDto> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Upload aborted'));

    const xhr = new XMLHttpRequest();
    if (onChunkProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onChunkProgress(e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const rawEtag =
          xhr.getResponseHeader('ETag') ||
          xhr.getResponseHeader('etag') ||
          '';
        const eTag = rawEtag.replace(/^"|"$/g, '');
        resolve({ partNumber, eTag });
      } else {
        reject(new Error(`S3 part upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during S3 part upload'));
    xhr.onabort = () => reject(new Error('Part upload aborted'));
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.open('PUT', uploadUrl, true);
    xhr.send(chunk);
  });
};

export const completeMultipart = (
  sessionId: string,
  parts: MultipartPartDto[],
) => {
  return apiPost<{ fileId: string; blobId?: string; url: string; filename: string; size: number }>(
    '/api/v1/experiments/files/multipart/complete',
    {
      sessionId,
      parts,
    },
  );
};

export const abortMultipart = (sessionId: string) => {
  return apiDelete<{ success: boolean }>(
    `/api/v1/experiments/files/multipart/${encodeURIComponent(sessionId)}`,
  );
};

/**
 * Resumable multi-chunk upload for large research datasets (>15MB).
 * Delegates to Unified SmartUploadEngine (persistent checkpoints, bounded concurrency, instant CAS dedup).
 */
export const uploadLargeFileResumable = async (
  file: File,
  options: ResumableUploadOptions = {},
): Promise<{ fileId: string; url: string }> => {
  const result = await smartUpload(file, {
    baseEndpoint: '/api/v1/experiments/files',
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    spaceId: options.spaceId ?? options.projectId,
    pageId: options.pageId,
    parentId: options.parentId,
    multipartThresholdBytes: 0,
    signal: options.signal,
    onProgress: options.onProgress,
  });

  return { fileId: result.fileId, url: result.url };
};

// ── 3. High-Level Facade Functions ──────────────────────────────────────────

export const uploadFile = async (
  file: File,
  params: UploadFileParams,
): Promise<{ fileId: string; url: string }> => {
  const effectiveSpaceId = (params.spaceId ?? params.projectId) || undefined;
  const result = await smartUpload(file, {
    baseEndpoint: '/api/v1/experiments/files',
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    spaceId: effectiveSpaceId,
    pageId: params.pageId || undefined,
    parentId: params.parentId,
    metaData: params.metaData,
    onProgress: params.onProgress,
    resolveUrl: resolveFileUrl,
  });

  return { fileId: result.fileId, url: result.url };
};

export { uploadGenericFile } from '@/shared/lib/file-client';
