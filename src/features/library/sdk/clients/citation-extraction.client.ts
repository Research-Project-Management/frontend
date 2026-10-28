import type {
  FormattedCitation,
  CslStyle,
  ReferenceData,
  CslStyleMetadata,
  ItemAttachment,
  Note,
} from '@/features/library/domain/types/library.types';
import type {
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
} from '@/features/library/domain/types/reader.types';
import { normalizeCitationStyleId } from '@/features/library/domain/citations';
import {
  libraryClient,
  resolveLibraryUrl,
  resolveLibraryRawPath,
  getCitationUrl,
  getExportsUrl,
  getItemAttachmentUrl,
  getAttachmentUrl,
  unwrapList,
  unwrapResolvedReference,
  isProjectScope,
} from './http.client';
import { NotesService } from './catalog-entities.client';

// 8. Citations & Exports Services
export const CitationService = {
  formatCitation: (scopeId: string | undefined, itemId: string, style: CslStyle = 'apa-7th', index = 1) => {
    const resolvedStyle = normalizeCitationStyleId(style);
    const pQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<FormattedCitation>(
      `${getCitationUrl(scopeId, 'items')}/${encodeURIComponent(itemId)}/citation?style=${encodeURIComponent(resolvedStyle)}&index=${index}${pQuery}`,
    );
  },

  batchFormat: (scopeId: string | undefined, itemIds: string[], style: CslStyle = 'apa-7th') => {
    const resolvedStyle = normalizeCitationStyleId(style);
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
      style: resolvedStyle,
      ...(projectId ? { projectId } : {}),
    });
  },

  getStyles: (scopeId?: string) => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<import('@/features/library/domain/types/library.types').StyleSummary[]>(
      `${getCitationUrl(scopeId, 'styles')}${pQuery}`,
    );
  },

  searchStyles: (query = '', limit = 30, scopeId?: string) =>
    libraryClient.get<{ styles: CslStyleMetadata[]; total: number }>(
      `${getCitationUrl(scopeId, 'styles/search')}?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  uploadCustomStyle: (xml: string, title?: string, scopeId?: string) =>
    libraryClient.post<{ styleId?: string; id?: string; title: string; message: string }>(
      getCitationUrl(scopeId, 'styles/custom'),
      { xml, title },
    ).then((res) => ({
      ...res,
      id: res.id || res.styleId || '',
      styleId: res.styleId || res.id || '',
    })),

  formatRawItem: (
    item: Record<string, unknown>,
    styleId: CslStyle = 'apa-7th',
    index = 1,
    scopeId?: string,
  ) =>
    libraryClient.post<FormattedCitation>(getCitationUrl(scopeId, 'format'), {
      item,
      styleId: normalizeCitationStyleId(styleId),
      index,
    }),

  formatRawBatch: (
    items: Array<Record<string, unknown>>,
    styleId: CslStyle = 'apa-7th',
    scopeId?: string,
  ) =>
    libraryClient.post<{
      style: CslStyle;
      total: number;
      combinedInText?: string;
      bibliographyText?: string;
      bibliographyHtml?: string;
      citations: Array<{ itemId?: string; citation: FormattedCitation }>;
    }>(getCitationUrl(scopeId, 'batch'), {
      items,
      styleId: normalizeCitationStyleId(styleId),
    }),

  resolveDoi: async (doi: string, scopeId?: string): Promise<ReferenceData | null> => {
    const rawDoi = typeof doi === 'string' ? doi.trim() : '';
    if (!rawDoi) throw new Error('Invalid DOI provided');
    try {
      const referenceResponse = await libraryClient.post<unknown>(
        getCitationUrl(scopeId, 'resolve'),
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

  search: async (query: string, scopeId?: string): Promise<ReferenceData[]> => {
    if (!query || !query.trim()) return [];
    const trimmedQuery = query.trim();
    try {
      const response = await libraryClient.get<{
        works?: ReferenceData[];
        results?: ReferenceData[];
        data?: ReferenceData[];
      }>(
        `${getCitationUrl(scopeId, 'crossref/search')}?query=${encodeURIComponent(trimmedQuery)}&rows=10`,
        { silent: true },
      );
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
        getCitationUrl(scopeId, 'resolve'),
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

  exportByCitationKeys: async (scopeId: string, keys: string[]) => {
    const projectId = isProjectScope(scopeId) ? scopeId : undefined;
    const res = await libraryClient.post<{
      content?: string;
      bibtex?: string;
      filename?: string;
      itemCount?: number;
      count?: number;
      foundKeys?: string[];
      missingKeys?: string[];
    }>(
      `${getExportsUrl(scopeId)}/by-keys`,
      { keys, ...(projectId ? { projectId } : {}) },
    );
    const content = res?.content ?? res?.bibtex ?? '';
    return {
      ...res,
      content,
      bibtex: res?.bibtex ?? content,
      itemCount: res?.itemCount ?? res?.count ?? 0,
      filename: res?.filename ?? 'references.bib',
      foundKeys: Array.isArray(res?.foundKeys) ? res.foundKeys : [],
      missingKeys: Array.isArray(res?.missingKeys) ? res.missingKeys : [],
    };
  },

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

  getPresignedUrl: (scopeId: string | undefined, attachmentId: string) =>
    libraryClient.get<{
      url: string;
      expiresIn: number;
      filename: string;
      mimeType: string;
    }>(getAttachmentUrl(scopeId, attachmentId, 'presigned-url')),

  getThumbnailUrl: (scopeId: string | undefined, attachmentId: string) =>
    getAttachmentUrl(scopeId, attachmentId, 'thumbnail'),
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

  presignUpload: (
    scopeId: string | undefined,
    dto: {
      filename: string;
      mimeType?: string;
      sizeBytes?: number;
      contentHash?: string;
    },
  ) =>
    libraryClient.post<{
      uploadUrl: string;
      storageKey: string;
      fileId?: string;
      expiresIn?: number;
      headers?: Record<string, string>;
    }>(resolveLibraryUrl('extraction', '/attachments/presign', scopeId), dto),

  completePresignedUpload: (
    scopeId: string | undefined,
    dto: {
      storageKey: string;
      filename: string;
      mimeType?: string;
      sizeBytes?: number;
      contentHash?: string;
    },
  ) =>
    libraryClient.post<{
      success?: boolean;
      fileId?: string;
      storageKey: string;
      url?: string;
      filename?: string;
      size?: number;
      mimeType?: string;
    }>(resolveLibraryUrl('extraction', '/attachments/presign/complete', scopeId), dto),

  initiateMultipartSession: (
    scopeId: string | undefined,
    dto: {
      filename: string;
      mimeType?: string;
      totalSize: number;
      expectedHash?: string;
    },
  ) =>
    libraryClient.post<{
      sessionId: string;
      storageKey?: string;
      partSize?: number;
      totalParts?: number;
    }>(resolveLibraryUrl('extraction', '/attachments/multipart/initiate', scopeId), dto),

  getMultipartPartUrl: (
    scopeId: string | undefined,
    sessionId: string,
    partNumber: number,
  ) =>
    libraryClient.get<{ partNumber: number; partUrl: string }>(
      resolveLibraryUrl(
        'extraction',
        `/attachments/multipart/${encodeURIComponent(sessionId)}/part-url`,
        scopeId,
      ),
      { params: { partNumber } },
    ),

  completeMultipartSession: (
    scopeId: string | undefined,
    dto: {
      sessionId: string;
      parts: Array<{ partNumber: number; eTag: string }>;
    },
  ) =>
    libraryClient.post<{
      fileId?: string;
      storageKey?: string;
      url?: string;
      size?: number;
    }>(resolveLibraryUrl('extraction', '/attachments/multipart/complete', scopeId), dto),

  abortMultipartSession: (scopeId: string | undefined, sessionId: string) =>
    libraryClient.delete<{ success: boolean }>(
      resolveLibraryUrl(
        'extraction',
        `/attachments/multipart/${encodeURIComponent(sessionId)}`,
        scopeId,
      ),
    ),
};

export const ExtractionTelemetryService = {
  getTelemetry: () =>
    libraryClient.get<{
      status: string;
      architecture: string;
      version: string;
      flags: {
        enabled: boolean;
        zeroDocker: boolean;
        fallbackMode: string;
        pipelineMode: string;
      };
      metrics: {
        latencyTarget: string;
        supportedFormats: string[];
        cascades: string[];
      };
    }>(resolveLibraryRawPath('/api/v1/library/extraction/telemetry', 'extraction')),

  benchmark: (payload: { base64Pdf?: string; filename?: string } | File) => {
    const benchmarkUrl = resolveLibraryRawPath('/api/v1/library/extraction/benchmark', 'extraction');
    if (typeof File !== 'undefined' && payload instanceof File) {
      const formData = new FormData();
      formData.append('file', payload);
      return libraryClient.post<{
        success: boolean;
        benchmark: {
          executionLatencyMs: number;
          engineUsed: string;
          isSelfSufficient: boolean;
          qualityScore: number;
          breakdown: Record<string, unknown>;
          missingFields: string[];
        };
        extractedMetadata: Record<string, unknown>;
      }>(benchmarkUrl, formData);
    }
    return libraryClient.post<{
      success: boolean;
      benchmark: {
        executionLatencyMs: number;
        engineUsed: string;
        isSelfSufficient: boolean;
        qualityScore: number;
        breakdown: Record<string, unknown>;
        missingFields: string[];
      };
      extractedMetadata: Record<string, unknown>;
    }>(benchmarkUrl, payload);
  },
};


// 12. Annotations & Reader Services
export const AnnotationsService = {
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
    const res = await libraryClient.delete<{ deleted?: boolean; success?: boolean } | boolean>(url, {
      params: expectedVersion !== undefined ? { expectedVersion } : undefined,
    });
    return typeof res === 'boolean' ? res : Boolean(res?.deleted ?? res?.success);
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
    options?: { noteId?: string; tagColor?: boolean; tagColorName?: string; includeComments?: boolean },
  ): Promise<{ totalExtracted: number; note?: Note }> => {
    const res = await NotesService.extractFromAnnotations(scopeId, itemId, options);
    const count =
      res && typeof res === 'object' && 'totalExtracted' in res && typeof res.totalExtracted === 'number'
        ? res.totalExtracted
        : res && (res as { id?: string }).id
          ? 1
          : 0;
    return { totalExtracted: count, note: res?.note ?? res };
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


