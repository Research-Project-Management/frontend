import type { QueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type {
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from "@/features/workspaces/library/types/library.types";

export const collectionKeys = {
  all: (workspaceId: string) => ["collections", workspaceId] as const,
  byId: (workspaceId: string, collectionId: string) => ["collections", workspaceId, collectionId] as const,
};

export const invalidateCollections = (qc: QueryClient, workspaceId: string) => {
  qc.invalidateQueries({ queryKey: collectionKeys.all(workspaceId) });
};

// ── Structured Collection Service ─────────────────────────────────────────────

export const CollectionService = {
  getAll: (workspaceId: string) =>
    apiGet<{ collections: Collection[] }>(`/api/library/${workspaceId}/collections`),

  getById: (workspaceId: string, collectionId: string) =>
    apiGet<{ collection: Collection }>(`/api/library/${workspaceId}/collections/${collectionId}`),

  create: (workspaceId: string, data: CreateCollectionDTO) =>
    apiPost<{ collection: Collection }>(`/api/library/${workspaceId}/collections`, data),

  update: (workspaceId: string, collectionId: string, data: UpdateCollectionDTO) =>
    apiPut<{ collection: Collection }>(`/api/library/${workspaceId}/collections/${collectionId}`, data),

  delete: (workspaceId: string, collectionId: string) =>
    apiDelete(`/api/library/${workspaceId}/collections/${collectionId}`),
};

// ── Backwards-compatible Function Aliases ─────────────────────────────────────

export const getCollections = CollectionService.getAll;
export const createCollection = CollectionService.create;
export const updateCollection = CollectionService.update;
export const deleteCollection = CollectionService.delete;
