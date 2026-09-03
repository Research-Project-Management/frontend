import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';


// ── ExportService ─────────────────────────────────────────────────────────────
/**
 * Library export service.
 * Backed by GET|POST /exports, GET /exports/:collectionId/export-bundle, GET /exports/items/:itemId/annotated-pdf
 */

export type ExportFormat = 'bibtex' | 'ris' | 'json' | 'csv' | 'zotero';

export interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
  itemCount: number;
  /** Alias fields for backward compat */
  bibtex?: string;
  total?: number;
}

export const ExportService = {
  /**
   * Export library (or subset) in a given format.
   * Backed by GET /exports?format=bibtex&collectionId=...&tagId=...
   */
  export: (
    workspaceId: string,
    options: {
      format?: ExportFormat;
      collectionId?: string;
      tagId?: string;
    } = {},
  ) =>
    apiGet<ExportResult>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports`,
      {
        params: {
          format: options.format || 'bibtex',
          ...(options.collectionId ? { collectionId: options.collectionId } : {}),
          ...(options.tagId ? { tagId: options.tagId } : {}),
        },
      },
    ),

  /**
   * Get a full export bundle (BibTeX + file manifest) for a collection.
   * Backed by GET /exports/:collectionId/export-bundle
   */
  collectionBundle: (workspaceId: string, collectionId: string) =>
    apiGet<{
      collection: { id: string; name: string };
      totalPapers: number;
      totalFiles: number;
      bibtex: string;
      files: Array<{
        paperId: string;
        title: string;
        filename: string;
        fileUrl: string;
      }>;
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports/${encodeURIComponent(collectionId)}/export-bundle`,
    ),

  /**
   * Trigger a library export via POST (with body payload).
   * Backed by POST /exports
   * For GET-based export (with query params), use ExportService.export().
   */
  postExport: (
    workspaceId: string,
    dto: {
      format?: ExportFormat;
      collectionId?: string;
      tagId?: string;
    },
  ) =>
    apiPost<ExportResult>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports`,
      dto,
    ),

  /**
   * Export an annotated PDF for a specific item.
   * Backed by GET /exports/items/:itemId/annotated-pdf
   * Returns base64 encoded PDF.
   */
  annotatedPdf: (workspaceId: string, itemId: string) =>
    apiGet<{
      filename: string;
      mimeType: string;
      base64: string;
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports/items/${encodeURIComponent(itemId)}/annotated-pdf`,
    ),
};
