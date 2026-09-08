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
    const query = pageIndex !== undefined ? `?pageIndex=${encodeURIComponent(pageIndex)}` : '';
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations${query}`,
    );
    if (Array.isArray(raw)) return raw;
    return raw?.data || raw?.annotations || [];
  },

  /**
   * Create a new PDF annotation attached to an attachment
   */
  create: async (
    workspaceId: string,
    attachmentId: string,
    dto: CreateAnnotationDTO,
  ): Promise<ReaderAnnotation> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations`,
      dto,
    );
    return raw?.data || raw?.annotation || raw;
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
    const raw = await apiPatch<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      {
        ...dto,
        expectedVersion,
      },
    );
    return raw?.data || raw?.annotation || raw;
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
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    const raw = await apiDelete<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}${versionQuery}`,
    );
    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },

  /**
   * Synthesize & extract literature notes from highlighted passages in document
   */
  extractNotes: async (
    workspaceId: string,
    itemId: string,
  ): Promise<{ success: boolean; totalExtracted: number }> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/extract-notes`,
      {},
    );
    return raw?.data || raw || { success: true, totalExtracted: 0 };
  },
};
