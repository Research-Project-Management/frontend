/**
 * export.types.ts
 *
 * Types for document compilation export bundles and output formats.
 * Matches backend document/export module.
 */

export type DocumentExportFormat =
  | 'pdf'
  | 'markdown'
  | 'latex-source'
  | 'latex-bundle';

export interface ExportDocumentInput {
  format: DocumentExportFormat;
  includeChildren?: boolean;
}
