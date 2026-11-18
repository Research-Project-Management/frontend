/**
 * document-download.ts
 *
 * Client SDK triggers for authoritative backend single-document exports and browser file downloads:
 * - Word (.docx) export via backend `manuscriptService.export.exportDocument(..., 'docx')`
 * - Markdown (.md) export via backend `manuscriptService.export.exportDocument(..., 'md')`
 * - Standalone styled HTML (.html) export via backend `manuscriptService.export.exportDocument(..., 'html')`
 * - Generic file download triggers
 */

import { manuscriptService } from '@/features/editor/sdk/pages.service';

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
  fallbackContent,
  content,
}: ExportSingleDocOptions): Promise<string> {
  const fallbackName = (projectTitle || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  try {
    const res = await manuscriptService.export.exportDocument(pageId, 'md', includeChildren);
    const blob = new Blob([res.content], {
      type: 'text/markdown;charset=utf-8',
    });
    const finalFilename = res.filename || `${fallbackName}.md`;
    triggerFileDownload(blob, finalFilename);
    return finalFilename;
  } catch (err) {
    const offlineText = fallbackContent ?? content;
    if (offlineText !== undefined) {
      const blob = new Blob([offlineText], {
        type: 'text/markdown;charset=utf-8',
      });
      const finalFilename = `${fallbackName}.md`;
      triggerFileDownload(blob, finalFilename);
      return finalFilename;
    }
    throw err;
  }
}

function transpileLatexToStandaloneHtml(latexContent: string, title = 'Document'): string {
  const body = (latexContent || '')
    .replace(/\\section\*?\{([^}]+)\}/g, '<h1>$1</h1>')
    .replace(/\\subsection\*?\{([^}]+)\}/g, '<h2>$1</h2>')
    .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8" />',
    `<title>${title}</title>`,
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />',
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('\n');
}

/**
 * Exports document manuscript to HTML (.html) via backend transpiler and triggers download.
 * Supports synchronous direct content conversion when `pageId` is omitted.
 */
export function exportDocumentAsHtml(
  pageIdOrOptions:
    | string
    | {
        pageId?: string;
        projectTitle?: string;
        includeChildren?: boolean;
        content?: string;
        fallbackContent?: string;
      },
  title?: string,
): string | Promise<string> {
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
  const directContent =
    typeof pageIdOrOptions === 'string'
      ? undefined
      : (pageIdOrOptions.content ?? pageIdOrOptions.fallbackContent);

  const fallbackName = (projectTitle || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  if (!pageId && directContent !== undefined) {
    const html = transpileLatexToStandaloneHtml(directContent, projectTitle || 'Document');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const finalFilename = `${fallbackName}.html`;
    triggerFileDownload(blob, finalFilename);
    return finalFilename;
  }

  return (async () => {
    try {
      const res = await manuscriptService.export.exportDocument(
        pageId,
        'html',
        includeChildren,
      );
      const blob = new Blob([res.content], {
        type: 'text/html;charset=utf-8',
      });
      const finalFilename = res.filename || `${fallbackName}.html`;
      triggerFileDownload(blob, finalFilename);
      return finalFilename;
    } catch (err) {
      if (directContent !== undefined) {
        const html = transpileLatexToStandaloneHtml(directContent, projectTitle || 'Document');
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const finalFilename = `${fallbackName}.html`;
        triggerFileDownload(blob, finalFilename);
        return finalFilename;
      }
      throw err;
    }
  })();
}
