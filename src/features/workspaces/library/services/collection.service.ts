import { ExportService } from './export.service';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/shared/lib/api";
import type {
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from "@/features/workspaces/library/types/library.types";

// ── Structured Collection Service ─────────────────────────────────────────────

export const CollectionService = {
  getAll: (workspaceId: string) =>
    apiGet<{ collections: Collection[] }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections`,
    ),

  /**
   * Get hierarchical collection tree (for sidebar/tree view rendering)
   * Backed by GET /collections/tree
   */
  getTree: (workspaceId: string) =>
    apiGet<{ tree: Collection[] }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/tree`,
    ),

  getById: (workspaceId: string, collectionId: string) =>
    apiGet<{ collection: Collection }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/${encodeURIComponent(collectionId)}`,
    ),

  create: (workspaceId: string, data: CreateCollectionDTO) =>
    apiPost<{ collection: Collection }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections`,
      data,
    ),

  update: (workspaceId: string, collectionId: string, data: UpdateCollectionDTO) =>
    apiPut<{ collection: Collection }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/${encodeURIComponent(collectionId)}`,
      data,
    ),

  delete: (workspaceId: string, collectionId: string, strategy?: "cascade" | "move-to-parent" | "orphan") =>
    apiDelete(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/${encodeURIComponent(collectionId)}`,
      { params: strategy ? { strategy } : undefined },
    ),

  moveItems: (workspaceId: string, collectionId: string, itemIds: string[]) =>
    apiPost<{ message: string; count: number; targetCollectionId: string | null }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/${encodeURIComponent(collectionId)}/move-items`,
      { itemIds, paperIds: itemIds }
    ),

  movePapers: (workspaceId: string, collectionId: string, paperIds: string[]) =>
    apiPost<{ message: string; count: number; targetCollectionId: string | null }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/${encodeURIComponent(collectionId)}/move-items`,
      { itemIds: paperIds, paperIds }
    ),

  reorder: (workspaceId: string, collections: Array<{ id: string; parentId?: string | null }>) =>
    apiPatch<{ collections: Collection[] }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/reorder`,
      { collections },
    ),

  /**
   * Assign items to a collection (batch, non-destructive add)
   * Backed by POST /collections/:collectionId/items
   */
  assignItems: (
    workspaceId: string,
    collectionId: string,
    itemIds: string[],
  ) =>
    apiPost<{ count: number; collectionId: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/${encodeURIComponent(collectionId)}/items`,
      { itemIds },
    ),

  /**
   * Remove a single item from a collection without deleting the item
   * Backed by DELETE /collections/:collectionId/items/:itemId
   */
  detachItem: (
    workspaceId: string,
    collectionId: string,
    itemId: string,
  ) =>
    apiDelete<{ detached: boolean }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
    ),

  exportBibtex: (workspaceId: string, collectionId: string) =>
    apiGet<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId)}`,
    ),

  exportBundle: (workspaceId: string, collectionId: string) =>
    apiGet<{
      collection: { id: string; name: string };
      totalPapers: number;
      totalFiles: number;
      bibtex: string;
      files: Array<{ paperId: string; title: string; filename: string; fileUrl: string }>;
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/exports/${encodeURIComponent(collectionId)}/export-bundle`,
    ),
};


// ── Backwards-compatible Function Aliases ─────────────────────────────────────

export const getCollections = CollectionService.getAll;
export const createCollection = CollectionService.create;
export const updateCollection = CollectionService.update;
export const deleteCollection = CollectionService.delete;
export const moveItemsToCollection = CollectionService.moveItems;
export const movePapersToCollection = CollectionService.movePapers;
export const reorderCollections = CollectionService.reorder;


export { ExportService } from './export.service';
