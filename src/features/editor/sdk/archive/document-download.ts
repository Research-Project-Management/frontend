/**
 * document-download.ts
 *
 * Client SDK triggers for authoritative backend single-document exports and browser file downloads:
 * - Word (.docx) export via backend `manuscriptService.export.exportDocument(..., 'docx')`
 * - Markdown (.md) export via backend `manuscriptService.export.exportDocument(..., 'md')`
 * - Standalone styled HTML (.html) export via backend `manuscriptService.export.exportDocument(..., 'html')`
 * - Generic file download triggers
 */

import { manuscriptService } from '@/features/editor/sdk/manuscript.service';

export interface ExportSingleDocOptions {
  pageId: string;
  projectTitle?: string;
  includeChildren?: boolean;
  fallbackContent?: string;
  content?: string;
}

/**
 * Initiates browser download of Blob data with filename.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports document manuscript to Microsoft Word (.docx) and triggers download.
 * Returns the downloaded filename on success, throws on error.
 */
export async function exportDocumentAsWord({
  pageId,
  projectTitle,
  includeChildren = true,
}: ExportSingleDocOptions): Promise<string> {
  const res = await manuscriptService.export.exportDocument(pageId, 'docx', includeChildren);

  const binaryStr = window.atob(res.content);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const fallbackName = (projectTitle || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const finalFilename = res.filename || `${fallbackName}.docx`;

  triggerFileDownload(blob, finalFilename);
  return finalFilename;
}

/**
 * Exports document manuscript to Markdown (.md) via backend transpiler and triggers download.
 * Returns the downloaded filename on success, throws on error.
 */
export async function exportDocumentAsMarkdown({
  pageId,
  projectTitle,
  includeChildren = true,
}: ExportSingleDocOptions): Promise<string> {
  const res = await manuscriptService.export.exportDocument(pageId, 'md', includeChildren);

  const blob = new Blob([res.content], {
    type: 'text/markdown;charset=utf-8',
  });

  const fallbackName = (projectTitle || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const finalFilename = res.filename || `${fallbackName}.md`;

  triggerFileDownload(blob, finalFilename);
  return finalFilename;
}

/**
 * Exports document manuscript to HTML (.html) via backend transpiler and triggers download.
 * Returns the downloaded filename on success, throws on error.
 */
export async function exportDocumentAsHtml(
  pageIdOrOptions:
    | string
    | {
        pageId?: string;
        projectTitle?: string;
        includeChildren?: boolean;
        content?: string;
      },
  title?: string,
): Promise<string> {
  const pageId =
    typeof pageIdOrOptions === 'string'
      ? pageIdOrOptions
      : pageIdOrOptions.pageId || '';
  const projectTitle =
    typeof pageIdOrOptions === 'string'
      ? title
      : pageIdOrOptions.projectTitle || title;
  const includeChildren =
    typeof pageIdOrOptions === 'string'
      ? true
      : (pageIdOrOptions.includeChildren ?? true);

  const res = await manuscriptService.export.exportDocument(
    pageId,
    'html',
    includeChildren,
  );

  const blob = new Blob([res.content], {
    type: 'text/html;charset=utf-8',
  });

  const fallbackName = (projectTitle || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const finalFilename = res.filename || `${fallbackName}.html`;

  triggerFileDownload(blob, finalFilename);
  return finalFilename;
}
