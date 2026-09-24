/**
 * @file version.service.ts
 * @description Frontend service mirroring backend VersionController.
 * Handles fetching file versions, uploading new revisions, and reverting to historical versions.
 */

import { apiGet, apiPost, getAuthToken } from '@/shared/lib/api';
import { API_BASE_URL } from '@/config/env';

export interface FileVersionItem {
  id: string;
  versionNumber: number;
  size: number;
  changeComment: string | null;
  createdAt: string;
  isCurrent: boolean;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
}

export interface FileVersionsResponse {
  fileId: string;
  filename: string;
  currentVersionNumber: number;
  totalVersions: number;
  versions: FileVersionItem[];
}

export const getFileVersions = (fileId: string): Promise<FileVersionsResponse> => {
  return apiGet<FileVersionsResponse>(`/api/files/${encodeURIComponent(fileId)}/versions`);
};

export const uploadNewFileVersion = (
  fileId: string,
  file: File,
  changeComment?: string,
  onProgress?: (progress: number) => void,
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    if (changeComment) {
      formData.append('changeComment', changeComment);
    }

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch {
          resolve({});
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as any;
          reject(new Error(err.message || 'Failed to upload new version'));
        } catch {
          reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Connection error while uploading new version'));

    xhr.open('POST', `${API_BASE_URL}/api/files/${encodeURIComponent(fileId)}/versions`);
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
};

export const revertFileVersion = (fileId: string, versionNumber: number): Promise<any> => {
  return apiPost(`/api/files/${encodeURIComponent(fileId)}/versions/${versionNumber}/revert`, {});
};

export const getVersionDownloadUrl = (fileId: string, versionNumber: number): string => {
  return `${API_BASE_URL}/api/files/${encodeURIComponent(fileId)}/versions/${versionNumber}/download`;
};
