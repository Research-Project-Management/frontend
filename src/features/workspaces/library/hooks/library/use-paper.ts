'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Paper } from '../../types/library.types';

export type SortField = 'title' | 'authors' | 'year' | 'journal' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

interface UsePaperOptions {
  papers: Paper[];
  initialActiveId?: string | null;
}

export function usePaper({ papers, initialActiveId = null }: UsePaperOptions) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePaperId, setActivePaperId] = useState<string | null>(initialActiveId);

  // Sorting Handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  // Multi-selection Handlers
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
      return new Set(papers.map((p) => p.id));
    });
  }, [papers]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Sorted papers
  const sortedPapers = useMemo(() => {
    return [...papers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'authors':
          comparison = (a.authors?.[0] || '').localeCompare(b.authors?.[0] || '');
          break;
        case 'year':
          comparison = Number(a.year || 0) - Number(b.year || 0);
          break;
        case 'journal':
          comparison = (a.journal || a.publisher || '').localeCompare(b.journal || b.publisher || '');
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
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

export default usePaper;
