import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';
import { libraryServices } from '@/features/library/sdk/library.client';
import type { Item, CslStyle } from '@/features/library/domain/types/library.types';
import {
  copyWithToastHelper,
  triggerBrowserBlobDownload,
  triggerBrowserTextDownload,
  triggerBrowserUrlDownload,
} from './browser-io.helpers';

export {
  copyWithToastHelper,
  triggerBrowserBlobDownload,
  triggerBrowserTextDownload,
  triggerBrowserUrlDownload,
};

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
