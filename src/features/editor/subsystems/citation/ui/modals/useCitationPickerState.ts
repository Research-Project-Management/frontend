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
import { useEditorCitations } from '@/features/editor/subsystems/citation/ui/hooks/useCitation';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  extractCitationKeys,
  formatCitationSnippet,
  formatBibEntryToBibtex,
  formatItemToBibtex,
  parseBibtexAuthors,
  cleanBibtexTitle,
} from '@/features/editor/subsystems/citation/model/citation-formatter';
import { validateIdentifier } from '@/features/editor/subsystems/citation/model/citation.schema';
import {
  buildRetractedCitationMap,
  type RetractedItemInfo,
} from '@/features/editor/subsystems/citation/model/retracted-citations';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { pagesService } from '@/features/editor/sdk/pages.service';
import type { BibEntryDto } from '@/features/editor/sdk/pages/types';
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
import { useCitationPickerActions } from './useCitationPickerActions';
import { type CollectionNode } from '../subcomponents/CitationCollectionTreePane';

export type CitationStyle =
  | 'latex-cite'
  | 'latex-citep'
  | 'latex-citet'
  | 'latex-autocite'
  | 'markdown-bracket'
  | 'markdown-inline';

export type CitationPredicate = (entry: BibEntry) => boolean;

export const CitationSpecs = {
  all: (): CitationPredicate => () => true,
  isLibrarySource: (): CitationPredicate => (item) =>
    item.source === 'library' || item.sourceFile === 'workspace-library',
  isBibSource: (): CitationPredicate => (item) =>
    item.source === 'bib' ||
    Boolean(item.sourceFile && item.sourceFile !== 'workspace-library'),
  isCitedInDoc: (citedKeysSet: ReadonlySet<string>): CitationPredicate => (item) =>
    Boolean(item.key && citedKeysSet.has(item.key.toLowerCase())),
  isUncitedInDoc: (citedKeysSet: ReadonlySet<string>): CitationPredicate => (item) =>
    !Boolean(item.key && citedKeysSet.has(item.key.toLowerCase())),
  matchesQuery: (rawQuery: string): CitationPredicate => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return () => true;
    return (entry) => {
      const keyMatch = entry.key?.toLowerCase().includes(query);
      const titleMatch = entry.title?.toLowerCase().includes(query);
      const authorMatch = entry.authors?.some((a) => a.toLowerCase().includes(query));
      const yearMatch = entry.year?.toString().includes(query);
      const doiMatch = entry.doi?.toLowerCase().includes(query);
      const venueMatch =
        entry.journal?.toLowerCase().includes(query) ||
        entry.booktitle?.toLowerCase().includes(query) ||
        entry.publisher?.toLowerCase().includes(query);
      return Boolean(keyMatch || titleMatch || authorMatch || yearMatch || doiMatch || venueMatch);
    };
  },
} as const;

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
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const storeProjectId = usePageStore((s) => s.projectId);
  const storeSpaceId = usePageStore((s) => s.spaceId);

  const rootId = params?.pageId || storeParentPageId || currentPageId || '';
  const effectiveProjectId =
    propsProjectId ||
    params?.projectId ||
    storeProjectId ||
    currentPageProjectId ||
    storeSpaceId ||
    rootId ||
    '';
  const librarySpaceId =
    propsProjectId ||
    params?.projectId ||
    storeProjectId ||
    currentPageProjectId ||
    'user';

  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>(defaultStyle);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'default' | 'year-desc' | 'year-asc' | 'title-asc' | 'author-asc'>('default');
  const [selectedNav, setSelectedNav] = useState<string>('all');
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
    projectId: librarySpaceId,
    enabled: open,
  });

  const { collections: serverCollections = [] } = useCollections(librarySpaceId);

  const citedKeys = useMemo(() => {
    if (propsCitedKeys && propsCitedKeys.length > 0) return propsCitedKeys;
    if (!open) return [];
    const engineContent = getActiveEditorEngine()?.getContent();
    if (engineContent) return extractCitationKeys(engineContent);
    const rawContent = usePageStore.getState().currentPage?.content;
    const activeContent =
      typeof rawContent === 'string'
        ? rawContent
        : typeof rawContent === 'object' && rawContent !== null
          ? String(rawContent.source ?? rawContent.text ?? rawContent.content ?? '')
          : '';
    return extractCitationKeys(activeContent);
  }, [propsCitedKeys, open]);

  const citedKeysSet = useMemo(() => {
    return new Set(citedKeys.map((k) => k.toLowerCase()));
  }, [citedKeys]);

  const localBaseItems = useMemo<BibEntry[]>(() => {
    if (propsItems && propsItems.length > 0) {
      return propsItems;
    }

    const citationsFromIndex = latexSymbolsIndex.getCitations('');
    const mapped: BibEntry[] = citationsFromIndex.map((c) => ({
      key: c.key,
      type: c.type || 'article',
      title: cleanBibtexTitle(c.title),
      authors: parseBibtexAuthors(c.author),
      author: c.author,
      year: c.year,
      journal: c.journal,
      booktitle: c.booktitle,
      doi: c.doi,
      sourceFile: c.sourceFile,
      source: c.sourceFile === 'workspace-library' ? 'library' : 'bib',
    }));

    const indexByKey = new Map<string, number>();
    mapped.forEach((m, idx) => {
      if (m.key) indexByKey.set(m.key.toLowerCase(), idx);
    });

    for (const lib of libraryItems) {
      const k = lib.citationKey || lib.id;
      if (!k) continue;
      const lowerKey = k.toLowerCase();
      const resolvedCollectionIds = lib.collectionIds ?? [];

      const existingIdx = indexByKey.get(lowerKey);
      if (existingIdx !== undefined) {
        const existing = mapped[existingIdx];
        mapped[existingIdx] = {
          ...existing,
          title: cleanBibtexTitle(existing.title || lib.title),
          authors: parseBibtexAuthors(
            existing.authors && existing.authors.length > 0 ? existing.authors : lib.authors,
          ),
          year: existing.year || (lib.year ? String(lib.year) : undefined),
          journal: existing.journal || lib.publicationTitle,
          doi: existing.doi || lib.doi,
          url: existing.url || lib.url,
          abstract: existing.abstract || lib.abstractNote,
          collectionId: resolvedCollectionIds[0],
          collectionIds: resolvedCollectionIds.length > 0 ? resolvedCollectionIds : undefined,
        };
      } else {
        indexByKey.set(lowerKey, mapped.length);
        mapped.push({
          key: k,
          type: lib.itemType || 'article',
          title: cleanBibtexTitle(lib.title),
          authors: parseBibtexAuthors(lib.authors),
          year: lib.year ? String(lib.year) : undefined,
          journal: lib.publicationTitle,
          doi: lib.doi,
          url: lib.url,
          abstract: lib.abstractNote,
          source: 'library',
          sourceFile: 'workspace-library',
          collectionId: resolvedCollectionIds[0],
          collectionIds: resolvedCollectionIds.length > 0 ? resolvedCollectionIds : undefined,
        });
      }
    }

    return mapped;
  }, [propsItems, libraryItems]);

  useEffect(() => {
    if (open) {
      setSearch(initialQuery || '');
      setSelectedKey(initialKey || null);
      setSelectedNav('all');
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
        const results = await pagesService.citations.search(
          effectiveProjectId,
          search.trim(),
          25,
        );
        if (active && Array.isArray(results)) {
          const mapped: BibEntry[] = results.map((r: BibEntryDto) => ({
            key: r.key,
            type: r.type || 'article',
            title: cleanBibtexTitle(r.title),
            authors: parseBibtexAuthors(r.author),
            author: r.author,
            year: r.year,
            journal: r.journal,
            doi: r.doi,
            raw: r.rawBibtex,
            source: 'server',
            sourceFile: 'server',
          }));
          setServerItems((prev) => {
            const merged = new Map<string, BibEntry>();
            for (const p of prev) {
              if (p.key) merged.set(p.key.toLowerCase(), p);
            }
            for (const m of mapped) {
              if (m.key) merged.set(m.key.toLowerCase(), m);
            }
            return Array.from(merged.values());
          });
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
  }, [open, effectiveProjectId, search]);

  const allMergedItems = useMemo(() => {
    const map = new Map<string, BibEntry>();
    for (const item of localBaseItems) {
      if (item.key) map.set(item.key.toLowerCase(), item);
    }
    for (const sItem of serverItems) {
      if (sItem.key && !map.has(sItem.key.toLowerCase())) {
        map.set(sItem.key.toLowerCase(), sItem);
      }
    }
    return Array.from(map.values());
  }, [localBaseItems, serverItems]);

  const { data: retractedItems } = useRetractedItems(
    librarySpaceId === 'user' ? '' : librarySpaceId,
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

  const collectionTree = useMemo<CollectionNode[]>(() => {
    if (serverCollections && serverCollections.length > 0) {
      const map = new Map<string, CollectionNode>();
      const roots: CollectionNode[] = [];
      for (const c of serverCollections) {
        if (!c.id) continue;
        map.set(c.id, { id: c.id, name: c.name, children: [] });
      }
      for (const c of serverCollections) {
        if (!c.id) continue;
        const node = map.get(c.id)!;
        const colItem = c as typeof c & { parentId?: string; parent?: string };
        const rawParent = colItem.parentId || colItem.parent;
        if (rawParent && rawParent !== c.id && map.has(rawParent)) {
          map.get(rawParent)!.children!.push(node);
        } else {
          roots.push(node);
        }
      }
      return roots;
    }
    return [];
  }, [serverCollections]);

  const collectionNodeMap = useMemo(() => {
    const map = new Map<string, CollectionNode>();
    const traverse = (nodes: CollectionNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(collectionTree);
    return map;
  }, [collectionTree]);

  const entryMatchesCollection = useCallback(
    (entry: BibEntry, node: CollectionNode): boolean => {
      const colId = entry.collectionId;
      const colIds = entry.collectionIds;
      if (colId === node.id || colIds?.includes(node.id)) return true;
      if (node.children?.some((child) => entryMatchesCollection(entry, child))) return true;
      return false;
    },
    [],
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
          entry: (matchedLibItem ?? entry) as unknown as Record<string, unknown>,
          targetBibFile: preferredBib,
        });

        if (res.syncedCount > 0 && res.formattedBibtex) {
          const targetDocId = res.docId || res.filePath || preferredBib;
          const existingCached = res.docId ? lruDocumentCache.get(res.docId) : undefined;
          const alreadyPresent = existingCached?.content?.includes(`{${entry.key},`);
          const updatedContent =
            alreadyPresent && existingCached?.content
              ? existingCached.content
              : existingCached?.content
                ? `${existingCached.content.trim()}\n\n${res.formattedBibtex}\n`
                : `${res.formattedBibtex}\n`;
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
    setSelectedKeys(new Set([entry.key.toLowerCase()]));
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
    const newEntry = await resolveAcademicIdentifier(effectiveProjectId, search.trim());
    if (newEntry) {
      setServerItems((prev) => [newEntry, ...prev]);
      setSelectedKey(newEntry.key);
    }
  };

  return {
    effectiveProjectId,
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
