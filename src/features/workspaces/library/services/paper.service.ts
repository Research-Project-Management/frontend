import { apiGet, apiPost, apiPut, apiDelete, getAuthToken } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import type { Collection, Paper, PaperAttachment } from "@/features/workspaces/library/types/library.types";

export const paperKeys = {
  all: (workspaceId: string) => ["papers", workspaceId] as const,
  byId: (workspaceId: string, paperId: string) => ["papers", workspaceId, paperId] as const,
  byCollection: (workspaceId: string, collectionId: string) => [
    "papers",
    workspaceId,
    collectionId,
  ] as const,
};

// ── Unified Academic Ingestion Seam ─────────────────────────────────────────

export interface IngestPaperDTO {
  source?: "upload" | "storage" | "identifier";
  fileId?: string | null;
  collectionId?: string | null;
  title?: string;
  filename?: string;
  fileUrl?: string;
  size?: number;
  mimeType?: string;
  authors?: string[];
  year?: number | null;
  doi?: string;
  citationKey?: string;
}

// ── Structured Paper Service ──────────────────────────────────────────────────

export const PaperService = {
  getAll: (workspaceId: string, params?: { collectionId?: string; search?: string; limit?: number; skip?: number }) =>
    apiGet<{ papers: Paper[]; total?: number }>(`/api/library/papers/${workspaceId}`, { params }),

  getById: (workspaceId: string, paperId: string) =>
    apiGet<{ paper: Paper }>(`/api/library/papers/${workspaceId}/${paperId}`),

  getByCollection: (workspaceId: string, collectionId: string, search?: string) =>
    apiGet<{ collection: Collection; papers: Paper[] }>(
      `/api/library/${workspaceId}/collections/${collectionId}/papers`,
      { params: search ? { search } : undefined }
    ),

  create: (workspaceId: string, collectionId: string, data: Partial<Paper>) =>
    collectionId
      ? apiPost<{ paper: Paper }>(`/api/library/${workspaceId}/collections/${collectionId}/papers`, data)
      : apiPost<{ paper: Paper }>(`/api/library/papers/${workspaceId}/upload`, data),

  update: (workspaceId: string, paperId: string, data: Partial<Paper>) =>
    apiPut<{ paper: Paper }>(`/api/library/papers/${workspaceId}/${paperId}`, data),

  delete: (workspaceId: string, paperId: string) =>
    apiDelete(`/api/library/papers/${workspaceId}/${paperId}`),

  ingest: (workspaceId: string, data: IngestPaperDTO) =>
    apiPost<{ paper: Paper }>(`/api/library/papers/${workspaceId}/ingest`, data),

  addAttachment: (
    workspaceId: string,
    paperId: string,
    data: Partial<PaperAttachment>
  ) =>
    apiPost<{ paper: Paper }>(
      `/api/library/papers/${workspaceId}/${paperId}/attachments`,
      data
    ),

  deleteAttachment: (
    workspaceId: string,
    paperId: string,
    attachmentId: string
  ) =>
    apiDelete<{ paper: Paper }>(
      `/api/library/papers/${workspaceId}/${paperId}/attachments/${attachmentId}`
    ),

  importFromStorage: (
    workspaceId: string,
    data: { fileId: string; collectionId?: string | null; title?: string; authors?: string[] }
  ) =>
    apiPost<{ paper: Paper }>(
      `/api/library/papers/${workspaceId}/import-storage`,
      data
    ),

  reindex: (workspaceId: string, paperId: string) =>
    apiPost<{ message: string; paperId: string }>(
      `/api/library/papers/${workspaceId}/${paperId}/reindex`,
    ),

  fetchPdfBlob: (url: string) => fetchPdfBlob(url),
};

// ── Backwards-compatible Function Aliases ─────────────────────────────────────

export const ingestPaper = PaperService.ingest;
export const getAllPapers = PaperService.getAll;
export const getPaperById = PaperService.getById;
export const getCollectionPapers = PaperService.getByCollection;
export const createPaper = PaperService.create;
export const updatePaper = PaperService.update;
export const deletePaper = PaperService.delete;
export const addPaperAttachment = PaperService.addAttachment;
export const deletePaperAttachment = PaperService.deleteAttachment;
export const importPaperFromStorage = PaperService.importFromStorage;
export const reindexPaper = PaperService.reindex;

export const fetchPdfBlob = async (url: string): Promise<Blob> => {
  let targetUrl = url;

  // Resolve mock / local storage hostnames to local static assets
  if (targetUrl.includes('r2.rpm.local')) {
    const match = targetUrl.match(/\/papers\/[^/?#]+/);
    targetUrl = match ? match[0] : targetUrl.replace(/^https?:\/\/[^/]+/, '');
  }

  const isLocalStatic = targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');
  const resolvedUrl = isLocalStatic
    ? targetUrl
    : targetUrl.startsWith('http')
      ? targetUrl
      : `${API_BASE_URL}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token && !isLocalStatic) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrl, {
    credentials: isLocalStatic ? 'same-origin' : 'include',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed.message || 'Failed to load PDF (Server returned JSON)');
    } catch {
      throw new Error(`Server returned JSON instead of PDF: ${text.substring(0, 50)}...`);
    }
  }

  return response.blob();
};
