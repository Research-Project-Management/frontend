'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  inspectItemDifferences,
  aggregateItemAssets,
  selectBestMasterItemId,
  mergeZoteroExtraFields,
  normalizeCompareValue,
  type FieldOptionValue,
} from '@/features/library/domain/diff';
import type { Item } from '@/features/library/domain/types/library.types';

/**
 * Shared state and diff computation hook for duplicate merging
 * (used by both DuplicateMergeInspector and MergeModal).
 */
export function useDuplicateMergeState(
  items: Item[],
  serverRecommendedMasterId?: string | null,
) {
  const recommendedMasterId = useMemo(() => {
    if (
      serverRecommendedMasterId &&
      items.some((i) => i.id === serverRecommendedMasterId)
    ) {
      return serverRecommendedMasterId;
    }
    return selectBestMasterItemId(items) || items[0]?.id || '';
  }, [items, serverRecommendedMasterId]);

  const [selectedMasterId, setSelectedMasterId] = useState<string>(
    () => recommendedMasterId,
  );
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, unknown>>({});
  const [showConflictsOnly, setShowConflictsOnly] = useState<boolean>(false);

  // Sync master when items change and current master is no longer in the list
  useEffect(() => {
    if (items.length > 0 && !items.some((i) => i.id === selectedMasterId)) {
      const nextMasterId = recommendedMasterId || items[0].id;
      setSelectedMasterId(nextMasterId);
      setFieldOverrides({});
    }
  }, [items, selectedMasterId, recommendedMasterId]);

  const masterPaper = useMemo(
    () => items.find((p) => p.id === selectedMasterId) || items[0],
    [items, selectedMasterId],
  );

  const inspection = useMemo(
    () => inspectItemDifferences(items, selectedMasterId),
    [items, selectedMasterId],
  );

  const assetsSummary = useMemo(() => aggregateItemAssets(items), [items]);

  const itemTypes = useMemo(
    () => Array.from(new Set(items.map((i) => i.itemType).filter(Boolean))),
    [items],
  );
  const hasTypeMismatch = itemTypes.length > 1;

  const effectiveItemType = useMemo(
    () =>
      (fieldOverrides.itemType as string | undefined) ||
      masterPaper?.itemType ||
      'journalArticle',
    [fieldOverrides.itemType, masterPaper?.itemType],
  );

  const mergedExtraDefault = useMemo(() => {
    if (!masterPaper) return undefined;
    const mergedExtra = mergeZoteroExtraFields(items, masterPaper.id);
    const masterExtra =
      typeof masterPaper.extra === 'string'
        ? masterPaper.extra.trim()
        : typeof (masterPaper.extraFields as Record<string, unknown> | undefined)?.extra === 'string'
          ? String((masterPaper.extraFields as Record<string, unknown>).extra).trim()
          : '';
    return mergedExtra && mergedExtra !== masterExtra ? mergedExtra : undefined;
  }, [items, masterPaper]);

  const resolvedFieldOverrides = useMemo(() => {
    const out: Record<string, unknown> = { ...fieldOverrides };
    if (hasTypeMismatch && !out.itemType) {
      out.itemType = effectiveItemType;
    }
    if (!('extra' in out) && mergedExtraDefault) {
      out.extra = mergedExtraDefault;
    }
    return out;
  }, [fieldOverrides, hasTypeMismatch, effectiveItemType, mergedExtraDefault]);

  const getEffectiveMergeSelections = useCallback(
    () => ({ ...resolvedFieldOverrides }),
    [resolvedFieldOverrides],
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
          normalizeCompareValue(option.rawValue) === normalizeCompareValue(masterVal);
        if (isSameAsMaster) {
          const copy = { ...prev };
          delete copy[fieldKey];
          return copy;
        }
        return {
          ...prev,
          [fieldKey]: option.rawValue,
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

  return {
    selectedMasterId,
    recommendedMasterId,
    setSelectedMasterId,
    fieldOverrides,
    resolvedFieldOverrides,
    getEffectiveMergeSelections,
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
  };
}
