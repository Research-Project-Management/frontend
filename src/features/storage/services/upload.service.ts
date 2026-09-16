/**
 * @file upload.service.ts
 * @description Frontend service mirroring backend UploadController.
 * Handles direct uploads, presigned S3 uploads, and S3 multipart resumable chunked uploads with progress tracking.
 */

import { apiPost, apiDelete, apiGet, getAuthToken } from '@/shared/lib/api';
import { API_BASE_URL } from '@/config/env';

export interface UploadFileParams {
  projectId?: string;
  pageId?: string;
  parentId?: string | null;
  onProgress?: (progress: number) => void;
  metaData?: Record<string, any>;
}

export interface CreateFileRecordParams {
  filename: string;
  size: number;
  mimeType?: string;
  url: string;
  thumbnail?: string | null;
  parentId?: string | null;
  projectId?: string;
  pageId?: string;
  metaData?: Record<string, any>;
}

export interface PresignUploadDto {
  filename: string;
  mimeType?: string;
  size?: number;
  projectId?: string;
  pageId?: string;
  metaData?: Record<string, unknown> | null;
}

export interface PresignUploadResult {
  uploadUrl: string;
  storageKey: string;
  fileUuid: string;
  expiresIn: number;
  signedUrl?: string; // backwards compatibility alias
  path?: string;
  url?: string;
}

export interface CompletePresignedParams {
  storageKey: string;
  filename: string;
  size?: number;
  sizeBytes?: number;
  mimeType?: string;
  projectId?: string;
  parentId?: string | null;
}

export interface InitiateMultipartResult {
  sessionId: string;
  uploadId: string;
  partSize: number;
  totalParts: number;
}

export interface PartUrlResult {
  partNumber: number;
  uploadUrl: string;
}

export interface MultipartPartDto {
  partNumber: number;
  eTag: string;
  etag?: string;
}

export interface ResumableUploadOptions {
  projectId?: string;
  pageId?: string;
  parentId?: string | null;
  chunkSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

// ── 1. Presigned & Direct Upload ─────────────────────────────────────────────

export const presignUpload = (dto: PresignUploadDto) => {
  return apiPost<PresignUploadResult>('/api/files/presign', dto);
};

export const completePresigned = (params: CompletePresignedParams) => {
  return apiPost<{
    id: string;
    fileId: string;
    blobId: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  }>('/api/files/presign/complete', params);
};

export const createFileRecord = (params: CreateFileRecordParams) => {
  return apiPost<{ id: string; url: string; file: any }>('/api/files/upload', {
    filename: params.filename,
    size: params.size,
    mimeType: params.mimeType,
    url: params.url,
    thumbnail: params.thumbnail,
    parentId: params.parentId ?? null,
    projectId: params.projectId,
    metaData: params.metaData,
  });
};

export const uploadDirectWithProgress = (
  blob: Blob | File,
  fileName: string,
  onProgress?: (progress: number) => void,
  options?: { projectId?: string; parentId?: string | null; signal?: AbortSignal },
): Promise<{ url: string; path: string; fileId: string }> => {
  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted) {
      return reject(new Error('Upload aborted'));
    }

    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('fileName', fileName);
    if (options?.projectId) formData.append('projectId', options.projectId);
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
          const response = JSON.parse(xhr.responseText) as Record<string, any>;
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
        ? '/api/files/upload'
        : `${API_BASE_URL}/api/files/upload`;
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
    projectId?: string;
    pageId?: string;
    parentId?: string | null;
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
  } | ((progress: number) => void),
): Promise<{ url: string; path: string; fileId?: string }> => {
  const onProgress = typeof options === 'function' ? options : options?.onProgress;
  const projectId = typeof options === 'object' ? options?.projectId : undefined;
  const signal = typeof options === 'object' ? options?.signal : undefined;
  const parentId = typeof options === 'object' ? options?.parentId : undefined;

  try {
    const presignRes = await presignUpload({
      filename: fileName,
      mimeType: blob.type || 'application/octet-stream',
      size: blob.size,
      projectId,
    });

    const uploadUrl = presignRes?.uploadUrl || presignRes?.signedUrl;
    if (uploadUrl && presignRes?.storageKey) {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('Upload aborted'));
        const xhr = new XMLHttpRequest();
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
            resolve();
          } else {
            reject(new Error(`Direct S3 upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Direct S3 upload network error'));
        xhr.onabort = () => reject(new Error('Direct S3 upload aborted'));
        if (signal) {
          signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
        xhr.send(blob);
      });

      const completed = await completePresigned({
        storageKey: presignRes.storageKey,
        filename: fileName,
        size: blob.size,
        mimeType: blob.type || 'application/octet-stream',
        projectId,
        parentId,
      });

      return {
        url: completed.url,
        path: completed.url,
        fileId: completed.fileId || completed.id,
      };
    }
  } catch (err: any) {
    if (signal?.aborted) throw err;
    // Fallback to direct upload if presigned fails
  }

  return uploadDirectWithProgress(blob, fileName, onProgress, { projectId, parentId, signal });
};

// ── 2. Multipart Chunked Upload (S3 Protocol for Large Files) ───────────────

export const initiateMultipart = (
  filename: string,
  mimeType: string,
  totalSize: number,
  projectId?: string | null,
  parentId?: string | null,
) => {
  return apiPost<InitiateMultipartResult>('/api/files/multipart/initiate', {
    filename,
    mimeType,
    totalSize,
    sizeBytes: totalSize,
    projectId,
    parentId,
  });
};

export const getMultipartPartUrl = (
  sessionId: string,
  partNumber: number,
) => {
  return apiGet<PartUrlResult>(
    `/api/files/multipart/${encodeURIComponent(sessionId)}/part-url?partNumber=${partNumber}`,
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
        resolve({ partNumber, eTag, etag: eTag });
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
    '/api/files/multipart/complete',
    {
      sessionId,
      parts,
    },
  );
};

export const abortMultipart = (sessionId: string) => {
  return apiDelete<{ success: boolean }>(
    `/api/files/multipart/${encodeURIComponent(sessionId)}`,
  );
};

/**
 * Resumable multi-chunk upload for large research datasets (>10MB).
 * Automatically handles chunking, sequential part uploads, progress reporting, and completion.
 */
export const uploadLargeFileResumable = async (
  file: File,
  options: ResumableUploadOptions = {},
): Promise<{ fileId: string; url: string }> => {
  if (options.signal?.aborted) {
    throw new Error('Upload aborted');
  }

  const session = await initiateMultipart(
    file.name,
    file.type || 'application/octet-stream',
    file.size,
    options.projectId,
    options.parentId,
  );

  const partSize = session.partSize;
  const totalParts = session.totalParts;
  const parts: MultipartPartDto[] = [];
  const partLoadedBytes = new Array(totalParts).fill(0);

  const reportProgress = () => {
    if (options.onProgress) {
      const loaded = partLoadedBytes.reduce((acc, bytes) => acc + bytes, 0);
      const percent = Math.min(100, Math.round((loaded / file.size) * 100));
      options.onProgress(percent);
    }
  };

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      if (options.signal?.aborted) {
        await abortMultipart(session.sessionId).catch(() => {});
        throw new Error('Upload aborted by user');
      }

      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const chunk = file.slice(start, end);

      const { uploadUrl } = await getMultipartPartUrl(session.sessionId, partNumber);

      const partResult = await uploadPartToS3(
        uploadUrl,
        partNumber,
        chunk,
        options.signal,
        (loaded) => {
          partLoadedBytes[partNumber - 1] = loaded;
          reportProgress();
        },
      );

      partLoadedBytes[partNumber - 1] = chunk.size;
      reportProgress();
      parts.push(partResult);
    }

    const completeResult = await completeMultipart(session.sessionId, parts);
    if (options.onProgress) options.onProgress(100);
    return { fileId: completeResult.fileId, url: completeResult.url };
  } catch (err) {
    await abortMultipart(session.sessionId).catch(() => {});
    throw err;
  }
};

// ── 3. High-Level Facade Functions (Backwards Compatibility) ────────────────

export const uploadFile = async (
  file: File,
  params: UploadFileParams,
): Promise<{ fileId: string; url: string }> => {
  if (file.size > 15 * 1024 * 1024) {
    return uploadLargeFileResumable(file, {
      projectId: params.projectId,
      parentId: params.parentId,
      pageId: params.pageId,
      onProgress: params.onProgress,
    });
  }

  const storagePrefix = 'user';
  const timestamp = Date.now();
  const fileName = `${storagePrefix}/${timestamp}-${file.name}`;

  const { url: uploadPath, fileId } = await uploadBlobWithPresigned(file, fileName, {
    projectId: params.projectId,
    pageId: params.pageId || undefined,
    parentId: params.parentId,
    onProgress: params.onProgress,
  });

  const uploadUrl = uploadPath.startsWith('http') ? uploadPath : `${API_BASE_URL}${uploadPath}`;
  return { fileId: fileId || '', url: uploadUrl };
};

export const uploadGenericFile = async (file: File, scopePrefix: string = 'flux'): Promise<string> => {
  const fileName = `avatars/${scopePrefix || 'flux'}-${Date.now()}`;
  const { url: uploadPath } = await uploadBlobWithPresigned(file, fileName);
  return uploadPath.startsWith('http') ? uploadPath : `${API_BASE_URL}${uploadPath}`;
};
