'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ItemsService, StateService } from '@/features/library/sdk';
import { getMappedItemMeta, hasExplicitUserStateInPayload, preserveMappedItemFlags, setMappedItemMeta } from '@/features/library/domain/metadata-mapper';
import type { Item, CreateItemDTO, UpdateItemDTO } from '@/features/library/domain/types/core.types';
import { itemKeys, libraryKeys, invalidateCollections, normalizeScopeId } from '@/features/library/sdk/query-keys';
import { mergeCachedItemWithPatch, preserveCachedUserReadingState, patchItemAcrossScopeCaches, resolveCachedItemFromScope, chunkUniqueIds, invalidateLibraryCatalogDependencies } from './cache-patcher';
import { doesItemMatchSystemView, isItemStarred, isItemTrashed, isItemInMyPublications, isItemUnfiled, isItemRetracted } from '@/features/library/domain/system-views.policy';

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
    preserveCachedUserReadingState(
      patchData as Record<string, unknown>,
      existingCached,
      serverItem,
    );
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
      await Promise.all([
        queryClient.cancelQueries({ queryKey: itemKeys.all(effectiveScope) }),
        queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, itemId) }),
      ]);

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
        (old) => {
          const merged = mergeCachedItemWithPatch(old, optimisticPatch as Partial<Item>);
          merged.version = old.version;
          return merged;
        },
        {
          membershipPatch: optimisticPatch,
          forceSkipMembershipInvalidation: true,
          baseItem: previousItemSnapshot,
        },
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
          baseItem: existingCached,
        });
      }

      const isLastInFlightMutation = queryClient.isMutating({ mutationKey }) <= 1;
      if (rawData.tags !== undefined && isLastInFlightMutation) {
        queryClient.invalidateQueries({ queryKey: libraryKeys.tags(effectiveScope) });
      }
      if (
        (rawData.collectionIds !== undefined ||
          (rawData as Record<string, unknown>).collectionId !== undefined) &&
        isLastInFlightMutation
      ) {
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
      if (targetId && (Boolean(_error) || !_data)) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(effectiveScope, targetId),
        });
      }
      const { silent: _silent, ...rawData } = variables?.data || {};
      const shouldInvalidateListsAndCounts =
        Boolean(_error) || !isMetadataOnlyPatch(rawData);
      if (shouldInvalidateListsAndCounts && queryClient.isMutating({ mutationKey }) <= 1) {
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
      await Promise.all([
        queryClient.cancelQueries({ queryKey: itemKeys.all(effectiveScope) }),
        queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, id) }),
        queryClient.cancelQueries({ queryKey: itemKeys.state(effectiveScope, id) }),
      ]);

      const previousItem = queryClient.getQueryData(
        itemKeys.byId(effectiveScope, id),
      );
      const previousState = queryClient.getQueryData(
        itemKeys.state(effectiveScope, id),
      );
      const cachedItem = resolveCachedItemFromScope(queryClient, effectiveScope, id);
      const previousIsStarred = cachedItem?.isStarred ?? !isStarred;

      patchItemAcrossScopeCaches(
        queryClient,
        effectiveScope,
        id,
        { isStarred },
        { forceSkipMembershipInvalidation: true },
      );

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
      });
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
      queryClient.invalidateQueries({
        queryKey: itemKeys.all(effectiveScope),
        refetchType: 'active',
      });
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
      const results = await Promise.all(
        chunks.map((chunk) => ItemsService.importFromUser(targetProject, chunk)),
      );
      const totalImported = results.reduce(
        (sum, res, idx) => sum + (res?.importedCount ?? chunks[idx].length),
        0,
      );
      return { success: true, importedCount: totalImported };
    },
    onSettled: (_res, _err, input) => {
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

export { isItemStarred };

export function isTrashQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey[2] === 'trash' || queryKey[3] === 'trash') return true;
  const params = queryKey[3];
  if (params && typeof params === 'object' && (params as { view?: unknown }).view === 'trash') {
    return true;
  }
  return false;
}

function extractNormalizedItemTags(item: Item): string[] {
  if (!Array.isArray(item.tags)) return [];
  return item.tags
    .map((t) => {
      if (typeof t === 'string') return t.trim().toLowerCase();
      if (t && typeof t === 'object' && 'name' in t && typeof (t as { name?: unknown }).name === 'string') {
        return ((t as { name: string }).name || '').trim().toLowerCase();
      }
      return '';
    })
    .filter(Boolean);
}

export function doesItemMatchQueryFilter(
  item: Item,
  params: Record<string, unknown> | undefined,
): boolean {
  if (!params || typeof params !== 'object') return true;
  const view = typeof params.view === 'string' ? params.view : undefined;
  const rec = item as Record<string, unknown>;

  if (view) {
    if (!doesItemMatchSystemView(rec, view)) return false;
    if (view === 'trash') return true;
  } else if (isItemTrashed(rec)) {
    return false;
  }
  if (Boolean(params.starred) && !isItemStarred(rec)) return false;
  if (Boolean(params.unfiled) && !isItemUnfiled(rec)) return false;

  const collectionId = typeof params.collectionId === 'string' ? params.collectionId : undefined;
  if (collectionId) {
    const colIds = Array.isArray(item.collectionIds) ? item.collectionIds : [];
    const singleColId = (item as { collectionId?: string }).collectionId;
    const expandedIds = Array.isArray(params.collectionIds) ? (params.collectionIds as string[]) : null;
    if (expandedIds && expandedIds.length > 0) {
      if (!colIds.some((c) => expandedIds.includes(c)) && (!singleColId || !expandedIds.includes(singleColId))) return false;
    } else if (params.includeSubcollections === false) {
      if (!colIds.includes(collectionId) && singleColId !== collectionId) return false;
    } else if (colIds.length === 0 && !singleColId) {
      return false;
    }
  }

  if (typeof params.tag === 'string' && params.tag.trim()) {
    const requiredTags = params.tag
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (requiredTags.length > 0 && Array.isArray(item.tags)) {
      const itemTagSet = new Set(extractNormalizedItemTags(item));
      if (!requiredTags.every((req) => itemTagSet.has(req))) return false;
    }
  }

  if (typeof params.itemType === 'string' && params.itemType.trim()) {
    const targetType = params.itemType.trim();
    const currentType = (item.itemType || (rec.type as string | undefined) || '').trim();
    if (currentType && currentType !== targetType) return false;
  }

  if (typeof params.readStatus === 'string' && params.readStatus.trim()) {
    const targetStatus = params.readStatus.trim().toLowerCase();
    const mappedTarget = targetStatus === 'read' ? 'completed' : targetStatus;
    const currentStatus = (item.readStatus || (item.isRead ? 'completed' : 'unread')).toLowerCase();
    if (currentStatus !== mappedTarget) return false;
  }

  return true;
}

export const MEMBERSHIP_MUTATION_KEYS = new Set([
  'isStarred',
  'deletedAt',
  'status',
  'readStatus',
  'isRead',
  'collectionId',
  'collectionIds',
  'isMyPublication',
  'isInMyPublications',
  'isRetracted',
  'retractionStatus',
  'itemType',
]);

export function doesPatchAffectMembership(patch?: Record<string, unknown> | null): boolean {
  if (!patch || typeof patch !== 'object') return false;
  for (const key of Object.keys(patch)) {
    if (MEMBERSHIP_MUTATION_KEYS.has(key)) return true;
  }
  return false;
}

export function isMetadataOnlyPatch(patch?: Record<string, unknown> | null): boolean {
  if (!patch || typeof patch !== 'object') return false;
  const keys = Object.keys(patch);
  if (keys.length === 0) return true;
  return !keys.some((k) => MEMBERSHIP_MUTATION_KEYS.has(k) || k === 'tags');
}

const MEMBERSHIP_STATE_EXTRACTORS: ReadonlyArray<(it: Record<string, unknown>) => unknown> = [
  isItemStarred,
  isItemTrashed,
  isItemInMyPublications,
  isItemRetracted,
  (it) => (it as { status?: string }).status ?? null,
  (it) => (it as { readStatus?: string }).readStatus ?? null,
  (it) => (it as { itemType?: string }).itemType ?? null,
  (it) => (it as { collectionId?: string }).collectionId ?? null,
];

export function hasMembershipFieldsChanged(
  oldItem: Item | null,
  updatedItem: Item,
  membershipPatch?: Record<string, unknown>,
): boolean {
  if (membershipPatch && !doesPatchAffectMembership(membershipPatch)) {
    return false;
  }
  const nextRec = updatedItem as Record<string, unknown>;
  const nextCols = Array.isArray(updatedItem.collectionIds) ? updatedItem.collectionIds : [];
  if (!oldItem) {
    return (
      nextCols.length > 0 ||
      Boolean((updatedItem as { collectionId?: string }).collectionId) ||
      isItemStarred(nextRec) ||
      isItemTrashed(nextRec) ||
      isItemInMyPublications(nextRec) ||
      isItemRetracted(nextRec)
    );
  }
  const oldRec = oldItem as Record<string, unknown>;
  if (MEMBERSHIP_STATE_EXTRACTORS.some((fn) => fn(oldRec) !== fn(nextRec))) {
    return true;
  }
  const oldCols = Array.isArray(oldItem.collectionIds) ? oldItem.collectionIds : [];
  if (oldCols.length !== nextCols.length) return true;
  const oldSet = new Set(oldCols);
  if (nextCols.some((c) => !oldSet.has(c))) return true;

  const oldTags = extractNormalizedItemTags(oldItem);
  const nextTags = extractNormalizedItemTags(updatedItem);
  if (oldTags.length !== nextTags.length) return true;
  const oldTagSet = new Set(oldTags);
  return nextTags.some((t) => !oldTagSet.has(t));
}
