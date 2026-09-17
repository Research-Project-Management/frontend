import { API_BASE_URL } from '@/config/env';
import { getEffectiveBaseUrl } from '@/shared/lib/api';
import { getAuthToken } from "@/shared/lib/token-storage";
import { isProjectScope } from './items.service';

export interface LibraryUploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  preferDirect?: boolean;
}

export interface LibraryUploadResult {
  fileId: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

/**
 * Standard multipart upload through NestJS Fastify backend.
 */
export async function uploadLibraryFileMultipart(
  scopeId?: string,
  targetFile?: File,
  options: LibraryUploadOptions = {},
): Promise<LibraryUploadResult> {
  const file = targetFile as File;
  const { onProgress, signal } = options;

  if (signal?.aborted) {
    throw new Error('Upload aborted by user');
  }

  return new Promise<LibraryUploadResult>((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as Record<string, unknown>;
          const payload = ((response.data && typeof response.data === 'object' ? response.data : response) || {}) as Record<string, unknown>;
          resolve({
            fileId: String(payload.fileId || payload.id || ''),
            url: String(payload.url || ''),
            filename: String(payload.filename || file.name),
            size: typeof payload.size === 'number' ? payload.size : file.size,
            mimeType: String(payload.mimeType || file.type || 'application/pdf'),
          });
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        let errorMsg = `Upload failed with status ${xhr.status}`;
        try {
          const errRes = JSON.parse(xhr.responseText) as { message?: string | string[] };
          if (errRes.message) {
            errorMsg = Array.isArray(errRes.message)
              ? errRes.message.join(', ')
              : errRes.message;
          }
        } catch {
          // ignore
        }
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted by user'));

    const isProject = isProjectScope(scopeId);
    const uploadBase = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/upload`
      : `/api/v1/library/upload`;
    const baseUrl = (typeof getEffectiveBaseUrl === 'function' ? getEffectiveBaseUrl() : API_BASE_URL) || API_BASE_URL;
    const uploadUrl = `${baseUrl}${uploadBase}`;

    xhr.open('POST', uploadUrl, true);

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}

/**
 * Fast client-side SHA-256 calculation using the browser's native Web Crypto API.
 */
export async function computeFileSha256(file: File): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return '';
  }
  try {
    const buffer = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Failed to compute client-side SHA-256:', err);
    return '';
  }
}

/**
 * Resumable S3/R2 Multipart Upload for large files (>= 50MB):
 * 1. Initiates multipart upload session.
 * 2. Uploads parts in parallel (up to 3 parts concurrently) with per-part retry.
 * 3. Completes multipart assembly on storage driver.
 */
export async function uploadLibraryFileMultipartResumable(
  scopeId?: string,
  targetFile?: File,
  options: LibraryUploadOptions = {},
  expectedHash?: string,
): Promise<LibraryUploadResult> {
  const file = targetFile as File;
  const { onProgress, signal } = options;

  const isProject = isProjectScope(scopeId);
  const initiateUrl = isProject
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/multipart/initiate`
    : `/api/v1/library/attachments/multipart/initiate`;
  const completeUrl = isProject
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/multipart/complete`
    : `/api/v1/library/attachments/multipart/complete`;

  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Initiate Multipart
  const initResp = await fetch(
    typeof window !== 'undefined' ? initiateUrl : `${API_BASE_URL}${initiateUrl}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        totalSize: file.size,
        expectedHash,
      }),
      signal,
    },
  );

  if (!initResp.ok) {
    throw new Error(`Multipart initiate failed: ${initResp.status}`);
  }

  const initData = (await initResp.json()) as Record<string, unknown>;
  const session = ((initData.data && typeof initData.data === 'object' ? initData.data : initData) || {}) as {
    sessionId: string;
    partSize: number;
    totalParts: number;
  };

  const { sessionId, partSize, totalParts } = session;
  const completedParts: { partNumber: number; eTag: string }[] = [];
  let uploadedBytes = 0;

  // 2. Upload parts with concurrency pool of 3
  const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
  const CONCURRENCY = 3;

  const uploadPartWorker = async () => {
    while (partNumbers.length > 0) {
      if (signal?.aborted) throw new Error('Upload aborted');
      const partNum = partNumbers.shift();
      if (!partNum) break;

      const start = (partNum - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const chunk = file.slice(start, end);

      // Get presigned part URL
      const partUrlPath = isProject
        ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/multipart/${encodeURIComponent(sessionId)}/part-url?partNumber=${partNum}`
        : `/api/v1/library/attachments/multipart/${encodeURIComponent(sessionId)}/part-url?partNumber=${partNum}`;

      const partUrlResp = await fetch(
        typeof window !== 'undefined' ? partUrlPath : `${API_BASE_URL}${partUrlPath}`,
        { headers, signal },
      );
      if (!partUrlResp.ok) {
        throw new Error(`Failed to get part URL for part ${partNum}`);
      }
      const partUrlData = (await partUrlResp.json()) as Record<string, unknown>;
      const partUrlPayload = ((partUrlData.data && typeof partUrlData.data === 'object' ? partUrlData.data : partUrlData) || {}) as { partUrl: string };
      const uploadPartUrl = partUrlPayload.partUrl;

      // PUT chunk with retry (up to 3 times)
      let eTag = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          eTag = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadPartUrl, true);
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                const tag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || `part-${partNum}`;
                resolve(tag.replace(/"/g, ''));
              } else {
                reject(new Error(`Part ${partNum} PUT failed: ${xhr.status}`));
              }
            };
            xhr.onerror = () => reject(new Error(`Part ${partNum} network error`));
            xhr.send(chunk);
          });
          break;
        } catch (err) {
          if (attempt === 3) throw err;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      completedParts.push({ partNumber: partNum, eTag });
      uploadedBytes += chunk.size;
      if (onProgress) {
        onProgress(Math.round((uploadedBytes / file.size) * 100));
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, totalParts) }, () => uploadPartWorker()),
  );

  // 3. Complete Multipart
  completedParts.sort((a, b) => a.partNumber - b.partNumber);
  const compResp = await fetch(
    typeof window !== 'undefined' ? completeUrl : `${API_BASE_URL}${completeUrl}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        parts: completedParts,
      }),
      signal,
    },
  );

  if (!compResp.ok) {
    throw new Error(`Multipart complete failed: ${compResp.status}`);
  }

  const compData = (await compResp.json()) as Record<string, unknown>;
  const payload = ((compData.data && typeof compData.data === 'object' ? compData.data : compData) || {}) as Record<string, unknown>;

  return {
    fileId: String(payload.fileId || payload.id || ''),
    url: String(payload.url || ''),
    filename: String(payload.filename || file.name),
    size: typeof payload.size === 'number' ? payload.size : file.size,
    mimeType: String(payload.mimeType || file.type || 'application/pdf'),
  };
}

/**
 * Direct-to-Storage Presigned Upload with Client-Side SHA-256 CAS Deduplication:
 * 1. Computes SHA-256 hash. If duplicate file exists, backend returns instant 200 (Zero-byte WAN transfer).
 * 2. If file >= 50MB, routes to Resumable Multipart Upload.
 * 3. Otherwise, streams directly to S3 / Cloudflare R2 via single-part PUT with progress.
 */
export async function uploadLibraryFileDirect(
  scopeId?: string,
  targetFile?: File,
  options: LibraryUploadOptions = {},
): Promise<LibraryUploadResult> {
  const file = targetFile as File;
  const { onProgress, signal } = options;

  if (signal?.aborted) {
    throw new Error('Upload aborted by user');
  }

  // 1. Calculate client-side SHA-256 for CAS deduplication
  const contentHash = await computeFileSha256(file);

  const isProject = isProjectScope(scopeId);
  const presignBase = isProject
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/presign`
    : `/api/v1/library/attachments/presign`;
  const completeBase = isProject
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/presign/complete`
    : `/api/v1/library/attachments/presign/complete`;

  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 2. Request presigned upload URL (or check instant deduplication)
  const presignResp = await fetch(
    typeof window !== 'undefined' ? presignBase : `${API_BASE_URL}${presignBase}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        sizeBytes: file.size,
        contentHash: contentHash || undefined,
      }),
      signal,
    },
  );

  if (!presignResp.ok) {
    throw new Error(`Presign request failed: ${presignResp.status}`);
  }

  const rawPresign = (await presignResp.json()) as Record<string, unknown>;
  const presignData = ((rawPresign.data && typeof rawPresign.data === 'object' ? rawPresign.data : rawPresign) || {}) as {
    deduplicated?: boolean;
    fileId?: string;
    url?: string;
    filename?: string;
    size?: number;
    mimeType?: string;
    uploadUrl?: string;
    storageKey?: string;
  };

  // Case A: Instant Zero-Byte Deduplication! File already exists in CAS.
  if (presignData.deduplicated && presignData.fileId) {
    if (onProgress) onProgress(100);
    return {
      fileId: String(presignData.fileId),
      url: String(presignData.url || `/api/files/${encodeURIComponent(presignData.fileId)}/content`),
      filename: String(presignData.filename || file.name),
      size: typeof presignData.size === 'number' ? presignData.size : file.size,
      mimeType: String(presignData.mimeType || file.type || 'application/pdf'),
    };
  }

  // Case B: Large file (>= 50MB) -> Use Resumable S3 Multipart Upload
  const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
  if (file.size >= MULTIPART_THRESHOLD) {
    return uploadLibraryFileMultipartResumable(scopeId, file, options, contentHash);
  }

  // Case C: Standard file (< 50MB) -> Direct Single-part PUT
  if (!presignData.uploadUrl || !presignData.storageKey) {
    throw new Error('Invalid presign response: missing uploadUrl or storageKey');
  }

  // In local disk driver mode, bypass PUT to mock local-upload endpoint and use multipart
  if (presignData.uploadUrl.startsWith('/api/files/local-upload')) {
    return uploadLibraryFileMultipart(scopeId, file, options);
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignData.uploadUrl!, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Direct storage upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during direct storage upload'));
    xhr.onabort = () => reject(new Error('Upload aborted by user'));

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });

  // Complete presign registration with true contentHash
  const completeResp = await fetch(
    typeof window !== 'undefined' ? completeBase : `${API_BASE_URL}${completeBase}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        storageKey: presignData.storageKey,
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        sizeBytes: file.size,
        contentHash: contentHash || undefined,
      }),
      signal,
    },
  );

  if (!completeResp.ok) {
    throw new Error(`Presign completion failed: ${completeResp.status}`);
  }

  const completeData = (await completeResp.json()) as Record<string, unknown>;
  const payload = ((completeData.data && typeof completeData.data === 'object' ? completeData.data : completeData) || {}) as Record<string, unknown>;

  return {
    fileId: String(payload.fileId || payload.id || ''),
    url: String(payload.url || ''),
    filename: String(payload.filename || file.name),
    size: typeof payload.size === 'number' ? payload.size : file.size,
    mimeType: String(payload.mimeType || file.type || 'application/pdf'),
  };
}

/**
 * Main upload entry point for Library files.
 * Defaults to Direct-to-Storage Presigned Upload, with automatic fallback
 * to standard multipart upload on failure or local dev environments.
 */
export async function uploadLibraryFile(
  scopeId?: string,
  file?: File,
  options: LibraryUploadOptions = {},
): Promise<LibraryUploadResult> {
  const targetFile = file as File;

  if (options.preferDirect !== false) {
    try {
      return await uploadLibraryFileDirect(scopeId, targetFile, options);
    } catch (err: any) {
      console.warn(
        `Direct upload failed (${err?.message || err}). Gracefully falling back to multipart upload.`,
      );
    }
  }

  return uploadLibraryFileMultipart(scopeId, targetFile, options);
}
