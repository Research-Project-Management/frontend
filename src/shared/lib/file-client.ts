/**
 * Centralized file operations and transport client.
 * Handles file validation, image thumbnail generation, browser downloads,
 * and multipart XHR uploads with real-time progress.
 */

import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/token-storage';
import {
  buildUploadFingerprint,
  computeClientSha256Hex,
  defaultCheckpointStore,
  MultipartCheckpointStore,
  smartUpload,
  USER_ABORT_ERROR_MESSAGE,
  type SmartUploadOptions,
  type SmartUploadResult,
} from '@/shared/lib/smart-upload-engine';

export {
  buildUploadFingerprint,
  computeClientSha256Hex,
  defaultCheckpointStore,
  MultipartCheckpointStore,
  smartUpload,
  USER_ABORT_ERROR_MESSAGE,
  type SmartUploadOptions,
  type SmartUploadResult,
};

// ─── 1. Types & Options ───────────────────────────────────────────────────────

export interface FileValidationOptions {
  readonly maxSize?: number;
  readonly allowedTypes?: readonly string[];
}

export interface ThumbnailOptions {
  readonly maxSizePx?: number;
  readonly quality?: number;
}

export interface UploadScope {
  readonly type: 'project' | 'page' | 'general';
  readonly id?: string;
}

export interface FileUploadPayload {
  readonly file: File;
  readonly prefix?: string;
  readonly scope?: UploadScope;
  readonly signal?: AbortSignal;
  readonly onProgress?: (percent: number) => void;
}

// ─── 2. URL Normalization & Resolution ────────────────────────────────────────

/**
 * Resolve a relative file path or key to a fully-qualified URL (or relative proxy URL in browser).
 */
export function resolveFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    return normalized;
  }
  return `${API_BASE_URL}${normalized}`;
}


// ─── 3. Client-Side Validation ────────────────────────────────────────────────

/**
 * Validates a file against size and MIME/extension constraints.
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {},
): { valid: boolean; error?: Error } {
  const { maxSize, allowedTypes } = options;

  if (maxSize && file.size > maxSize) {
    return {
      valid: false,
      error: new Error(`File size exceeds limit of ${maxSize} bytes`),
    };
  }

  if (allowedTypes && allowedTypes.length > 0) {
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
    const mime = file.type?.toLowerCase() || '';

    const isValid = allowedTypes.some((type) => {
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
      return {
        valid: false,
        error: new Error(`File type "${file.type || ext}" is not allowed`),
      };
    }
  }

  return { valid: true };
}

// ─── 4. Client-Side Thumbnail Generation ──────────────────────────────────────

const DEFAULT_THUMBNAIL_MAX_PX = 300;
const DEFAULT_THUMBNAIL_QUALITY = 0.7;

/**
 * Generate a client-side thumbnail blob from an image file using the HTML5 Canvas API.
 * Returns null if the file is not an image or if canvas context is unavailable.
 */
export async function generateThumbnail(
  file: File | Blob,
  options: ThumbnailOptions = {},
): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const maxPx = options.maxSizePx ?? DEFAULT_THUMBNAIL_MAX_PX;
  const quality = options.quality ?? DEFAULT_THUMBNAIL_QUALITY;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxPx) {
            height *= maxPx / width;
            width = maxPx;
          }
        } else {
          if (height > maxPx) {
            width *= maxPx / height;
            height = maxPx;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      };
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// ─── 5. Programmatic Browser File Download ────────────────────────────────────

/**
 * Triggers a browser file download programmatically for a given URL and filename.
 */
export function downloadFileUrl(url: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const fullUrl = resolveFileUrl(url);
  if (!fullUrl) return;

  const a = document.createElement('a');
  a.href = fullUrl;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Performs an authenticated fetch request with the current user's Bearer token.
 */
export async function fetchAuthorized(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const fullUrl = resolveFileUrl(url) || url;
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(fullUrl, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });
}

/**
 * Downloads a protected file using an authenticated fetch request and triggers a browser Blob download.
 */
export async function downloadFileAuthorized(
  url: string,
  filename: string,
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const response = await fetchAuthorized(url);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  }
}

// ─── 6. File Upload Transport (Unified Smart Upload Engine) ──────────────────

const SCOPE_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseScopeFromPayload(payload: FileUploadPayload): {
  projectId?: string;
  pageId?: string;
  extraFormFields?: Record<string, string>;
} {
  const { prefix, scope } = payload;

  if (prefix) {
    const parts = prefix.split('/').filter(Boolean);
    if (parts.length >= 2) {
      if (parts.includes('library')) {
        return { extraFormFields: { source: 'library' } };
      }
      if (parts[0] === 'project' && SCOPE_UUID_REGEX.test(parts[1])) {
        return { projectId: parts[1] };
      }
      if (parts[0] === 'page' && SCOPE_UUID_REGEX.test(parts[1])) {
        return { pageId: parts[1] };
      }
    } else if (parts.length === 1 && SCOPE_UUID_REGEX.test(parts[0])) {
      return { projectId: parts[0] };
    }
    return {};
  }

  if (scope) {
    if ((scope.type as string) === 'library' && scope.id && SCOPE_UUID_REGEX.test(scope.id)) {
      return { projectId: scope.id, extraFormFields: { source: 'library' } };
    }
    if (scope.type === 'project' && scope.id && SCOPE_UUID_REGEX.test(scope.id)) {
      return { projectId: scope.id };
    }
    if (scope.type === 'page' && scope.id && SCOPE_UUID_REGEX.test(scope.id)) {
      return { pageId: scope.id };
    }
  }

  return {};
}

/**
 * Uploads a file to FilesModule via Unified SmartUploadEngine
 * (SHA-256 instant CAS dedup, Presigned PUT <= 15MB, Resumable Multipart > 15MB).
 */
export async function uploadFileXhr(payload: FileUploadPayload): Promise<string> {
  const result = await uploadFileWithDetails(payload);
  return result.url;
}

export async function uploadFileWithDetails(
  payload: FileUploadPayload,
): Promise<{ url: string; fileId: string }> {
  const { file, signal, onProgress } = payload;
  const { projectId, pageId, extraFormFields } = parseScopeFromPayload(payload);

  const result = await smartUpload(file, {
    baseEndpoint: '/api/v1/files',
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    projectId,
    pageId,
    extraFormFields,
    signal,
    onProgress,
    resolveUrl: resolveFileUrl,
  });

  return {
    url: result.url,
    fileId: result.fileId,
  };
}

/**
 * Uploads a shared/public image or asset (avatar, cover, project icon) directly to FilesModule.
 */
export async function uploadGenericFile(
  file: File,
  scopePrefix: string = 'flux',
): Promise<string> {
  const dotIdx = file.name.lastIndexOf('.');
  const ext = dotIdx !== -1 ? file.name.slice(dotIdx) : '';
  const fileName = `avatars/${scopePrefix || 'flux'}-${Date.now()}${ext}`;

  const result = await smartUpload(file, {
    baseEndpoint: '/api/v1/files',
    filename: fileName,
    mimeType: file.type || 'application/octet-stream',
    extraFormFields: scopePrefix ? { prefix: scopePrefix } : undefined,
    resolveUrl: resolveFileUrl,
  });

  return result.url;
}
