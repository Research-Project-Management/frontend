'use client';

import { useState, useMemo } from 'react';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import { useDebounce } from "@/shared/hooks";
import type { FileQueryParams } from '../services/file.service';

export function useStorageQueryParams() {
  const { typeFilter, selectedTypes, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);

  const queryParams: FileQueryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      sortBy,
      types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
    }),
    [debouncedSearch, sortBy, selectedTypes, typeFilter],
  );

  return {
    projectId: undefined,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    setSelectedItem,
    queryParams,
  };
}
