/**
 * export.types.ts
 *
 * Types for document compilation export bundles and output formats.
 * Matches backend document/export module.
 */

export type DocumentExportFormat =
  | 'pdf'
  | 'docx'
  | 'markdown'
  | 'md'
  | 'latex-source'
  | 'latex-bundle'
  | 'zip'
  | 'arxiv-zip'
  | 'log'
  | 'bbl';

export interface ExportDocumentInput {
  format: DocumentExportFormat;
  includeChildren?: boolean;
}
