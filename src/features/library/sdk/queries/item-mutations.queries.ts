'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ItemsService, StateService } from '../library.client';
import {
  getMappedItemMeta,
  hasExplicitUserStateInPayload,
  preserveMappedItemFlags,
  setMappedItemMeta,
} from '@/features/library/domain/metadata';
import type { Item, CreateItemDTO, UpdateItemDTO } from '@/features/library/domain/types/library.types';
import {
  itemKeys,
  libraryKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import {
  mergeCachedItemWithPatch,
  patchItemAcrossScopeCaches,
  resolveCachedItemFromScope,
  chunkUniqueIds,
  invalidateLibraryCatalogDependencies,
  isMetadataOnlyPatch,
} from './cache-patcher';

export function resolveCachedItemVersion(
  queryClient: QueryClient,
  effectiveScope: string,
  itemId: string,
  explicitVersion?: number,
  dtoVersion?: number,
): number | undefined {
  if (typeof explicitVersion === 'number') return explicitVersion;
  if (typeof dtoVersion === 'number') return dtoVersion;

  const cached = resolveCachedItemFromScope(queryClient, effectiveScope, itemId);
  return typeof cached?.version === 'number' ? cached.version : undefined;
}

export function buildServerSuccessCachePatch(
  serverItem: Partial<Item> | undefined,
  rawData: Partial<UpdateItemDTO>,
  existingCached: Item | null | undefined,
): Partial<Item> {
  const patchData: Partial<Item> = {
    ...rawData,
    ...(serverItem && typeof serverItem === 'object' ? serverItem : {}),
  };

  if (serverItem && typeof serverItem === 'object') {
    preserveMappedItemFlags(serverItem, patchData);
    const serverMeta = getMappedItemMeta(serverItem);
    setMappedItemMeta(patchData, {
      isFullBackendItem: serverMeta?.isFullBackendItem ?? true,
      hasExplicitUserState: Boolean(serverMeta?.hasExplicitUserState),
    });
  }

  const serverHasExplicitState = hasExplicitUserStateInPayload(
    serverItem as Record<string, unknown> | undefined,
  );
  const inputHasExplicitState = hasExplicitUserStateInPayload(
    rawData as Record<string, unknown>,
  );

  if (existingCached && !serverHasExplicitState && !inputHasExplicitState) {
    patchData.isStarred = existingCached.isStarred;
    patchData.isFavorite = existingCached.isFavorite;
    patchData.isRead = existingCached.isRead;
    patchData.readStatus = existingCached.readStatus;
    patchData.rating = existingCached.rating;
    if (existingCached.lastReadAt !== undefined) {
      patchData.lastReadAt = existingCached.lastReadAt;
    }
    if (existingCached.currentPage !== undefined) {
      patchData.currentPage = existingCached.currentPage;
    }
    if (existingCached.lastReadPage !== undefined) {
      patchData.lastReadPage = existingCached.lastReadPage;
    }
    if (existingCached.scrollPosition !== undefined) {
      patchData.scrollPosition = existingCached.scrollPosition;
    }
    if (existingCached.lastOpenedAt !== undefined) {
      patchData.lastOpenedAt = existingCached.lastOpenedAt;
    }
    setMappedItemMeta(patchData, { hasExplicitUserState: false });
  }

  return patchData;
}

export function useUpdateLibraryItemMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  const mutationKey = ['update-item', effectiveScope];

  return useMutation({
    mutationKey,
    mutationFn: async ({
      itemId,
      data,
      expectedVersion,
    }: {
      itemId: string;
      data: UpdateItemDTO;
      expectedVersion?: number;
      silent?: boolean;
    }) => {
      const { silent: _silent, ...updateData } = data;
      const cached = resolveCachedItemFromScope(queryClient, effectiveScope, itemId);
      const cachedVersion = cached?.version;
      const resolvedVersion =
        expectedVersion ??
        updateData.version ??
        (typeof cachedVersion === 'number'
          ? cachedVersion
          : resolveCachedItemVersion(queryClient, effectiveScope, itemId));
      return ItemsService.update(effectiveScope, itemId, updateData, resolvedVersion);
    },
    onMutate: async ({ itemId, data }) => {
      if (!itemId) return undefined;
      await queryClient.cancelQueries({ queryKey: itemKeys.all(effectiveScope) });
      await queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, itemId) });

      const previousDetail = queryClient.getQueryData(
        itemKeys.byId(effectiveScope, itemId),
      );
      const previousItemSnapshot = resolveCachedItemFromScope(
        queryClient,
        effectiveScope,
        itemId,
      );

      const { silent: _silent, ...optimisticPatch } = data;
      patchItemAcrossScopeCaches(
        queryClient,
        effectiveScope,
        itemId,
        (old) => ({
          ...mergeCachedItemWithPatch(old, optimisticPatch as Partial<Item>),
          // Keep old.version during optimistic patch to prevent 409 Conflict if mutationFn reads cache
          version: old.version,
        }),
        { membershipPatch: optimisticPatch },
      );

      return { previousDetail, previousItemSnapshot };
    },
    onSuccess: (updatedItem, variables) => {
      const targetId = variables.itemId;
      const { silent: _silent, ...rawData } = variables.data || {};
      const serverItem =
        updatedItem && typeof updatedItem === 'object' && 'item' in updatedItem && updatedItem.item
          ? (updatedItem.item as Partial<Item>)
          : (updatedItem as Partial<Item> | undefined);

      if (targetId) {
        const existingCached = resolveCachedItemFromScope(
          queryClient,
          effectiveScope,
          targetId,
        );
        const patchData = buildServerSuccessCachePatch(
          serverItem,
          rawData,
          existingCached,
        );
        patchItemAcrossScopeCaches(queryClient, effectiveScope, targetId, patchData, {
          membershipPatch: rawData,
        });
      }

      if (rawData.tags !== undefined) {
        queryClient.invalidateQueries({ queryKey: libraryKeys.tags(effectiveScope) });
      }
      if (rawData.collectionIds !== undefined || (rawData as Record<string, unknown>).collectionId !== undefined) {
        invalidateCollections(queryClient, effectiveScope);
      }

      const isMetadataOnly = isMetadataOnlyPatch(rawData);
      const isSilent =
        variables.silent !== undefined
          ? Boolean(variables.silent)
          : variables.data?.silent !== undefined
            ? Boolean(variables.data.silent)
            : isMetadataOnly;

      if (!isSilent) {
        toast.success('Item updated', { id: 'item-update' });
      }
    },
    onError: (err: Error, variables, context) => {
      const targetId = variables?.itemId;
      if (targetId && context?.previousDetail !== undefined) {
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, targetId),
          context.previousDetail,
        );
      }
      if (targetId && context?.previousItemSnapshot) {
        patchItemAcrossScopeCaches(
          queryClient,
          effectiveScope,
          targetId,
          context.previousItemSnapshot,
        );
      }
      if (!variables?.silent && !variables?.data?.silent) {
        toast.error('Failed to update item', {
          description: err.message || 'Please try again.',
          id: 'item-update',
        });
      }
    },
    onSettled: (_data, _error, variables) => {
      const targetId = variables?.itemId;
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(effectiveScope, targetId),
        });
      }
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.all(effectiveScope),
        });
        queryClient.invalidateQueries({
          queryKey: itemKeys.counts(effectiveScope),
        });
      }
    },
  });
}

export function useToggleStarItemMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async ({ id, isStarred }: { id: string; isStarred: boolean }) => {
      return StateService.updateState(effectiveScope, id, { isStarred });
    },
    onMutate: async ({ id, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.all(effectiveScope) });
      await queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, id) });
      await queryClient.cancelQueries({ queryKey: itemKeys.state(effectiveScope, id) });

      const previousItem = queryClient.getQueryData(
        itemKeys.byId(effectiveScope, id),
      );
      const previousState = queryClient.getQueryData(
        itemKeys.state(effectiveScope, id),
      );
      const cachedItem = resolveCachedItemFromScope(queryClient, effectiveScope, id);
      const previousIsStarred = cachedItem?.isStarred ?? cachedItem?.isFavorite ?? !isStarred;

      patchItemAcrossScopeCaches(queryClient, effectiveScope, id, {
        isStarred,
        isFavorite: isStarred,
      });

      queryClient.setQueryData(
        itemKeys.state(effectiveScope, id),
        (old: unknown) => {
          const s = old as Record<string, unknown> | undefined;
          if (!s) return { isStarred };
          return { ...s, isStarred };
        },
      );

      return { previousIsStarred, previousItem, previousState };
    },
    onError: (err: Error, variables, context) => {
      const rollbackStarred = context?.previousIsStarred ?? !variables.isStarred;
      patchItemAcrossScopeCaches(queryClient, effectiveScope, variables.id, {
        isStarred: rollbackStarred,
        isFavorite: rollbackStarred,
      });
      if (context?.previousItem !== undefined) {
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, variables.id),
          context.previousItem,
        );
      }
      if (context?.previousState !== undefined) {
        queryClient.setQueryData(
          itemKeys.state(effectiveScope, variables.id),
          context.previousState,
        );
      }
      toast.error('Action failed', {
        description: err?.message || 'Please try again.',
        id: 'item-star-toggle',
      });
    },
    onSuccess: (_updated, variables) => {
      patchItemAcrossScopeCaches(queryClient, effectiveScope, variables.id, {
        isStarred: variables.isStarred,
        isFavorite: variables.isStarred,
      });
      toast.success(
        variables.isStarred ? 'Added to Starred' : 'Removed from Starred',
        {
          id: 'item-star-toggle',
        },
      );
    },
    onSettled: (_data, _error, variables) => {
      if (variables?.id) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(effectiveScope, variables.id),
        });
        queryClient.invalidateQueries({
          queryKey: itemKeys.state(effectiveScope, variables.id),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
    },
  });
}

export function useImportFromUserMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (
      input: string[] | { projectId?: string; scopeId?: string; itemIds: string[] },
    ): Promise<{ success: boolean; importedCount: number }> => {
      const rawIds = Array.isArray(input) ? input : input.itemIds;
      const targetProject = Array.isArray(input)
        ? effectiveScope
        : normalizeScopeId(input.projectId || input.scopeId || effectiveScope);
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return { success: true, importedCount: 0 };
      let totalImported = 0;
      for (const chunk of chunks) {
        const res = await ItemsService.importFromUser(targetProject, chunk);
        totalImported += res?.importedCount ?? chunk.length;
      }
      return { success: true, importedCount: totalImported };
    },
    onSuccess: (_res, input) => {
      const targetProject = Array.isArray(input)
        ? effectiveScope
        : normalizeScopeId(input.projectId || input.scopeId || effectiveScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetProject) });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(targetProject) });
      invalidateCollections(queryClient, targetProject);
    },
  });
}

export type CreateLibraryItemMutationInput =
  | (Partial<Item> & Partial<CreateItemDTO> & { collectionId?: string; silent?: boolean })
  | {
      collectionId?: string;
      silent?: boolean;
      data: (Partial<Item> & Partial<CreateItemDTO> & { silent?: boolean }) | Record<string, unknown>;
    };

export function useCreateLibraryItemMutation(
  scopeId?: string,
  defaultCollectionId?: string,
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (input: CreateLibraryItemMutationInput) => {
      const hasNestedData =
        input &&
        typeof input === 'object' &&
        'data' in input &&
        input.data &&
        typeof input.data === 'object';
      const collectionId =
        (input as { collectionId?: string })?.collectionId ||
        defaultCollectionId ||
        '';
      const rawPayload = hasNestedData
        ? (input as { data: Record<string, unknown> }).data
        : (input as Record<string, unknown>);
      const { silent: _silent, collectionId: _cid, ...payload } = rawPayload;
      return ItemsService.create(effectiveScope, collectionId, payload as CreateItemDTO);
    },
    onSuccess: (newItem, variables) => {
      const targetCollection =
        newItem?.collectionIds?.[0] ||
        (variables as { collectionId?: string })?.collectionId ||
        defaultCollectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(effectiveScope, targetCollection),
        });
      }
      invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        tags: true,
        collections: true,
        counts: true,
      });
      const isSilent = Boolean(
        (variables as { silent?: boolean })?.silent ||
          ((variables as { data?: { silent?: boolean } })?.data?.silent),
      );
      if (!isSilent) {
        toast.success('Document added', {
          description: 'Added to your library.',
          id: 'library-item-create',
        });
      }
    },
    onError: (error: Error | { message?: string }, variables) => {
      const isSilent = Boolean(
        (variables as { silent?: boolean })?.silent ||
          ((variables as { data?: { silent?: boolean } })?.data?.silent),
      );
      if (!isSilent) {
        toast.error('Failed to add document', {
          description: error?.message || 'Please check your inputs and try again.',
          id: 'library-item-create',
        });
      }
    },
  });
}

export function useReResolveItemMetadataMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: ({
      itemId,
      attachOaPdf = true,
      forceRefresh = false,
    }: {
      itemId: string;
      attachOaPdf?: boolean;
      forceRefresh?: boolean;
    }) => ItemsService.reResolve(effectiveScope, itemId, { attachOaPdf, forceRefresh }),
    onSuccess: (res, variables) => {
      if (res?.item?.id) {
        patchItemAcrossScopeCaches(
          queryClient,
          effectiveScope,
          variables.itemId,
          res.item,
        );
      }
      invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemId: variables.itemId,
        itemsList: true,
        counts: true,
      });
      if (res?.oaPdfAttached) {
        toast.success('Metadata refreshed & Open Access PDF attached', {
          id: 'item-re-resolve',
        });
      } else {
        toast.success('Metadata refreshed from academic mirrors', {
          id: 'item-re-resolve',
        });
      }
    },
    onError: (err: Error) => {
      toast.error('Could not re-resolve metadata', {
        description: err.message || 'Make sure the item has a DOI, PMID, or arXiv ID.',
        id: 'item-re-resolve',
      });
    },
  });
}

export function useSetMyPublicationMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: ({
      itemId,
      isMyPublication,
      options,
    }: {
      itemId: string;
      isMyPublication: boolean;
      options?: {
        contributorId?: string | null;
        isPublic?: boolean;
        openAccessLicense?: string | null;
        includeAttachments?: boolean;
        includeNotes?: boolean;
        authorshipConfirmed?: boolean;
      };
    }) => ItemsService.setMyPublication(effectiveScope, itemId, isMyPublication, options),
    onSuccess: (_updated, variables) => {
      patchItemAcrossScopeCaches(queryClient, effectiveScope, variables.itemId, {
        isMyPublication: variables.isMyPublication,
      });
      invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemId: variables.itemId,
        itemsList: true,
        counts: true,
      });
      toast.success(
        variables.isMyPublication
          ? 'Added to My Publications'
          : 'Removed from My Publications',
        { id: 'item-my-publication' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to update My Publications status', {
        description: err.message || 'Please try again.',
        id: 'item-my-publication',
      });
    },
  });
}
