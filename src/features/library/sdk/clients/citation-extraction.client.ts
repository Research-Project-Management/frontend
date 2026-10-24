import type {
  FormattedCitation,
  CslStyle,
  ReferenceData,
  CslStyleMetadata,
  ItemAttachment,
} from '@/features/library/domain/types/library.types';
import type {
  ReaderDocument,
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  DocumentReadingState,
  DocumentFulltext,
} from '@/features/library/domain/types/reader.types';
import {
  libraryClient,
  resolveLibraryUrl,
  getCitationUrl,
  getExportsUrl,
  getItemAttachmentUrl,
  getAttachmentUrl,
  unwrapList,
  unwrapRecord,
  unwrapResolvedReference,
  fetchPdfBlob,
  getItemFileUrl,
  isProjectScope,
} from './http.client';
import { ItemsService } from './items.client';
import { NotesService, StateService } from './catalog-entities.client';

// 8. Citations & Exports Services
export const CitationService = {
  formatCitation: (scopeId: string | undefined, itemId: string, style: CslStyle = 'apa', index = 1) => {
    const pQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<FormattedCitation>(
      `${getCitationUrl(scopeId, 'items')}/${encodeURIComponent(itemId)}/citation?style=${encodeURIComponent(style)}&index=${index}${pQuery}`,
    );
  },

  batchFormat: (scopeId: string | undefined, itemIds: string[], style: CslStyle = 'apa') => {
    const projectId = isProjectScope(scopeId) ? scopeId : undefined;
    return libraryClient.post<{
      style: CslStyle;
      total: number;
      combinedInText?: string;
      bibliographyText?: string;
      bibliographyHtml?: string;
      citations: Array<{ itemId?: string; citation: FormattedCitation }>;
    }>(getCitationUrl(scopeId, 'batch-items'), {
      itemIds,
      style,
      ...(projectId ? { projectId } : {}),
    });
  },

  getStyles: (scopeId?: string) => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<import('@/features/library/domain/types/library.types').StyleSummary[]>(
      `${getCitationUrl(scopeId, 'styles')}${pQuery}`,
    );
  },

  searchStyles: (query = '', limit = 30) =>
    libraryClient.get<{ styles: CslStyleMetadata[]; total: number }>(
      `/api/v1/library/citation/styles/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  uploadCustomStyle: (xml: string, title?: string) =>
    libraryClient.post<{ styleId?: string; id?: string; title: string; message: string }>(
      `/api/v1/library/citation/styles/custom`,
      { xml, title },
    ).then((res) => ({
      ...res,
      id: res.id || res.styleId || '',
      styleId: res.styleId || res.id || '',
    })),

  resolveDoi: async (doi: string, _scopeId?: string): Promise<ReferenceData | null> => {
    const rawDoi = typeof doi === 'string' ? doi.trim() : '';
    if (!rawDoi) throw new Error('Invalid DOI provided');
    try {
      const referenceResponse = await libraryClient.post<unknown>(
        `/api/v1/library/citation/resolve`,
        { doi: rawDoi, query: rawDoi },
        { silent: true },
      );
      const unwrapped = unwrapResolvedReference(referenceResponse);
      if (unwrapped) return unwrapped;
    } catch {
      return null;
    }
    return null;
  },

  fetchByDoi: (doi: string, scopeId?: string) => CitationService.resolveDoi(doi, scopeId),

  search: async (query: string, _scopeId?: string): Promise<ReferenceData[]> => {
    if (!query || !query.trim()) return [];
    const trimmedQuery = query.trim();
    try {
      const response = await libraryClient.get<{
        works?: ReferenceData[];
        results?: ReferenceData[];
        data?: ReferenceData[];
      }>(`/api/v1/library/citation/crossref/search?query=${encodeURIComponent(trimmedQuery)}&rows=10`, { silent: true });
      if (response?.works && Array.isArray(response.works)) return response.works;
      if (response?.results && Array.isArray(response.results)) return response.results;
      if (response?.data && Array.isArray(response.data)) return response.data;
      if (Array.isArray(response)) return response as ReferenceData[];
      return [];
    } catch {
      return [];
    }
  },

  resolve: async (query: string, scopeId?: string): Promise<ReferenceData | null> => {
    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (!trimmed) return null;
    try {
      const referenceResponse = await libraryClient.post<unknown>(
        `/api/v1/library/citation/resolve`,
        { query: trimmed },
        { silent: true },
      );
      const unwrapped = unwrapResolvedReference(referenceResponse);
      if (unwrapped) return unwrapped;
    } catch {
      // Fall back to search
    }
    const results = await CitationService.search(trimmed, scopeId);
    return results.length > 0 ? results[0] : null;
  },
};

export const ExportsService = {
  exportLibrary: (
    scopeId?: string,
    options?: {
      format?: string;
      collectionId?: string;
      tagId?: string;
      itemIds?: string[];
      projectId?: string;
    },
  ) => {
    const projectId = options?.projectId || (isProjectScope(scopeId) ? scopeId : undefined);
    return libraryClient.post<{ content: string; filename: string; itemCount: number }>(
      getExportsUrl(scopeId),
      { ...options, ...(projectId ? { projectId } : {}) },
    );
  },

  exportByCitationKeys: (scopeId: string, keys: string[]) =>
    libraryClient.post<{ content: string; filename: string; itemCount: number }>(
      `${getExportsUrl(scopeId)}/by-keys`,
      { keys, format: 'bibtex' },
    ),

  exportAnnotatedPdf: (scopeId?: string, itemId?: string) => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<{ filename: string; mimeType: string; base64: string }>(
      `${getExportsUrl(scopeId)}/items/${encodeURIComponent(itemId || '')}/annotated-pdf${pQuery}`,
    );
  },

  downloadAnnotatedPdf: async (
    scopeId: string | undefined,
    itemId: string,
    fallbackFilename = `annotated_${itemId}.pdf`,
  ): Promise<{ filename: string; mimeType: string }> => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    const endpoint = `${getExportsUrl(scopeId)}/items/${encodeURIComponent(itemId)}/annotated-pdf${pQuery}`;
    let resolvedFilename = fallbackFilename;
    const res = await libraryClient.get<{ filename: string; mimeType: string; base64: string }>(endpoint);
    if (!res || !res.base64) {
      throw new Error('Failed to generate annotated PDF: No content received');
    }
    if (res.filename) {
      resolvedFilename = res.filename;
    }
    const byteCharacters = atob(res.base64);
    const sliceSize = 32_768;
    const byteArrays: Uint8Array<ArrayBuffer>[] = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const end = Math.min(offset + sliceSize, byteCharacters.length);
      const bytes = new Uint8Array(end - offset);
      for (let i = offset; i < end; i++) {
        bytes[i - offset] = byteCharacters.charCodeAt(i);
      }
      byteArrays.push(bytes);
    }
    const blob = new Blob(byteArrays, { type: res.mimeType || 'application/pdf' });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedFilename;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    }
    return { filename: resolvedFilename, mimeType: 'application/pdf' };
  },
};

export const downloadAnnotatedPdf = ExportsService.downloadAnnotatedPdf;

// 9. Extraction, Attachments & Upload Services
export const AttachmentsService = {
  list: async (scopeId: string, itemId: string): Promise<ItemAttachment[]> => {
    const res = await libraryClient.get<{ attachments: ItemAttachment[] }>(getItemAttachmentUrl(scopeId, itemId));
    return res.attachments || [];
  },

  get: async (scopeId: string, attachmentId: string): Promise<ItemAttachment> => {
    const res = await libraryClient.get<{ attachment?: ItemAttachment } | ItemAttachment>(getAttachmentUrl(scopeId, attachmentId));
    if (res && typeof res === 'object' && 'attachment' in res && res.attachment) {
      return res.attachment;
    }
    return res as ItemAttachment;
  },

  delete: async (scopeId: string, attachmentId: string): Promise<boolean> => {
    const res = await libraryClient.delete<{ success: boolean }>(getAttachmentUrl(scopeId, attachmentId));
    return res.success;
  },

  create: async (scopeId: string, itemId: string, data: Record<string, unknown>): Promise<ItemAttachment> => {
    const res = await libraryClient.post<{ attachment?: ItemAttachment } | ItemAttachment>(
      getItemAttachmentUrl(scopeId, itemId),
      data,
    );
    return (res as { attachment?: ItemAttachment }).attachment ?? (res as ItemAttachment);
  },

  captureSnapshot: async (scopeId: string, itemId: string, url?: string): Promise<ItemAttachment> => {
    const res = await libraryClient.post<{ attachment?: ItemAttachment } | ItemAttachment>(
      getItemAttachmentUrl(scopeId, itemId, 'snapshot'),
      url ? { url } : {},
    );
    return (res as { attachment?: ItemAttachment }).attachment ?? (res as ItemAttachment);
  },

  rename: async (scopeId: string, attachmentId: string, dto: { filename?: string; pattern?: string }) =>
    libraryClient.patch<{ attachment: ItemAttachment; oldFilename: string; newFilename: string }>(
      getAttachmentUrl(scopeId, attachmentId, 'rename'),
      dto,
    ),

  batchRename: async (scopeId: string, dto: { itemIds?: string[]; attachmentIds?: string[]; pattern?: string }) =>
    libraryClient.post<{
      renamedCount: number;
      results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
    }>(resolveLibraryUrl('extraction', '/attachments/batch-rename', scopeId), dto),

  reExtract: async (scopeId: string | undefined, attachmentId: string) =>
    libraryClient.post<{ status: string; attachmentId: string; message: string }>(
      getAttachmentUrl(scopeId, attachmentId, 're-extract'),
      {},
    ),

  setPrimary: (scopeId: string, itemId: string, attachmentId: string) =>
    libraryClient.post<{ success: boolean }>(
      getItemAttachmentUrl(scopeId, itemId, `${encodeURIComponent(attachmentId)}/set-primary`),
      {},
    ),
};

export const UploadService = {
  uploadMultipart: async (
    scopeId: string | undefined,
    file: File,
    options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
  ): Promise<{ fileId: string; url: string; filename: string; size: number; mimeType: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (isProjectScope(scopeId)) {
      formData.append('projectId', scopeId!);
    }
    const uploadUrl = resolveLibraryUrl('extraction', '/upload', scopeId);
    const res = await libraryClient.post<{
      fileId: string;
      url: string;
      filename?: string;
      size?: number;
      mimeType?: string;
    }>(uploadUrl, formData, {
      signal: options?.signal,
    }, scopeId);
    return {
      fileId: res.fileId,
      url: res.url,
      filename: res.filename || file.name,
      size: res.size ?? file.size,
      mimeType: res.mimeType || file.type || 'application/pdf',
    };
  },
};


// 12. Reader Services
const ReaderDocumentsService = {
  get: async (scopeId: string | undefined, itemId: string): Promise<ReaderDocument> => {
    const item = await ItemsService.getById(scopeId || 'user', itemId);
    return item as ReaderDocument;
  },

  update: async (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<ReaderDocument>,
  ): Promise<ReaderDocument> => {
    const updated = await ItemsService.updateItem(
      scopeId,
      itemId,
      data as Parameters<typeof ItemsService.updateItem>[2],
    );
    return updated as ReaderDocument;
  },

  reindex: ItemsService.reindex,

  getFulltext: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<DocumentFulltext | null> => {
    const res = await ItemsService.getFulltext(scopeId, itemId);
    if (!res) return null;
    return unwrapRecord<DocumentFulltext>(res, 'data') ?? (res as DocumentFulltext);
  },

  getMetadataSources: ItemsService.getMetadataSources,
};

const ReaderAnnotationsService = {
  getByAttachment: async (scopeId: string | undefined, attachmentId: string): Promise<ReaderAnnotation[]> => {
    if (!attachmentId) return [];
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
    const res = await libraryClient.get<ReaderAnnotation[] | { data?: ReaderAnnotation[]; annotations?: ReaderAnnotation[] }>(url);
    return unwrapList<ReaderAnnotation>(res, 'annotations');
  },

  create: async (scopeId: string | undefined, attachmentId: string, dto: CreateAnnotationDto): Promise<ReaderAnnotation> => {
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
    return libraryClient.post<ReaderAnnotation>(url, dto);
  },

  update: async (
    scopeId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion: number | undefined,
    dto: UpdateAnnotationDto,
  ): Promise<ReaderAnnotation> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      scopeId,
    );
    return libraryClient.patch<ReaderAnnotation>(url, { ...dto, expectedVersion });
  },

  delete: async (
    scopeId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion?: number,
  ): Promise<boolean> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      scopeId,
    );
    const res = await libraryClient.delete<{ success?: boolean } | boolean>(url, {
      params: expectedVersion !== undefined ? { expectedVersion } : undefined,
    });
    return typeof res === 'boolean' ? res : Boolean(res?.success);
  },

  batch: async (
    scopeId: string | undefined,
    attachmentId: string,
    payload: { upserts: unknown[]; deletes: string[] },
  ): Promise<unknown> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/batch`,
      scopeId,
    );
    return libraryClient.put<unknown>(url, payload);
  },

  extractNotes: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<{ totalExtracted: number; note?: unknown }> => {
    const res = await NotesService.extractNotes(scopeId, itemId);
    const count =
      res && typeof res === 'object' && 'totalExtracted' in res
        ? Number((res as { totalExtracted?: number }).totalExtracted ?? 1)
        : res
          ? 1
          : 0;
    return { totalExtracted: count, note: res };
  },

  importExternal: async (
    scopeId: string | undefined,
    attachmentId: string,
  ): Promise<{ importedCount: number }> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/import-external`,
      scopeId,
    );
    return libraryClient.post<{ importedCount: number }>(url, {});
  },
};

const ReaderStateService = {
  getState: async (scopeId: string | undefined, itemId: string): Promise<DocumentReadingState | null> => {
    try {
      const state = await StateService.getState(scopeId, itemId);
      return (state as DocumentReadingState | null) ?? null;
    } catch {
      return null;
    }
  },

  updateState: async (
    scopeId: string | undefined,
    itemId: string,
    patch: Partial<DocumentReadingState>,
  ): Promise<DocumentReadingState> => {
    const updated = await StateService.updateState(scopeId, itemId, patch);
    return updated as DocumentReadingState;
  },

  markAsRead: (scopeId: string | undefined, itemId: string) =>
    StateService.markAsRead(scopeId, itemId),
};

const ReaderAttachmentsService = {
  reExtract: AttachmentsService.reExtract,
};

const ReaderCitationsService = {
  exportLibrary: ExportsService.exportLibrary,
  downloadAnnotatedPdf: ExportsService.downloadAnnotatedPdf,
};

export const readerService = {
  getDocument: ReaderDocumentsService.get,
  getAnnotations: ReaderAnnotationsService.getByAttachment,
  createAnnotation: ReaderAnnotationsService.create,
  updateAnnotation: ReaderAnnotationsService.update,
  deleteAnnotation: ReaderAnnotationsService.delete,
  batchAnnotations: ReaderAnnotationsService.batch,
  getState: ReaderStateService.getState,
  updateState: ReaderStateService.updateState,
  markAsRead: ReaderStateService.markAsRead,
  documents: ReaderDocumentsService,
  items: ReaderDocumentsService,
  annotations: ReaderAnnotationsService,
  state: ReaderStateService,
  attachments: ReaderAttachmentsService,
  citations: ReaderCitationsService,
  exports: ReaderCitationsService,
  fetchPdfBlob,
  getItemFileUrl,
  isProjectScope,
};

