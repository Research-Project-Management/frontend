'use client';

import { useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  inspectItemDifferences,
  aggregateItemAssets,
  selectBestMasterItemId,
  resolveDuplicateMergeFieldOverrides,
  extractExplicitUserMergeOverrides,
  normalizeCompareValue,
  getMergeableFieldsForTypes,
  isFieldEmpty,
  type FieldOptionValue,
} from '@/features/library/domain/diff';
import type { Item } from '@/features/library/domain/types/library.types';
import {
  useLibraryCommandStore,
  createMergeDuplicatesCommand,
} from '@/features/library/core/manager/library-command.manager';
import {
  type DuplicateGroupMergeDraft,
  groupMergeDraftCache,
  getGroupMergeDraft,
  setGroupMergeDraft,
  clearGroupMergeDraft,
  computeDuplicateSetKey,
  getDeterministicDuplicateGroupKey,
  getOrInitDraft,
  updateGroupDraft,
  subscribeToDrafts,
} from '@/features/library/core/store/curation-draft.store';

export {
  type DuplicateGroupMergeDraft,
  groupMergeDraftCache,
  getGroupMergeDraft,
  setGroupMergeDraft,
  clearGroupMergeDraft,
  computeDuplicateSetKey,
  getDeterministicDuplicateGroupKey,
};

export interface ExecuteDuplicateMergeWithCommandOptions {
  masterPaper: Item;
  mergedFields: Record<string, unknown>;
  duplicateIdsToDelete: string[];
  effectiveScopeId: string;
  resolveCachedItem: (itemId: string, scopeId?: string) => Item | null | undefined;
  executeCommand: ReturnType<typeof useLibraryCommandStore.getState>['executeCommand'];
  mergeMutation: {
    mutateAsync: (payload: {
      primaryItemId: string;
      duplicateItemIds: string[];
      mergedFields?: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  restoreMutation: {
    mutateAsync: (ids: string[]) => Promise<unknown>;
  };
  updateItemMutation: {
    mutateAsync: (payload: {
      itemId: string;
      data: Record<string, unknown>;
      silent?: boolean;
    }) => Promise<unknown>;
  };
  invalidateScopeItemsAndCounts: (scopeId?: string) => Promise<void> | void;
}

export async function executeDuplicateMergeWithCommand({
  masterPaper,
  mergedFields,
  duplicateIdsToDelete,
  effectiveScopeId,
  resolveCachedItem,
  executeCommand,
  mergeMutation,
  restoreMutation,
  updateItemMutation,
  invalidateScopeItemsAndCounts,
}: ExecuteDuplicateMergeWithCommandOptions): Promise<void> {
  const cachedPrimary = resolveCachedItem(masterPaper.id, effectiveScopeId);
  const snapshotPrimary: Item = cachedPrimary
    ? { ...masterPaper, ...cachedPrimary }
    : masterPaper;

  await executeCommand(
    createMergeDuplicatesCommand({
      primaryItem: snapshotPrimary,
      duplicateIdsToDelete,
      mergedFields,
      mergeMutation: { mutateAsync: mergeMutation.mutateAsync },
      restoreMutation: { mutateAsync: restoreMutation.mutateAsync },
      updateItemMutation: {
        mutateAsync: ({ itemId, data, silent }) =>
          updateItemMutation.mutateAsync({ itemId, data, silent }),
      },
      onUndone: () => {
        void invalidateScopeItemsAndCounts(effectiveScopeId);
      },
    }),
    { silentToast: false },
  );
}

/**
 * Shared state and diff computation hook for duplicate merging
 * (used by both DuplicateMergeInspector and MergeModal).
 * Persists draft selections per duplicate group set so opening MergeModal
 * from DuplicateMergeInspector (and vice versa) preserves master & field overrides.
 */
export function useDuplicateMergeState(
  items: Item[],
  serverRecommendedMasterId?: string | null,
) {
  const setKey = useMemo(() => computeDuplicateSetKey(items), [items]);

  const recommendedMasterId = useMemo(() => {
    if (
      serverRecommendedMasterId &&
      items.some((i) => i.id === serverRecommendedMasterId)
    ) {
      return serverRecommendedMasterId;
    }
    return selectBestMasterItemId(items) || items[0]?.id || '';
  }, [items, serverRecommendedMasterId]);

  const draft = useSyncExternalStore(
    subscribeToDrafts,
    () => getOrInitDraft(setKey, recommendedMasterId),
    () => getOrInitDraft(setKey, recommendedMasterId),
  );

  const selectedMasterId = draft.selectedMasterId || recommendedMasterId;
  const fieldOverrides = draft.fieldOverrides;
  const showConflictsOnly = draft.showConflictsOnly;

  const setSelectedMasterId = useCallback(
    (value: string | ((prev: string) => string)) => {
      updateGroupDraft(
        setKey,
        (prev) => ({
          ...prev,
          selectedMasterId:
            typeof value === 'function' ? value(prev.selectedMasterId) : value,
        }),
        recommendedMasterId,
      );
    },
    [setKey, recommendedMasterId],
  );

  const setFieldOverrides = useCallback(
    (
      value:
        | Record<string, unknown>
        | ((prev: Record<string, unknown>) => Record<string, unknown>),
    ) => {
      updateGroupDraft(
        setKey,
        (prev) => ({
          ...prev,
          fieldOverrides:
            typeof value === 'function' ? value(prev.fieldOverrides) : value,
        }),
        recommendedMasterId,
      );
    },
    [setKey, recommendedMasterId],
  );

  const setShowConflictsOnly = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      updateGroupDraft(
        setKey,
        (prev) => ({
          ...prev,
          showConflictsOnly:
            typeof value === 'function' ? value(prev.showConflictsOnly) : value,
        }),
        recommendedMasterId,
      );
    },
    [setKey, recommendedMasterId],
  );

  // Sync master when items change and current master is no longer in the list
  useEffect(() => {
    if (items.length > 0 && !items.some((i) => i.id === selectedMasterId)) {
      const nextMasterId = recommendedMasterId || items[0].id;
      updateGroupDraft(
        setKey,
        (prev) => ({
          ...prev,
          selectedMasterId: nextMasterId,
          fieldOverrides: {},
        }),
        recommendedMasterId,
      );
    }
  }, [items, selectedMasterId, recommendedMasterId, setKey]);

  const masterPaper = useMemo(
    () => items.find((p) => p.id === selectedMasterId) || items[0],
    [items, selectedMasterId],
  );

  const itemTypes = useMemo(
    () => Array.from(new Set(items.map((i) => i.itemType).filter(Boolean))),
    [items],
  );
  const hasTypeMismatch = itemTypes.length > 1;

  const mergeableFields = useMemo(
    () => getMergeableFieldsForTypes(itemTypes),
    [itemTypes],
  );

  const inspection = useMemo(
    () => inspectItemDifferences(items, selectedMasterId, mergeableFields),
    [items, selectedMasterId, mergeableFields],
  );

  const assetsSummary = useMemo(() => aggregateItemAssets(items), [items]);

  const effectiveItemType = useMemo(
    () =>
      (fieldOverrides.itemType as string | undefined) ||
      masterPaper?.itemType ||
      'journalArticle',
    [fieldOverrides.itemType, masterPaper?.itemType],
  );

  const resolvedFieldOverrides = useMemo(
    () =>
      resolveDuplicateMergeFieldOverrides(
        items,
        masterPaper?.id || selectedMasterId,
        fieldOverrides,
        {
          inspection,
          includeUnchangedMasterFields: false,
        },
      ),
    [items, masterPaper?.id, selectedMasterId, fieldOverrides, inspection],
  );

  const explicitMergeOverrides = useMemo(
    () =>
      extractExplicitUserMergeOverrides(
        items,
        masterPaper?.id || selectedMasterId,
        fieldOverrides,
        {
          inspection,
        },
      ),
    [items, masterPaper?.id, selectedMasterId, fieldOverrides, inspection],
  );

  const getEffectiveMergeSelections = useCallback(
    () => ({ ...resolvedFieldOverrides }),
    [resolvedFieldOverrides],
  );

  const getExplicitMergeSelections = useCallback(
    () => ({ ...explicitMergeOverrides }),
    [explicitMergeOverrides],
  );

  const visibleFields = useMemo(() => {
    if (!showConflictsOnly) return inspection.fields;
    return inspection.fields.filter((f) => f.hasConflict);
  }, [inspection.fields, showConflictsOnly]);

  const handleSelectMaster = useCallback((newMasterId: string) => {
    setSelectedMasterId(newMasterId);
    setFieldOverrides({});
  }, []);

  const handleSelectFieldValue = useCallback(
    (fieldKey: string, option: FieldOptionValue) => {
      setFieldOverrides((prev) => {
        const masterField = inspection.fields.find((f) => f.key === fieldKey);
        const masterVal = masterField?.masterValue
          ? masterField.masterValue.rawValue
          : masterPaper
            ? (masterPaper as Record<string, unknown>)[fieldKey]
            : undefined;
        const isSameAsMaster =
          option.rawValue === masterVal ||
          normalizeCompareValue(option.rawValue, fieldKey) ===
            normalizeCompareValue(masterVal, fieldKey);
        if (isSameAsMaster && masterField?.status !== 'MISSING_IN_MASTER') {
          const copy = { ...prev };
          delete copy[fieldKey];
          return copy;
        }
        const isEmptySelection =
          option.isEmpty || option.rawValue === undefined || option.rawValue === '';
        return {
          ...prev,
          [fieldKey]:
            isSameAsMaster && masterField?.status === 'MISSING_IN_MASTER'
              ? null
              : isEmptySelection
                ? Array.isArray(option.rawValue)
                  ? []
                  : ''
                : option.rawValue,
        };
      });
    },
    [inspection.fields, masterPaper],
  );

  const handleAutoRecommend = useCallback(() => {
    const newOverrides: Record<string, unknown> = {};
    for (const field of inspection.fields) {
      if (field.key === 'extra') continue;
      if (field.hasConflict && field.recommendedItemId !== selectedMasterId) {
        const bestOpt = field.options.find((o) => o.itemId === field.recommendedItemId);
        if (bestOpt && !bestOpt.isEmpty) {
          newOverrides[field.key] = bestOpt.rawValue;
        }
      }
    }
    setFieldOverrides(newOverrides);
  }, [inspection.fields, selectedMasterId]);

  const resetMergeState = useCallback(
    (defaultMasterId = '') => {
      const targetMasterId =
        defaultMasterId ||
        (serverRecommendedMasterId &&
        items.some((i) => i.id === serverRecommendedMasterId)
          ? serverRecommendedMasterId
          : selectBestMasterItemId(items)) ||
        items[0]?.id ||
        '';
      setSelectedMasterId(targetMasterId);
      setFieldOverrides({});
    },
    [items, serverRecommendedMasterId],
  );

  const clearDraft = useCallback(() => {
    clearGroupMergeDraft(setKey);
  }, [setKey]);

  return {
    selectedMasterId,
    recommendedMasterId,
    setSelectedMasterId,
    fieldOverrides,
    resolvedFieldOverrides,
    explicitMergeOverrides,
    getEffectiveMergeSelections,
    getExplicitMergeSelections,
    effectiveItemType,
    setFieldOverrides,
    showConflictsOnly,
    setShowConflictsOnly,
    masterPaper,
    inspection,
    assetsSummary,
    itemTypes,
    hasTypeMismatch,
    visibleFields,
    handleSelectMaster,
    handleSelectFieldValue,
    handleAutoRecommend,
    resetMergeState,
    clearDraft,
  };
}
