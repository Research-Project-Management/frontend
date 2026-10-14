'use client';

import { useState, useCallback, useMemo } from 'react';
import type { UseWorkItemSelectionOptions } from '../types/hook.types';

export type { UseWorkItemSelectionOptions };

export function useWorkItemSelection(options: UseWorkItemSelectionOptions = {}) {
  const { initialSelectedIds = [], onSelectionChange } = options;
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
        onSelectionChange?.(next);
        return next;
      });
    },
    [onSelectionChange]
  );

  const selectAll = useCallback(
    (allIds: string[]) => {
      setSelectedIds((prev) => {
        const isAllSelected = allIds.length > 0 && prev.length === allIds.length;
        const next = isAllSelected ? [] : allIds;
        onSelectionChange?.(next);
        return next;
      });
    },
    [onSelectionChange]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  const isSelected = useCallback(
    (id: string) => selectedSet.has(id),
    [selectedSet]
  );

  return {
    selectedIds,
    selectedSet,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount: selectedIds.length,
    hasSelection: selectedIds.length > 0,
  };
}
