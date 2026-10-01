import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from "@/shared/lib/api";
import type {
  LibraryAnnotation,
  ReaderAnnotation,
  AnnotationType,
  CreateAnnotationDTO,
  UpdateAnnotationDTO,
  BatchAnnotationsDTO,
  BatchAnnotationsResponse,
} from '../../types/annotations.types';

export type {
  LibraryAnnotation,
  ReaderAnnotation,
  AnnotationType,
  CreateAnnotationDTO,
  UpdateAnnotationDTO,
  BatchAnnotationsDTO,
  BatchAnnotationsResponse,
};

type AnnotationsListResponse =
  | ReaderAnnotation[]
  | { data?: ReaderAnnotation[]; annotations?: ReaderAnnotation[] };

type AnnotationSingleResponse =
  | ReaderAnnotation
  | { data?: ReaderAnnotation; annotation?: ReaderAnnotation };

type DeleteAnnotationResponse = {
  deleted?: boolean;
  id?: string;
  data?: { deleted?: boolean; id?: string };
};

type ExtractNotesResponse = {
  success?: boolean;
  totalExtracted?: number;
  data?: { success?: boolean; totalExtracted?: number };
};

export const LIBRARY_EXTRACTION_BASE =
  process.env.NEXT_PUBLIC_LIBRARY_EXTRACTION_URL ||
  process.env.NEXT_PUBLIC_LIBRARY_SERVICE_URL ||
  process.env.NEXT_PUBLIC_LIBRARIES_SERVICE_URL ||
  '/api/v1/library';

export const LIBRARY_CATALOG_BASE =
  process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL ||
  process.env.NEXT_PUBLIC_LIBRARY_SERVICE_URL ||
  process.env.NEXT_PUBLIC_LIBRARIES_SERVICE_URL ||
  '/api/v1/library';

/**
 * AnnotationsService connected to backend AnnotationsController (/api/v1/library/attachments/:attachmentId/annotations)
 * Part of the unified library-services microservice extraction domain.
 */
export const AnnotationsService = {
  /**
   * Get all PDF annotations for an attachment (sorted by position page -> Y -> X)
   */
  getByAttachment: async (
    _scopeId: string | undefined,
    attachmentId: string,
    pageIndex?: number,
    type?: string,
  ): Promise<ReaderAnnotation[]> => {
    const params = new URLSearchParams();
    if (pageIndex !== undefined) params.set('pageIndex', String(pageIndex));
    if (type !== undefined) params.set('type', type);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const raw = await apiGet<AnnotationsListResponse>(
      `${LIBRARY_EXTRACTION_BASE}/attachments/${encodeURIComponent(attachmentId)}/annotations${qs}`,
    );
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      return raw.data || raw.annotations || [];
    }
    return [];
  },

  /**
   * Create a new PDF annotation attached to an attachment
   */
  create: async (
    _scopeId: string | undefined,
    attachmentId: string,
    dto: CreateAnnotationDTO,
  ): Promise<ReaderAnnotation> => {
    const rawType = (dto as any)?.type;
    const resolvedType =
      rawType === 'box' || rawType === 'area'
        ? 'rect'
        : rawType;
    const payload = { ...dto, ...(resolvedType ? { type: resolvedType } : {}) };

    const raw = await apiPost<AnnotationSingleResponse>(
      `${LIBRARY_EXTRACTION_BASE}/attachments/${encodeURIComponent(attachmentId)}/annotations`,
      payload,
    );
    if (raw && typeof raw === 'object') {
      if ('data' in raw && raw.data) return raw.data;
      if ('annotation' in raw && raw.annotation) return raw.annotation;
      return raw as ReaderAnnotation;
    }
    return raw as ReaderAnnotation;
  },

  /**
   * Update an annotation comment, color, or text (with optimistic locking)
   */
  update: async (
    _scopeId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion: number | undefined,
    dto: UpdateAnnotationDTO,
  ): Promise<ReaderAnnotation> => {
    const raw = await apiPatch<AnnotationSingleResponse>(
      `${LIBRARY_EXTRACTION_BASE}/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      {
        ...dto,
        expectedVersion: expectedVersion ?? 1,
      },
      {
        headers: expectedVersion ? { 'If-Match': String(expectedVersion) } : undefined,
      },
    );
    if (raw && typeof raw === 'object') {
      if ('data' in raw && raw.data) return raw.data;
      if ('annotation' in raw && raw.annotation) return raw.annotation;
      return raw as ReaderAnnotation;
    }
    return raw as ReaderAnnotation;
  },

  /**
   * Delete a PDF annotation (soft delete)
   */
  delete: async (
    _scopeId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const versionQuery =
      expectedVersion !== undefined
        ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
        : '';
    const raw = await apiDelete<DeleteAnnotationResponse>(
      `${LIBRARY_EXTRACTION_BASE}/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}${versionQuery}`,
    );
    if (raw && typeof raw === 'object') {
      if (typeof raw.deleted === 'boolean') {
        return { deleted: raw.deleted };
      }
      if (raw.data && typeof raw.data.deleted === 'boolean') {
        return { deleted: raw.data.deleted };
      }
    }
    return { deleted: true };
  },

  /**
   * Batch upsert & delete annotations in a single transaction
   */
  batch: async (
    _scopeId: string | undefined,
    attachmentId: string,
    dto: BatchAnnotationsDTO,
  ): Promise<BatchAnnotationsResponse> => {
    const normalizedUpserts = (dto.upserts || []).map((u) => {
      const rawType = (u as any)?.type;
      const resolvedType =
        rawType === 'box' || rawType === 'area'
          ? 'rect'
          : rawType;
      return {
        ...u,
        ...(resolvedType ? { type: resolvedType } : {}),
      };
    });
    const payload = {
      ...dto,
      upserts: normalizedUpserts,
    };
    const raw = await apiPut<BatchAnnotationsResponse>(
      `${LIBRARY_EXTRACTION_BASE}/attachments/${encodeURIComponent(attachmentId)}/annotations/batch`,
      payload,
    );
    return raw;
  },

  /**
   * Synthesize & extract literature notes from highlighted passages in document
   */
  extractNotes: async (
    _scopeId: string | undefined,
    itemId: string,
  ): Promise<{ success: boolean; totalExtracted: number }> => {
    const raw = await apiPost<ExtractNotesResponse>(
      `${LIBRARY_CATALOG_BASE}/notes/items/${encodeURIComponent(itemId)}/from-annotations`,
      {},
    );
    if (raw && typeof raw === 'object') {
      if (raw.data) {
        return {
          success: Boolean(raw.data.success),
          totalExtracted: Number(raw.data.totalExtracted ?? 0),
        };
      }
      return {
        success: Boolean(raw.success),
        totalExtracted: Number(raw.totalExtracted ?? 0),
      };
    }
    return { success: true, totalExtracted: 0 };
  },

  /**
   * Import embedded annotations from underlying PDF (/Annots dictionary)
   */
  importExternal: async (
    _scopeId: string | undefined,
    attachmentId: string,
  ): Promise<{ imported: number; totalFound: number }> => {
    const raw = await apiPost<{ imported?: number; totalFound?: number; data?: { imported?: number; totalFound?: number } }>(
      `${LIBRARY_EXTRACTION_BASE}/attachments/${encodeURIComponent(attachmentId)}/annotations/import-external`,
      {},
    );
    if (raw && typeof raw === 'object') {
      if (raw.data) {
        return {
          imported: Number(raw.data.imported ?? 0),
          totalFound: Number(raw.data.totalFound ?? 0),
        };
      }
      return {
        imported: Number(raw.imported ?? 0),
        totalFound: Number(raw.totalFound ?? 0),
      };
    }
    return { imported: 0, totalFound: 0 };
  },
};

export const AnnotationService = AnnotationsService;
