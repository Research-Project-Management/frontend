import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/shared/lib/api';
import type {
  ReaderDocument,
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  DocumentReadingState,
  DocumentFulltext,
} from '@/features/library/types/reader.types';
import { isProjectScope, getPaperFileUrl as resolvePaperFileUrl } from '@/features/library/domain/item-url';
import { ItemsService, NotesService, StateService, fetchPdfBlob } from '@/features/library/data/catalog/catalog.service';
import { AttachmentsService } from '@/features/library/data/extraction/extraction.service';
import { ExportService } from '@/features/library/data/citation/citation.service';
import { streamPaperChat } from './ai.service';

export { isProjectScope, fetchPdfBlob };

export function getPaperFileUrl(paper?: ReaderDocument | null, scopeId?: string): string | null {
  if (!paper) return null;
  const resolved = resolvePaperFileUrl(paper, scopeId);
  return resolved || null;
}

function unwrapList<T>(res: unknown, key: string): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function unwrapRecord<T>(res: unknown, key: string): T | null {
  if (!res || typeof res !== 'object') return null;
  const obj = res as Record<string, unknown>;
  if (key in obj && obj[key] && typeof obj[key] === 'object') {
    return obj[key] as T;
  }
  if ('data' in obj && obj.data && typeof obj.data === 'object') {
    return obj.data as T;
  }
  return res as T;
}

// ── 1. Documents Domain (Delegates to ItemsService) ──────────────────────────
export const ReaderDocumentsService = {
  get: async (scopeId: string | undefined, itemId: string): Promise<ReaderDocument> => {
    const item = await ItemsService.getItem(scopeId, itemId);
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

  reindex: (scopeId: string | undefined, itemId: string) =>
    ItemsService.reindexItem(scopeId, itemId),

  getFulltext: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<DocumentFulltext | null> => {
    const res = await ItemsService.getFulltext(scopeId, itemId);
    if (!res) return null;
    return unwrapRecord<DocumentFulltext>(res, 'data') ?? (res as DocumentFulltext);
  },

  getMetadataSources: (scopeId: string | undefined, itemId: string) =>
    ItemsService.getMetadataSources(scopeId, itemId),
};

// ── 2. Annotations Domain ────────────────────────────────────────────────────
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
    return unwrapList<ReaderAnnotation>(res, 'annotations');
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
    return unwrapRecord<ReaderAnnotation>(res, 'annotation') ?? (res as ReaderAnnotation);
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
    return unwrapRecord<ReaderAnnotation>(res, 'annotation') ?? (res as ReaderAnnotation);
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
      upserts?: Array<Record<string, unknown>>;
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
    const note = await NotesService.extractFromAnnotations(scopeId, itemId, options);
    const totalExtracted =
      (note as { totalExtracted?: number } | undefined)?.totalExtracted ?? (note?.id ? 1 : 0);
    return { success: true, totalExtracted, note };
  },

  importExternal: async (scopeId: string | undefined, attachmentId: string) => {
    const url = getAttachmentAnnotationsUrl(scopeId, attachmentId, 'import-external');
    return apiPost<{ success: boolean; importedCount: number }>(url, {});
  },
};

export const AnnotationsService = ReaderAnnotationsService;

// ── 3. Reading State Domain (Delegates to StateService) ──────────────────────
export const ReaderStateService = {
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
    data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
      currentPage?: number;
      scrollPosition?: Record<string, unknown> | Array<unknown> | null;
    },
  ): Promise<DocumentReadingState> => {
    const updated = await StateService.updateState(scopeId, itemId, data);
    return updated as DocumentReadingState;
  },

  markAsRead: (scopeId: string | undefined, itemId: string) =>
    StateService.markAsRead(scopeId, itemId),
};

// ── 4. Attachments OCR Trigger (Delegates to AttachmentsService) ─────────────
export const ReaderAttachmentsService = {
  reExtract: (scopeId: string | undefined, attachmentId: string) =>
    AttachmentsService.reExtractAttachment(scopeId, attachmentId),
};

// ── 5. Citations & Annotated PDF Export (Delegates to ExportService) ─────────
export const ReaderCitationsService = {
  exportLibrary: ExportService.exportLibrary,
  downloadAnnotatedPdf: ExportService.downloadAnnotatedPdf,
};

// ── UNIFIED READER SDK ENTRY POINT ───────────────────────────────────────────
export const readerService = {
  documents: ReaderDocumentsService,
  items: ReaderDocumentsService,
  annotations: ReaderAnnotationsService,
  state: ReaderStateService,
  attachments: ReaderAttachmentsService,
  citations: ReaderCitationsService,
  exports: ReaderCitationsService,
  ai: {
    streamPaperChat,
  },
  fetchPdfBlob,
  getPaperFileUrl,
  isProjectScope,
};

export const ReaderService = readerService;
export default readerService;
