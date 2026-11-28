'use client';

/**
 * useExport.ts
 *
 * Centralizes validation guards, concurrency lock, progress toast, and error feedback
 * across all document and archive export actions.
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  exportZip as runExportZip,
  exportArxivZip,
  type ExportZipOptions,
} from '@/features/editor/sdk/archive/zip-export';
import {
  exportDocx,
  exportMarkdown as runExportMarkdown,
  exportHtml as runExportHtml,
  type ExportDocOptions,
} from '@/features/editor/sdk/archive/doc-export';
import { sanitizeSlug, triggerFileDownload } from '@/features/editor/sdk/archive/download';
import { getExportFilename } from '@/features/editor/domain/document/document-naming';

export type { ExportZipOptions, ExportDocOptions };

interface ExportCommand {
  id: string;
  guardError?: string | null;
  loadingMessage: string;
  fallbackErrorMessage: string;
  execute: () => Promise<string>;
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const activeLockRef = useRef(false);

  const runExportCommand = useCallback(async (cmd: ExportCommand): Promise<string | null> => {
    if (cmd.guardError) {
      toast.error(cmd.guardError, { id: cmd.id });
      return null;
    }
    if (activeLockRef.current) return null;

    activeLockRef.current = true;
    setIsExporting(true);
    const toastId = toast.loading(cmd.loadingMessage);
    try {
      const filename = await cmd.execute();
      toast.success(`Exported ${filename}`, { id: toastId });
      return filename;
    } catch (err: unknown) {
      toast.error(
        err instanceof Error && err.message ? err.message : cmd.fallbackErrorMessage,
        { id: toastId },
      );
      return null;
    } finally {
      activeLockRef.current = false;
      setIsExporting(false);
    }
  }, []);

  const downloadPdf = useCallback(async (pdfUrl: string | null | undefined, title?: string) => {
    if (!pdfUrl) {
      toast.error('Please compile the document to PDF first.', { id: 'download-pdf' });
      return;
    }
    const filename = getExportFilename(title || 'document', 'pdf');
    try {
      if (pdfUrl.startsWith('blob:') || pdfUrl.startsWith('data:')) {
        const anchor = document.createElement('a');
        anchor.href = pdfUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } else {
        const resp = await fetch(pdfUrl, { credentials: 'include' });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        triggerFileDownload(blob, filename);
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error && err.message
          ? `Failed to download PDF (${err.message}).`
          : 'Failed to download PDF.',
        { id: 'download-pdf' },
      );
    }
  }, []);

  const downloadCopy = useCallback((content?: string, title?: string) => {
    const filename = `${sanitizeSlug(title)}_copy.tex`;
    const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
    triggerFileDownload(blob, filename);
  }, []);

  const exportZip = useCallback(
    (options: ExportZipOptions) =>
      runExportCommand({
        id: 'export-zip',
        loadingMessage: 'Exporting ZIP...',
        fallbackErrorMessage: 'Failed to create ZIP archive.',
        execute: () => runExportZip(options),
      }),
    [runExportCommand],
  );

  const exportArxiv = useCallback(
    (options: ExportZipOptions) =>
      runExportCommand({
        id: 'export-arxiv',
        loadingMessage: 'Exporting arXiv bundle...',
        fallbackErrorMessage: 'Failed to create arXiv submission ZIP.',
        execute: () => exportArxivZip(options),
      }),
    [runExportCommand],
  );

  const exportWord = useCallback(
    (options: ExportDocOptions) =>
      runExportCommand({
        id: 'export-word',
        guardError: options.docId ? null : 'Unable to find document ID',
        loadingMessage: 'Exporting Word (.docx)...',
        fallbackErrorMessage: 'Failed to export document to Microsoft Word (.docx).',
        execute: () => exportDocx(options),
      }),
    [runExportCommand],
  );

  const exportMarkdown = useCallback(
    (options: ExportDocOptions) =>
      runExportCommand({
        id: 'export-markdown',
        guardError: options.docId ? null : 'Unable to find document ID',
        loadingMessage: 'Exporting Markdown (.md)...',
        fallbackErrorMessage: 'Failed to export document to Markdown (.md).',
        execute: () => runExportMarkdown(options),
      }),
    [runExportCommand],
  );

  const exportHtml = useCallback(
    (options: ExportDocOptions) =>
      runExportCommand({
        id: 'export-html',
        guardError: options.docId ? null : 'Unable to find document ID',
        loadingMessage: 'Exporting HTML (.html)...',
        fallbackErrorMessage: 'Failed to export HTML document.',
        execute: () => runExportHtml(options),
      }),
    [runExportCommand],
  );

  return {
    isExporting,
    downloadPdf,
    downloadCopy,
    exportZip,
    exportArxiv,
    exportWord,
    exportMarkdown,
    exportHtml,
  };
}
