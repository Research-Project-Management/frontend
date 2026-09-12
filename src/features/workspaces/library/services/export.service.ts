import { apiGet, apiPost } from "@/shared/lib/api";

export interface ExportBundleResponse {
  collection: { id: string; name: string };
  totalPapers: number;
  totalFiles: number;
  bibtex: string;
  files: Array<{ paperId: string; title: string; filename: string; fileUrl: string }>;
}

export const ExportService = {
  /**
   * Export library with format and filters (POST /exports)
   */
  exportLibrary: (
    workspaceId: string,
    options?: { format?: string; collectionId?: string; tagId?: string },
  ) =>
    apiPost<{ content: string; filename: string; itemCount: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports`,
      options || {},
    ),

  /**
   * Export citations by specific citation keys in BibTeX format (POST /exports/citations/bibtex)
   */
  exportByCitationKeys: (workspaceId: string, keys: string[]) =>
    apiPost<{ bibtex: string; count: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports/citations/bibtex`,
      { keys },
    ),

  /**
   * Export collection items to BibTeX format
   */
  exportBibtex: (workspaceId: string, collectionId: string) =>
    apiGet<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId)}`,
    ),

  /**
   * Export full bundle containing BibTeX and associated file metadata
   */
  exportBundle: (workspaceId: string, collectionId: string) =>
    apiGet<ExportBundleResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports/${encodeURIComponent(collectionId)}/export-bundle`,
    ),

  /**
   * Export item PDF with baked annotations (highlights, sticky notes, rectangles)
   */
  exportAnnotatedPdf: (workspaceId: string, itemId: string) =>
    apiGet<{ filename: string; mimeType: string; base64: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports/items/${encodeURIComponent(itemId)}/annotated-pdf`,
    ),

  /**
   * Download item PDF with baked annotations directly in browser
   */
  downloadAnnotatedPdf: async (workspaceId: string, itemId: string, fallbackFilename?: string) => {
    const res = await apiGet<{ filename: string; mimeType: string; base64: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports/items/${encodeURIComponent(itemId)}/annotated-pdf`,
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


