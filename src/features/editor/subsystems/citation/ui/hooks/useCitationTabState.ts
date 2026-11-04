'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  usePageStore,
  editorCommandBus,
} from '@/features/editor/core';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { useEditorCitations } from '@/features/editor/subsystems/citation/ui/hooks/useCitation';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { type CitationValidationResult, type BibEntryDto } from '@/features/editor/sdk/manuscript/types';
import { generateCitationKey } from '@/features/library/domain/citations';
import { type BibEntry } from '@/features/editor/domain/latex/bib-parser';
import {
  extractCitationKeys,
  formatBibEntryAuthorSummary,
} from '@/features/editor/subsystems/citation/model/citation-formatter';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';

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

export function useCitationTabState() {
  const queryClient = useQueryClient();
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const currentPageProjectId = usePageStore((s) => extractProjectId(s.currentPage));
  const activeFilePath = usePageStore((s) => {
    const p = s.currentPage as { path?: string; filePath?: string; title?: string; name?: string } | null;
    return p?.path || p?.filePath || p?.title || '';
  });
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const storeProjectId = usePageStore((s) => s.projectId);
  const { engine, getContent } = useEditorInstance();

  const rootPageId = params?.pageId || storeParentPageId || currentPageId || params?.projectId || '';
  const projectId = params?.projectId || storeProjectId || currentPageProjectId || rootPageId || '';

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
    const unsub = engine.onContentChange((val: string) => {
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

  useEffect(() => {
    const handleClearBibCache = () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['project-citations', projectId] });
      }
      refreshContent();
    };
    return editorCommandBus.subscribe('filetree:updated', handleClearBibCache);
  }, [projectId, queryClient, refreshContent]);

  // Fetch authoritative project .bib citations from backend
  const { data: serverBibEntries = [] } = useQuery<BibEntryDto[]>({
    queryKey: ['project-citations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await manuscriptService.citations.list(projectId, 500);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: Boolean(projectId),
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
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: Boolean(projectId),
  });

  // Merge backend BibTeX entries with any unsaved local symbols index entries
  const bibEntries = useMemo<BibEntry[]>(() => {
    const list: BibEntry[] = [];
    const seenKeys = new Set<string>();

    for (const dto of serverBibEntries) {
      const lowerKey = dto.key?.toLowerCase();
      if (lowerKey && !seenKeys.has(lowerKey)) {
        seenKeys.add(lowerKey);
        const rawAuthor = dto.author || dto.authorsDisplay;
        list.push({
          key: dto.key,
          type: dto.entryType || dto.type || 'article',
          title: dto.title,
          author: rawAuthor,
          authors: dto.authors || (rawAuthor ? rawAuthor.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean) : undefined),
          year: dto.year,
          journal: dto.journal,
          doi: dto.doi,
          raw: dto.rawBibtex,
          source: 'bib',
          sourceFile: 'references.bib',
        });
      }
    }

    for (const sym of latexSymbolsIndex.getCitations('')) {
      const lowerKey = sym.key?.toLowerCase();
      if (lowerKey && !seenKeys.has(lowerKey) && sym.sourceFile !== 'workspace-library') {
        seenKeys.add(lowerKey);
        list.push({
          key: sym.key,
          type: sym.type || 'article',
          title: sym.title,
          author: sym.author,
          authors: sym.author ? [sym.author] : undefined,
          year: sym.year,
          journal: sym.journal,
          booktitle: sym.booktitle,
          doi: sym.doi,
          source: 'bib',
          sourceFile: sym.sourceFile,
        });
      }
    }

    return list;
  }, [serverBibEntries, content]);

  // Load workspace library items
  const {
    libraryItems,
    citedItems,
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
        journal: item.publicationTitle,
        source: 'library',
        collectionId: item.collectionIds?.[0],
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
          authorsSummary: formatBibEntryAuthorSummary(entry),
          year: entry.year,
          journal: entry.journal || entry.booktitle,
          source: 'bib',
        });
      }
    }

    return Array.from(map.values());
  }, [libraryItems, bibEntries, getAuthorSummary]);

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

  const handleCopyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(`\\cite{${key}}`);
    toast.success(`Copied \\cite{${key}} to clipboard`, { id: 'copy-citation-key' });
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  const handleInsertKey = useCallback((key: string) => {
    const matchedEntry = allAvailableEntries.find(
      (e) => e.key.toLowerCase() === key.toLowerCase(),
    );
    const entryPayload = matchedEntry
      ? {
          key: matchedEntry.key,
          title: matchedEntry.title,
          year: matchedEntry.year,
          journal: matchedEntry.journal,
          source: matchedEntry.source,
        }
      : undefined;

    if (engine) {
      engine.insertText(`\\cite{${key}}`);
      engine.focus();
      if (refreshContent) refreshContent();
      editorCommandBus.dispatch({
        type: 'editor:insert-citation',
        bibKey: key,
        textInserted: true,
        entry: entryPayload,
      });
      return;
    }

    editorCommandBus.dispatch({
      type: 'editor:insert-citation',
      bibKey: key,
      textInserted: false,
      entry: entryPayload,
    });
  }, [allAvailableEntries, engine, refreshContent]);

  const openPickerModal = useCallback((initialQuery?: unknown, initialKey?: unknown) => {
    const query = typeof initialQuery === 'string' ? initialQuery : undefined;
    const key = typeof initialKey === 'string' ? initialKey : query;
    editorCommandBus.dispatch({
      type: 'dialog:open',
      dialog: 'citation-picker',
      payload: query ? { initialQuery: query, initialKey: key } : undefined,
    });
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
    citedEntries,
    citedItems,
    filteredCitedEntries,
    filteredAvailableEntries,
    isLibraryLoading,
    isLibraryError,
    handleCopyKey,
    handleInsertKey,
    openPickerModal,
    projectId,
    activeFilePath,
    engine,
    getContent,
    refreshContent,
  };
}
