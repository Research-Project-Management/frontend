import { apiGet, apiPost } from "@/shared/lib/api";
import type { ExportBundleResponse } from '../../types';
import { isProjectScope } from './items.service';

export const ExportService = {
  /**
   * Export library with format and filters (POST /exports)
   */
  exportLibrary: (
    scopeId?: string,
    options?: {
      format?: string;
      collectionId?: string;
      tagId?: string;
      itemIds?: string[];
      projectId?: string;
    },
  ) => {
    const projectId =
      options?.projectId ||
      (isProjectScope(scopeId) ? scopeId : undefined);
    return apiPost<{ content: string; filename: string; itemCount: number }>(
      `/api/v1/library/exports`,
      {
        ...options,
        ...(projectId ? { projectId } : {}),
      },
    );
  },

  /**
   * Export citations by specific citation keys in BibTeX format (POST /exports/citations/bibtex)
   */
  exportByCitationKeys: (scopeId?: string, keys: string[] = []) =>
    apiPost<{ bibtex: string; count: number }>(
      `/api/v1/library/exports/citations/bibtex`,
      {
        keys,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    ),

  /**
   * Export collection items to BibTeX format
   */
  exportBibtex: (scopeId?: string, collectionId?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return apiGet<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId || '')}${projectQuery}`,
    );
  },

  /**
   * Export full bundle containing BibTeX and associated file metadata
   */
  exportBundle: (_scopeId?: string, collectionId?: string) =>
    apiGet<ExportBundleResponse>(
      `/api/v1/library/exports/${encodeURIComponent(collectionId || '')}/export-bundle`,
    ),

  /**
   * Export item PDF with baked annotations (highlights, sticky notes, rectangles)
   */
  exportAnnotatedPdf: (scopeId?: string, itemId?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return apiGet<{ filename: string; mimeType: string; base64: string }>(
      `/api/v1/library/exports/items/${encodeURIComponent(itemId || '')}/annotated-pdf${projectQuery}`,
    );
  },

  /**
   * Download item PDF with baked annotations directly in browser
   */
  downloadAnnotatedPdf: async (scopeId?: string, itemId?: string, fallbackFilename?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    const res = await apiGet<{ filename: string; mimeType: string; base64: string }>(
      `/api/v1/library/exports/items/${encodeURIComponent(itemId || '')}/annotated-pdf${projectQuery}`,
    );
    if (!res || !res.base64) {
      throw new Error('Failed to generate annotated PDF: No content received');
    }
    const byteCharacters = atob(res.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: res.mimeType || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename || fallbackFilename || 'annotated-document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return res;
  },
};

// Aliases
export const ExportsService = ExportService;
export const exportBibtex = ExportService.exportBibtex;
export const exportBundle = ExportService.exportBundle;
export const exportAnnotatedPdf = ExportService.exportAnnotatedPdf;
export const downloadAnnotatedPdf = ExportService.downloadAnnotatedPdf;
export const exportLibrary = ExportService.exportLibrary;
export const exportByCitationKeys = ExportService.exportByCitationKeys;
