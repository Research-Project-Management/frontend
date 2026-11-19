import {
  apiDelete,
  apiGet,
  apiPost,
  getAuthToken,
  getEffectiveBaseUrl,
} from '@/shared/lib/api';
import type { DocumentItem } from '../types/session';
import { normalizeSpaceId } from './flux';

export interface UploadDocumentProgress {
  loaded: number;
  total: number;
  percent: number;
  stage: 'uploading' | 'processing';
}

export function uploadDocument(
  spaceId: string | null | undefined,
  file: File,
  onProgress?: (progress: UploadDocumentProgress) => void,
): Promise<{ id: string; name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    const cleanSpaceId = normalizeSpaceId(spaceId);
    if (cleanSpaceId) {
      formData.append('spaceId', cleanSpaceId);
    }

    const xhr = new XMLHttpRequest();
    const url = `${getEffectiveBaseUrl()}/api/ai/documents/upload`;

    xhr.open('POST', url);
    xhr.withCredentials = true;

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
        onProgress?.({
          loaded: e.loaded,
          total: e.total,
          percent,
          stage: 'uploading',
        });
      }
    });

    xhr.upload.addEventListener('load', () => {
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percent: 100,
        stage: 'processing',
      });
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as {
            data?: { id: string; name: string; size: number };
            id?: string;
            name?: string;
            size?: number;
          };
          const payload = json?.data || json;
          resolve({
            id: payload.id || '',
            name: payload.name || file.name,
            size: payload.size ?? file.size,
          });
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const errJson = JSON.parse(xhr.responseText) as { message?: string };
          reject(
            new Error(errJson?.message || `Upload failed with status ${xhr.status}`),
          );
        } catch {
          reject(new Error(`Failed to upload document: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    xhr.send(formData);
  });
}

export async function fetchDocuments(
  spaceId?: string | null,
): Promise<DocumentItem[]> {
  const cleanId = normalizeSpaceId(spaceId);
  const qs = cleanId ? `?spaceId=${encodeURIComponent(cleanId)}` : '';
  const res = await apiGet<DocumentItem[] | { documents?: DocumentItem[] }>(
    `/api/ai/documents${qs}`,
  );
  if (Array.isArray(res)) return res;
  return res?.documents ?? [];
}

export async function fetchDocumentsBulk(
  ids: string[],
  spaceId?: string | null,
): Promise<Array<{ id: string; name: string; size: number }>> {
  if (!ids.length) return [];
  const cleanId = normalizeSpaceId(spaceId);
  const data = await apiPost<
    | Array<{ id: string; name?: string; title?: string; size?: number }>
    | { documents?: Array<{ id: string; name?: string; title?: string; size?: number }> }
  >('/api/ai/documents/bulk', {
    ids,
    spaceId: cleanId,
  });
  const list = Array.isArray(data) ? data : (data?.documents ?? []);
  return list.map((d) => ({
    id: d.id,
    name: d.name || d.title || d.id,
    size: d.size ?? 0,
  }));
}

export async function fetchDocumentContent(
  docId: string,
  spaceId?: string | null,
): Promise<{ text: string }> {
  const cleanId = normalizeSpaceId(spaceId);
  const qs = cleanId ? `?spaceId=${encodeURIComponent(cleanId)}` : '';
  const data = await apiGet<string | { text?: string; content?: string }>(
    `/api/ai/documents/${encodeURIComponent(docId)}/content${qs}`,
  );

  const contentStr =
    typeof data === 'string' ? data : (data?.text ?? data?.content ?? '');

  return { text: contentStr };
}

export async function deleteDocument(
  docId: string,
  spaceId?: string | null,
): Promise<boolean> {
  const cleanId = normalizeSpaceId(spaceId);
  const qs = cleanId ? `?spaceId=${encodeURIComponent(cleanId)}` : '';
  await apiDelete(`/api/ai/documents/${encodeURIComponent(docId)}${qs}`);
  return true;
}
