/**
 * useCitationModal.ts
 *
 * Deep cockpit hook for CitationModal:
 * - Resolves Personal Space ('user' library, 'personal' / userId space) vs Project Space via useEditorScope.
 * - Unifies .bib mutations (Add to .bib, Sync Collection, DOI/arXiv Resolve, Inline Cite) with
 *   local LRU cache, mounted CodeMirror engine, latexSymbolsIndex, and file tree invalidation.
 */

import type React from 'react';
import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import {
  filesQuery,
  invalidateFileTreeQueries,
  pageKeys,
} from '@/features/editor/core/queries/document.queries';
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
import { pagesService, type BibMutationResponse } from '@/features/editor/sdk/pages.service';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import { useRetractedItems } from '@/features/library/sdk/queries/ingestion.queries';
import {
  documentFacade,
  editorCommandBus,
  getActiveEditorEngine,
  getEditorEngineForFile,
  lruDocumentCache,
  sessionCoordinator,
  useEditorScope,
  usePageStore,
  useSettingsStore,
  workspaceCoordinator,
} from '@/features/editor/core';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { resolveCitationScope } from '../model/scope';
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
  targetBibFile?: string;
}

function resolvePreferredBibFile(explicitBibFile?: string): string {
  const cleanExplicit = explicitBibFile?.trim();
  if (cleanExplicit && cleanExplicit !== 'auto') return cleanExplicit;
  const storeBib = useSettingsStore.getState().mainBibFile?.trim();
  if (storeBib && storeBib !== 'auto') return storeBib;
  return 'references.bib';
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
  targetBibFile,
}: UseCitationPickerStateOptions) {
  const queryClient = useQueryClient();
  const editorScope = useEditorScope({ projectId: propsProjectId });

  const rootId = editorScope.rootPageId;
  const { spaceId: effectiveProjectId, libraryScope } = useMemo(
    () =>
      resolveCitationScope({
        spaceType: editorScope.spaceKind,
        propProjectId: propsProjectId,
        storeProjectId: editorScope.projectId || undefined,
        storeSpaceId: editorScope.spaceId || undefined,
        pageId: rootId || undefined,
      }),
    [
      editorScope.spaceKind,
      editorScope.projectId,
      editorScope.spaceId,
      propsProjectId,
      rootId,
    ],
  );

  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>(defaultStyle);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'default' | 'year-desc' | 'year-asc' | 'title-asc' | 'author-asc'>('default');
  const [selectedNav, setSelectedNav] = useState<string>('library');
  const [serverItems, setServerItems] = useState<BibEntry[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isAddingToBib, setIsAddingToBib] = useState(false);
  const [isSyncingCollection, setIsSyncingCollection] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootId),
    enabled: Boolean(rootId) && open,
  });

  const { libraryItems = [] } = useEditorCitations({
    projectId: propsProjectId,
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
    const activeContent = extractDocumentContentString(
      usePageStore.getState().activeFilePage?.content ??
        usePageStore.getState().currentPage?.content,
    );
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
      setSelectedKeys(new Set());
      setSelectedNav('library');
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

  const { data: retractedItems } = useRetractedItems(libraryScope, open);
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
  }, [citedKeysSet, collectionNodeMap]);

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

  const reconcileServerBibMutation = useCallback(
    (res: BibMutationResponse, preferredBib: string, sourceEntries?: BibEntry[]) => {
      const mapped = mapServerBibDtos(res.entries || []);
      const entriesToSync = sourceEntries && sourceEntries.length > 0 ? sourceEntries : mapped;
      const resolvedPath = res.filePath || preferredBib;
      const cachedByPath = lruDocumentCache.findByPath(resolvedPath);
      const targetDocId = res.docId || cachedByPath?.fileId;

      if (entriesToSync.length > 0) {
        const existingText =
          (targetDocId ? lruDocumentCache.get(targetDocId)?.content : undefined) ?? '';
        const blocksToAppend: string[] = [];
        for (const item of entriesToSync) {
          if (!item.key || existingText.includes(`{${item.key},`)) continue;
          const matchedLib = libraryItems.find(
            (it) => (it.citationKey || it.id)?.toLowerCase() === item.key.toLowerCase(),
          );
          const snippet = matchedLib
            ? formatItemToBibtex(matchedLib)
            : formatBibEntryToBibtex(item);
          if (snippet) blocksToAppend.push(snippet);
        }

        const updatedContent =
          blocksToAppend.length > 0
            ? existingText.trim()
              ? `${existingText.trim()}\n\n${blocksToAppend.join('\n\n')}\n`
              : `${blocksToAppend.join('\n\n')}\n`
            : existingText;

        if (targetDocId && updatedContent) {
          sessionCoordinator.cancelPendingAutoSave(targetDocId);
          lruDocumentCache.updateContent(targetDocId, updatedContent, false);
          lruDocumentCache.markClean(targetDocId);
          getEditorEngineForFile(targetDocId)?.setContent(updatedContent);
        }
        if (updatedContent) {
          latexSymbolsIndex.indexFile(targetDocId || resolvedPath, resolvedPath, updatedContent);
        }
      }

      for (const scopeKey of [effectiveProjectId, rootId]) {
        if (scopeKey) documentFacade.clearProjectCache(scopeKey);
      }
      invalidateFileTreeQueries(queryClient, {
        parentPageId: rootId || undefined,
        pageId: rootId || undefined,
      });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({
        queryKey: ['project-citation-validation', effectiveProjectId],
      });
      queryClient.invalidateQueries({ queryKey: ['project-citations', effectiveProjectId] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      return mapped;
    },
    [effectiveProjectId, libraryItems, queryClient, rootId],
  );

  const ensureBibtexInProject = useCallback(
    async (entry: BibEntry) => {
      if (!effectiveProjectId) return;

      const preferredBib = resolvePreferredBibFile(targetBibFile);
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

      try {
        const res = await pagesService.citations.upsertEntries(effectiveProjectId, {
          entries: [matchedLibItem ?? entry],
          targetBibFile: preferredBib,
          ...(rootId ? { pageId: rootId } : {}),
        });
        reconcileServerBibMutation(res, preferredBib, [entry]);
        if (res.entries.length > 0) {
          toast.success(`Synced @${entry.key} to ${res.filePath || preferredBib}`, {
            id: `sync-bib-${entry.key}`,
          });
        }
      } catch {
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
            toast.success(
              `Synced @${entry.key} to ${getBibFileName(existingBibFile) || preferredBib}`,
              { id: `sync-bib-${entry.key}` },
            );
          }
        } else if (!existingBibFile && bibCode) {
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
    },
    [
      effectiveProjectId,
      libraryItems,
      projectFiles,
      reconcileServerBibMutation,
      rootId,
      targetBibFile,
    ],
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

  const handleSelectCard = useCallback(
    (entry: BibEntry, e?: React.MouseEvent) => {
      if (e && (e.metaKey || e.ctrlKey)) {
        toggleSelectKey(entry.key);
        return;
      }
      setSelectedKey(entry.key);
    },
    [toggleSelectKey],
  );

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

  const handleResolveIdentifier = useCallback(async () => {
    const trimmed = search.trim();
    if (!effectiveProjectId || !trimmed || isResolving) return;
    const preferredBib = resolvePreferredBibFile(targetBibFile);

    setIsResolving(true);
    try {
      const res = await pagesService.citations.resolve(
        effectiveProjectId,
        trimmed,
        preferredBib,
        rootId || undefined,
      );
      const mapped = reconcileServerBibMutation(res, preferredBib);
      const newEntry = mapped[0];
      if (newEntry?.key) {
        toast.success(`Resolved BibTeX for ${newEntry.key}`);
        setServerItems((prev) => mergeUniqueBibEntries([newEntry], prev));
        setSelectedKey(newEntry.key);
      } else {
        toast.error('Identifier could not be resolved');
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to resolve academic identifier',
      );
    } finally {
      setIsResolving(false);
    }
  }, [effectiveProjectId, isResolving, reconcileServerBibMutation, rootId, search, targetBibFile]);

  const selectedEntries = useMemo<BibEntry[]>(() => {
    if (selectedKeys.size > 0) {
      return filteredItems.filter((item) => selectedKeys.has(item.key.toLowerCase()));
    }
    return selectedEntry ? [selectedEntry] : [];
  }, [selectedKeys, filteredItems, selectedEntry]);

  const commitAddEntriesToBib = useCallback(
    async (entriesToAdd: BibEntry[]) => {
      if (entriesToAdd.length === 0 || isAddingToBib || !effectiveProjectId) return;
      const preferredBib = resolvePreferredBibFile(targetBibFile);
      setIsAddingToBib(true);
      try {
        const payloadEntries = entriesToAdd.map((entry) => ({
          key: entry.key,
          entryType: entry.type || 'article',
          title: entry.title,
          authors: entry.authors,
          year: entry.year,
          journal: entry.journal,
          booktitle: entry.booktitle,
          publisher: entry.publisher,
          doi: entry.doi,
          url: entry.url,
          abstract: entry.abstract,
        }));

        const res = await pagesService.citations.upsertEntries(effectiveProjectId, {
          entries: payloadEntries,
          targetBibFile: preferredBib,
          ...(rootId ? { pageId: rootId } : {}),
        });

        reconcileServerBibMutation(res, preferredBib, entriesToAdd);
        const count = res.entries.length;
        toast.success(count === 1 ? 'Added 1 reference' : `Added ${count} references`);
        onOpenChange(false);
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to add references to .bib',
        );
      } finally {
        setIsAddingToBib(false);
      }
    },
    [effectiveProjectId, isAddingToBib, onOpenChange, reconcileServerBibMutation, rootId, targetBibFile],
  );

  const handleAddToBib = useCallback(() => {
    if (selectedEntries.length === 0 || isAddingToBib || !effectiveProjectId) return;
    const retracted = selectedEntries.find((e) => retractedMap.has(e.key));
    if (retracted) {
      setPendingRetracted({ entry: retracted, info: retractedMap.get(retracted.key)! });
      return;
    }
    void commitAddEntriesToBib(selectedEntries);
  }, [commitAddEntriesToBib, effectiveProjectId, isAddingToBib, retractedMap, selectedEntries]);

  const handleSyncCollection = useCallback(
    async (collectionId: string) => {
      if (!collectionId || !effectiveProjectId || isSyncingCollection) return;
      const preferredBib = resolvePreferredBibFile(targetBibFile);
      setIsSyncingCollection(true);
      try {
        const res = await pagesService.citations.syncLibrary(effectiveProjectId, {
          collectionId,
          targetBibFile: preferredBib,
          ...(rootId ? { pageId: rootId } : {}),
        });
        reconcileServerBibMutation(res, preferredBib);
        const count = res.entries.length;
        if (res.conflicts && res.conflicts.length > 0) {
          toast.warning(
            `Synced ${count} references (${res.conflicts.length} conflicting citekey(s) skipped: ${res.conflicts.slice(0, 3).join(', ')})`,
          );
        } else {
          toast.success(count === 1 ? 'Synced 1 reference' : `Synced ${count} references`);
        }
        onOpenChange(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to sync collection');
      } finally {
        setIsSyncingCollection(false);
      }
    },
    [
      effectiveProjectId,
      isSyncingCollection,
      onOpenChange,
      reconcileServerBibMutation,
      rootId,
      targetBibFile,
    ],
  );

  return {
    effectiveProjectId,
    rootId,
    selectedStyle,
    setSelectedStyle,
    search,
    setSearch,
    selectedKey,
    selectedKeys,
    selectedEntries,
    toggleSelectKey,
    sortBy,
    setSortBy,
    selectedNav,
    setSelectedNav,
    isSearchingServer,
    isResolving,
    isAddingToBib,
    isSyncingCollection,
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
    handleAddToBib,
    commitAddEntriesToBib,
    handleSyncCollection,
    insertCitation,
  };
}
