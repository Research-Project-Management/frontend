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

const uploadBlobWithPresigned = async (
  blob: Blob,
  fileName: string,
  onProgress?: (progress: number) => void,
): Promise<{ url: string; path: string }> => {
  try {
    const presignRes = await apiPost<{ signedUrl: string; path: string; url: string }>('/api/files/presign', {
      filename: fileName,
      mimeType: blob.type || 'application/octet-stream',
    });

    if (presignRes?.signedUrl) {
      await new Promise<void>((resolve, reject) => {
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
            reject(new Error(`Presigned upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during presigned upload'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
        xhr.open('PUT', presignRes.signedUrl, true);
        xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
        xhr.send(blob);
      });

      return { url: presignRes.url, path: presignRes.path };
    }
  } catch (e) {
    console.warn('Presign upload fallback:', e);
  }
  return { url: `/api/files/r2/${fileName}`, path: fileName };
};

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
  const { url: uploadPath } = await uploadBlobWithPresigned(file, fileName, params.onProgress);
  const uploadUrl = uploadPath.startsWith('http') ? uploadPath : `${API_BASE_URL}${uploadPath}`;

  return createFileRecord({
    workspaceId: params.workspaceId,
    filename: file.name,
    size: file.size,
    mimeType: file.type,
    url: uploadUrl,
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
