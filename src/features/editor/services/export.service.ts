/**
 * export.service.ts
 *
 * Frontend service for document compilation and manuscript export:
 * PDF, Word (.docx), Markdown (.md), LaTeX source, ZIP, and arXiv packages.
 *
 * Delegates to unified manuscriptService.export (`/api/v1/manuscripts/docs/:docId/export`).
 */

import { manuscriptService } from './manuscript.service';
export type { ExportFileResult } from './manuscript.service';

export const exportService = {
  exportDocument: manuscriptService.export.exportDocument,
};
