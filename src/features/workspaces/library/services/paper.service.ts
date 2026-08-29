import { apiGet, apiPost, apiPut, apiDelete, getAuthToken } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import type {
  Collection,
  Paper,
  PaperAcademicBundle,
  PaperAttachment,
} from "@/features/workspaces/library/types/library.types";

export const paperKeys = {
  all: (workspaceId: string) => ["papers", workspaceId] as const,
  byId: (workspaceId: string, paperId: string) => ["papers", workspaceId, paperId] as const,
  byCollection: (workspaceId: string, collectionId: string) => [
    "papers",
    workspaceId,
    collectionId,
  ] as const,
};

// ── Unified Academic Ingestion ──────────────────────────────────────────────

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

const VALID_PAPER_PAYLOAD_KEYS = new Set([
  'title',
  'authors',
  'creators',
  'year',
  'doi',
  'abstract',
  'abstractNote',
  'journal',
  'publisher',
  'publicationTitle',
  'publicationDate',
  'place',
  'volume',
  'issue',
  'section',
  'partNumber',
  'partTitle',
  'pages',
  'series',
  'seriesTitle',
  'seriesText',
  'seriesNumber',
  'issn',
  'isbn',
  'pmid',
  'pmcid',
  'arxivId',
  'arxiv',
  'url',
  'type',
  'itemType',
  'date',
  'accessDate',
  'accessedAt',
  'language',
  'journalAbbr',
  'journalAbbreviation',
  'shortTitle',
  'rights',
  'license',
  'citationKey',
  'libraryCatalog',
  'archive',
  'archiveLocation',
  'callNumber',
  'extra',
  'notes',
  'labels',
  'keywords',
  'tags',
  'fileUrl',
  'filename',
  'mimeType',
  'size',
  'fileId',
  'collectionId',
  'editors',
  // Specialized Zotero Fields across all 35 item types
  'edition',
  'numPages',
  'numberOfVolumes',
  'bookTitle',
  'proceedingsTitle',
  'conferenceName',
  'websiteTitle',
  'websiteType',
  'university',
  'institution',
  'country',
  'assignee',
  'issuingAuthority',
  'patentNumber',
  'applicationNumber',
  'reportNumber',
  'reportType',
  'thesisType',
  'genre',
  'filingDate',
  'legalStatus',
  'versionNumber',
]);

export function sanitizePaperPayload(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (VALID_PAPER_PAYLOAD_KEYS.has(key) && data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
}

// ── Structured Paper Service ──────────────────────────────────────────────────

export const PaperService = {
  getAll: (
    workspaceId: string,
    params?: {
      view?: 'all' | 'recent' | 'unfiled' | 'trash';
      collectionId?: string;
      tagId?: string;
      search?: string;
      limit?: number;
      skip?: number;
      cursor?: string;
    },
  ) => {
    if (params?.view) {
      return apiGet<{
        success: boolean;
        data: Paper[];
        papers?: Paper[];
        total?: number;
        meta?: { totalCount: number; hasNextPage: boolean; cursor?: string };
      }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items`,
        { params },
      ).then((res) => ({
        papers: res.data || res.papers || [],
        total: res.meta?.totalCount ?? res.total ?? res.data?.length ?? 0,
        meta: res.meta,
      }));
    }
    return apiGet<{ papers: Paper[]; total?: number }>(
      `/api/library/papers/${workspaceId}`,
      { params },
    );
  },

  getById: (workspaceId: string, paperId: string) =>
    apiGet<{ paper: Paper }>(`/api/library/papers/${workspaceId}/${paperId}`),

  getAcademicBundle: (workspaceId: string, paperId: string) =>
    apiGet<PaperAcademicBundle>(
      `/api/library/${encodeURIComponent(workspaceId)}/papers/${encodeURIComponent(paperId)}/bundle`,
    ),

  getByCollection: (workspaceId: string, collectionId: string, search?: string) =>
    apiGet<{ collection?: Collection; papers: Paper[]; items?: Paper[]; data?: Paper[] }>(
      `/api/library/${workspaceId}/collections/${collectionId}/papers`,
      { params: search ? { search } : undefined }
    ),

  create: (workspaceId: string, collectionId: string, data: Partial<Paper>) => {
    const payload = sanitizePaperPayload(data);
    if (collectionId) {
      payload.collectionId = collectionId;
      return apiPost<{ paper: Paper }>(`/api/library/${workspaceId}/collections/${collectionId}/upload`, payload);
    }
    return apiPost<{ paper: Paper }>(`/api/library/papers/${workspaceId}/upload`, payload);
  },

  update: (workspaceId: string, paperId: string, data: Partial<Paper>) =>
    apiPut<{ paper: Paper }>(`/api/library/papers/${workspaceId}/${paperId}`, sanitizePaperPayload(data)),

  delete: (workspaceId: string, paperId: string) =>
    apiDelete(`/api/library/papers/${workspaceId}/${paperId}`),

  restore: (workspaceId: string, paperId: string, expectedVersion?: number) =>
    apiPost<{ success: boolean; data: Paper }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(paperId)}/restore`,
      {},
      {
        headers: expectedVersion
          ? { 'if-match': `"${expectedVersion}"` }
          : undefined,
      },
    ),

  purge: (workspaceId: string, paperId: string) =>
    apiDelete<{ success: boolean; data: { purged: boolean } }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(paperId)}/purge`,
    ),

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
export const getPaperAcademicBundle = PaperService.getAcademicBundle;
export const getCollectionPapers = PaperService.getByCollection;
export const createPaper = PaperService.create;
export const updatePaper = PaperService.update;
export const deletePaper = PaperService.delete;
export const restorePaper = PaperService.restore;
export const purgePaper = PaperService.purge;
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
      const parsed = JSON.parse(text) as Record<string, any>;
      throw new Error(parsed?.message || 'Failed to load PDF (Server returned JSON)');
    } catch {
      throw new Error(`Server returned JSON instead of PDF: ${text.substring(0, 50)}...`);
    }
  }

  return response.blob();
};
