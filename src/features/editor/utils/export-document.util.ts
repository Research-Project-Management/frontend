/**
 * export-document.util.ts
 *
 * Client-side triggers for exporting LaTeX manuscripts to Word (.docx)
 * and GitHub Flavored Markdown (.md) via the Flux document export API.
 */

import { toast } from 'sonner';
import { exportService } from '../services/export.service';

export interface ExportSingleDocOptions {
  pageId: string;
  projectTitle?: string;
  includeChildren?: boolean;
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
 */
export async function exportDocumentAsWord({
  pageId,
  projectTitle,
  includeChildren = true,
}: ExportSingleDocOptions): Promise<void> {
  const toastId = toast.loading('Exporting document to Microsoft Word (.docx)...');

  try {
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
    toast.success(`Exported ${finalFilename} successfully!`, { id: toastId });
  } catch (error) {
    console.error('[export-document] Error exporting to Word:', error);
    toast.error('Failed to export document to Microsoft Word (.docx).', {
      id: toastId,
    });
  }
}

/**
 * Exports document manuscript to Markdown (.md) and triggers download.
 */
export async function exportDocumentAsMarkdown({
  pageId,
  projectTitle,
  includeChildren = true,
}: ExportSingleDocOptions): Promise<void> {
  const toastId = toast.loading('Exporting document to Markdown (.md)...');

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
    toast.success(`Exported ${finalFilename} successfully!`, { id: toastId });
  } catch (error) {
    console.error('[export-document] Error exporting to Markdown:', error);
    toast.error('Failed to export document to Markdown (.md).', {
      id: toastId,
    });
  }
}
