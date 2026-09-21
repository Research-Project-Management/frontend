/**
 * export.service.ts
 *
 * Frontend service for document compilation and manuscript export:
 * PDF, Word (.docx), Markdown (.md), LaTeX source, ZIP, and arXiv packages.
 * Mirrors Backend `modules/document/export`.
 */

import { apiPost } from '@/shared/lib/api';
import type { DocumentExportFormat } from '../types/export.types';

export interface ExportFileResult {
  filename: string;
  mimeType: string;
  content: string; // base64 or raw string
  isBase64: boolean;
  sizeBytes: number;
}

export const exportService = {
  exportDocument: async (
    pageId: string,
    format: DocumentExportFormat,
    includeChildren = true,
  ): Promise<ExportFileResult> => {
    return apiPost<ExportFileResult>(`/api/pages/${pageId}/export`, {
      format,
      includeChildren,
    });
  },
};
