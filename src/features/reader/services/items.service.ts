import {
  ItemsService as LibraryItemsService,
  fetchPdfBlob,
  getPaperFileUrl,
} from '@/features/library/services/items.service';
import type { ReaderDocument, DocumentFulltext } from '../types/reader.types';

export { getPaperFileUrl, fetchPdfBlob };
export const fetchDocumentBuffer = fetchPdfBlob;

/**
 * ItemsService corresponding to backend ItemsService (backend/src/modules/library/items/items.service.ts)
 * Facade delegating to features/library/services/items.service.ts for a single source of truth.
 */
export const ItemsService = {
  getPaperFileUrl,
  fetchPdfBlob,
  fetchDocumentBuffer,

  getItem: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<ReaderDocument> => {
    return (await LibraryItemsService.getItem(scopeId, itemId)) as unknown as ReaderDocument;
  },

  updateItem: async (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<ReaderDocument>,
  ): Promise<ReaderDocument> => {
    return (await LibraryItemsService.updateItem(
      scopeId,
      itemId,
      data as any,
    )) as unknown as ReaderDocument;
  },

  reindexItem: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<{ success: boolean }> => {
    return LibraryItemsService.reindexItem(scopeId, itemId);
  },

  getFulltext: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<DocumentFulltext | null> => {
    return LibraryItemsService.getFulltext(scopeId, itemId);
  },
};
