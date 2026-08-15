import { apiGet, apiPost } from '@/shared/lib/api';
import { API_BASE_URL } from '@/shared/constants';

// ── Read ─────────────────────────────────────────────────────────────────────

export const getAllFiles = (workspaceId: string, parentId?: string | null) => {
  let url = `/api/files/workspace/${workspaceId}`;
  if (parentId !== undefined) {
    url += `?parentId=${parentId === null ? 'null' : parentId}`;
  }
  return apiGet<any>(url);
};

// ── Upload ───────────────────────────────────────────────────────────────────

const uploadBlobWithProgress = (
  blob: Blob,
  fileName: string,
  uploadEndpoint: string,
  onProgress?: (progress: number) => void,
): Promise<{ url: string }> =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('fileName', fileName);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve({ url: JSON.parse(xhr.responseText).url });
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.open('POST', `${API_BASE_URL}${uploadEndpoint}`, true);
    xhr.send(formData);
  });

export const createFileRecord = (params: {
  workspaceId: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  parentId: string | null;
}) =>
  apiPost(`/api/files/workspace/${params.workspaceId}/upload`, {
    filename: params.filename,
    size: params.size,
    mimeType: params.mimeType,
    url: params.url,
    parentId: params.parentId ?? null,
  });

export const uploadFile = async (
  file: File,
  params: { workspaceId: string; parentId?: string | null; onProgress?: (p: number) => void },
) => {
  const fileName = `workspace/${params.workspaceId}/${Date.now()}-${file.name}`;
  const endpoint = `/api/files/workspace/${params.workspaceId}/upload-r2`;
  const { url: uploadPath } = await uploadBlobWithProgress(file, fileName, endpoint, params.onProgress);

  return createFileRecord({
    workspaceId: params.workspaceId,
    filename: file.name,
    size: file.size,
    mimeType: file.type,
    url: `${API_BASE_URL}${uploadPath}`,
    parentId: params.parentId || null,
  });
};

// ── Folder ───────────────────────────────────────────────────────────────────

export const createFolder = (
  name: string,
  params: { workspaceId: string; parentId?: string | null },
) =>
  apiPost(`/api/files/workspace/${params.workspaceId}/folder`, {
    name,
    parentId: params.parentId ?? null,
  });
