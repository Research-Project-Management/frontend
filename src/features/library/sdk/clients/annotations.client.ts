import type { Note } from '@/features/library/types/core.types';
import type {
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
} from '@/features/library/types/reader.types';
import {
  libraryClient,
  resolveLibraryUrl,
  unwrapList,
  isProjectScope,
} from './http.client';
import { NotesService, type ExtractNotesOptions } from './notes.client';

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
