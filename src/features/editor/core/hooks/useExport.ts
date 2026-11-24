'use client';

/**
 * use-export.ts
 *
 * Centralized Document & Project Export Hook.
 * Manages all export lifecycles, progress toasts, success/error feedback,
 * and absorbs errors safely so event triggers don't throw unhandled exceptions.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  exportProjectAsZip,
  exportArxivSubmissionZip,
  exportVersionAsZip,
  type ArchiveExportOptions,
  type ExportZipOptions,
  type ExportVersionZipOptions,
} from '@/features/editor/sdk/archive/archive-export';
import {
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
  triggerFileDownload,
  type ExportSingleDocOptions,
} from '@/features/editor/sdk/archive/document-download';
import { getExportFilename } from '@/features/editor/domain/document/document-naming';
import { usePageStore } from '@/features/editor/core/store/editor.store';

export type { ArchiveExportOptions, ExportZipOptions, ExportVersionZipOptions };

export function useProjectExport() {
  const [isExporting, setIsExporting] = useState(false);

  const downloadPdf = useCallback(async (pdfUrl: string | null | undefined, projectTitle?: string) => {
    if (!pdfUrl) {
      toast.error('Please compile the document to PDF first.', { id: 'download-pdf' });
      return;
    }
    const filename = getExportFilename(projectTitle || 'document', 'pdf');
    try {
      if (pdfUrl.startsWith('blob:') || pdfUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const resp = await fetch(pdfUrl);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, []);

  const downloadCopy = useCallback((content?: string, projectTitle?: string) => {
    const src = content || '';
    const title = (projectTitle || 'document').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const filename = `${title}_copy.tex`;
    const blob = new Blob([src], { type: 'text/plain;charset=utf-8' });
    triggerFileDownload(blob, filename);
  }, []);

  const exportZip = useCallback(async (options: ExportZipOptions): Promise<string | null> => {
    const toastId = toast.loading('Exporting ZIP...');
    setIsExporting(true);
    try {
      const mainFile = options.mainFile || usePageStore.getState().mainFilePath || 'main.tex';
      const filename = await exportProjectAsZip({ ...options, mainFile });
      toast.success(`Exported ${filename}`, { id: toastId });
      return filename;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to create project ZIP archive.', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportArxiv = useCallback(async (options: ExportZipOptions): Promise<string | null> => {
    const toastId = toast.loading('Exporting arXiv bundle...');
    setIsExporting(true);
    try {
      const mainFile = options.mainFile || usePageStore.getState().mainFilePath || 'main.tex';
      const filename = await exportArxivSubmissionZip({ ...options, mainFile });
      toast.success(`Exported ${filename}`, { id: toastId });
      return filename;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to create arXiv submission ZIP.', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportWord = useCallback(async (options: ExportSingleDocOptions): Promise<string | null> => {
    if (!options.pageId) {
      toast.error('Unable to find project or document ID', { id: 'export-word' });
      return null;
    }
    const toastId = toast.loading('Exporting Word (.docx)...');
    setIsExporting(true);
    try {
      const filename = await exportDocumentAsWord(options);
      toast.success(`Exported ${filename}`, { id: toastId });
      return filename;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to export document to Microsoft Word (.docx).', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportMarkdown = useCallback(async (options: ExportSingleDocOptions): Promise<string | null> => {
    if (!options.pageId && !options.fallbackContent) {
      toast.error('Unable to find document content', { id: 'export-markdown' });
      return null;
    }
    const toastId = toast.loading('Exporting Markdown (.md)...');
    setIsExporting(true);
    try {
      const filename = await exportDocumentAsMarkdown(options);
      toast.success(`Exported ${filename}`, { id: toastId });
      return filename;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to export document to Markdown (.md).', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportHtml = useCallback(
    async (
      options: {
        pageId?: string;
        content?: string;
        projectTitle?: string;
        includeChildren?: boolean;
      },
    ): Promise<string | null> => {
      if (!options.pageId) {
        toast.error('Unable to find project or document ID', { id: 'export-html' });
        return null;
      }
      const toastId = toast.loading('Exporting HTML (.html)...');
      setIsExporting(true);
      try {
        const filename = await exportDocumentAsHtml(options);
        toast.success(`Exported ${filename}`, { id: toastId });
        return filename;
      } catch (err: unknown) {
        toast.error(
          (err as Error)?.message || 'Failed to export HTML document.',
          { id: toastId },
        );
        return null;
      } finally {
        setIsExporting(false);
      }
    },
    [],
  );

  const exportVersionZip = useCallback(async (options: ExportVersionZipOptions): Promise<string | null> => {
    const toastId = toast.loading('Exporting version ZIP...');
    setIsExporting(true);
    try {
      const filename = await exportVersionAsZip(options);
      toast.success(`Exported ${filename}`, { id: toastId });
      return filename;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to create version ZIP archive.', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

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
