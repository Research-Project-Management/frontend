import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from "@/shared/lib/token-storage";

export interface LibraryUploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface LibraryUploadResult {
  fileId: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

/**
 * Uploads a file through the Library Bounded Context Gateway.
 * Scoped to /api/v1/library/upload.
 */
export async function uploadLibraryFile(
  scopeId?: string,
  file?: File,
  options: LibraryUploadOptions = {},
): Promise<LibraryUploadResult> {
  const targetFile = file as File;
  const { onProgress, signal } = options;

  if (signal?.aborted) {
    throw new Error('Upload aborted by user');
  }

  return new Promise<LibraryUploadResult>((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', targetFile);
    formData.append('fileName', targetFile.name);

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
            filename: String(payload.filename || targetFile.name),
            size: typeof payload.size === 'number' ? payload.size : targetFile.size,
            mimeType: String(payload.mimeType || targetFile.type),
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

    const uploadBase = `/api/v1/library/upload`;
    const uploadUrl =
      typeof window !== 'undefined'
        ? uploadBase
        : `${API_BASE_URL}${uploadBase}`;

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
