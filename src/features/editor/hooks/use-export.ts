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
  type ExportZipOptions,
  type ExportVersionZipOptions,
} from '../utils/export-zip.util';
import {
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
  triggerFileDownload,
  type ExportSingleDocOptions,
} from '../utils/export-document.util';
import { getExportFilename } from '../utils/core.util';

export function useProjectExport() {
  const [isExporting, setIsExporting] = useState(false);

  const downloadPdf = useCallback((pdfUrl: string | null | undefined, projectTitle?: string) => {
    if (!pdfUrl) {
      toast.error('Please compile the PDF first.');
      return;
    }
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = getExportFilename(projectTitle || 'document', 'pdf');
    a.click();
  }, []);

  const downloadCopy = useCallback((content?: string, projectTitle?: string) => {
    const src = content || '';
    const title = (projectTitle || 'document').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const filename = `${title}_copy.tex`;
    const blob = new Blob([src], { type: 'text/plain;charset=utf-8' });
    triggerFileDownload(blob, filename);
    toast.success(`Created copy: ${filename}`);
  }, []);

  const exportZip = useCallback(async (options: ExportZipOptions): Promise<string | null> => {
    const toastId = toast.loading('Packaging project into ZIP...');
    setIsExporting(true);
    try {
      const filename = await exportProjectAsZip(options);
      toast.success(`Exported ${filename} successfully!`, { id: toastId });
      return filename;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create project ZIP archive.', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportArxiv = useCallback(async (options: ExportZipOptions): Promise<string | null> => {
    const toastId = toast.loading('Generating arXiv submission bundle...');
    setIsExporting(true);
    try {
      const filename = await exportArxivSubmissionZip(options);
      toast.success(`Exported ${filename} successfully for arXiv!`, { id: toastId });
      return filename;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create arXiv submission ZIP.', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportWord = useCallback(async (options: ExportSingleDocOptions): Promise<string | null> => {
    if (!options.pageId) {
      toast.error('Unable to find project or document ID');
      return null;
    }
    const toastId = toast.loading('Exporting document to Microsoft Word (.docx)...');
    setIsExporting(true);
    try {
      const filename = await exportDocumentAsWord(options);
      toast.success(`Exported ${filename} successfully!`, { id: toastId });
      return filename;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export document to Microsoft Word (.docx).', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportMarkdown = useCallback(async (options: ExportSingleDocOptions): Promise<string | null> => {
    if (!options.pageId && !options.fallbackContent) {
      toast.error('Unable to find document content');
      return null;
    }
    const toastId = toast.loading('Exporting document to Markdown (.md)...');
    setIsExporting(true);
    try {
      const filename = await exportDocumentAsMarkdown(options);
      toast.success(`Exported ${filename} successfully!`, { id: toastId });
      return filename;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export document to Markdown (.md).', { id: toastId });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportHtml = useCallback((options: { content: string; projectTitle?: string }): string | null => {
    try {
      const filename = exportDocumentAsHtml(options);
      toast.success(`Exported ${filename} successfully!`);
      return filename;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export HTML document.');
      return null;
    }
  }, []);

  const exportVersionZip = useCallback(async (options: ExportVersionZipOptions): Promise<string | null> => {
    const toastId = toast.loading('Packaging historical snapshot into ZIP...');
    setIsExporting(true);
    try {
      const filename = await exportVersionAsZip(options);
      toast.success(`Exported ${filename} successfully!`, { id: toastId });
      return filename;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create version ZIP archive.', { id: toastId });
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
