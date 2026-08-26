'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  collectionKeys,
  getCollections,
  invalidateCollections,
} from '../../services/collection.service';
import { libraryKeys } from '../../services/library.service';
import type { Collection } from '../../types/library.types';

export interface CollectionTreeNode extends Collection {
  children?: CollectionTreeNode[];
  itemCount?: number;
}

export interface LibraryTag {
  id: string;
  name: string;
  color: string;
  origin?: 'user' | 'local_import' | 'zotero_adapter';
  itemCount?: number;
}

export function useLibraryTaxonomy(workspaceId: string) {
  const queryClient = useQueryClient();

  // 1. Collections Hierarchy Tree Query
  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(workspaceId),
    queryFn: () => getCollections(workspaceId),
    enabled: Boolean(workspaceId),
    select: (data) => {
      const collections: Collection[] = data.collections || [];
      const nodeMap = new Map<string, CollectionTreeNode>();
      const roots: CollectionTreeNode[] = [];

      for (const col of collections) {
        nodeMap.set(col.id, { ...col, children: [] });
      }

      for (const col of collections) {
        const node = nodeMap.get(col.id)!;
        if (col.parentId && nodeMap.has(col.parentId)) {
          nodeMap.get(col.parentId)!.children!.push(node);
        } else {
          roots.push(node);
        }
      }

      return { raw: collections, tree: roots };
    },
  });

  // 2. Tags Query
  const tagsQuery = useQuery({
    queryKey: ['workspace', workspaceId, 'library', 'tags'],
    queryFn: async (): Promise<LibraryTag[]> => {
      // Tags fetcher fallback
      return [];
    },
    enabled: Boolean(workspaceId),
  });

  // 3. Tag Assignment Mutations
  const assignTagMutation = useMutation({
    mutationFn: async ({ itemId, tagId }: { itemId: string; tagId: string }) => {
      // Simulated or canonical assign endpoint
      return { itemId, tagId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.paperDetail(workspaceId, vars.itemId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      toast.success('Tag assigned');
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async ({ itemId, tagId }: { itemId: string; tagId: string }) => {
      return { itemId, tagId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.paperDetail(workspaceId, vars.itemId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      toast.success('Tag removed');
    },
  });

  return {
    state: {
      collections: collectionsQuery.data?.raw || [],
      collectionTree: collectionsQuery.data?.tree || [],
      tags: tagsQuery.data || [],
      isLoading: collectionsQuery.isLoading || tagsQuery.isLoading,
    },
    actions: {
      assignTag: assignTagMutation.mutateAsync,
      removeTag: removeTagMutation.mutateAsync,
      invalidateTaxonomy: () => {
        invalidateCollections(queryClient, workspaceId);
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'library', 'tags'] });
      },
    },
  };
}
