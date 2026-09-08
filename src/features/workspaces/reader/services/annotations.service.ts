import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type {
  ReaderAnnotation,
  AnnotationType,
} from '../types/reader.types';

export interface CreateAnnotationDTO {
  type?: AnnotationType;
  pageIndex: number;
  color?: string;
  quoteText?: string;
  comment?: string;
  rectCoords?: unknown;
}

export interface UpdateAnnotationDTO {
  color?: string;
  quoteText?: string;
  comment?: string;
  rectCoords?: unknown;
  expectedVersion?: number;
}

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

/**
 * AnnotationsService corresponding to backend AnnotationsService (backend/src/modules/library/annotations/annotations.service.ts)
 */
export const AnnotationsService = {
  /**
   * Get all PDF annotations for an attachment
   */
  getByAttachment: async (
    workspaceId: string,
    attachmentId: string,
    pageIndex?: number,
  ): Promise<ReaderAnnotation[]> => {
    const query =
      pageIndex !== undefined ? `?pageIndex=${encodeURIComponent(pageIndex)}` : '';
    const raw = await apiGet<AnnotationsListResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations${query}`,
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
    workspaceId: string,
    attachmentId: string,
    dto: CreateAnnotationDTO,
  ): Promise<ReaderAnnotation> => {
    const raw = await apiPost<AnnotationSingleResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations`,
      dto,
    );
    if (raw && typeof raw === 'object') {
      if ('data' in raw && raw.data) return raw.data;
      if ('annotation' in raw && raw.annotation) return raw.annotation;
      return raw as ReaderAnnotation;
    }
    return raw as ReaderAnnotation;
  },

  /**
   * Update an annotation comment, color, or text
   */
  update: async (
    workspaceId: string,
    attachmentId: string,
    annotationId: string,
    expectedVersion: number | undefined,
    dto: UpdateAnnotationDTO,
  ): Promise<ReaderAnnotation> => {
    const raw = await apiPatch<AnnotationSingleResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      {
        ...dto,
        expectedVersion,
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
   * Delete a PDF annotation
   */
  delete: async (
    workspaceId: string,
    attachmentId: string,
    annotationId: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const versionQuery =
      expectedVersion !== undefined
        ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
        : '';
    const raw = await apiDelete<DeleteAnnotationResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}${versionQuery}`,
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
   * Synthesize & extract literature notes from highlighted passages in document
   */
  extractNotes: async (
    workspaceId: string,
    itemId: string,
  ): Promise<{ success: boolean; totalExtracted: number }> => {
    const raw = await apiPost<ExtractNotesResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/extract-notes`,
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
};

