import { useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';
import { copyToClipboard } from '@/shared/lib/utils';
import { buildReaderPaperUrl } from '@/features/library/domain/reader.domain';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { libraryServices } from '@/features/library/sdk';
import type { Item, CslStyle } from '@/features/library/domain/types/core.types';
import { isItemRetracted } from '@/features/library/domain/system-views.policy';

export { copyToClipboard, buildReaderPaperUrl };

/**
 * Shared Browser IO & Clipboard Utilities for Library Coordinators and Reader.
 *
 * Centralizes clipboard copying with toast feedback, Blob downloads, text file
 * downloads, and external/internal URL download triggers so coordinators do not
 * duplicate raw DOM `<textarea>`, `<a>`, or `URL.createObjectURL` boilerplate.
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

export function triggerBrowserBlobDownload(
  blob: Blob,
  filename: string,
  revokeDelayMs: number = 10_000,
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs);
  }
}

export function triggerBrowserTextDownload(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  triggerBrowserBlobDownload(blob, filename);
}

export function triggerBrowserUrlDownload(url: string, filename: string): void {
  if (typeof document === 'undefined' || !url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }
}

export function openInNewTab(url: string): void {
  if (typeof window === 'undefined' || !url) return;
  if (typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else if (window.location && typeof window.location.assign === 'function') {
    window.location.assign(url);
  }
}

export function navigateToUrl(url: string): void {
  if (typeof window === 'undefined' || !url) return;
  if (window.location && typeof window.location.assign === 'function') {
    window.location.assign(url);
  } else if (typeof window.open === 'function') {
    window.open(url, '_self');
  }
}

/**
 * Stateless Citation & Bibliography Export Application Service.
 *
 * Delegates all citation formatting and BibTeX synthesis strictly to the
 * authoritative Backend Library Services (`libraryServices.citations` and
 * `libraryServices.exports`), handling retraction safety alerts, clipboard
 * feedback, and browser file downloads on the client.
 */

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

export async function executeDownloadFormatFile(
  items: Item[],
  scopeId: string,
  format: 'bibtex' | 'ris' | 'csl_json' | 'csv' | 'markdown',
  retractedCount: number = 0,
): Promise<void> {
  warnIfRetractedHelper(retractedCount, items.length, `${format.toUpperCase()} export`);
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length === 0) return;

  const extMap: Record<typeof format, string> = {
    bibtex: 'bib',
    ris: 'ris',
    csl_json: 'json',
    csv: 'csv',
    markdown: 'md',
  };

  try {
    const res = await libraryServices.exports.exportLibrary(scopeId, {
      format,
      itemIds,
    });
    if (res?.content) {
      const downloadFilename =
        res.filename || `references-selected-${items.length}.${extMap[format]}`;
      triggerBrowserTextDownload(res.content, downloadFilename, 'text/plain;charset=utf-8');
      toast.success(`Exported ${items.length} item(s) as .${extMap[format]}`);
      return;
    }
  } catch (err) {
    logger.warn(`Backend ${format} export failed`, { error: err });
  }

  toast.error(`Unable to export ${format.toUpperCase()} file`, { id: 'library-clipboard' });
}

export async function executeExportCollectionFormat(
  collectionId: string,
  collectionName: string,
  scopeId: string,
  format: 'bibtex' | 'ris' | 'csl_json' | 'csv' | 'markdown',
): Promise<void> {
  const extMap: Record<typeof format, string> = {
    bibtex: 'bib',
    ris: 'ris',
    csl_json: 'json',
    csv: 'csv',
    markdown: 'md',
  };

  try {
    const res = await libraryServices.exports.exportLibrary(scopeId, {
      format,
      collectionId,
    });
    if (res?.content) {
      const safeSlug = collectionName.toLowerCase().replace(/[^a-z0-9-_]+/g, '-') || 'collection';
      const downloadFilename = res.filename || `${safeSlug}.${extMap[format]}`;
      triggerBrowserTextDownload(res.content, downloadFilename, 'text/plain;charset=utf-8');
      toast.success(`Exported "${collectionName}" as .${extMap[format]}`);
      return;
    }
  } catch (err) {
    logger.warn(`Collection ${format} export failed`, { error: err });
  }

  toast.error(`Unable to export collection as ${format.toUpperCase()}`, { id: 'library-clipboard' });
}

export async function executeExportScopeFormat(
  scopeId: string,
  format: 'bibtex' | 'ris' | 'csl_json' | 'csv' | 'markdown',
  collectionId?: string,
): Promise<void> {
  const extMap: Record<typeof format, string> = {
    bibtex: 'bib',
    ris: 'ris',
    csl_json: 'json',
    csv: 'csv',
    markdown: 'md',
  };

  try {
    const res = await libraryServices.exports.exportLibrary(scopeId, {
      format,
      ...(collectionId ? { collectionId } : {}),
    });
    if (res?.content) {
      const downloadFilename =
        res.filename ||
        `${collectionId ? 'collection-export' : 'library-export'}-${new Date().toISOString().slice(0, 10)}.${extMap[format]}`;
      triggerBrowserTextDownload(res.content, downloadFilename, 'text/plain;charset=utf-8');
      toast.success(`Exported library as .${extMap[format]}`);
      return;
    }
  } catch (err) {
    logger.warn(`Library ${format} export failed`, { error: err });
  }

  toast.error(`Unable to export library as ${format.toUpperCase()}`, { id: 'library-clipboard' });
}

export interface UseQuickCopyOptions {
  scopeId?: string;
  items?: Item[];
  selectedIds?: Set<string>;
  activeItemId?: string | null;
  defaultStyle?: CslStyle;
  enableKeydownListener?: boolean;
}

/**
 * Native Academic Quick Copy Coordinator:
 * - Ctrl+Shift+C (Cmd+Shift+C on macOS): Copy Selected References as Bibliography
 * - Ctrl+Shift+A (Cmd+Shift+A on macOS): Copy Selected References as In-text Citation
 */
export function useQuickCopyCoordinator({
  scopeId,
  items,
  selectedIds: propSelectedIds,
  activeItemId: propActiveItemId,
  defaultStyle = 'apa',
  enableKeydownListener = true,
}: UseQuickCopyOptions = {}) {
  const getTargetItemIds = useCallback((): string[] => {
    if (propSelectedIds && propSelectedIds.size > 0) {
      return Array.from(propSelectedIds);
    }
    const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
    if (currentSelectedIds && currentSelectedIds.size > 0) {
      return Array.from(currentSelectedIds);
    }
    const currentActiveItemId =
      propActiveItemId !== undefined
        ? propActiveItemId
        : useLibraryUIStore.getState().activeItemId;
    if (currentActiveItemId) {
      return [currentActiveItemId];
    }
    return [];
  }, [propSelectedIds, propActiveItemId]);

  const warnRetractedIfNeeded = useCallback(
    (itemIds: string[], actionLabel: string) => {
      if (!items || items.length === 0 || itemIds.length === 0) return;
      const targetIdSet = new Set(itemIds);
      const retractedCount = items.filter(
        (catalogItem) => targetIdSet.has(catalogItem.id) && isItemRetracted(catalogItem),
      ).length;
      warnIfRetractedHelper(retractedCount, itemIds.length, actionLabel);
    },
    [items],
  );

  const copyBibliography = useCallback(
    async (style: CslStyle = defaultStyle) => {
      const itemIds = getTargetItemIds();
      if (itemIds.length === 0) {
        toast.info('Select references first to copy citation', { id: 'quick-copy' });
        return;
      }

      warnRetractedIfNeeded(itemIds, 'citation formatting');

      const toastId = String(
        toast.loading(`Formatting bibliography (${style.toUpperCase()})...`, {
          id: 'quick-copy',
        }),
      );

      try {
        let text = '';
        if (itemIds.length === 1) {
          const res = await libraryServices.citations.formatCitation(scopeId, itemIds[0], style);
          text = res.bibliography || res.inText || '';
        } else {
          const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
          text =
            res.bibliographyText ||
            res.citations
              .map((c) => c.citation?.bibliography)
              .filter(Boolean)
              .join('\n\n');
        }

        if (!text.trim()) {
          toast.error('Unable to generate bibliography for selected items', { id: toastId });
          return;
        }

        await copyWithToastHelper(
          text,
          `Copied ${itemIds.length} reference${itemIds.length > 1 ? 's' : ''} (${style.toUpperCase()}) to clipboard`,
          toastId,
        );
      } catch (err: unknown) {
        toast.error('Citation copy failed', {
          description:
            err instanceof Error
              ? err.message
              : 'Could not contact citation formatting engine',
          id: toastId,
        });
      }
    },
    [getTargetItemIds, warnRetractedIfNeeded, scopeId, defaultStyle],
  );

  const copyInTextCitation = useCallback(
    async (style: CslStyle = defaultStyle) => {
      const itemIds = getTargetItemIds();
      if (itemIds.length === 0) {
        toast.info('Select references first to copy citation', { id: 'quick-copy' });
        return;
      }

      warnRetractedIfNeeded(itemIds, 'in-text citation');

      const toastId = String(
        toast.loading('Formatting in-text citation...', { id: 'quick-copy' }),
      );

      try {
        let text = '';
        if (itemIds.length === 1) {
          const res = await libraryServices.citations.formatCitation(scopeId, itemIds[0], style);
          text = res.inText || '';
        } else {
          const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
          text =
            res.combinedInText ||
            res.citations
              .map((c) => c.citation?.inText)
              .filter(Boolean)
              .join('; ');
        }

        if (!text.trim()) {
          toast.error('Unable to generate in-text citation', { id: toastId });
          return;
        }

        await copyWithToastHelper(
          text,
          `Copied in-text citation for ${itemIds.length} reference${itemIds.length > 1 ? 's' : ''} to clipboard`,
          toastId,
        );
      } catch (err: unknown) {
        toast.error('In-text citation copy failed', {
          description:
            err instanceof Error
              ? err.message
              : 'Could not contact citation formatting engine',
          id: toastId,
        });
      }
    },
    [getTargetItemIds, warnRetractedIfNeeded, scopeId, defaultStyle],
  );

  // Global Keyboard Listener
  useEffect(() => {
    if (!enableKeydownListener) return;
    const isMac =
      typeof navigator !== 'undefined'
        ? /mac/i.test(navigator.userAgent) ||
          /mac/i.test(
            (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '',
          )
        : false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (useLibraryUIStore.getState().activeModal !== null) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable ||
        target?.closest('[role="dialog"], [role="menu"], [role="combobox"]')
      ) {
        return;
      }

      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (!modifier || !e.shiftKey) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        e.stopPropagation();
        void copyBibliography();
      } else if (key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        void copyInTextCitation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enableKeydownListener, copyBibliography, copyInTextCitation]);

  return useMemo(
    () => ({
      copyBibliography,
      copyInTextCitation,
    }),
    [copyBibliography, copyInTextCitation],
  );
}
