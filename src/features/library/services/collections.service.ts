import { ExportService, ExportsService } from './exports.service';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/shared/lib/api";
import type {
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from "@/features/library/types/library.types";

// ── Structured Collection Service ─────────────────────────────────────────────

export const CollectionsService = {
  getAll: (scopeId?: string) =>
    apiGet<{ collections: Collection[] }>(
      `/api/v1/library/collections`,
      { params: scopeId ? { projectId: scopeId } : undefined }
    ),

  /**
   * Get hierarchical collection tree (for sidebar/tree view rendering)
   * Backed by GET /collections/tree
   */
  getTree: (scopeId?: string) =>
    apiGet<{ tree: Collection[] }>(
      `/api/v1/library/collections/tree`,
      { params: scopeId ? { projectId: scopeId } : undefined }
    ),

  getById: (_scopeId?: string, collectionId?: string) => {
    const id = collectionId || _scopeId || '';
    return apiGet<{ collection: Collection }>(
      `/api/v1/library/collections/${encodeURIComponent(id)}`,
    );
  },

  create: (scopeId: string | undefined, data: CreateCollectionDTO) =>
    apiPost<{ collection: Collection }>(
      `/api/v1/library/collections`,
      data,
      { params: scopeId ? { projectId: scopeId } : undefined }
    ),

  update: (_scopeId: string | undefined, collectionId: string, data: UpdateCollectionDTO) =>
    apiPut<{ collection: Collection }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}`,
      data,
    ),

  delete: (_scopeId: string | undefined, collectionId: string, strategy?: "cascade" | "move-to-parent" | "orphan") =>
    apiDelete(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}`,
      { params: strategy ? { strategy } : undefined },
    ),

  moveItems: (_scopeId: string | undefined, collectionId: string, itemIds: string[]) =>
    apiPost<{ message: string; count: number; targetCollectionId: string | null }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/move-items`,
      { itemIds, paperIds: itemIds }
    ),

  movePapers: (_scopeId: string | undefined, collectionId: string, paperIds: string[]) =>
    apiPost<{ message: string; count: number; targetCollectionId: string | null }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/move-items`,
      { itemIds: paperIds, paperIds }
    ),

  reorder: (_scopeId: string | undefined, collections: Array<{ id: string; parentId?: string | null }>) =>
    apiPatch<{ collections: Collection[] }>(
      `/api/v1/library/collections/reorder`,
      { collections },
    ),

  /**
   * Assign items to a collection (batch, non-destructive add)
   * Backed by POST /collections/:collectionId/items
   */
  assignItems: (
    _scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    apiPost<{ count: number; collectionId: string }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/items`,
      { itemIds },
    ),

  /**
   * Remove a single item from a collection without deleting the item
   * Backed by DELETE /collections/:collectionId/items/:itemId
   */
  detachItem: (
    _scopeId: string | undefined,
    collectionId: string,
    itemId: string,
  ) =>
    apiDelete<{ detached: boolean }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
    ),

  exportBibtex: (_scopeId: string | undefined, collectionId: string) =>
    apiGet<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId)}`,
    ),

  exportBundle: (_scopeId: string | undefined, collectionId: string) =>
    apiGet<{
      collection: { id: string; name: string };
      totalPapers: number;
      totalFiles: number;
      bibtex: string;
      files: Array<{ paperId: string; title: string; filename: string; fileUrl: string }>;
    }>(
      `/api/v1/library/exports/${encodeURIComponent(collectionId)}/export-bundle`,
    ),
};


// ── Backwards-compatible Function Aliases ─────────────────────────────────────

export const getCollections = CollectionsService.getAll;
export const createCollection = CollectionsService.create;
export const updateCollection = CollectionsService.update;
export const deleteCollection = CollectionsService.delete;
export const moveItemsToCollection = CollectionsService.moveItems;
export const movePapersToCollection = CollectionsService.movePapers;
export const reorderCollections = CollectionsService.reorder;
export const CollectionService = CollectionsService;

export { ExportService, ExportsService } from './exports.service';
