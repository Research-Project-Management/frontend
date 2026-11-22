import type { ItemAttachment, Note, FormattedCitation, CslStyle, ReferenceData, CslStyleMetadata } from '@/features/library/types/core.types';
import type { ReaderAnnotation, CreateAnnotationDto, UpdateAnnotationDto } from '@/features/library/types/reader.types';
import { libraryClient, resolveLibraryUrl, getItemAttachmentUrl, getAttachmentUrl, unwrapList, isProjectScope, getCitationUrl, getExportsUrl, unwrapResolvedReference } from './http.client';
import { NotesService, type ExtractNotesOptions } from './catalog-entities.client';
import { normalizeCitationStyleId } from '@/features/library/domain/citations';
import { smartUpload } from '@/shared/lib/smart-upload-engine';

export const AttachmentsService = {
  list: async (spaceId: string, itemId: string): Promise<ItemAttachment[]> => {
    const res = await libraryClient.get<{ attachments: ItemAttachment[] }>(getItemAttachmentUrl(spaceId, itemId));
    return res.attachments || [];
  },

  get: async (spaceId: string, attachmentId: string): Promise<ItemAttachment> => {
    const res = await libraryClient.get<{ attachment?: ItemAttachment } | ItemAttachment>(getAttachmentUrl(spaceId, attachmentId));
    if (res && typeof res === 'object' && 'attachment' in res && res.attachment) {
      return res.attachment;
    }
    return res as ItemAttachment;
  },

  delete: async (spaceId: string, attachmentId: string): Promise<boolean> => {
    const res = await libraryClient.delete<{ success: boolean }>(getAttachmentUrl(spaceId, attachmentId));
    return res.success;
  },

  create: async (spaceId: string, itemId: string, data: Record<string, unknown>): Promise<ItemAttachment> => {
    const res = await libraryClient.post<{ attachment?: ItemAttachment } | ItemAttachment>(
      getItemAttachmentUrl(spaceId, itemId),
      data,
    );
    return (res as { attachment?: ItemAttachment }).attachment ?? (res as ItemAttachment);
  },

  rename: async (spaceId: string, attachmentId: string, dto: { filename?: string; pattern?: string }) =>
    libraryClient.patch<{ attachment: ItemAttachment; oldFilename: string; newFilename: string }>(
      getAttachmentUrl(spaceId, attachmentId, 'rename'),
      dto,
    ),

  batchRename: async (spaceId: string, dto: { itemIds?: string[]; attachmentIds?: string[]; pattern?: string }) =>
    libraryClient.post<{
      renamedCount: number;
      results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
    }>(resolveLibraryUrl('extraction', '/attachments/batch-rename', spaceId), dto),

  setPrimary: (spaceId: string, itemId: string, attachmentId: string) =>
    libraryClient.post<{ success: boolean }>(
      getItemAttachmentUrl(spaceId, itemId, `${encodeURIComponent(attachmentId)}/set-primary`),
      {},
    ),
};

export const UploadService = {
  uploadFile: async (
    spaceId: string | undefined,
    file: File,
    options?: {
      contentHash?: string;
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    },
  ): Promise<{
    fileId: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    deduplicated?: boolean;
  }> => {
    const effectiveSpaceId = isProjectScope(spaceId) ? spaceId : undefined;
    const baseEndpoint = resolveLibraryUrl('extraction', '/attachments', effectiveSpaceId);
    const directUploadEndpoint = resolveLibraryUrl('extraction', '/upload', effectiveSpaceId);
    const result = await smartUpload(file, {
      baseEndpoint,
      directUploadEndpoint,
      filename: file.name,
      mimeType: file.type || 'application/pdf',
      spaceId: effectiveSpaceId,
      contentHash: options?.contentHash,
      headers: effectiveSpaceId ? { 'X-Space-Id': effectiveSpaceId } : undefined,
      allowDirectFallback: true,
      onProgress: options?.onProgress,
      signal: options?.signal,
    });
    return {
      fileId: result.fileId,
      url: result.url,
      filename: result.filename || file.name,
      size: result.size ?? file.size,
      mimeType: result.mimeType || file.type || 'application/pdf',
      deduplicated: result.deduplicated,
    };
  },

  uploadMultipart: async (
    spaceId: string | undefined,
    file: File,
    options?: {
      contentHash?: string;
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    },
  ) => UploadService.uploadFile(spaceId, file, options),
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
  getByAttachment: async (spaceId: string | undefined, attachmentId: string): Promise<ReaderAnnotation[]> => {
    if (!attachmentId) return [];
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, spaceId);
    const res = await libraryClient.get<ReaderAnnotation[] | { data?: ReaderAnnotation[]; annotations?: ReaderAnnotation[] }>(url);
    return unwrapList<ReaderAnnotation>(res, 'annotations').map(normalizeAnnotationEntity);
  },

  create: async (spaceId: string | undefined, attachmentId: string, dto: CreateAnnotationDto): Promise<ReaderAnnotation> => {
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, spaceId);
    const res = await libraryClient.post<ReaderAnnotation>(url, dto);
    return normalizeAnnotationEntity(res);
  },

  update: async (
    spaceId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion: number | undefined,
    dto: UpdateAnnotationDto,
  ): Promise<ReaderAnnotation> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      spaceId,
    );
    const res = await libraryClient.patch<ReaderAnnotation>(url, { ...dto, expectedVersion });
    return normalizeAnnotationEntity(res);
  },

  delete: async (
    spaceId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion?: number,
  ): Promise<boolean> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      spaceId,
    );
    const res = await libraryClient.delete<{ deleted?: boolean; success?: boolean } | boolean>(url, {
      params: expectedVersion !== undefined ? { expectedVersion } : undefined,
    });
    return typeof res === 'boolean' ? res : Boolean(res?.deleted ?? res?.success);
  },

  batch: async (
    spaceId: string | undefined,
    attachmentId: string,
    payload: { upserts: unknown[]; deletes: string[] },
  ): Promise<unknown> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/batch`,
      spaceId,
    );
    return libraryClient.put<unknown>(url, payload);
  },

  extractNotes: (
    spaceId: string | undefined,
    itemId: string,
    options?: ExtractNotesOptions,
  ): Promise<{ totalExtracted: number; note?: Note; message?: string }> =>
    NotesService.extractFromAnnotations(spaceId, itemId, options),

  importExternal: async (
    spaceId: string | undefined,
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
      spaceId,
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
  formatCitation: (spaceId: string | undefined, itemId: string, style: CslStyle = 'apa-7th', index = 1) => {
    const resolvedStyle = normalizeCitationStyleId(style);
    const pQuery = isProjectScope(spaceId) ? `&spaceId=${encodeURIComponent(spaceId!)}` : '';
    return libraryClient.get<FormattedCitation>(
      `${getCitationUrl(spaceId, 'items')}/${encodeURIComponent(itemId)}/citation?style=${encodeURIComponent(resolvedStyle)}&index=${index}${pQuery}`,
    );
  },

  batchFormat: (spaceId: string | undefined, itemIds: string[], style: CslStyle = 'apa-7th') => {
    const resolvedStyle = normalizeCitationStyleId(style);
    const targetSpaceId = isProjectScope(spaceId) ? spaceId : undefined;
    return libraryClient.post<{
      style: CslStyle;
      total: number;
      combinedInText?: string;
      bibliographyText?: string;
      bibliographyHtml?: string;
      citations: Array<{ itemId?: string; citation: FormattedCitation }>;
    }>(getCitationUrl(spaceId, 'batch-items'), {
      itemIds,
      style: resolvedStyle,
      ...(targetSpaceId ? { spaceId: targetSpaceId } : {}),
    });
  },

  getStyles: (spaceId?: string) => {
    const pQuery = isProjectScope(spaceId) ? `?spaceId=${encodeURIComponent(spaceId!)}` : '';
    return libraryClient.get<import('@/features/library/types/core.types').StyleSummary[]>(
      `${getCitationUrl(spaceId, 'styles')}${pQuery}`,
    );
  },

  searchStyles: (query = '', limit = 30, spaceId?: string) =>
    libraryClient.get<{ styles: CslStyleMetadata[]; total: number }>(
      `${getCitationUrl(spaceId, 'styles/search')}?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  resolveDoi: async (doi: string, spaceId?: string): Promise<ReferenceData | null> => {
    const rawDoi = typeof doi === 'string' ? doi.trim() : '';
    if (!rawDoi) throw new Error('Invalid DOI provided');
    try {
      const referenceResponse = await libraryClient.post<unknown>(
        getCitationUrl(spaceId, 'resolve'),
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

  search: async (query: string, spaceId?: string): Promise<ReferenceData[]> => {
    if (!query || !query.trim()) return [];
    const trimmedQuery = query.trim();
    try {
      const response = await libraryClient.get<{
        works?: ReferenceData[];
        results?: ReferenceData[];
        data?: ReferenceData[];
      }>(
        `${getCitationUrl(spaceId, 'crossref/search')}?query=${encodeURIComponent(trimmedQuery)}&rows=10`,
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

  resolve: async (query: string, spaceId?: string): Promise<ReferenceData | null> => {
    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (!trimmed) return null;
    try {
      const referenceResponse = await libraryClient.post<unknown>(
        getCitationUrl(spaceId, 'resolve'),
        { query: trimmed },
        { silent: true },
      );
      const unwrapped = unwrapResolvedReference(referenceResponse);
      if (unwrapped) return unwrapped;
    } catch {
      // Fall back to search
    }
    const results = await CitationService.search(trimmed, spaceId);
    return results.length > 0 ? results[0] : null;
  },
};

export const ExportsService = {
  exportLibrary: (
    spaceId?: string,
    options?: {
      format?: string;
      collectionId?: string;
      tagId?: string;
      itemIds?: string[];
      spaceId?: string;
      projectId?: string;
    },
  ) => {
    const { projectId: optProjectId, spaceId: optSpaceId, ...restOptions } = options || {};
    const targetSpaceId = optSpaceId || optProjectId || (isProjectScope(spaceId) ? spaceId : undefined);
    return libraryClient.post<{ content: string; filename: string; itemCount: number }>(
      getExportsUrl(spaceId),
      { ...restOptions, ...(targetSpaceId ? { spaceId: targetSpaceId } : {}) },
    );
  },

  downloadAnnotatedPdf: async (
    spaceId: string | undefined,
    itemId: string,
    fallbackFilename = `annotated_${itemId}.pdf`,
    attachmentId?: string,
  ): Promise<{ filename: string; mimeType: string }> => {
    const params = new URLSearchParams();
    if (isProjectScope(spaceId)) params.set('spaceId', spaceId!);
    if (attachmentId) params.set('attachmentId', attachmentId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const endpoint = `${getExportsUrl(spaceId)}/items/${encodeURIComponent(itemId)}/annotated-pdf${qs}`;
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
