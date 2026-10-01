/**
 * export-document.util.ts
 *
 * Client-side triggers for exporting LaTeX manuscripts to Word (.docx)
 * and GitHub Flavored Markdown (.md) via the Flux document export API.
 * Pure utility functions with zero UI toast side-effects.
 */

import { exportService } from '../services/export.service';

export interface ExportSingleDocOptions {
  pageId: string;
  projectTitle?: string;
  includeChildren?: boolean;
  fallbackContent?: string;
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
  const res = await exportService.exportDocument(pageId, 'docx', includeChildren);

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
 * Exports document manuscript to Markdown (.md) and triggers download.
 * Returns the downloaded filename on success, throws on error.
 */
export async function exportDocumentAsMarkdown({
  pageId,
  projectTitle,
  includeChildren = true,
  fallbackContent,
}: ExportSingleDocOptions): Promise<string> {
  try {
    const res = await exportService.exportDocument(pageId, 'md', includeChildren);

    const blob = new Blob([res.content], {
      type: 'text/markdown;charset=utf-8',
    });

    const fallbackName = (projectTitle || 'document')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const finalFilename = res.filename || `${fallbackName}.md`;

    triggerFileDownload(blob, finalFilename);
    return finalFilename;
  } catch (error) {
    if (fallbackContent) {
      const fallbackName = (projectTitle || 'document')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      const finalFilename = `${fallbackName}.md`;
      const blob = new Blob([fallbackContent], { type: 'text/markdown;charset=utf-8' });
      triggerFileDownload(blob, finalFilename);
      return finalFilename;
    }
    throw error;
  }
}

/**
 * Exports document manuscript to HTML (.html) with Katex and styling, triggers download.
 * Returns the downloaded filename on success.
 */
export function exportDocumentAsHtml({
  content,
  projectTitle,
}: {
  content: string;
  projectTitle?: string;
}): string {
  const title = projectTitle || 'document';
  const fallbackName = title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const finalFilename = `${fallbackName}.html`;

  const htmlBody = content
    .replace(/\\section\*?\{([^}]+)\}/g, '<h1>$1</h1>')
    .replace(/\\subsection\*?\{([^}]+)\}/g, '<h2>$1</h2>')
    .replace(/\\subsubsection\*?\{([^}]+)\}/g, '<h3>$1</h3>')
    .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
    .replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>')
    .replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>')
    .replace(/\n\n+/g, '</p><p>');

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 820px;
      margin: 40px auto;
      padding: 0 24px;
      color: #1a202c;
    }
    h1, h2, h3, h4, h5, h6 { color: #111827; margin-top: 1.5em; margin-bottom: 0.5em; }
    p { margin-bottom: 1em; }
    table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background-color: #f8fafc; font-weight: 600; }
    pre { background: #f1f5f9; padding: 14px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${htmlBody}</p>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  triggerFileDownload(blob, finalFilename);
  return finalFilename;
}
