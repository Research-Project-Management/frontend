import { useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';
import { copyToClipboard } from '@/shared/lib/utils';
import { buildReaderPaperUrl } from '@/features/library/domain/reader.domain';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import {
  formatCitationItem,
  batchFormatCitations,
  exportLibraryBibliography,
  useBatchRenameAttachmentsMutation,
  useCitationStyles,
  useCslCitation,
  useSearchCslStyles,
  useExportItemCitationQuery,
} from '@/features/library/sdk/queries/extraction.queries';
import type { Item, CslStyle } from '@/features/library/types/core.types';
import { isItemRetracted } from '@/features/library/domain/system-views.policy';
import { isEditableOrModalElementFocused } from './keyboard-shortcuts.coordinator';

export {
  copyToClipboard,
  buildReaderPaperUrl,
  useBatchRenameAttachmentsMutation,
  useCitationStyles,
  useCslCitation,
  useSearchCslStyles,
  useExportItemCitationQuery,
};

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

function triggerBrowserBlobDownload(
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

/**
 * Stateless Citation & Bibliography Export Application Service.
 *
 * Delegates all citation formatting and BibTeX synthesis strictly to the
 * authoritative Backend Library Services (`libraryServices.citations` and
 * `libraryServices.exports`), handling retraction safety alerts, clipboard
 * feedback, and browser file downloads on the client.
 */

type ExportFormatType = 'bibtex' | 'ris' | 'csl_json' | 'csv' | 'markdown';

const EXPORT_FORMAT_EXTENSION_MAP: Record<ExportFormatType, string> = {
  bibtex: 'bib',
  ris: 'ris',
  csl_json: 'json',
  csv: 'csv',
  markdown: 'md',
};

async function formatBibliographyForIds(
  scopeId: string | undefined,
  itemIds: string[],
  style: CslStyle,
  preferSingleEndpoint: boolean = false,
): Promise<string> {
  if (preferSingleEndpoint && itemIds.length === 1) {
    const res = await formatCitationItem(scopeId, itemIds[0], style);
    return res.bibliography || res.inText || '';
  }
  const res = await batchFormatCitations(scopeId, itemIds, style);
  return (
    res.bibliographyText ||
    res.citations
      .map((c) => c.citation?.bibliography)
      .filter(Boolean)
      .join('\n\n')
  );
}

async function formatInTextForIds(
  scopeId: string | undefined,
  itemIds: string[],
  style: CslStyle,
  preferSingleEndpoint: boolean = false,
): Promise<string> {
  if (preferSingleEndpoint && itemIds.length === 1) {
    const res = await formatCitationItem(scopeId, itemIds[0], style);
    return res.inText || '';
  }
  const res = await batchFormatCitations(scopeId, itemIds, style);
  return (
    res.combinedInText ||
    res.citations
      .map((c) => c.citation?.inText)
      .filter(Boolean)
      .join('; ')
  );
}

async function exportLibraryToFile(
  scopeId: string,
  params: {
    format: ExportFormatType;
    itemIds?: string[];
    collectionId?: string;
  },
  options: {
    fallbackFilename: string;
    successMessage?: string;
    errorMessage: string;
    logLabel: string;
  },
): Promise<void> {
  try {
    const res = await exportLibraryBibliography(scopeId, params);
    if (res?.content) {
      const downloadFilename = res.filename || options.fallbackFilename;
      triggerBrowserTextDownload(res.content, downloadFilename, 'text/plain;charset=utf-8');
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
      return;
    }
  } catch (err) {
    logger.warn(options.logLabel, { error: err });
  }

  toast.error(options.errorMessage, { id: 'library-clipboard' });
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
        id: 'retraction-alert',
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
      const text = await formatBibliographyForIds(scopeId, itemIds, style);
      if (text) {
        await copyWithToastHelper(
          text,
          `Copied ${itemIds.length} citations (${style.toUpperCase()}) to clipboard`,
        );
        return;
      }
    } catch {
      toast.error('Failed to format citation. Please try again.', { id: 'library-clipboard' });
      return;
    }
  }
  toast.error('No valid items found to format citation.', { id: 'library-clipboard' });
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
      const text = await formatInTextForIds(scopeId, itemIds, style);
      if (text) {
        await copyWithToastHelper(text, `Copied in-text citation (${itemIds.length} items)`);
        return;
      }
    } catch {
      toast.error('Failed to format citation. Please try again.', { id: 'library-clipboard' });
      return;
    }
  }
  toast.error('No valid items found to format citation.', { id: 'library-clipboard' });
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
    const res = await exportLibraryBibliography(scopeId, {
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

  await exportLibraryToFile(
    scopeId,
    { format: 'bibtex', itemIds },
    {
      fallbackFilename: `references-selected-${selectedCount}.bib`,
      errorMessage: 'Unable to generate BibTeX file for download',
      logLabel: 'Backend BibTeX export failed',
    },
  );
}

export async function executeDownloadFormatFile(
  items: Item[],
  scopeId: string,
  format: ExportFormatType,
  retractedCount: number = 0,
): Promise<void> {
  warnIfRetractedHelper(retractedCount, items.length, `${format.toUpperCase()} export`);
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length === 0) return;

  const ext = EXPORT_FORMAT_EXTENSION_MAP[format];
  await exportLibraryToFile(
    scopeId,
    { format, itemIds },
    {
      fallbackFilename: `references-selected-${items.length}.${ext}`,
      successMessage: `Exported ${items.length} item(s) as .${ext}`,
      errorMessage: `Unable to export ${format.toUpperCase()} file`,
      logLabel: `Backend ${format} export failed`,
    },
  );
}

export async function executeExportCollectionFormat(
  collectionId: string,
  collectionName: string,
  scopeId: string,
  format: ExportFormatType,
): Promise<void> {
  const ext = EXPORT_FORMAT_EXTENSION_MAP[format];
  const safeSlug = collectionName.toLowerCase().replace(/[^a-z0-9-_]+/g, '-') || 'collection';

  await exportLibraryToFile(
    scopeId,
    { format, collectionId },
    {
      fallbackFilename: `${safeSlug}.${ext}`,
      successMessage: `Exported "${collectionName}" as .${ext}`,
      errorMessage: `Unable to export collection as ${format.toUpperCase()}`,
      logLabel: `Collection ${format} export failed`,
    },
  );
}

export async function executeExportScopeFormat(
  scopeId: string,
  format: ExportFormatType,
  collectionId?: string,
): Promise<void> {
  const ext = EXPORT_FORMAT_EXTENSION_MAP[format];
  const dateSuffix = new Date().toISOString().slice(0, 10);

  await exportLibraryToFile(
    scopeId,
    { format, ...(collectionId ? { collectionId } : {}) },
    {
      fallbackFilename: `${collectionId ? 'collection-export' : 'library-export'}-${dateSuffix}.${ext}`,
      successMessage: `Exported library as .${ext}`,
      errorMessage: `Unable to export library as ${format.toUpperCase()}`,
      logLabel: `Library ${format} export failed`,
    },
  );
}

interface UseQuickCopyOptions {
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
        const text = await formatBibliographyForIds(scopeId, itemIds, style, true);

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
        const text = await formatInTextForIds(scopeId, itemIds, style, true);

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
      if (isEditableOrModalElementFocused(e.target)) return;

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
