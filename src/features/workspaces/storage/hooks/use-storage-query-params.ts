'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import { useDebounce } from "@/shared/hooks";
import type { FileQueryParams } from '../services/file.service';

export function useStorageQueryParams() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId?: string };
  const { typeFilter, selectedTypes, projectFilter, selectedProjects, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl);
  const workspaceId = workspace?.id || workspaceUrl || '';

  const queryParams: FileQueryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      sortBy,
      types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
      projectIds: selectedProjects.length > 0 ? selectedProjects : (projectFilter !== 'all' ? projectFilter : undefined),
    }),
    [debouncedSearch, sortBy, selectedTypes, typeFilter, selectedProjects, projectFilter],
  );

  return {
    workspaceUrl,
    workspace,
    workspaceId,
    isWorkspaceLoading,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    setSelectedItem,
    queryParams,
  };
}
