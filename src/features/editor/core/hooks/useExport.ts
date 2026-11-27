'use client';

/**
 * useExport.ts
 *
 * GoF Command + Template Method Hook (`runExportCommand`):
 * Centralizes validation guards, concurrency lock, progress toast, and error feedback
 * across all document and archive export operations.
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  exportProjectAsZip,
  exportArxivSubmissionZip,
  exportVersionAsZip,
  type ExportZipOptions,
  type ExportVersionZipOptions,
} from '@/features/editor/sdk/archive/zip-export';
import {
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
  type ExportSingleDocOptions,
} from '@/features/editor/sdk/archive/doc-export';
import {
  sanitizeDocExportSlug,
  triggerFileDownload,
} from '@/features/editor/sdk/archive/download';
import { getExportFilename } from '@/features/editor/domain/document/document-naming';

export type { ExportZipOptions, ExportVersionZipOptions, ExportSingleDocOptions };

/**
 * GoF Command Descriptor encapsulating an executable export operation and its UI feedback contract.
 */
interface ExportCommandDescriptor {
  id: string;
  guardError?: string | null;
  loadingMessage: string;
  fallbackErrorMessage: string;
  execute: () => Promise<string>;
}

export function useProjectExport() {
  const [isExporting, setIsExporting] = useState(false);
  const activeLockRef = useRef(false);

  const runExportCommand = useCallback(
    async (cmd: ExportCommandDescriptor): Promise<string | null> => {
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
    },
    [],
  );

  const downloadPdf = useCallback(async (pdfUrl: string | null | undefined, projectTitle?: string) => {
    if (!pdfUrl) {
      toast.error('Please compile the document to PDF first.', { id: 'download-pdf' });
      return;
    }
    const filename = getExportFilename(projectTitle || 'document', 'pdf');
    try {
      if (pdfUrl.startsWith('blob:') || pdfUrl.startsWith('data:')) {
        const anchor = document.createElement('a');
        anchor.href = pdfUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } else {
        const resp = await fetch(pdfUrl);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        triggerFileDownload(blob, filename);
      }
    } catch {
      const anchor = document.createElement('a');
      anchor.href = pdfUrl;
      anchor.download = filename;
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }, []);

  const downloadCopy = useCallback((content?: string, projectTitle?: string) => {
    const filename = `${sanitizeDocExportSlug(projectTitle)}_copy.tex`;
    const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
    triggerFileDownload(blob, filename);
  }, []);

  const exportZip = useCallback(
    (options: ExportZipOptions) =>
      runExportCommand({
        id: 'export-zip',
        loadingMessage: 'Exporting ZIP...',
        fallbackErrorMessage: 'Failed to create project ZIP archive.',
        execute: () => exportProjectAsZip(options),
      }),
    [runExportCommand],
  );

  const exportArxiv = useCallback(
    (options: ExportZipOptions) =>
      runExportCommand({
        id: 'export-arxiv',
        loadingMessage: 'Exporting arXiv bundle...',
        fallbackErrorMessage: 'Failed to create arXiv submission ZIP.',
        execute: () => exportArxivSubmissionZip(options),
      }),
    [runExportCommand],
  );

  const exportWord = useCallback(
    (options: ExportSingleDocOptions) =>
      runExportCommand({
        id: 'export-word',
        guardError: options.docId ? null : 'Unable to find document ID',
        loadingMessage: 'Exporting Word (.docx)...',
        fallbackErrorMessage: 'Failed to export document to Microsoft Word (.docx).',
        execute: () => exportDocumentAsWord(options),
      }),
    [runExportCommand],
  );

  const exportMarkdown = useCallback(
    (options: ExportSingleDocOptions) =>
      runExportCommand({
        id: 'export-markdown',
        guardError: options.docId ? null : 'Unable to find document ID',
        loadingMessage: 'Exporting Markdown (.md)...',
        fallbackErrorMessage: 'Failed to export document to Markdown (.md).',
        execute: () => exportDocumentAsMarkdown(options),
      }),
    [runExportCommand],
  );

  const exportHtml = useCallback(
    (options: ExportSingleDocOptions) =>
      runExportCommand({
        id: 'export-html',
        guardError: options.docId ? null : 'Unable to find document ID',
        loadingMessage: 'Exporting HTML (.html)...',
        fallbackErrorMessage: 'Failed to export HTML document.',
        execute: () => exportDocumentAsHtml(options),
      }),
    [runExportCommand],
  );

  const exportVersionZip = useCallback(
    (options: ExportVersionZipOptions) =>
      runExportCommand({
        id: 'export-version-zip',
        loadingMessage: 'Exporting version ZIP...',
        fallbackErrorMessage: 'Failed to create version ZIP archive.',
        execute: () => exportVersionAsZip(options),
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
    exportVersionZip,
  };
}
