/**
 * Centralized file operations and transport client.
 * Handles file validation, image thumbnail generation, browser downloads,
 * and multipart XHR uploads with real-time progress.
 */

import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/token-storage';

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
  readonly type: 'workspace' | 'project' | 'page' | 'general';
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
 * Resolve a relative file path or key to a fully-qualified URL.
 */
export function resolveFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
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

// ─── 6. File Upload Transport (XHR with Progress & Abort) ─────────────────────

/**
 * Uploads a file to the backend storage endpoint via XMLHttpRequest,
 * supporting progress tracking, cancellation signals, and auth headers.
 */
export function uploadFileXhr(payload: FileUploadPayload): Promise<string> {
  const { file, prefix, scope, signal, onProgress } = payload;

  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Upload aborted by user'));
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    if (prefix) {
      const [scopeType, scopeId] = prefix.split('/');
      if (scopeType === 'workspace' && scopeId) {
        formData.append('workspaceId', scopeId);
      } else if (scopeType === 'project' && scopeId) {
        formData.append('projectId', scopeId);
      } else if (scopeType === 'page' && scopeId) {
        formData.append('pageId', scopeId);
      }
    } else if (scope) {
      if (scope.type === 'workspace' && scope.id) {
        formData.append('workspaceId', scope.id);
      } else if (scope.type === 'project' && scope.id) {
        formData.append('projectId', scope.id);
      } else if (scope.type === 'page' && scope.id) {
        formData.append('pageId', scope.id);
      }
    }

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as Record<string, any>;
          const rawUrl = response.url || response.file?.url || response.path || '';
          const resolvedUrl = resolveFileUrl(rawUrl) || rawUrl;
          resolve(resolvedUrl);
        } catch {
          reject(new Error('Failed to parse backend response'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted by user'));

    xhr.open('POST', `${API_BASE_URL}/api/files/upload-r2`, true);

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
