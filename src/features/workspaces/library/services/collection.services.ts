import type { QueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Collection } from "@/features/workspaces/library/types/library.types";


export const collectionKeys = {
  all: (workspaceId: string) => ["collections", workspaceId] as const,
};

export const invalidateCollections = (qc: QueryClient, workspaceId: string) => {
  qc.invalidateQueries({ queryKey: collectionKeys.all(workspaceId) });
};

export const getCollections = (workspaceId: string) =>
  apiGet<{ collections: Collection[] }>(`/api/library/${workspaceId}/collections`);

export const createCollection = (workspaceId: string, data: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
}) => apiPost<{ collection: Collection }>(`/api/library/${workspaceId}/collections`, data);

export const updateCollection = (workspaceId: string, collectionId: string, data: {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
}) => apiPut<{ collection: Collection }>(`/api/library/${workspaceId}/collections/${collectionId}`, data);

export const deleteCollection = (workspaceId: string, collectionId: string) =>
  apiDelete(`/api/library/${workspaceId}/collections/${collectionId}`);
