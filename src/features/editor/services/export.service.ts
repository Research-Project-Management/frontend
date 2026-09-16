/**
 * export.service.ts
 *
 * Frontend service mirroring Backend `modules/document/export/`:
 *  - Export PDF, Markdown, LaTeX source, or full ZIP bundle (`/api/pages/:pageId/export`)
 *  - Browser file download trigger
 */

import { apiPost } from '@/shared/lib/api';

export type ExportFormat = 'pdf' | 'markdown' | 'latex_source' | 'latex_bundle';

export interface ExportFileResult {
  filename: string;
  mimeType: string;
  content: string;
  isBase64: boolean;
  sizeBytes: number;
}

export const exportService = {
  exportDocument: async (
    pageId: string,
    format: ExportFormat,
    includeAssets = true,
  ): Promise<ExportFileResult> => {
    return await apiPost<ExportFileResult>(`/api/pages/${pageId}/export`, {
      format,
      includeAssets,
    });
  },

  downloadExportResult: (result: ExportFileResult): void => {
    if (typeof window === 'undefined') return;

    let blob: Blob;
    if (result.isBase64) {
      const binaryStr = atob(result.content);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: result.mimeType });
    } else {
      blob = new Blob([result.content], { type: result.mimeType });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

export const DocumentExportService = exportService;
