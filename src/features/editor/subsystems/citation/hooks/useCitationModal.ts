/**
 * useCitationPickerState.ts
 *
 * Stateful cockpit hook and Specification predicates for CitationPickerModal.
 */

import type React from 'react';
import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { filesQuery, pageKeys } from '@/features/editor/core/queries/document.queries';
import { useEditorCitations } from './useCitation';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  extractCitationKeys,
  formatCitationSnippet,
  formatBibEntryToBibtex,
  formatItemToBibtex,
} from '../model/formatter';
import {
  CitationSpecs,
  mergeCitationSources,
  mapServerBibDtos,
  mergeUniqueBibEntries,
  type CitationStyle,
  type CitationPredicate,
} from '../model/citation-specs';
import { validateIdentifier } from '../model/schema';
import {
  buildRetractedCitationMap,
  type RetractedItemInfo,
} from '../model/retraction';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import { useRetractedItems } from '@/features/library/sdk/queries/ingestion.queries';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { getActiveEditorEngine } from '@/features/editor/core/bus/engine-registry';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { useCitationPickerActions } from './useCitationActions';
import {
  resolveCitationScope,
  PERSONAL_LIBRARY_SCOPE,
} from '../model/scope';
import {
  buildCollectionTree,
  indexCollectionNodes,
  entryMatchesCollection,
  type CollectionNode,
} from '../model/collection-tree';
export type { CollectionNode, CitationStyle, CitationPredicate };
export { CitationSpecs };

export interface UseCitationPickerStateOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: BibEntry[];
  onSelectCitation?: (snippet: string, citeKey: string, entry?: BibEntry) => void;
  defaultStyle?: CitationStyle;
  projectId?: string;
  initialQuery?: string;
  initialKey?: string;
  citedKeys?: string[];
}

export function useCitationPickerState({
  open,
  onOpenChange,
  items: propsItems,
  onSelectCitation,
  defaultStyle = 'latex-cite',
  projectId: propsProjectId,
  initialQuery = '',
  initialKey = '',
  citedKeys: propsCitedKeys,
}: UseCitationPickerStateOptions) {
  const queryClient = useQueryClient();
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const currentPageProjectId = usePageStore((s) => {
    const p = s.currentPage?.projectId;
    return typeof p === 'string' ? p : p?.id || '';
  });
  const storeRootPageId = usePageStore((s) => s.rootPageId);
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const storeProjectId = usePageStore((s) => s.projectId);
  const storeSpaceId = usePageStore((s) => s.spaceId);
  const spaceType = usePageStore((s) => s.spaceType);

  const rootId = params?.pageId || storeRootPageId || storeParentPageId || currentPageId || '';
  const { spaceId: effectiveProjectId, libraryScope } = resolveCitationScope({
    spaceType,
    propProjectId: propsProjectId,
    routeProjectId: params?.projectId,
    storeProjectId: storeProjectId || undefined,
    pageProjectId: currentPageProjectId || undefined,
    storeSpaceId: storeSpaceId || undefined,
    pageId: rootId,
  });

  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>(defaultStyle);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'default' | 'year-desc' | 'year-asc' | 'title-asc' | 'author-asc'>('default');
  const [selectedNav, setSelectedNav] = useState<string>('library');
  const [activeView, setActiveView] = useState<'tree' | 'list' | 'detail'>('list');
  const [serverItems, setServerItems] = useState<BibEntry[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const {
    isResolving,
    copyCitationSnippet,
    copyBibtex,
    copyKey,
    copyDoi,
    resolveAcademicIdentifier,
  } = useCitationPickerActions();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootId),
    enabled: Boolean(rootId) && open,
  });

  const { libraryItems = [] } = useEditorCitations({
    projectId: libraryScope,
    pageId: rootId || undefined,
    enabled: open,
  });

  const { collections: serverCollections = [] } = useCollections({
    spaceId: libraryScope,
    enabled: open,
  });

  const citedKeys = useMemo(() => {
    if (propsCitedKeys && propsCitedKeys.length > 0) return propsCitedKeys;
    if (!open) return [];
    const engineContent = getActiveEditorEngine()?.getContent();
    if (engineContent) return extractCitationKeys(engineContent);
    const activeContent = extractDocumentContentString(usePageStore.getState().currentPage?.content);
    return extractCitationKeys(activeContent);
  }, [propsCitedKeys, open]);

  const citedKeysSet = useMemo(() => {
    return new Set(citedKeys.map((k) => k.toLowerCase()));
  }, [citedKeys]);

  const localBaseItems = useMemo<BibEntry[]>(() => {
    if (propsItems && propsItems.length > 0) {
      return propsItems;
    }
    return mergeCitationSources(latexSymbolsIndex.getCitations(''), libraryItems);
  }, [propsItems, libraryItems]);

  useEffect(() => {
    if (open) {
      setSearch(initialQuery || '');
      setSelectedKey(initialKey || null);
      setSelectedNav('library');
      setActiveView(initialKey ? 'detail' : 'list');
      setServerItems([]);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }
  }, [open, initialQuery, initialKey]);

  useEffect(() => {
    if (!effectiveProjectId || !open || search.trim().length < 2) {
      setServerItems([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const res = await pagesService.citations.list(
          effectiveProjectId,
          search.trim(),
          25,
          rootId || undefined,
        );
        if (active && Array.isArray(res?.items)) {
          const mapped = mapServerBibDtos(res.items);
          setServerItems((prev) => mergeUniqueBibEntries(mapped, prev));
        }
      } catch {
        // Non-blocking fallback to local bib entries
      } finally {
        if (active) setIsSearchingServer(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, effectiveProjectId, rootId, search]);

  const allMergedItems = useMemo(
    () => mergeUniqueBibEntries(localBaseItems, serverItems),
    [localBaseItems, serverItems],
  );

  const { data: retractedItems } = useRetractedItems(
    libraryScope === PERSONAL_LIBRARY_SCOPE ? '' : libraryScope,
    open,
  );
  const retractedMap = useMemo(
    () => buildRetractedCitationMap(allMergedItems, retractedItems),
    [allMergedItems, retractedItems],
  );
  const [pendingRetracted, setPendingRetracted] = useState<{
    entry: BibEntry;
    info: RetractedItemInfo;
  } | null>(null);

  const collectionTree = useMemo<CollectionNode[]>(
    () => buildCollectionTree(serverCollections),
    [serverCollections],
  );

  const collectionNodeMap = useMemo(
    () => indexCollectionNodes(collectionTree),
    [collectionTree],
  );

  const navSpecMap = useMemo<Record<string, CitationPredicate>>(() => {
    const specs: Record<string, CitationPredicate> = {
      all: CitationSpecs.all(),
      library: CitationSpecs.isLibrarySource(),
      bib: CitationSpecs.isBibSource(),
      cited: CitationSpecs.isCitedInDoc(citedKeysSet),
    };
    for (const [id, node] of collectionNodeMap.entries()) {
      specs[id] = (entry) => entryMatchesCollection(entry, node);
    }
    return specs;
  }, [citedKeysSet, collectionNodeMap, entryMatchesCollection]);

  const navCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [navId, predicate] of Object.entries(navSpecMap)) {
      counts[navId] = allMergedItems.filter(predicate).length;
    }
    return counts;
  }, [allMergedItems, navSpecMap]);

  const navFilteredItems = useMemo(() => {
    const spec = navSpecMap[selectedNav];
    if (!spec) return allMergedItems;
    const matched = allMergedItems.filter(spec);
    if (
      matched.length === 0 &&
      selectedNav !== 'all' &&
      selectedNav !== 'library' &&
      selectedNav !== 'bib' &&
      selectedNav !== 'cited'
    ) {
      return allMergedItems;
    }
    return matched;
  }, [allMergedItems, selectedNav, navSpecMap]);

  const deferredSearch = useDeferredValue(search);

  const filteredItems = useMemo(() => {
    const querySpec = CitationSpecs.matchesQuery(deferredSearch);
    const items = navFilteredItems.filter(querySpec);

    if (sortBy === 'year-desc') {
      return [...items].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    }
    if (sortBy === 'year-asc') {
      return [...items].sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
    }
    if (sortBy === 'title-asc') {
      return [...items].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    if (sortBy === 'author-asc') {
      return [...items].sort((a, b) =>
        (a.authors?.[0] || a.author || '').localeCompare(b.authors?.[0] || b.author || ''),
      );
    }
    return items;
  }, [navFilteredItems, deferredSearch, sortBy]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedKey(null);
      return;
    }
    const exists = filteredItems.some(
      (item) => item.key.toLowerCase() === selectedKey?.toLowerCase(),
    );
    if (!exists) {
      setSelectedKey(filteredItems[0].key);
    }
  }, [filteredItems, selectedKey]);

  const selectedEntry = useMemo(() => {
    if (!selectedKey) return filteredItems[0] || null;
    return (
      allMergedItems.find((item) => item.key.toLowerCase() === selectedKey.toLowerCase()) ||
      filteredItems[0] ||
      null
    );
  }, [allMergedItems, filteredItems, selectedKey]);

  const isIdentifier = useMemo(() => validateIdentifier(search).isIdentifier, [search]);

  const ensureBibtexInProject = useCallback(
    async (entry: BibEntry) => {
      if (!effectiveProjectId) return;

      const storeBib = useSettingsStore.getState().mainBibFile;
      const preferredBib = storeBib && storeBib !== 'auto' ? storeBib : 'references.bib';

      const matchedLibItem = libraryItems.find(
        (it) => (it.citationKey || it.id)?.toLowerCase() === entry.key.toLowerCase(),
      );
      const bibCode = matchedLibItem
        ? formatItemToBibtex(matchedLibItem)
        : formatBibEntryToBibtex(entry);

      const getBibFileName = (f: (typeof projectFiles)[number]) =>
        f.title || ('name' in f && typeof f.name === 'string' ? f.name : '') || '';
      const existingBibFile =
        projectFiles.find((f) => getBibFileName(f).toLowerCase() === preferredBib.toLowerCase()) ||
        projectFiles.find((f) => getBibFileName(f).toLowerCase().endsWith('.bib'));

      if (existingBibFile && bibCode) {
        const cached = lruDocumentCache.get(existingBibFile.id);
        const existingText =
          cached?.content ?? extractDocumentContentString(existingBibFile.content) ?? '';
        if (!existingText.includes(`{${entry.key},`)) {
          const nextContent = existingText.trim()
            ? `${existingText.trim()}\n\n${bibCode}\n`
            : `${bibCode}\n`;
          lruDocumentCache.updateContent(existingBibFile.id, nextContent, true);
          sessionCoordinator.notifyContentChange(existingBibFile.id, nextContent);
          latexSymbolsIndex.indexFile(
            existingBibFile.id,
            getBibFileName(existingBibFile) || preferredBib,
            nextContent,
          );
          toast.success(`Synced @${entry.key} to ${getBibFileName(existingBibFile) || preferredBib}`, {
            id: `sync-bib-${entry.key}`,
          });
        }
      }

      try {
        const res = await pagesService.citations.upsertEntries(effectiveProjectId, {
          entries: [matchedLibItem ?? entry],
          targetBibFile: preferredBib,
          ...(rootId ? { pageId: rootId } : {}),
        });

        if (res.entries.length > 0) {
          const formattedBibtex = formatBibEntryToBibtex(entry);
          const targetDocId = res.docId || res.filePath || preferredBib;
          const existingCached = res.docId ? lruDocumentCache.get(res.docId) : undefined;
          const alreadyPresent = existingCached?.content?.includes(`{${entry.key},`);
          const updatedContent =
            alreadyPresent && existingCached?.content
              ? existingCached.content
              : existingCached?.content
                ? `${existingCached.content.trim()}\n\n${formattedBibtex}\n`
                : `${formattedBibtex}\n`;
          if (res.docId && !alreadyPresent) {
            lruDocumentCache.updateContent(res.docId, updatedContent, false);
          }
          latexSymbolsIndex.indexFile(targetDocId, res.filePath || preferredBib, updatedContent);
          toast.success(`Synced @${entry.key} to ${res.filePath || preferredBib}`, {
            id: `sync-bib-${entry.key}`,
          });
        }
      } catch {
        if (!existingBibFile && bibCode) {
          const created = await workspaceCoordinator.createFile({
            name: preferredBib,
            content: `${bibCode}\n`,
            openAfterCreate: false,
          });
          if (created?.id) {
            latexSymbolsIndex.indexFile(created.id, preferredBib, `${bibCode}\n`);
          }
          toast.success(`Synced @${entry.key} to ${preferredBib}`, {
            id: `sync-bib-${entry.key}`,
          });
        }
      }

      if (rootId) {
        queryClient.invalidateQueries({ queryKey: filesQuery(rootId).queryKey });
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['project-citation-validation', effectiveProjectId] });
      queryClient.invalidateQueries({ queryKey: ['project-citations', effectiveProjectId] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
    },
    [effectiveProjectId, libraryItems, projectFiles, rootId, queryClient],
  );

  const toggleSelectKey = useCallback((key: string) => {
    const lower = key.toLowerCase();
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
    setSelectedKey(key);
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedKeys(new Set(filteredItems.map((it) => it.key.toLowerCase())));
  }, [filteredItems]);

  const insertCitation = useCallback(
    (entriesToInsert: BibEntry | BibEntry[]) => {
      const list = Array.isArray(entriesToInsert) ? entriesToInsert : [entriesToInsert];
      if (list.length === 0) return;

      const keysString = list.map((e) => e.key).join(', ');
      const snippet = formatCitationSnippet(keysString, selectedStyle);

      if (onSelectCitation) {
        onSelectCitation(snippet, list[0].key, list[0]);
      } else {
        const engine = getActiveEditorEngine();
        if (engine) {
          engine.insertText(snippet);
          engine.focus();
        } else {
          editorCommandBus.dispatch({ type: 'editor:insert-text', text: snippet });
          editorCommandBus.dispatch({ type: 'editor:focus' });
        }

        for (const entry of list) {
          if (entry.source === 'library' || entry.sourceFile === 'workspace-library') {
            void ensureBibtexInProject(entry);
          }
        }
      }

      onOpenChange(false);
    },
    [selectedStyle, onSelectCitation, onOpenChange, ensureBibtexInProject],
  );

  const handleSelectItem = useCallback(
    (entry: BibEntry) => {
      const info = retractedMap.get(entry.key);
      if (info) {
        setPendingRetracted({ entry, info });
        return;
      }
      insertCitation(entry);
    },
    [retractedMap, insertCitation],
  );

  const handleInsertSelected = useCallback(() => {
    if (selectedKeys.size > 1) {
      const entries = allMergedItems.filter((e) => selectedKeys.has(e.key.toLowerCase()));
      const retracted = entries.find((e) => retractedMap.has(e.key));
      if (retracted) {
        const info = retractedMap.get(retracted.key)!;
        setPendingRetracted({ entry: retracted, info });
        return;
      }
      insertCitation(entries);
    } else if (selectedEntry) {
      handleSelectItem(selectedEntry);
    }
  }, [selectedKeys, allMergedItems, selectedEntry, retractedMap, insertCitation, handleSelectItem]);

  const handleSelectCard = useCallback((entry: BibEntry, e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey)) {
      toggleSelectKey(entry.key);
      return;
    }
    setSelectedKey(entry.key);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setActiveView('detail');
    }
  }, [toggleSelectKey]);

  const isLargeCardsList = filteredItems.length >= 25;
  const cardsVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 85,
    overscan: 5,
    enabled: isLargeCardsList,
  });

  const scrollToIndex = (index: number) => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${index}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currIndex = filteredItems.findIndex(
        (it) => it.key.toLowerCase() === selectedKey?.toLowerCase(),
      );
      const nextIndex = Math.min(currIndex + 1, Math.max(filteredItems.length - 1, 0));
      if (filteredItems[nextIndex]) {
        setSelectedKey(filteredItems[nextIndex].key);
        scrollToIndex(nextIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currIndex = filteredItems.findIndex(
        (it) => it.key.toLowerCase() === selectedKey?.toLowerCase(),
      );
      const prevIndex = Math.max(currIndex - 1, 0);
      if (filteredItems[prevIndex]) {
        setSelectedKey(filteredItems[prevIndex].key);
        scrollToIndex(prevIndex);
      }
    } else if (e.key === 'Enter') {
      if (selectedEntry) {
        e.preventDefault();
        handleSelectItem(selectedEntry);
      }
    }
  };

  const handleResolveIdentifier = async () => {
    if (!effectiveProjectId || !search.trim()) return;
    const newEntry = await resolveAcademicIdentifier(
      effectiveProjectId,
      search.trim(),
      undefined,
      rootId || undefined,
    );
    if (newEntry) {
      setServerItems((prev) => [newEntry, ...prev]);
      setSelectedKey(newEntry.key);
    }
  };

  return {
    effectiveProjectId,
    rootId,
    selectedStyle,
    setSelectedStyle,
    search,
    setSearch,
    selectedKey,
    selectedKeys,
    toggleSelectKey,
    selectAllFiltered,
    handleInsertSelected,
    sortBy,
    setSortBy,
    selectedNav,
    setSelectedNav,
    activeView,
    setActiveView,
    isSearchingServer,
    isResolving,
    searchInputRef,
    listRef,
    citedKeysSet,
    collectionTree,
    navCounts,
    filteredItems,
    selectedEntry,
    isIdentifier,
    pendingRetracted,
    setPendingRetracted,
    isLargeCardsList,
    cardsVirtualizer,
    handleSelectItem,
    handleSelectCard,
    handleKeyDown,
    handleResolveIdentifier,
    insertCitation,
    copyCitationSnippet,
    copyBibtex,
    copyKey,
    copyDoi,
  };
}
