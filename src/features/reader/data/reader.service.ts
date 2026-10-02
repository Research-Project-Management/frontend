/**
 * reader.service.ts
 *
 * UNIFIED READER DATA CLIENT SDK
 *
 * Provides a self-contained, microservice-ready SDK communicating directly
 * with the backend `library-services` endpoints (/api/v1/library/...).
 * Reader defines its own data contracts and operations without frontend
 * dependencies on features/library.
 */

import { apiGet, apiPost, apiPatch, apiPut, apiDelete, getAuthToken } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import type {
  ReaderDocument,
  DocumentFulltext,
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  ReaderNote,
  CreateNoteDto,
  UpdateNoteDto,
  DocumentReadingState,
  ReaderCollection,
  DocumentTag,
  TagWithCount,
  DocumentAttachment,
  RelatedItem,
  CslStyle,
  CslStyleMetadata,
  SchemaItemTypeDefinition,
  ItemMetadataSourcesResponse,
} from '../types/reader.types';
import { streamPaperChat, type StreamPaperOptions } from '../services/ai.service';

// ── Base URL & Scope Resolution ──────────────────────────────────────────────
export const LIBRARY_SERVICE_API_BASE =
  process.env.NEXT_PUBLIC_LIBRARY_SERVICE_URL ||
  process.env.NEXT_PUBLIC_LIBRARIES_SERVICE_URL ||
  '/api/v1/library';

export function isProjectScope(scopeId?: string | null): boolean {
  return Boolean(
    scopeId &&
    scopeId !== 'user' &&
    scopeId !== 'personal' &&
    scopeId !== 'me'
  );
}

export function getScopeItemsUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
    : `/api/v1/library/items`;
  return suffix ? `${base}/${suffix}` : base;
}

export function getScopeUrl(scopeId?: string, subpath = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library`
    : `/api/v1/library`;
  return subpath ? `${base}/${subpath}` : base;
}

export function getPaperFileUrl(urlOrPathOrPaper?: any): string {
  if (!urlOrPathOrPaper) return '';
  if (typeof urlOrPathOrPaper === 'object') {
    const candidate =
      urlOrPathOrPaper.url ||
      urlOrPathOrPaper.primaryFile?.url ||
      urlOrPathOrPaper.fileUrl ||
      urlOrPathOrPaper.attachments?.[0]?.url ||
      urlOrPathOrPaper.attachments?.[0]?.fileUrl ||
      '';
    return candidate ? getPaperFileUrl(candidate) : '';
  }
  const urlOrPath = String(urlOrPathOrPaper).trim();
  if (!urlOrPath) return '';
  if (
    urlOrPath.startsWith('http://') ||
    urlOrPath.startsWith('https://') ||
    urlOrPath.startsWith('blob:') ||
    urlOrPath.startsWith('data:')
  ) {
    return urlOrPath;
  }
  return urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
}

export async function fetchPdfBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid document URL provided.');
  }

  const targetUrl = url.trim();
  const isLocalStatic = targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');
  const rawApiBase =
    typeof API_BASE_URL === 'string' && API_BASE_URL !== 'undefined' && API_BASE_URL !== 'null'
      ? API_BASE_URL.trim()
      : '';
  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : (rawApiBase || 'http://localhost:3000');

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
        errorDetail = text.slice(0, 300);
      }
    } catch {
      // Ignore text decoding failure
    }
    throw new Error(errorDetail || 'Server returned HTML/JSON instead of binary PDF.');
  }

  const blob = await response.blob();
  if (blob.size < 16) {
    throw new Error('PDF payload is corrupt or unexpectedly empty.');
  }

  return blob;
}

// ── 1. Documents / Items Domain ──────────────────────────────────────────────
export const ReaderDocumentsService = {
  get: async (scopeId: string | undefined, itemId: string): Promise<ReaderDocument> => {
    const res = await apiGet<ReaderDocument | { item?: ReaderDocument; paper?: ReaderDocument }>(
      getScopeItemsUrl(scopeId, encodeURIComponent(itemId)),
    );
    const item =
      res && typeof res === 'object' && 'item' in res && res.item
        ? (res.item as ReaderDocument)
        : (res as ReaderDocument);
    return item;
  },

  update: async (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<ReaderDocument>,
  ): Promise<ReaderDocument> => {
    const res = await apiPatch<ReaderDocument | { item?: ReaderDocument }>(
      getScopeItemsUrl(scopeId, encodeURIComponent(itemId)),
      data,
    );
    return (res && typeof res === 'object' && 'item' in res && res.item)
      ? (res.item as ReaderDocument)
      : (res as ReaderDocument);
  },

  reindex: async (scopeId: string | undefined, itemId: string): Promise<{ success: boolean }> => {
    return apiPost<{ success: boolean }>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
    );
  },

  getFulltext: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<DocumentFulltext | null> => {
    try {
      const res = await apiGet<DocumentFulltext | { data?: DocumentFulltext }>(
        getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/fulltext`),
      );
      if (!res) return null;
      return (res && typeof res === 'object' && 'data' in res && (res as any).data)
        ? (res as any).data
        : (res as DocumentFulltext);
    } catch {
      return null;
    }
  },

  getCounts: async (scopeId?: string) => {
    return apiGet<{ total: number; unfiled: number; starred: number; trash: number }>(
      getScopeItemsUrl(scopeId, 'counts'),
    );
  },

  getAll: async (scopeId?: string, params?: Record<string, unknown>) => {
    return apiGet<{ items: ReaderDocument[]; total: number }>(
      getScopeItemsUrl(scopeId),
      { params: params as any },
    );
  },

  previewConvertType: async (
    scopeId: string | undefined,
    itemId: string,
    targetType: string,
    retainUnmappedInExtra = true,
  ) => {
    return apiPost(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type/preview`),
      { targetType, retainUnmappedInExtra },
    );
  },

  convertType: async (
    scopeId: string | undefined,
    itemId: string,
    targetType: string,
    expectedVersion?: number,
    retainUnmappedInExtra = true,
  ) => {
    return apiPost(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type`),
      { targetType, expectedVersion, retainUnmappedInExtra },
    );
  },

  getMetadataSources: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<ItemMetadataSourcesResponse> => {
    return apiGet<ItemMetadataSourcesResponse>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/metadata-sources`),
    );
  },
};

// ── 2. Annotations Domain ───────────────────────────────────────────────────
export function getAttachmentAnnotationsUrl(scopeId?: string, attachmentId = '', subpath = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations`
    : `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/annotations`;
  return subpath ? `${base}/${subpath}` : base;
}

export const ReaderAnnotationsService = {
  getByAttachment: async (scopeId: string | undefined, attachmentId: string): Promise<ReaderAnnotation[]> => {
    if (!attachmentId) return [];
    const url = getAttachmentAnnotationsUrl(scopeId, attachmentId);
    const res = await apiGet<ReaderAnnotation[] | { data?: ReaderAnnotation[]; annotations?: ReaderAnnotation[] }>(url);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    if (res && Array.isArray((res as any).annotations)) return (res as any).annotations;
    return [];
  },

  create: async (
    scopeId: string | undefined,
    attachmentId: string,
    dto: CreateAnnotationDto,
  ): Promise<ReaderAnnotation> => {
    const url = getAttachmentAnnotationsUrl(scopeId, attachmentId);
    const res = await apiPost<ReaderAnnotation | { data?: ReaderAnnotation; annotation?: ReaderAnnotation }>(
      url,
      dto,
    );
    if (res && typeof res === 'object' && 'data' in res && (res as any).data) return (res as any).data;
    if (res && typeof res === 'object' && 'annotation' in res && (res as any).annotation) return (res as any).annotation;
    return res as ReaderAnnotation;
  },

  update: async (
    scopeId: string | undefined,
    attachmentId: string,
    id: string,
    expectedVersion?: number,
    dto?: UpdateAnnotationDto,
  ): Promise<ReaderAnnotation> => {
    const url = getAttachmentAnnotationsUrl(scopeId, attachmentId, encodeURIComponent(id));
    const res = await apiPatch<ReaderAnnotation | { data?: ReaderAnnotation; annotation?: ReaderAnnotation }>(
      url,
      {
        ...dto,
        expectedVersion,
      },
    );
    if (res && typeof res === 'object' && 'data' in res && (res as any).data) return (res as any).data;
    if (res && typeof res === 'object' && 'annotation' in res && (res as any).annotation) return (res as any).annotation;
    return res as ReaderAnnotation;
  },

  delete: async (
    scopeId: string | undefined,
    attachmentId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean; id: string }> => {
    const url = getAttachmentAnnotationsUrl(scopeId, attachmentId, encodeURIComponent(id));
    const res = await apiDelete<{ deleted?: boolean; id?: string; data?: { deleted?: boolean; id?: string } }>(
      url,
      expectedVersion !== undefined ? { params: { expectedVersion } } : undefined,
    );
    return {
      deleted: res?.data?.deleted ?? res?.deleted ?? true,
      id: res?.data?.id ?? res?.id ?? id,
    };
  },

  batch: async (
    scopeId: string | undefined,
    attachmentId: string,
    operations: {
      creates?: CreateAnnotationDto[];
      updates?: Array<UpdateAnnotationDto & { id: string }>;
      deletes?: string[];
      upserts?: any[];
    },
  ): Promise<{ created: ReaderAnnotation[]; updated: ReaderAnnotation[]; deleted: string[] }> => {
    const url = getAttachmentAnnotationsUrl(scopeId, attachmentId, 'batch');
    const upserts = operations.upserts || [
      ...(operations.creates || []),
      ...(operations.updates || []),
    ];
    return apiPut(url, {
      upserts,
      deletes: operations.deletes || [],
    });
  },

  extractNotes: async (
    scopeId: string | undefined,
    itemId: string,
    options?: { noteId?: string; tagColor?: boolean; includeComments?: boolean },
  ) => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/notes/items/${encodeURIComponent(itemId)}/from-annotations`
      : `/api/v1/library/notes/items/${encodeURIComponent(itemId)}/from-annotations`;
    return apiPost<{ success: boolean; totalExtracted: number }>(url, options || {});
  },

  importExternal: async (scopeId: string | undefined, attachmentId: string) => {
    const url = getAttachmentAnnotationsUrl(scopeId, attachmentId, 'import-external');
    return apiPost<{ success: boolean; importedCount: number }>(url, {});
  },
};

// ── 3. Notes Domain ──────────────────────────────────────────────────────────
export const ReaderNotesService = {
  list: async (scopeId?: string, itemId?: string): Promise<ReaderNote[]> => {
    const url = getScopeUrl(scopeId, 'notes');
    const res = await apiGet<ReaderNote[] | { notes?: ReaderNote[]; data?: ReaderNote[] }>(
      url,
      itemId ? { params: { itemId } } : undefined,
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).notes)) return (res as any).notes;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },

  get: async (scopeId: string | undefined, id: string): Promise<ReaderNote> => {
    const res = await apiGet<ReaderNote | { note?: ReaderNote; data?: ReaderNote }>(
      getScopeUrl(scopeId, `notes/${encodeURIComponent(id)}`),
    );
    if (res && typeof res === 'object' && 'note' in res && (res as any).note) return (res as any).note;
    if (res && typeof res === 'object' && 'data' in res && (res as any).data) return (res as any).data;
    return res as ReaderNote;
  },

  create: async (scopeId: string | undefined, dto: CreateNoteDto): Promise<ReaderNote> => {
    const res = await apiPost<ReaderNote | { note?: ReaderNote; data?: ReaderNote }>(
      getScopeUrl(scopeId, 'notes'),
      dto,
    );
    if (res && typeof res === 'object' && 'note' in res && (res as any).note) return (res as any).note;
    if (res && typeof res === 'object' && 'data' in res && (res as any).data) return (res as any).data;
    return res as ReaderNote;
  },

  update: async (
    scopeId: string | undefined,
    id: string,
    version: number,
    dto: UpdateNoteDto & { expectedVersion?: number },
  ): Promise<ReaderNote> => {
    const payload = { ...dto, expectedVersion: version };
    const res = await apiPatch<ReaderNote | { note?: ReaderNote; data?: ReaderNote }>(
      getScopeUrl(scopeId, `notes/${encodeURIComponent(id)}`),
      payload,
    );
    if (res && typeof res === 'object' && 'note' in res && (res as any).note) return (res as any).note;
    if (res && typeof res === 'object' && 'data' in res && (res as any).data) return (res as any).data;
    return res as ReaderNote;
  },

  delete: async (
    scopeId: string | undefined,
    id: string,
    version?: number,
  ): Promise<{ deleted: boolean }> => {
    return apiDelete<{ deleted: boolean }>(
      getScopeUrl(scopeId, `notes/${encodeURIComponent(id)}`),
      version !== undefined ? { params: { expectedVersion: version } } : undefined,
    );
  },
};

// ── 4. Reading State Domain ──────────────────────────────────────────────────
export const ReaderStateService = {
  getState: async (scopeId: string | undefined, itemId: string): Promise<DocumentReadingState | null> => {
    try {
      const res = await apiGet<DocumentReadingState | { state?: DocumentReadingState; data?: DocumentReadingState }>(
        getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/state`),
      );
      if (!res) return null;
      if (typeof res === 'object' && 'state' in res && (res as any).state) return (res as any).state;
      if (typeof res === 'object' && 'data' in res && (res as any).data) return (res as any).data;
      return res as DocumentReadingState;
    } catch {
      return null;
    }
  },

  updateState: async (
    scopeId: string | undefined,
    itemId: string,
    data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
      currentPage?: number;
      scrollPosition?: Record<string, unknown> | Array<unknown> | null;
    },
  ): Promise<DocumentReadingState> => {
    const res = await apiPatch<DocumentReadingState | { state?: DocumentReadingState; data?: DocumentReadingState }>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/state`),
      data,
    );
    if (res && typeof res === 'object' && 'state' in res && (res as any).state) return (res as any).state;
    if (res && typeof res === 'object' && 'data' in res && (res as any).data) return (res as any).data;
    return res as DocumentReadingState;
  },

  markAsRead: async (scopeId: string | undefined, itemId: string): Promise<DocumentReadingState> => {
    return apiPost<DocumentReadingState>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/state/read`),
      {},
    );
  },
};

// ── 5. Attachments Domain ───────────────────────────────────────────────────
export const ReaderAttachmentsService = {
  list: async (scopeId: string | undefined, itemId: string): Promise<DocumentAttachment[]> => {
    if (!itemId) return [];
    const res = await apiGet<DocumentAttachment[] | { attachments?: DocumentAttachment[]; data?: DocumentAttachment[] }>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/attachments`),
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).attachments)) return (res as any).attachments;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },

  create: async (
    scopeId: string | undefined,
    itemId: string,
    data: {
      filename: string;
      url?: string;
      fileId?: string;
      contentType?: string;
      size?: number;
      isPrimary?: boolean;
    },
  ): Promise<DocumentAttachment> => {
    return apiPost<DocumentAttachment>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/attachments`),
      data,
    );
  },

  captureSnapshot: async (
    scopeId: string | undefined,
    itemId: string,
    url?: string,
  ): Promise<DocumentAttachment> => {
    const res = await apiPost<{ attachment?: DocumentAttachment } | DocumentAttachment>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/attachments/snapshot`),
      url ? { url } : {},
    );
    const candidate = res as { attachment?: DocumentAttachment };
    if (candidate && candidate.attachment) {
      return candidate.attachment;
    }
    return res as DocumentAttachment;
  },

  delete: async (scopeId: string | undefined, attachmentId: string): Promise<{ deleted: boolean }> => {
    return apiDelete<{ deleted: boolean }>(
      `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}`,
    );
  },

  setPrimary: async (
    scopeId: string | undefined,
    itemId: string,
    attachmentId: string,
  ): Promise<{ success: boolean }> => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/${encodeURIComponent(attachmentId)}/set-primary`
      : `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/set-primary`;
    return apiPost<{ success: boolean }>(url, { itemId });
  },

  rename: async (
    scopeId: string | undefined,
    attachmentId: string,
    options?: { filename?: string; pattern?: string } | string,
  ): Promise<{ success: boolean; newFilename?: string }> => {
    const payload = typeof options === 'string' ? { filename: options } : (options || {});
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/${encodeURIComponent(attachmentId)}/rename`
      : `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/rename`;
    return apiPatch<{ success: boolean; newFilename?: string }>(url, payload);
  },

  reExtract: async (
    scopeId: string | undefined,
    attachmentId: string,
  ): Promise<{ success: boolean; taskId?: string }> => {
    return apiPost<{ success: boolean; taskId?: string }>(
      `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/re-extract`,
    );
  },

  upload: async (
    scopeId: string | undefined,
    file: File,
    itemId?: string,
  ): Promise<DocumentAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    if (itemId) formData.append('itemId', itemId);
    if (scopeId && isProjectScope(scopeId)) formData.append('projectId', scopeId);

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api/v1/library/attachments/upload', {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}): ${res.statusText}`);
    const json = (await res.json()) as any;
    return json.data || json;
  },
};

// ── 6. Collections Domain ───────────────────────────────────────────────────
export const ReaderCollectionsService = {
  list: async (scopeId?: string): Promise<ReaderCollection[]> => {
    const res = await apiGet<ReaderCollection[] | { collections?: ReaderCollection[]; data?: ReaderCollection[] }>(
      getScopeUrl(scopeId, 'collections'),
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).collections)) return (res as any).collections;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },

  getItemCollections: async (scopeId: string | undefined, itemId: string): Promise<ReaderCollection[]> => {
    if (!itemId) return [];
    const res = await apiGet<ReaderCollection[] | { collections?: ReaderCollection[]; data?: ReaderCollection[] }>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/collections`),
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).collections)) return (res as any).collections;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },

  addToCollection: async (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ): Promise<{ success: boolean }> => {
    return apiPost<{ success: boolean }>(
      getScopeUrl(scopeId, `collections/${encodeURIComponent(collectionId)}/items`),
      { itemIds },
    );
  },

  removeFromCollection: async (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ): Promise<{ success: boolean }> => {
    if (!itemIds || itemIds.length === 0) return { success: true };
    await Promise.all(
      itemIds.map((itemId) =>
        apiDelete(getScopeUrl(scopeId, `collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`)),
      ),
    );
    return { success: true };
  },
};

// ── 7. Tags Domain ──────────────────────────────────────────────────────────
export const ReaderTagsService = {
  list: async (scopeId?: string): Promise<TagWithCount[]> => {
    const res = await apiGet<TagWithCount[] | { tags?: TagWithCount[]; data?: TagWithCount[] }>(
      getScopeUrl(scopeId, 'tags'),
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).tags)) return (res as any).tags;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },

  getItemTags: async (scopeId: string | undefined, itemId: string): Promise<DocumentTag[]> => {
    if (!itemId) return [];
    try {
      const doc = await ReaderDocumentsService.get(scopeId, itemId);
      return (doc as any)?.tags || (doc as any)?.itemTags || [];
    } catch {
      return [];
    }
  },

  addToItem: async (
    scopeId: string | undefined,
    itemId: string,
    tags: string[],
  ): Promise<{ success: boolean; tags: DocumentTag[] }> => {
    const createdTags: DocumentTag[] = [];
    for (const tagName of tags) {
      try {
        const tagRes = await apiPost<DocumentTag | { tag?: DocumentTag }>(
          getScopeUrl(scopeId, 'tags'),
          { name: tagName, projectId: isProjectScope(scopeId) ? scopeId : undefined },
        );
        const tag = (tagRes && typeof tagRes === 'object' && 'tag' in tagRes && tagRes.tag)
          ? tagRes.tag
          : (tagRes as DocumentTag);
        const tagObj = typeof tag === 'object' && tag !== null ? (tag as { id?: string }) : null;
        if (tagObj?.id) {
          await apiPost(getScopeUrl(scopeId, `tags/${encodeURIComponent(tagObj.id)}/items/${encodeURIComponent(itemId)}`), {});
          createdTags.push(tag);
        }
      } catch {
        // continue with other tags
      }
    }
    return { success: true, tags: createdTags };
  },

  removeFromItem: async (
    scopeId: string | undefined,
    itemId: string,
    tagIdOrName: string,
  ): Promise<{ success: boolean }> => {
    return apiDelete(
      getScopeUrl(scopeId, `tags/${encodeURIComponent(tagIdOrName)}/items/${encodeURIComponent(itemId)}`),
    );
  },
};

// ── 8. Relations Domain ─────────────────────────────────────────────────────
export const ReaderRelationsService = {
  list: async (scopeId: string | undefined, itemId: string): Promise<RelatedItem[]> => {
    if (!itemId) return [];
    const res = await apiGet<RelatedItem[] | { relations?: RelatedItem[]; data?: RelatedItem[] }>(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/relations`),
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).relations)) return (res as any).relations;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },

  add: async (
    scopeId: string | undefined,
    itemId: string,
    targetItemId: string,
    predicate?: string,
  ): Promise<{ success: boolean }> => {
    return apiPost(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/relations`),
      { targetItemId, predicate },
    );
  },

  remove: async (
    scopeId: string | undefined,
    itemId: string,
    targetItemId: string,
  ): Promise<{ success: boolean }> => {
    return apiDelete(
      getScopeItemsUrl(scopeId, `${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`),
    );
  },
};

// ── 9. Citations & Exports Domain ───────────────────────────────────────────
export const ReaderCitationsService = {
  format: async (
    scopeId: string | undefined,
    itemId: string,
    style = 'apa',
  ): Promise<{
    citation: string;
    html?: string;
    bibliography?: string;
    bibliographyHtml?: string;
    inText?: string;
  }> => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/citation/items/${encodeURIComponent(itemId)}/citation`
      : `/api/v1/library/citation/items/${encodeURIComponent(itemId)}/citation`;
    const res = await apiGet<any>(url, { params: { style } });
    return {
      citation: res?.bibliography || res?.citation || res?.inText || '',
      html: res?.html || res?.bibliographyHtml,
      bibliography: res?.bibliography || res?.citation || '',
      bibliographyHtml: res?.bibliographyHtml || res?.html || '',
      inText: res?.inText || '',
    };
  },

  getBibtex: async (scopeId: string | undefined, itemId: string): Promise<{ bibtex: string }> => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/exports`
      : '/api/v1/library/exports';
    const res = await apiPost<{ content?: string; bibtex?: string }>(url, {
      format: 'bibtex',
      itemIds: [itemId],
      projectId: isProjectScope(scopeId) ? scopeId : undefined,
    });
    return { bibtex: res?.bibtex ?? res?.content ?? '' };
  },

  getStyles: async (query?: string): Promise<CslStyleMetadata[]> => {
    const endpoint = query
      ? '/api/v1/library/citation/styles/search'
      : '/api/v1/library/citation/styles';
    const res = await apiGet<CslStyleMetadata[] | { styles?: CslStyleMetadata[]; data?: CslStyleMetadata[] }>(
      endpoint,
      query ? { params: { q: query } } : undefined,
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).styles)) return (res as any).styles;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },

  exportLibrary: async (
    scopeId?: string,
    options?: { format: 'bibtex' | 'ris' | 'json'; itemIds?: string[]; collectionId?: string },
  ): Promise<{ content: string; filename?: string }> => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/exports`
      : '/api/v1/library/exports';
    return apiPost(url, {
      format: options?.format || 'bibtex',
      itemIds: options?.itemIds,
      collectionId: options?.collectionId,
      projectId: isProjectScope(scopeId) ? scopeId : undefined,
    });
  },

  downloadAnnotatedPdf: async (
    scopeId: string | undefined,
    itemId: string,
    filename?: string,
  ): Promise<void> => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/exports/items/${encodeURIComponent(itemId)}/annotated-pdf`
      : `/api/v1/library/exports/items/${encodeURIComponent(itemId)}/annotated-pdf`;
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);

    const data = (await res.json()) as any;
    if (data.base64) {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType || 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || data.filename || `document_${itemId}_annotated.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }
  },
};

// ── 10. Schema & Item Types Domain ──────────────────────────────────────────
export const ReaderItemTypesService = {
  list: async (): Promise<SchemaItemTypeDefinition[]> => {
    try {
      const res = await apiGet<SchemaItemTypeDefinition[] | { itemTypes?: SchemaItemTypeDefinition[]; types?: SchemaItemTypeDefinition[]; data?: SchemaItemTypeDefinition[] }>(
        '/api/v1/library/item-types',
      );
      if (Array.isArray(res)) return res;
      if (res && Array.isArray((res as any).itemTypes)) return (res as any).itemTypes;
      if (res && Array.isArray((res as any).types)) return (res as any).types;
      if (res && Array.isArray((res as any).data)) return (res as any).data;
      return [];
    } catch {
      return [];
    }
  },
};

// ── 11. Retraction Domain ───────────────────────────────────────────────────
export const ReaderRetractionService = {
  checkItem: (scopeId: string | undefined, itemId: string) => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/retraction/items/${encodeURIComponent(itemId)}/check`
      : `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/check`;
    return apiPost<{
      itemId: string;
      isRetracted: boolean;
      nature?: string;
      details?: Record<string, unknown>;
    }>(url, {});
  },

  unflagItem: (scopeId: string | undefined, itemId: string) => {
    const url = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/retraction/items/${encodeURIComponent(itemId)}/flag`
      : `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`;
    return apiDelete<ReaderDocument>(url);
  },
};

// ── UNIFIED READER SDK ENTRY POINT ───────────────────────────────────────────
export const readerService = {
  // Domain contexts
  documents: ReaderDocumentsService,
  items: ReaderDocumentsService, // ergonomic alias
  annotations: ReaderAnnotationsService,
  notes: ReaderNotesService,
  state: ReaderStateService,
  attachments: ReaderAttachmentsService,
  collections: ReaderCollectionsService,
  tags: ReaderTagsService,
  relations: ReaderRelationsService,
  citations: ReaderCitationsService,
  exports: ReaderCitationsService, // ergonomic alias
  itemTypes: ReaderItemTypesService,
  retraction: ReaderRetractionService,
  ai: {
    streamPaperChat,
  },

  // Binary / URL Helpers
  fetchPdfBlob,
  getPaperFileUrl,
  isProjectScope,
};

export const ReaderService = readerService;
export default readerService;
