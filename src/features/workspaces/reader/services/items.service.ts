import { apiGet, apiPatch, apiPost, getAuthToken } from '@/shared/lib/api';
import type { ReaderDocument, DocumentFulltext } from '../types/reader.types';

// API base resolution
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Resolves canonical binary content URLs (/api/files/:fileId/content)
 * for PDF viewing, avoiding fallback to DOI landing page URLs.
 */
export function getPaperFileUrl(paper?: Partial<ReaderDocument> | null | undefined): string {
  if (!paper) return '';

  const normalizeUrl = (url?: string | null, fileId?: string | null): string => {
    if (fileId) {
      return `/api/files/${fileId}/content`;
    }
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('/api/files/') &&
      !trimmed.includes('/r2/') &&
      !trimmed.endsWith('/content')
    ) {
      return `${trimmed}/content`;
    }
    return trimmed;
  };

  // 1. Primary file / attachment (priority order: primary_pdf -> application/pdf -> .pdf filename)
  const attachments: any[] = Array.isArray(paper?.attachments)
    ? paper.attachments
    : [];

  const primaryPdfAttachment = attachments.find(
    (a) => a?.attachmentType === 'primary_pdf' || a?.isPrimary === true,
  );
  if (primaryPdfAttachment) {
    const resolved = normalizeUrl(primaryPdfAttachment.url, primaryPdfAttachment.fileId);
    if (resolved) return resolved;
  }

  const explicitPdfAttachment = attachments.find(
    (a) =>
      a?.mimeType === 'application/pdf' ||
      (typeof a?.filename === 'string' && a.filename.toLowerCase().endsWith('.pdf')),
  );
  if (explicitPdfAttachment) {
    const resolved = normalizeUrl(explicitPdfAttachment.url, explicitPdfAttachment.fileId);
    if (resolved) return resolved;
  }

  // 2. Direct primaryFile object on item
  if (paper.primaryFile) {
    const resolved = normalizeUrl(paper.primaryFile.url, paper.primaryFile.fileId);
    if (resolved) return resolved;
  }

  // 3. Any attachment with a valid content URL
  for (const att of attachments) {
    if (att?.fileId) return `/api/files/${att.fileId}/content`;
    if (typeof att?.url === 'string' && att.url.includes('/api/files/')) {
      return normalizeUrl(att.url);
    }
  }

  // 4. Fallback to direct pdfUrl / fileUrl if present
  if ((paper as any)?.pdfUrl) return normalizeUrl((paper as any).pdfUrl);
  if ((paper as any)?.fileUrl) return normalizeUrl((paper as any).fileUrl);

  return '';
}

/**
 * Fetches PDF binary blob via authenticated request with URL sanitization and origin safety.
 */
export const fetchPdfBlob = async (
  url: string,
  signal?: AbortSignal,
): Promise<Blob> => {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid document URL provided.');
  }

  let targetUrl = url.trim();

  if (targetUrl.includes('r2.rpm.local')) {
    const match = targetUrl.match(/\/papers\/[^/?#]+/);
    targetUrl = match ? match[0] : targetUrl.replace(/^https?:\/\/[^/]+/, '');
  }

  const isLocalStatic =
    targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');
  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';

  const rawApiBase =
    typeof API_BASE_URL === 'string' &&
    API_BASE_URL !== 'undefined' &&
    API_BASE_URL !== 'null'
      ? API_BASE_URL.trim()
      : '';

  let resolvedUrl = targetUrl;
  let isTrustedOrigin = false;
  try {
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      resolvedUrl = targetUrl;
    } else if (isLocalStatic) {
      resolvedUrl = targetUrl;
    } else if (rawApiBase) {
      const cleanBase = rawApiBase.replace(/\/+$/, '');
      const cleanPath = targetUrl.replace(/^\/+/, '');
      resolvedUrl = `${cleanBase}/${cleanPath}`;
    } else {
      resolvedUrl = targetUrl;
    }

    const resolvedOrigin = new URL(resolvedUrl, baseUrl).origin;
    const apiOrigin = rawApiBase ? new URL(rawApiBase, baseUrl).origin : new URL(baseUrl).origin;
    isTrustedOrigin =
      resolvedOrigin === new URL(baseUrl).origin ||
      resolvedOrigin === apiOrigin ||
      targetUrl.startsWith('/api/');
  } catch {
    isTrustedOrigin = targetUrl.startsWith('/api/');
  }

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token && isTrustedOrigin && !isLocalStatic) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrl, {
    credentials: isTrustedOrigin && !isLocalStatic ? 'include' : 'same-origin',
    headers,
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized: Session expired or invalid authentication.');
    if (response.status === 403) throw new Error('Forbidden: You do not have permission to view this document.');
    if (response.status === 404) throw new Error('Not Found: The requested document could not be found.');
    throw new Error(`Failed to fetch PDF (${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('text/html')) {
    let errorDetail = '';
    try {
      const text = typeof response.text === 'function' ? await response.text() : '';
      if (text.trim().startsWith('{')) {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        errorDetail = (parsed?.message || parsed?.error || text) as string;
      } else {
        errorDetail = text.slice(0, 200);
      }
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(`Server returned non-PDF content: ${errorDetail}`);
  }

  return response.blob();
};

/**
 * ItemsService corresponding to backend ItemsService (backend/src/modules/library/items/items.service.ts)
 */
export const ItemsService = {
  getPaperFileUrl,
  fetchPdfBlob,

  getItem: async (workspaceId: string, itemId: string): Promise<ReaderDocument> => {
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}`,
    );
    return raw?.data || raw?.item || raw;
  },

  updateItem: async (
    workspaceId: string,
    itemId: string,
    data: Partial<ReaderDocument>,
  ): Promise<ReaderDocument> => {
    const raw = await apiPatch<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}`,
      data,
    );
    return raw?.data || raw?.item || raw;
  },

  reindexItem: async (
    workspaceId: string,
    itemId: string,
  ): Promise<{ success: boolean }> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/reindex`,
      {},
    );
    return raw?.data || raw || { success: true };
  },

  getFulltext: async (
    workspaceId: string,
    itemId: string,
  ): Promise<DocumentFulltext | null> => {
    try {
      const raw = await apiGet<any>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/fulltext`,
      );
      return raw?.data || raw || null;
    } catch {
      return null;
    }
  },
};
