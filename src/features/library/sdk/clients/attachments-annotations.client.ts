import type { ItemAttachment, Note, FormattedCitation, CslStyle, ReferenceData, CslStyleMetadata } from '@/features/library/domain/types/core.types';
import type { ReaderAnnotation, CreateAnnotationDto, UpdateAnnotationDto } from '@/features/library/domain/types/reader.schema';
import { libraryClient, resolveLibraryUrl, getItemAttachmentUrl, getAttachmentUrl, unwrapList, isProjectScope, getCitationUrl, getExportsUrl, unwrapResolvedReference } from './http.client';
import { NotesService, type ExtractNotesOptions } from './catalog-entities.client';
import { normalizeCitationStyleId } from '@/features/library/domain/citations.domain';

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
    }>(
      uploadUrl,
      formData,
      {
        signal: options?.signal,
        onUploadProgress: options?.onProgress
          ? (evt) => {
              if (evt.total && evt.total > 0) {
                options.onProgress?.(Math.round((evt.loaded * 100) / evt.total));
              }
            }
          : undefined,
      },
      scopeId,
    );
    return {
      fileId: res.fileId,
      url: res.url,
      filename: res.filename || file.name,
      size: res.size ?? file.size,
      mimeType: res.mimeType || file.type || 'application/pdf',
    };
  },
};

export function normalizeAnnotationEntity(raw: ReaderAnnotation & { rectCoords?: unknown; quoteText?: string }): ReaderAnnotation {
  const rawRects = Array.isArray(raw.rects) && raw.rects.length > 0 ? raw.rects : raw.rectCoords;
  const rects: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
    paths?: string[];
    imageDataUrl?: string;
  }> = [];
  if (Array.isArray(rawRects)) {
    if (rawRects.length === 4 && rawRects.every((n) => typeof n === 'number')) {
      const [x1, y1, x2, y2] = rawRects as [number, number, number, number];
      rects.push({ x1, y1, x2, y2, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) });
    } else {
      for (const entry of rawRects) {
        if (Array.isArray(entry) && entry.length === 4 && entry.every((n) => typeof n === 'number')) {
          const [x1, y1, x2, y2] = entry as [number, number, number, number];
          rects.push({ x1, y1, x2, y2, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) });
        } else if (entry && typeof entry === 'object') {
          const r = entry as Record<string, unknown>;
          const x1 = typeof r.x1 === 'number' ? r.x1 : typeof r.x === 'number' ? r.x : 0;
          const y1 = typeof r.y1 === 'number' ? r.y1 : typeof r.y === 'number' ? r.y : 0;
          const w = typeof r.width === 'number' ? r.width : undefined;
          const h = typeof r.height === 'number' ? r.height : undefined;
          const x2 = typeof r.x2 === 'number' ? r.x2 : w !== undefined ? x1 + w : x1;
          const y2 = typeof r.y2 === 'number' ? r.y2 : h !== undefined ? y1 + h : y1;
          const paths = Array.isArray(r.paths)
            ? r.paths.filter((p): p is string => typeof p === 'string' && p.length > 0)
            : undefined;
          const imageDataUrl =
            typeof r.imageDataUrl === 'string' && r.imageDataUrl.length > 0
              ? r.imageDataUrl
              : undefined;
          rects.push({
            x1,
            y1,
            x2,
            y2,
            width: w ?? Math.max(0, x2 - x1),
            height: h ?? Math.max(0, y2 - y1),
            ...(paths && paths.length > 0 ? { paths } : {}),
            ...(imageDataUrl ? { imageDataUrl } : {}),
          });
        }
      }
    }
  }
  const textVal = raw.text ?? raw.quoteText ?? '';
  const pageIndex =
    typeof raw.pageIndex === 'number'
      ? Math.max(0, raw.pageIndex)
      : typeof raw.pageNumber === 'number'
        ? Math.max(0, raw.pageNumber - 1)
        : 0;
  const pageNumber =
    typeof raw.pageNumber === 'number' && raw.pageNumber >= 1
      ? raw.pageNumber
      : pageIndex + 1;
  return {
    ...raw,
    pageIndex,
    pageNumber,
    text: textVal,
    quoteText: raw.quoteText ?? textVal,
    rects,
  };
}

export const AnnotationsService = {
  getByAttachment: async (scopeId: string | undefined, attachmentId: string): Promise<ReaderAnnotation[]> => {
    if (!attachmentId) return [];
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
    const res = await libraryClient.get<ReaderAnnotation[] | { data?: ReaderAnnotation[]; annotations?: ReaderAnnotation[] }>(url);
    return unwrapList<ReaderAnnotation>(res, 'annotations').map(normalizeAnnotationEntity);
  },

  create: async (scopeId: string | undefined, attachmentId: string, dto: CreateAnnotationDto): Promise<ReaderAnnotation> => {
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
    const res = await libraryClient.post<ReaderAnnotation>(url, dto);
    return normalizeAnnotationEntity(res);
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
    const res = await libraryClient.patch<ReaderAnnotation>(url, { ...dto, expectedVersion });
    return normalizeAnnotationEntity(res);
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

  extractNotes: (
    scopeId: string | undefined,
    itemId: string,
    options?: ExtractNotesOptions,
  ): Promise<{ totalExtracted: number; note?: Note; message?: string }> =>
    NotesService.extractFromAnnotations(scopeId, itemId, options),

  importExternal: async (
    scopeId: string | undefined,
    attachmentId: string,
  ): Promise<{
    importedCount: number;
    imported: number;
    totalFound: number;
    pagesScanned: number;
  }> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/import-external`,
      scopeId,
    );
    const res = await libraryClient.post<{
      importedCount?: number;
      imported?: number;
      totalFound?: number;
      pagesScanned?: number;
    }>(url, {});
    const imported = res?.importedCount ?? res?.imported ?? 0;
    return {
      importedCount: imported,
      imported,
      totalFound: res?.totalFound ?? imported,
      pagesScanned: res?.pagesScanned ?? 0,
    };
  },
};

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
    return libraryClient.get<import('@/features/library/domain/types/core.types').StyleSummary[]>(
      `${getCitationUrl(scopeId, 'styles')}${pQuery}`,
    );
  },

  searchStyles: (query = '', limit = 30, scopeId?: string) =>
    libraryClient.get<{ styles: CslStyleMetadata[]; total: number }>(
      `${getCitationUrl(scopeId, 'styles/search')}?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

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

  downloadAnnotatedPdf: async (
    scopeId: string | undefined,
    itemId: string,
    fallbackFilename = `annotated_${itemId}.pdf`,
    attachmentId?: string,
  ): Promise<{ filename: string; mimeType: string }> => {
    const params = new URLSearchParams();
    if (isProjectScope(scopeId)) params.set('projectId', scopeId!);
    if (attachmentId) params.set('attachmentId', attachmentId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const endpoint = `${getExportsUrl(scopeId)}/items/${encodeURIComponent(itemId)}/annotated-pdf${qs}`;
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
