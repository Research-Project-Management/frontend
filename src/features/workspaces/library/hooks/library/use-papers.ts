'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  paperKeys,
  getCollectionPapers,
  getAllPapers,
  getPaperById,
  createPaper,
  updatePaper,
  deletePaper,
  getPaperAcademicBundle,
} from '../../services/paper.service';
import { invalidateCollections } from '../../services/collection.service';
import { libraryKeys } from '../../services/library.service';
import type {
  Paper,
  CreatePaperDTO,
  UpdatePaperDTO,
  PaperQueryParams,
} from '../../types/library.types';

// ── 1. Paper Queries & Mutations Hook ───────────────────────────────────────

export interface UsePapersOptions {
  workspaceId: string;
  collectionId?: string;
  paperId?: string;
}

export function usePapers({ workspaceId, collectionId, paperId }: UsePapersOptions) {
  const queryClient = useQueryClient();

  const allPapersQuery = useQuery({
    queryKey: paperKeys.all(workspaceId),
    queryFn: () => getAllPapers(workspaceId),
    enabled: Boolean(workspaceId),
    select: (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      return (data as any).papers || (data as any).items || (data as any).data || [];
    },
  });

  const paperByIdQuery = useQuery({
    queryKey: paperKeys.byId(workspaceId, paperId || ''),
    queryFn: () => getPaperById(workspaceId, paperId || ''),
    enabled: Boolean(workspaceId && paperId),
    select: (data) => (data as any)?.paper || (data as any)?.item || data || null,
  });

  const collectionPapersQuery = useQuery({
    queryKey: paperKeys.byCollection(workspaceId, collectionId || ''),
    queryFn: () => getCollectionPapers(workspaceId, collectionId || ''),
    enabled: Boolean(workspaceId && collectionId),
    select: (data) => {
      if (!data) return { papers: [] };
      if (Array.isArray(data)) return { papers: data };
      const papers =
        (data as any).papers || (data as any).items || (data as any).data || [];
      return { papers, collection: (data as any).collection };
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: CreatePaperDTO) =>
      createPaper(workspaceId, data.collectionId || collectionId || '', data),
    onSuccess: (_, variables) => {
      const targetCollection = variables.collectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: paperKeys.byCollection(workspaceId, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      invalidateCollections(queryClient, workspaceId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePaperDTO & { paperId: string; targetCollectionId?: string }) => {
      const { paperId, targetCollectionId, ...rest } = data;
      return updatePaper(workspaceId, paperId, rest);
    },
    onSuccess: (_, variables) => {
      const targetCollection = variables.targetCollectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: paperKeys.byCollection(workspaceId, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (data: { paperId: string; targetCollectionId?: string }) =>
      deletePaper(workspaceId, data.paperId),
    onSuccess: (_, variables) => {
      const targetCollection = variables.targetCollectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: paperKeys.byCollection(workspaceId, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      invalidateCollections(queryClient, workspaceId);
    },
  });

  return {
    state: {
      allPapers: allPapersQuery.data ?? [],
      collectionPapers: collectionPapersQuery.data,
      paperById: paperByIdQuery.data,
      isLoadingAll: allPapersQuery.isLoading,
      isLoadingCollection: collectionPapersQuery.isLoading,
      isAdding: addMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
    actions: {
      addPaper: addMutation.mutateAsync,
      updatePaper: updateMutation.mutateAsync,
      deletePaper: deleteMutation.mutateAsync,
      refetchAll: allPapersQuery.refetch,
      refetchCollection: collectionPapersQuery.refetch,
    },
  };
}

// ── 2. Single Paper Detail & Bundle Hooks ───────────────────────────────────

export function usePaper(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: paperKeys.byId(workspaceId, paperId),
    queryFn: async () => {
      const response = await getPaperById(workspaceId, paperId);
      return (response as any)?.paper || (response as any)?.item || response || null;
    },
    enabled: Boolean(workspaceId && paperId),
  });
}

export function usePaperDetail(workspaceId: string, paperId: string) {
  return usePaper(workspaceId, paperId);
}

export function usePaperAcademicBundle(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.paperBundle(workspaceId, paperId),
    queryFn: () => getPaperAcademicBundle(workspaceId, paperId),
    enabled: Boolean(workspaceId && paperId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLibraryPapers(workspaceId: string, query?: PaperQueryParams) {
  return useQuery({
    queryKey: libraryKeys.paperList(workspaceId, query),
    queryFn: () => getAllPapers(workspaceId, query),
    enabled: Boolean(workspaceId),
    staleTime: 1000 * 60 * 2,
    select: (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      return (data as any).papers || (data as any).items || (data as any).data || [];
    },
  });
}

export function useUpdatePaper(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Paper>) =>
      updatePaper(workspaceId, paperId, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      queryClient.setQueryData(libraryKeys.paperDetail(workspaceId, paperId), response);
      toast.success('Paper metadata updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update paper');
    },
  });
}

export function useDeletePaper(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paperId: string) =>
      deletePaper(workspaceId, paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      toast.success('Paper moved to trash');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete paper');
    },
  });
}

// ── 3. Table Sorting & Selection Hook ───────────────────────────────────────

export type SortField = 'title' | 'authors' | 'year' | 'journal' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface UsePaperTableOptions {
  papers: Paper[];
  initialActiveId?: string | null;
}

export function usePaperTable({ papers, initialActiveId = null }: UsePaperTableOptions) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePaperId, setActivePaperId] = useState<string | null>(initialActiveId);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === papers.length) {
        return new Set();
      }
      return new Set(papers.map((paper) => paper.id));
    });
  }, [papers]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const sortedPapers = useMemo(() => {
    return [...papers].sort((firstPaper, secondPaper) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = (firstPaper.title || '').localeCompare(secondPaper.title || '');
          break;
        case 'authors':
          comparison = (firstPaper.authors?.[0] || '').localeCompare(secondPaper.authors?.[0] || '');
          break;
        case 'year':
          comparison = Number(firstPaper.year || 0) - Number(secondPaper.year || 0);
          break;
        case 'journal':
          comparison = (firstPaper.journal || firstPaper.publisher || '').localeCompare(
            secondPaper.journal || secondPaper.publisher || '',
          );
          break;
        case 'createdAt':
          comparison =
            new Date(firstPaper.createdAt || 0).getTime() -
            new Date(secondPaper.createdAt || 0).getTime();
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [papers, sortField, sortOrder]);

  const isAllSelected = papers.length > 0 && selectedIds.size === papers.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < papers.length;

  return {
    sortedPapers,
    sortField,
    sortOrder,
    handleSort,
    selectedIds,
    activePaperId,
    setActivePaperId,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected,
    isPartiallySelected,
    selectedCount: selectedIds.size,
  };
}
