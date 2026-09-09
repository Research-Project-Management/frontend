'use client';

import { useMemo, useCallback } from 'react';
import { useViewItems } from '@/features/workspaces/library/hooks/use-items';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';
import {
  extractCitationKeys,
  formatCitationSnippet,
  formatItemAuthorSummary,
} from '../utils/citation.util';

export interface UseEditorCitationsOptions {
  workspaceId: string;
  content?: string;
  enabled?: boolean;
}

export interface UseEditorCitationsResult {
  libraryItems: CatalogItem[];
  citedItems: CatalogItem[];
  missingKeys: string[];
  documentKeys: string[];
  isLoading: boolean;
  isError: boolean;
  formatSnippet: (
    key: string,
    style?: 'latex-cite' | 'latex-citep' | 'latex-citet' | 'markdown-bracket' | 'markdown-inline',
  ) => string;
  getAuthorSummary: (item: CatalogItem) => string;
  searchLibrary: (query: string) => CatalogItem[];
}

export function useEditorCitations({
  workspaceId,
  content = '',
  enabled = true,
}: UseEditorCitationsOptions): UseEditorCitationsResult {
  const { data, isLoading, isError } = useViewItems(workspaceId, 'all');
  const libraryItems: CatalogItem[] = useMemo(() => data?.items ?? [], [data?.items]);

  const documentKeys = useMemo(() => {
    if (!content || !enabled) return [];
    return extractCitationKeys(content);
  }, [content, enabled]);

  const itemKeyMap = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of libraryItems) {
      if (item.citationKey) {
        map.set(item.citationKey.toLowerCase(), item);
      }
    }
    return map;
  }, [libraryItems]);

  const { citedItems, missingKeys } = useMemo(() => {
    const cited: CatalogItem[] = [];
    const missing: string[] = [];
    const seenItemIds = new Set<string>();

    for (const key of documentKeys) {
      const matched = itemKeyMap.get(key.toLowerCase());
      if (matched) {
        if (matched.id && !seenItemIds.has(matched.id)) {
          seenItemIds.add(matched.id);
          cited.push(matched);
        }
      } else {
        missing.push(key);
      }
    }

    return { citedItems: cited, missingKeys: missing };
  }, [documentKeys, itemKeyMap]);

  const searchLibrary = useCallback(
    (query: string): CatalogItem[] => {
      const q = query.trim().toLowerCase();
      if (!q) return libraryItems;

      return libraryItems.filter((item) => {
        if (item.citationKey?.toLowerCase().includes(q)) return true;
        if (item.title?.toLowerCase().includes(q)) return true;
        if (item.authors?.some((a) => a.toLowerCase().includes(q))) return true;
        if (item.year && String(item.year).includes(q)) return true;
        if (item.journal?.toLowerCase().includes(q)) return true;
        if (item.doi?.toLowerCase().includes(q)) return true;
        return false;
      });
    },
    [libraryItems],
  );

  return {
    libraryItems,
    citedItems,
    missingKeys,
    documentKeys,
    isLoading,
    isError,
    formatSnippet: formatCitationSnippet,
    getAuthorSummary: formatItemAuthorSummary,
    searchLibrary,
  };
}
