/**
 * @file stream.service.ts
 * @description Frontend service mirroring backend StreamController.
 * Handles authenticated binary streaming, partial range loading, array buffer extraction, and file downloads.
 */

import { getAuthToken } from '@/shared/lib/api';
import { resolveFileUrl, downloadFileUrl } from '@/shared/lib/file-client';

export const resolveStreamUrl = (fileIdOrPath: string | null | undefined): string | null => {
  if (!fileIdOrPath) return null;
  if (fileIdOrPath.startsWith('http://') || fileIdOrPath.startsWith('https://')) {
    return fileIdOrPath;
  }
  if (!fileIdOrPath.includes('/') && !fileIdOrPath.includes('.')) {
    // Looks like a UUID fileId
    return resolveFileUrl(`/api/files/${encodeURIComponent(fileIdOrPath)}/content`);
  }
  return resolveFileUrl(fileIdOrPath);
};

export const fetchAuthorized = async (url: string, errorType: string = 'content'): Promise<Response> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token && !url.startsWith('blob:') && !url.startsWith('data:')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { credentials: 'include', headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch file ${errorType}: ${response.statusText}`);
  }
  return response;
};

export const getFileArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const res = await fetchAuthorized(url, 'buffer');
  return res.arrayBuffer();
};

export const getFileBlob = async (url: string): Promise<Blob> => {
  const res = await fetchAuthorized(url, 'blob');
  return res.blob();
};

export const downloadFile = (url: string, filename: string): void => {
  downloadFileUrl(url, filename);
};
