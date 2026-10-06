'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useEditorCitations } from '@/features/editor/hooks/use-citation';
import { useCitationPickerActions } from '@/features/editor/components/editor/hooks/useCitationPickerActions';
import { manuscriptService, type CitationValidationResult } from '@/features/editor/services/manuscript.service';
import { generateCitationKey } from '@/features/library';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { parseBibContent, type BibEntry } from '@/features/editor/utils/bib-parser.util';
import { extractCitationKeys, stripLatexComments } from '@/features/editor/utils/citation.util';

export interface UnifiedCitation {
  id: string;
  key: string;
  title: string;
  authorsSummary: string;
  year?: string;
  journal?: string;
  source: 'bib' | 'library';
  collectionId?: string;
}

export type CitationFilterTab = 'document' | 'library';

/**
 * Module-level parsed .bib cache to prevent re-parsing large bibliography
 * files on unrelated file edits in the project.
 */
interface CachedBibFile {
  length: number;
  sample: string;
  entries: BibEntry[];
}
const bibParseCache = new Map<string, CachedBibFile>();

export function useCitationTabState() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const { currentPage, projectId: storeProjectId } = usePageStore();
  const { engine, getContent } = useEditorInstance();

  const rootPageId = params?.pageId || params?.projectId || currentPage?.id || '';
  const projectId =
    params?.projectId ||
    storeProjectId ||
    (typeof currentPage?.projectId === 'string' ? currentPage.projectId : currentPage?.projectId?.id) ||
    '';

  const [content, setContent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<CitationFilterTab>('document');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Defer search value to keep user typing smooth at 60 FPS
  const deferredSearch = useDeferredValue(searchQuery);

  // Sync content from active editor
  const refreshContent = useCallback(() => {
    const current = getContent();
    setContent(current);
  }, [getContent]);

  // Debounced editor content listener (300ms) to prevent expensive regex passes on every keystroke
  const contentTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    refreshContent();
    if (!engine) return;
    const unsub = engine.onContentChange((val) => {
      if (contentTimerRef.current) {
        clearTimeout(contentTimerRef.current);
      }
      contentTimerRef.current = setTimeout(() => {
        setContent(val);
      }, 300);
    });
    return () => {
      unsub();
      if (contentTimerRef.current) {
        clearTimeout(contentTimerRef.current);
      }
    };
  }, [engine, refreshContent]);

  // Load project files to extract citations from any project .bib files
  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  // Fetch authoritative bibliography validation (duplicate keys, missing required fields) with caching
  const { data: citationValidation } = useQuery<CitationValidationResult | null>({
    queryKey: ['project-citation-validation', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      try {
        return await manuscriptService.citations.validate(projectId);
      } catch {
        return null;
      }
    },
    staleTime: 60_000, // 1 minute cache
    gcTime: 5 * 60_000,
    enabled: Boolean(projectId),
  });

  // Parse BibTeX entries from all .bib files with cache lookup
  const bibEntries = useMemo<BibEntry[]>(() => {
    const bibFiles = (projectFiles || []).filter((f: any) => {
      const fileName = ((f as any)?.name || f?.title || (f as any)?.filename || '').toLowerCase();
      return fileName.endsWith('.bib') && Boolean(f?.content);
    });

    const list: BibEntry[] = [];
    const seenKeys = new Set<string>();

    for (const f of bibFiles) {
      if (!f.content || typeof f.content !== 'string') continue;
      const fileId = f.id || (f as any).title || (f as any).name || 'bib-file';
      const sample = f.content.length > 200 ? f.content.slice(0, 100) + f.content.slice(-100) : f.content;
      const cached = bibParseCache.get(fileId);

      let entries: BibEntry[];
      if (cached && cached.length === f.content.length && cached.sample === sample) {
        entries = cached.entries;
      } else {
        try {
          entries = parseBibContent(f.content);
          bibParseCache.set(fileId, {
            length: f.content.length,
            sample,
            entries,
          });
        } catch {
          entries = [];
        }
      }

      for (const entry of entries) {
        const lowerKey = entry.key?.toLowerCase();
        if (lowerKey && !seenKeys.has(lowerKey)) {
          seenKeys.add(lowerKey);
          list.push(entry);
        }
      }
    }
    return list;
  }, [projectFiles]);

  // Load workspace library items
  const {
    libraryItems,
    isLoading: isLibraryLoading,
    isError: isLibraryError,
    getAuthorSummary,
  } = useEditorCitations({
    projectId,
    content,
    enabled: true,
  });

  // Merge available references across Workspace Library and project .bib files
  const allAvailableEntries = useMemo<UnifiedCitation[]>(() => {
    const map = new Map<string, UnifiedCitation>();

    // 1. Add workspace library items
    for (const item of libraryItems) {
      const key = item.citationKey || generateCitationKey(item);
      if (!key) continue;
      map.set(key.toLowerCase(), {
        id: item.id || `lib-${key}`,
        key,
        title: item.title || 'Untitled item',
        authorsSummary: getAuthorSummary(item),
        year: item.year ? String(item.year) : undefined,
        journal: item.journal || (item as any).publicationTitle,
        source: 'library',
        collectionId: (item as any).collectionId,
      });
    }

    // 2. Add / enrich with project .bib file entries
    for (const entry of bibEntries) {
      const lowerKey = entry.key?.toLowerCase();
      if (!lowerKey) continue;
      if (!map.has(lowerKey)) {
        map.set(lowerKey, {
          id: `bib-${entry.key}`,
          key: entry.key,
          title: entry.title || 'Untitled entry',
          authorsSummary:
            entry.authors && entry.authors.length > 0
              ? entry.authors.length <= 2
                ? entry.authors.join(' & ')
                : `${entry.authors[0]} et al.`
              : 'Unknown author',
          year: entry.year,
          journal: entry.journal || entry.booktitle,
          source: 'bib',
        });
      }
    }

    // 3. Add inline \bibitem entries from document content
    if (content) {
      const sanitized = stripLatexComments(content);
      const bibitemRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g;
      let bMatch: RegExpExecArray | null;
      while ((bMatch = bibitemRegex.exec(sanitized)) !== null) {
        const key = bMatch[1]?.trim();
        const lowerKey = key?.toLowerCase();
        if (lowerKey && !map.has(lowerKey)) {
          map.set(lowerKey, {
            id: `bibitem-${key}`,
            key,
            title: 'Document Bibliography Item',
            authorsSummary: 'Inline \\bibitem',
            source: 'bib',
          });
        }
      }
    }

    return Array.from(map.values());
  }, [libraryItems, bibEntries, getAuthorSummary, content]);

  // Extract cited keys from current document and classify into resolved vs missing
  const { citedEntries, missingKeys } = useMemo(() => {
    if (!content) return { citedEntries: [], missingKeys: [] };
    const docKeys = extractCitationKeys(content);
    if (docKeys.length === 0) return { citedEntries: [], missingKeys: [] };

    const availableMap = new Map<string, UnifiedCitation>();
    for (const item of allAvailableEntries) {
      availableMap.set(item.key.toLowerCase(), item);
    }

    const cited: UnifiedCitation[] = [];
    const missing: string[] = [];
    const seenKeys = new Set<string>();

    for (const key of docKeys) {
      const lower = key.toLowerCase();
      if (seenKeys.has(lower)) continue;
      seenKeys.add(lower);

      const matched = availableMap.get(lower);
      if (matched) {
        cited.push(matched);
      } else {
        missing.push(key);
      }
    }

    return { citedEntries: cited, missingKeys: missing };
  }, [content, allAvailableEntries]);

  // Filter lists based on deferred search query & collection filter
  const filteredCitedEntries = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return citedEntries;
    return citedEntries.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.authorsSummary.toLowerCase().includes(q) ||
        (item.year && item.year.includes(q)),
    );
  }, [citedEntries, deferredSearch]);

  const filteredAvailableEntries = useMemo(() => {
    let base = allAvailableEntries;
    if (selectedCollectionId) {
      base = base.filter((item) => item.collectionId === selectedCollectionId);
    }
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.authorsSummary.toLowerCase().includes(q) ||
        (item.year && item.year.includes(q)),
    );
  }, [allAvailableEntries, deferredSearch, selectedCollectionId]);

  const { copyCiteKey, insertCiteKey } = useCitationPickerActions();

  const handleCopyKey = useCallback((key: string) => {
    copyCiteKey(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, [copyCiteKey]);

  const handleInsertKey = useCallback((key: string) => {
    const matchedEntry = allAvailableEntries.find(
      (e) => e.key.toLowerCase() === key.toLowerCase(),
    );
    insertCiteKey(key, matchedEntry, engine, refreshContent);
  }, [allAvailableEntries, insertCiteKey, engine, refreshContent]);

  const openPickerModal = useCallback((initialQuery?: unknown, initialKey?: unknown) => {
    const query = typeof initialQuery === 'string' ? initialQuery : undefined;
    const key = typeof initialKey === 'string' ? initialKey : query;
    EditorEventBus.emit(
      'flux:open-citation-picker',
      query ? { initialQuery: query, initialKey: key } : undefined,
    );
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filterTab,
    setFilterTab,
    copiedKey,
    selectedCollectionId,
    setSelectedCollectionId,
    citationValidation,
    missingKeys,
    filteredCitedEntries,
    filteredAvailableEntries,
    isLibraryLoading,
    isLibraryError,
    handleCopyKey,
    handleInsertKey,
    openPickerModal,
  };
}
