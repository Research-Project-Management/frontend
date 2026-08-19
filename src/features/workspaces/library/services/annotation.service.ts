import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type { PdfAnnotation } from '../types/library.types';

export const AnnotationService = {
  /**
   * Get all PDF annotations (highlights, underlines, notes, boxes) for a paper
   */
  getByPaper: (workspaceId: string, paperId: string) =>
    apiGet<{ annotations: PdfAnnotation[]; total: number }>(
      `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
    ),

  /**
   * Create a new PDF highlight, underline, sticky note, or rectangular box
   */
  create: (workspaceId: string, paperId: string, dto: Partial<PdfAnnotation>) =>
    apiPost<PdfAnnotation>(
      `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
      dto,
    ),

  /**
   * Update an annotation comment, color, or text
   */
  update: (
    workspaceId: string,
    paperId: string,
    annotationId: string,
    dto: Partial<PdfAnnotation>,
  ) =>
    apiPut<PdfAnnotation>(
      `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/${encodeURIComponent(annotationId)}`,
      dto,
    ),

  /**
   * Delete a PDF annotation
   */
  delete: (workspaceId: string, paperId: string, annotationId: string) =>
    apiDelete<{ message: string }>(
      `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/${encodeURIComponent(annotationId)}`,
    ),

  /**
   * Zotero 7 Parity: Synthesize all highlights into a Markdown Literature Note
   */
  extractNotes: (workspaceId: string, paperId: string) =>
    apiPost<{ message: string; markdownNote: string; totalExtracted: number }>(
      `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/extract-notes`,
    ),
};

// Aliases
export const getAnnotations = AnnotationService.getByPaper;
export const createAnnotation = AnnotationService.create;
export const updateAnnotation = AnnotationService.update;
export const deleteAnnotation = AnnotationService.delete;
export const extractNotesFromAnnotations = AnnotationService.extractNotes;
