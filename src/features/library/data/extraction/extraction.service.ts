import { apiGet, apiPost, apiPatch, apiDelete, getEffectiveBaseUrl } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from "@/shared/lib/token-storage";
import type { AttachmentDto } from "../../types/library.types";
import { isProjectScope } from '../../domain';
import { AnnotationsService } from './annotations.service';

export type { AttachmentDto };
export { AnnotationsService };


export interface RenameAttachmentInput {
  filename?: string;
  pattern?: string;
}

export interface BatchRenameAttachmentsInput {
  itemIds?: string[];
  attachmentIds?: string[];
  pattern?: string;
}

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

// ── Scope URL helpers ─────────────────────────────────────────────────────────

function getItemAttachmentUrl(scopeId: string | undefined, itemId: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/attachments`
    : `/api/v1/library/items/${encodeURIComponent(itemId)}/attachments`;
  return suffix ? `${base}/${suffix}` : base;
}

function getAttachmentUrl(scopeId: string | undefined, attachmentId: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/${encodeURIComponent(attachmentId)}`
    : `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}`;
  return suffix ? `${base}/${suffix}` : base;
}

function getFileUrl(scopeId: string | undefined, fileId: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/files/${encodeURIComponent(fileId)}`
    : `/api/v1/library/files/${encodeURIComponent(fileId)}`;
  return suffix ? `${base}/${suffix}` : base;
}

// ── Attachment API Functions ──────────────────────────────────────────────────

export async function getAttachments(scopeId: string, itemId: string): Promise<AttachmentDto[]> {
  const response = await apiGet<{ attachments: AttachmentDto[] }>(
    getItemAttachmentUrl(scopeId, itemId),
  );
  return response.attachments || [];
}

export async function getAttachment(
  scopeId: string,
  attachmentId: string,
): Promise<AttachmentDto> {
  const response = await apiGet<{ attachment: AttachmentDto }>(
    getAttachmentUrl(scopeId, attachmentId),
  );
  return (response as any).attachment ?? response;
}



export async function deleteAttachment(
  scopeId: string,
  attachmentId: string,
): Promise<boolean> {
  const response = await apiDelete<{ success: boolean }>(
    getAttachmentUrl(scopeId, attachmentId),
  );
  return response.success;
}

export async function captureSnapshot(
  scopeId: string,
  itemId: string,
  url?: string,
): Promise<AttachmentDto> {
  const response = await apiPost<{ attachment: AttachmentDto } | AttachmentDto>(
    getItemAttachmentUrl(scopeId, itemId, 'snapshot'),
    url ? { url } : {},
  );
  return (response as { attachment?: AttachmentDto }).attachment ?? (response as AttachmentDto);
}

export async function createAttachment(
  scopeId: string,
  itemId: string,
  data: Record<string, unknown>,
): Promise<AttachmentDto> {
  const response = await apiPost<{ attachment?: AttachmentDto } | AttachmentDto>(
    getItemAttachmentUrl(scopeId, itemId),
    data,
  );
  return (response as { attachment?: AttachmentDto }).attachment ?? (response as AttachmentDto);
}

export async function setPrimaryAttachment(
  scopeId: string,
  itemId: string,
  attachmentId: string,
): Promise<{ success: boolean }> {
  return apiPost(
    getItemAttachmentUrl(scopeId, itemId, `${encodeURIComponent(attachmentId)}/set-primary`),
    {},
  );
}

export function getFileContentUrl(scopeId: string, fileId: string): string {
  return getFileUrl(scopeId, fileId, 'content');
}

export async function fetchFileContent(scopeId: string, fileId: string): Promise<Blob> {
  return apiGet<Blob>(getFileUrl(scopeId, fileId, 'content'), { responseType: 'blob' });
}

export function getAttachmentContentUrl(scopeId: string, attachmentId: string): string {
  return getAttachmentUrl(scopeId, attachmentId, 'content');
}

export async function fetchAttachmentContent(scopeId: string, attachmentId: string): Promise<Blob> {
  return apiGet<Blob>(getAttachmentUrl(scopeId, attachmentId, 'content'), { responseType: 'blob' });
}

export async function uploadLibraryAttachment(
  scopeId: string | undefined,
  formData: FormData,
): Promise<{ fileId: string; url: string; filename: string; size: number; mimeType: string }> {
  const isProject = isProjectScope(scopeId);
  const uploadUrl = isProject
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/upload`
    : `/api/v1/library/attachments/upload`;
  const response = await apiPost<any>(uploadUrl, formData);
  const data = (response as any)?.data || response;
  return {
    fileId: String(data?.fileId || data?.id || ''),
    url: String(data?.url || ''),
    filename: String(data?.filename || ''),
    size: Number(data?.size || 0),
    mimeType: String(data?.mimeType || 'application/pdf'),
  };
}

export async function renameAttachment(
  scopeId: string,
  attachmentId: string,
  dto: RenameAttachmentInput,
): Promise<{ attachment: AttachmentDto; oldFilename: string; newFilename: string }> {
  const response = await apiPatch<{ attachment: AttachmentDto; oldFilename: string; newFilename: string }>(
    getAttachmentUrl(scopeId, attachmentId, 'rename'),
    dto,
  );
  return response;
}

export async function batchRenameAttachments(
  scopeId: string,
  dto: BatchRenameAttachmentsInput,
): Promise<{
  renamedCount: number;
  results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
}> {
  const batchBase = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/batch-rename`
    : `/api/v1/library/attachments/batch-rename`;
  const response = await apiPost<{
    renamedCount: number;
    results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
  }>(
    batchBase,
    dto,
  );
  return response;
}

export async function reExtractAttachment(
  scopeId: string | undefined,
  attachmentId: string,
): Promise<{ status: string; attachmentId: string; message: string }> {
  const url = getAttachmentUrl(scopeId, attachmentId, 're-extract');
  return apiPost<{ status: string; attachmentId: string; message: string }>(url, {});
}

export const AttachmentsService = {
  getAttachments,
  getAttachment,
  deleteAttachment,
  createAttachment,
  renameAttachment,
  batchRenameAttachments,
  reExtractAttachment,
  setPrimaryAttachment,
  getFileContentUrl,
  fetchFileContent,
  getAttachmentContentUrl,
  fetchAttachmentContent,
  streamAttachmentContent: fetchAttachmentContent,
  streamFileContent: fetchFileContent,
  uploadAttachment: uploadLibraryAttachment,
  uploadFile: uploadLibraryAttachment,
  addAttachment: createAttachment,
  captureSnapshot,
  // Ergonomic aliases
  list: getAttachments,
  get: getAttachment,
  delete: deleteAttachment,
  rename: renameAttachment,
  batchRename: batchRenameAttachments,
  reExtract: reExtractAttachment,
  add: createAttachment,
  create: createAttachment,
  setPrimary: setPrimaryAttachment,
};

export const AttachmentService = AttachmentsService;
export const uploadAttachment = uploadLibraryAttachment;

// ── Storage / S3 / R2 Direct Uploads ──────────────────────────────────────────

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

  const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
  if (file.size >= MULTIPART_THRESHOLD) {
    const contentHash = await computeFileSha256(file);
    return uploadLibraryFileMultipartResumable(scopeId, file, options, contentHash);
  }

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

  if (!presignData.uploadUrl || !presignData.storageKey) {
    throw new Error('Invalid presign response: missing uploadUrl or storageKey');
  }

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

let isDirectUploadCorsBlocked = false;

export async function uploadLibraryFile(
  scopeId?: string,
  file?: File,
  options: LibraryUploadOptions = {},
): Promise<LibraryUploadResult> {
  const targetFile = file as File;

  if (options.preferDirect !== false && !isDirectUploadCorsBlocked) {
    try {
      return await uploadLibraryFileDirect(scopeId, targetFile, options);
    } catch (err: unknown) {
      const errorObj = err as { name?: string; status?: number; message?: string } | null;
      const isCorsOrNetworkError =
        err instanceof TypeError ||
        errorObj?.name === 'TypeError' ||
        errorObj?.status === 0 ||
        (typeof errorObj?.message === 'string' &&
          (errorObj.message.toLowerCase().includes('cors') ||
            errorObj.message.toLowerCase().includes('network') ||
            errorObj.message.toLowerCase().includes('failed to fetch')));

      if (isCorsOrNetworkError) {
        isDirectUploadCorsBlocked = true;
        console.warn(
          `Direct upload blocked by CORS/network error (${errorObj?.message || String(err)}). Falling back to multipart upload for this session.`,
        );
      } else {
        throw err;
      }
    }
  }

  return uploadLibraryFileMultipart(scopeId, targetFile, options);
}

export const UploadService = {
  upload: uploadLibraryFile,
  uploadMultipart: uploadLibraryFileMultipart,
  uploadResumable: uploadLibraryFileMultipartResumable,
  uploadDirect: uploadLibraryFileDirect,
  computeSha256: computeFileSha256,
};

export const ExtractionService = {
  attachments: AttachmentsService,
  upload: UploadService,
  annotations: AnnotationsService,
};
