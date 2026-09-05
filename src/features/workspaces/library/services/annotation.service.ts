import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type { PdfAnnotation } from '../types/library.types';
import {
  annotationResponseSchema,
  annotationListResponseSchema,
} from '../schemas/library-api.schema';

export interface CreateAnnotationDTO {
  type?: 'highlight' | 'note' | 'underline' | 'box';
  pageIndex: number;
  color?: string;
  quoteText?: string;
  comment?: string;
  rectCoords?: any;
}

export interface UpdateAnnotationDTO {
  color?: string;
  quoteText?: string;
  comment?: string;
  rectCoords?: any;
  expectedVersion?: number;
}

export const AnnotationService = {
  /**
   * Get all PDF annotations (highlights, underlines, notes, boxes) for an attachment
   */
  getByAttachment: async (
    workspaceId: string,
    attachmentId: string,
    pageIndex?: number,
  ): Promise<PdfAnnotation[]> => {
    const query =
      pageIndex !== undefined ? `?pageIndex=${encodeURIComponent(pageIndex)}` : '';
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations${query}`,
    );

    const parsed = annotationListResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    if (Array.isArray(raw)) {
      return raw;
    }
    return raw?.data || raw?.annotations || [];
  },

  /**
   * Create a new PDF highlight, underline, or sticky note attached to an attachment
   */
  create: async (
    workspaceId: string,
    attachmentId: string,
    dto: CreateAnnotationDTO,
  ): Promise<PdfAnnotation> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations`,
      dto,
    );

    const parsed = annotationResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw?.data || raw?.annotation || raw;
  },

  /**
   * Update an annotation comment, color, or text with optimistic concurrency
   */
  update: async (
    workspaceId: string,
    attachmentId: string,
    annotationId: string,
    expectedVersion: number | undefined,
    dto: UpdateAnnotationDTO,
  ): Promise<PdfAnnotation> => {
    const raw = await apiPatch<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      {
        ...dto,
        expectedVersion,
      },
    );

    const parsed = annotationResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
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
   * Synthesize & extract literature notes from all highlighted passages in document
   */
  extractNotes: async (
    workspaceId: string,
    itemId: string,
  ): Promise<{
    success: boolean;
    totalExtracted: number;
    literatureNote?: any;
    message?: string;
  }> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/extract-notes`,
    );
    return raw?.data || raw;
  },

  /**
   * Alias for extractNotes
   */
  extractNotesFromAnnotations: (workspaceId: string, itemId: string) =>
    AnnotationService.extractNotes(workspaceId, itemId),
};

// Aliases
export const getAnnotations = AnnotationService.getByAttachment;
export const createAnnotation = AnnotationService.create;
export const updateAnnotation = AnnotationService.update;
export const deleteAnnotation = AnnotationService.delete;
export const extractNotesFromAnnotations = AnnotationService.extractNotes;
