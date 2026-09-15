/**
 * @file upload.service.ts
 * @description Frontend service mirroring backend UploadController.
 * Handles direct uploads, presigned S3 uploads, and S3 multipart resumable chunked uploads with progress tracking.
 */

import { apiPost, apiDelete, getAuthToken } from '@/shared/lib/api';
import { API_BASE_URL } from '@/config/env';
import { generateThumbnail } from '@/shared/lib/file-client';
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
  signedUrl: string;
  path: string;
  url: string;
  uploadId?: string;
}

export interface MultipartPartDto {
  partNumber: number;
  etag: string;
}

export interface ResumableUploadOptions {
  projectId?: string;
  pageId?: string;
  parentId?: string | null;
  chunkSize?: number; // default 5MB
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

// ── 1. Presigned & Direct Upload ─────────────────────────────────────────────

export const presignUpload = (dto: PresignUploadDto) => {
  return apiPost<PresignUploadResult>('/api/files/presign', dto);
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
    formData.append('file', blob);
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
  const pageId = typeof options === 'object' ? options?.pageId : undefined;
  const signal = typeof options === 'object' ? options?.signal : undefined;
  const parentId = typeof options === 'object' ? options?.parentId : undefined;

  try {
    const presignRes = await presignUpload({
      filename: fileName,
      mimeType: blob.type || 'application/octet-stream',
      size: blob.size,
      projectId,
      pageId,
    });

    if (presignRes?.signedUrl) {
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
            reject(new Error(`Direct upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Direct upload network error'));
        xhr.onabort = () => reject(new Error('Direct upload aborted'));
        if (signal) {
          signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }
        xhr.open('PUT', presignRes.signedUrl, true);
        xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
        xhr.send(blob);
      });

      return { url: presignRes.url, path: presignRes.path };
    }
  } catch {
    // Fallback to direct upload
  }

  return uploadDirectWithProgress(blob, fileName, onProgress, { projectId, parentId, signal });
};

// ── 2. Multipart Chunked Upload (S3 Protocol for Large Files) ───────────────

export const initiateMultipart = (
  filename: string,
  mimeType: string,
  sizeBytes: number,
  projectId?: string | null,
  parentId?: string | null,
) => {
  return apiPost<{ uploadId: string; storageKey: string }>('/api/files/multipart/initiate', {
    filename,
    mimeType,
    sizeBytes,
    projectId,
    parentId,
  });
};

export const uploadMultipartChunk = (
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<{ partNumber: number; etag: string }> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Upload aborted'));

    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('partNumber', String(partNumber));
    formData.append('chunk', chunk);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res: any = JSON.parse(xhr.responseText);
          resolve({ partNumber, etag: res?.etag || res?.data?.etag || '' });
        } catch {
          reject(new Error('Failed to parse part response'));
        }
      } else {
        reject(new Error(`Part upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during part upload'));
    xhr.onabort = () => reject(new Error('Part upload aborted'));
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.open('POST', `${API_BASE_URL}/api/files/multipart/part`, true);
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

export const completeMultipart = (
  uploadId: string,
  parts: MultipartPartDto[],
) => {
  return apiPost<{ fileId: string; url: string; filename: string }>('/api/files/multipart/complete', {
    uploadId,
    parts,
  });
};

export const abortMultipart = (uploadId: string) => {
  return apiDelete(`/api/files/multipart/abort?uploadId=${encodeURIComponent(uploadId)}`);
};

/**
 * Resumable multi-chunk upload for large research datasets (>10MB).
 * Automatically handles chunking (5MB slices), sequential part uploads, progress reporting, and completion.
 */
export const uploadLargeFileResumable = async (
  file: File,
  options: ResumableUploadOptions = {},
): Promise<{ fileId: string; url: string }> => {
  const CHUNK_SIZE = options.chunkSize || 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  if (totalChunks <= 1) {
    // Single chunk fallback to direct upload
    const res = await uploadDirectWithProgress(file, file.name, options.onProgress, {
      projectId: options.projectId,
      parentId: options.parentId,
      signal: options.signal,
    });
    return { fileId: res.fileId, url: res.url };
  }

  const { uploadId } = await initiateMultipart(
    file.name,
    file.type || 'application/octet-stream',
    file.size,
    options.projectId,
    options.parentId,
  );

  const parts: MultipartPartDto[] = [];

  try {
    for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
      if (options.signal?.aborted) {
        await abortMultipart(uploadId);
        throw new Error('Upload aborted by user');
      }

      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const partResult = await uploadMultipartChunk(
        uploadId,
        partNumber,
        chunk,
        options.signal,
      );

      parts.push(partResult);

      if (options.onProgress) {
        const overallPercent = Math.round((partNumber / totalChunks) * 100);
        options.onProgress(overallPercent);
      }
    }

    const completeResult = await completeMultipart(uploadId, parts);
    return { fileId: completeResult.fileId, url: completeResult.url };
  } catch (err) {
    try {
      await abortMultipart(uploadId);
    } catch {}
    throw err;
  }
};

// ── 3. High-Level Facade Functions (Backwards Compatibility) ────────────────

export const uploadFile = async (
  file: File,
  params: UploadFileParams,
) => {
  const storagePrefix = 'user';
  const timestamp = Date.now();
  const fileName = `${storagePrefix}/${timestamp}-${file.name}`;

  const onMainFileProgress = params.onProgress
    ? (p: number) => params.onProgress!(Math.round(p * 0.9))
    : undefined;

  const { url: uploadPath, fileId } = await uploadBlobWithPresigned(file, fileName, {
    projectId: params.projectId,
    pageId: params.pageId || undefined,
    parentId: params.parentId,
    onProgress: onMainFileProgress,
  });

  const uploadUrl = uploadPath.startsWith('http') ? uploadPath : `${API_BASE_URL}${uploadPath}`;

  let thumbnailUrl: string | undefined;
  if (file.type.startsWith('image/')) {
    const thumbnailBlob = await generateThumbnail(file);
    if (thumbnailBlob) {
      const thumbName = `${storagePrefix}/${Date.now()}-thumb.jpg`;
      const { url: thumbPath } = await uploadBlobWithPresigned(thumbnailBlob, thumbName, {
        projectId: params.projectId,
        pageId: params.pageId || undefined,
      });
      thumbnailUrl = thumbPath.startsWith('http') ? thumbPath : `${API_BASE_URL}${thumbPath}`;
    }
  }

  await createFileRecord({
    projectId: params.projectId,
    filename: file.name,
    size: file.size,
    mimeType: file.type,
    url: uploadUrl,
    thumbnail: thumbnailUrl,
    parentId: params.parentId || null,
    metaData: params.metaData,
  });

  if (params.onProgress) params.onProgress(100);
  return { fileId, url: uploadUrl };
};

export const uploadGenericFile = async (file: File, scopePrefix: string = 'flux'): Promise<string> => {
  const fileName = `avatars/${scopePrefix || 'flux'}-${Date.now()}`;
  const { url: uploadPath } = await uploadBlobWithPresigned(file, fileName);
  return uploadPath.startsWith('http') ? uploadPath : `${API_BASE_URL}${uploadPath}`;
};
