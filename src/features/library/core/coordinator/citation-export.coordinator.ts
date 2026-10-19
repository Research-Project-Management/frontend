import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { logger } from '@/shared/lib/logger';
import { libraryServices } from '@/features/library/sdk/library.client';
import type { Item, CslStyle } from '@/features/library/domain/types/library.types';

/**
 * Stateless Citation & Bibliography Export Application Service.
 *
 * Delegates all citation formatting and BibTeX synthesis strictly to the
 * authoritative Backend Library Services (`libraryServices.citations` and
 * `libraryServices.exports`), handling retraction safety alerts, clipboard
 * feedback, and browser file downloads on the client.
 */

export async function copyWithToastHelper(
  text: string,
  label: string = 'Copied to clipboard',
  toastId: string = 'library-clipboard',
): Promise<boolean> {
  if (!text || !text.trim()) {
    toast.error('Nothing to copy', { id: toastId });
    return false;
  }
  const ok = await copyToClipboard(text);
  if (ok) {
    toast.success(label, { id: toastId });
    return true;
  }
  toast.error('Failed to copy to clipboard', { id: toastId });
  return false;
}

export function warnIfRetractedHelper(
  retractedCount: number,
  totalSelectedCount: number,
  actionLabel: string,
): void {
  if (retractedCount > 0) {
    toast.warning(
      `Retraction Alert: ${retractedCount} of ${totalSelectedCount} selected item(s) have been retracted!`,
      {
        description: `Proceeding with ${actionLabel}. Please verify validity before citing in your research.`,
        duration: 6000,
      },
    );
  }
}

export function triggerBrowserTextDownload(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export async function executeCopyMultiCite(
  items: Item[],
  scopeId: string,
  style: CslStyle | 'latex' = 'apa',
  retractedCount: number = 0,
): Promise<void> {
  warnIfRetractedHelper(retractedCount, items.length, 'citation formatting');
  if (style === 'latex') {
    const keys = items
      .map((p) => (p.citationKey || p.id)?.trim())
      .filter(Boolean);
    const citeCmd = `\\cite{${keys.join(', ')}}`;
    await copyWithToastHelper(citeCmd, `Copied ${citeCmd} to clipboard`);
    return;
  }

  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length > 0) {
    try {
      const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
      const text =
        res.bibliographyText ||
        res.citations
          .map((c) => c.citation?.bibliography)
          .filter(Boolean)
          .join('\n\n');
      if (text) {
        await copyWithToastHelper(
          text,
          `Copied ${itemIds.length} citations (${style.toUpperCase()}) to clipboard`,
        );
        return;
      }
    } catch {
      toast.error('Failed to format citation. Please try again.');
      return;
    }
  }
  toast.error('No valid items found to format citation.');
}

export async function executeCopyInTextCite(
  items: Item[],
  scopeId: string,
  style: CslStyle = 'apa',
  retractedCount: number = 0,
): Promise<void> {
  warnIfRetractedHelper(retractedCount, items.length, 'in-text citation');
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length > 0) {
    try {
      const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
      const text =
        res.combinedInText ||
        res.citations
          .map((c) => c.citation?.inText)
          .filter(Boolean)
          .join('; ');
      if (text) {
        await copyWithToastHelper(text, `Copied in-text citation (${itemIds.length} items)`);
        return;
      }
    } catch {
      toast.error('Failed to format citation. Please try again.');
      return;
    }
  }
  toast.error('No valid items found to format citation.');
}

export async function executeExportAllBibtex(
  items: Item[],
  scopeId: string,
  selectedCount: number,
  retractedCount: number = 0,
): Promise<void> {
  warnIfRetractedHelper(retractedCount, items.length, 'BibTeX export');
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length === 0) return;

  try {
    const res = await libraryServices.exports.exportLibrary(scopeId, {
      format: 'bibtex',
      itemIds,
    });
    if (res?.content) {
      await copyWithToastHelper(
        res.content,
        `Copied BibTeX for ${selectedCount} reference(s) to clipboard`,
      );
      return;
    }
  } catch (err) {
    logger.warn('Backend BibTeX export failed', { error: err });
  }

  toast.error('Unable to export BibTeX for selected items', { id: 'library-clipboard' });
}

export async function executeDownloadBibFile(
  items: Item[],
  scopeId: string,
  selectedCount: number,
  retractedCount: number = 0,
): Promise<void> {
  warnIfRetractedHelper(retractedCount, items.length, 'BibTeX download');
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length === 0) return;

  try {
    const res = await libraryServices.exports.exportLibrary(scopeId, {
      format: 'bibtex',
      itemIds,
    });
    if (res?.content) {
      const downloadFilename = res.filename || `references-selected-${selectedCount}.bib`;
      triggerBrowserTextDownload(res.content, downloadFilename, 'text/plain;charset=utf-8');
      return;
    }
  } catch (err) {
    logger.warn('Backend BibTeX export failed', { error: err });
  }

  toast.error('Unable to generate BibTeX file for download', { id: 'library-clipboard' });
}
