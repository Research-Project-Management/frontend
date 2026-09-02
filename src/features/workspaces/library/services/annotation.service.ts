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
    const raw = await apiGet<{ success: boolean; data: PdfAnnotation[] }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations${query}`,
    );

    const parsed = annotationListResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw?.data || [];
  },

  /**
   * Create a new PDF highlight, underline, or sticky note attached to an attachment
   */
  create: async (
    workspaceId: string,
    attachmentId: string,
    dto: CreateAnnotationDTO,
  ): Promise<PdfAnnotation> => {
    const raw = await apiPost<{ success: boolean; data: PdfAnnotation }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations`,
      dto,
    );

    const parsed = annotationResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw.data;
  },

  /**
   * Update an annotation comment, color, or text with optimistic concurrency
   */
  update: async (
    workspaceId: string,
    attachmentId: string,
    annotationId: string,
    expectedVersion: number,
    dto: UpdateAnnotationDTO,
  ): Promise<PdfAnnotation> => {
    const raw = await apiPatch<{ success: boolean; data: PdfAnnotation }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      {
        ...dto,
        expectedVersion,
      },
      {
        headers: {
          'If-Match': String(expectedVersion),
        },
      },
    );

    const parsed = annotationResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw.data;
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
    const raw = await apiDelete<{ success: boolean; data: { deleted: boolean } }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      {
        headers: expectedVersion
          ? { 'If-Match': String(expectedVersion) }
          : undefined,
      },
    );

    return raw?.data ?? { deleted: true };
  },

  /**
   * Extract / synthesize literature notes from annotations
   */
  extractNotesFromAnnotations: async (
    workspaceId: string,
    paperId: string,
  ): Promise<{ success: boolean; totalExtracted?: number; literatureNote?: any }> => {
    const raw = await apiPost<{ success: boolean; data: any }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/papers/${encodeURIComponent(paperId)}/extract-notes`,
    );
    return raw?.data || { success: true };
  },
};

// Aliases for compatibility
export const getAnnotations = AnnotationService.getByAttachment;
export const createAnnotation = AnnotationService.create;
export const updateAnnotation = AnnotationService.update;
export const deleteAnnotation = AnnotationService.delete;
export const extractNotesFromAnnotations = AnnotationService.extractNotesFromAnnotations;
