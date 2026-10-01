import { readerService, fetchPdfBlob, getPaperFileUrl } from '../data/reader.service';
import type { ReaderDocument, DocumentFulltext } from '../types/reader.types';

export { getPaperFileUrl, fetchPdfBlob };
export const fetchDocumentBuffer = fetchPdfBlob;

/**
 * ItemsService corresponding to backend ItemsService
 * Delegates to Reader Client SDK (features/reader/data/reader.service.ts)
 */
export const ItemsService = {
  getPaperFileUrl,
  fetchPdfBlob,
  fetchDocumentBuffer,

  getItem: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<ReaderDocument> => {
    return readerService.documents.get(scopeId, itemId);
  },

  updateItem: async (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<ReaderDocument>,
  ): Promise<ReaderDocument> => {
    return readerService.documents.update(scopeId, itemId, data);
  },

  reindexItem: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<{ success: boolean }> => {
    return readerService.documents.reindex(scopeId, itemId);
  },

  getFulltext: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<DocumentFulltext | null> => {
    return readerService.documents.getFulltext(scopeId, itemId);
  },

  getCounts: async (scopeId?: string) => {
    return readerService.documents.getCounts(scopeId);
  },
};

export default ItemsService;
