'use client';

/**
 * CitationPickerModal.tsx
 *
 * Comprehensive 3-Column Academic Reference Cockpit & Inserter Modal.
 * Location: `features/editor/ui/modals/citation-picker/CitationPickerModal.tsx`
 *
 * Architecture & Features:
 * - 3-Column Cockpit Layout:
 *   - Column 1: Library Directory Tree (All References, In Document, Workspace Library, Project .bib, Collections Tree)
 *   - Column 2: Reference Cards List (Instant search, DOI/arXiv identifier resolver, virtualized cards, cited badges)
 *   - Column 3: Reference Details & Inspector (Title, authors, venue, DOI/URL links, citekey copy, macro dropdown, abstract, BibTeX)
 * - Retraction-Aware (Zotero parity): Warns before inserting citations to retracted papers
 * - Overleaf Parity Auto-Sync: Automatically syncs library references to references.bib when cited
 * - Dual Mode: Operates standalone (with autonomous state resolution) or with explicit props.
 */

import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Dialog, DialogContent, DialogTitle, DialogClose, } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Search, X, Loader2, Check, SearchX, Binary, } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { filesQuery, pageKeys } from '@/features/editor/ui/hooks/document.queries';
import { useEditorCitations } from '@/features/editor/subsystems/citation/ui/hooks/useCitation';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  extractCitationKeys, formatCitationSnippet, formatBibEntryToBibtex, formatItemToBibtex, } from '@/features/editor/subsystems/citation/model/citation-formatter';
import { validateAcademicIdentifier } from '@/features/editor/subsystems/citation/model/citation.schema';
import {
  buildRetractedCitationMap, type RetractedItemInfo, } from '@/features/editor/subsystems/citation/model/retracted-citations';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import type { BibEntryDto } from '@/features/editor/sdk/manuscript/types';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import { useRetractedItems } from '@/features/library/sdk/queries/ingestion.queries';
import {
  getActiveEditorEngine,
  editorCommandBus,
  workspaceCoordinator,
  sessionCoordinator,
  usePageStore,
  useSettingsStore,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { toast } from 'sonner';
import { useCitationPickerActions } from './useCitationPickerActions';
import { CitationPickerCard } from './CitationPickerCard';
import {
  CitationCollectionTreePane,
  type CollectionNode,
} from '../subcomponents/CitationCollectionTreePane';
import { CitationInspectorPane } from '../subcomponents/CitationInspectorPane';
import { CitationRetractionAlertDialog } from '../subcomponents/CitationRetractionAlertDialog';

export type CitationStyle =
  | 'latex-cite'
  | 'latex-citep'
  | 'latex-citet'
  | 'latex-autocite'
  | 'markdown-bracket'
  | 'markdown-inline';

export interface CitationPickerModalProps {
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

export default function CitationPickerModal({
  open,
  onOpenChange,
  items: propsItems,
  onSelectCitation,
  defaultStyle = 'latex-cite',
  projectId: propsProjectId,
  initialQuery = '',
  initialKey = '',
  citedKeys: propsCitedKeys,
}: CitationPickerModalProps) {
  // Contextual project and document resolution
  const queryClient = useQueryClient();
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const currentPageProjectId = usePageStore((s) => {
    const p = s.currentPage?.projectId;
    return typeof p === 'string' ? p : p?.id || '';
  });
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const storeProjectId = usePageStore((s) => s.projectId);

  const rootId = params?.pageId || storeParentPageId || currentPageId || '';
  const effectiveProjectId =
    propsProjectId ||
    params?.projectId ||
    storeProjectId ||
    currentPageProjectId ||
    '';

  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>(defaultStyle);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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

  // 1. Load project files to identify .bib files
  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootId),
    enabled: Boolean(rootId) && open,
  });

  // 2. Load workspace library items
  const { libraryItems = [] } = useEditorCitations({
    projectId: effectiveProjectId,
    enabled: open,
  });

  // 3. Query collections from backend
  const { collections: serverCollections = [] } = useCollections(effectiveProjectId || 'user');

  // 4. Resolve cited keys from document text if not explicitly provided (only when modal is open or propsCitedKeys passed)
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

  // 5. Gather all local parsed citations (from props or latexSymbolsIndex + library)
  const localBaseItems = useMemo<BibEntry[]>(() => {
    if (propsItems && propsItems.length > 0) {
      return propsItems;
    }

    const citationsFromIndex = latexSymbolsIndex.getCitations('');
    const mapped: BibEntry[] = citationsFromIndex.map((c) => ({
      key: c.key,
      type: c.type || 'article',
      title: c.title,
      authors: c.author ? [c.author] : undefined,
      year: c.year,
      journal: c.journal,
      booktitle: c.booktitle,
      doi: c.doi,
      sourceFile: c.sourceFile,
      source: c.sourceFile === 'workspace-library' ? 'library' : 'bib',
    }));

    // Augment or enrich with libraryItems (which contain full abstract, url, collectionId, collectionIds)
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
          title: existing.title || lib.title,
          authors: existing.authors && existing.authors.length > 0 ? existing.authors : lib.authors,
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
          title: lib.title,
          authors: lib.authors,
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

  // Reset and initialize states when modal is opened
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

  // Search backend manuscript citations if effectiveProjectId is present and query >= 2 chars
  useEffect(() => {
    if (!effectiveProjectId || !open || search.trim().length < 2) {
      setServerItems([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const results = await manuscriptService.citations.search(
          effectiveProjectId,
          search.trim(),
          25,
        );
        if (active && Array.isArray(results)) {
          const mapped: BibEntry[] = results.map((r: BibEntryDto) => ({
            key: r.key,
            type: r.type || 'article',
            title: r.title,
            authors: r.author ? [r.author] : undefined,
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

  // Merge local parsed items and backend results without duplicates
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

  // Retraction awareness (Zotero parity): confirm before citing a retracted work
  const { data: retractedItems } = useRetractedItems(effectiveProjectId, open);
  const retractedMap = useMemo(
    () => buildRetractedCitationMap(allMergedItems, retractedItems),
    [allMergedItems, retractedItems],
  );
  const [pendingRetracted, setPendingRetracted] = useState<{
    entry: BibEntry;
    info: RetractedItemInfo;
  } | null>(null);

  // Build collection tree structure from backend collections
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

  // Flat lookup map of all collection nodes by ID
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

  // Helper to check if an entry matches a collection node from database relation
  const entryMatchesCollection = useCallback(
    (entry: BibEntry, node: CollectionNode): boolean => {
      const colId = entry.collectionId;
      const colIds = entry.collectionIds;
      if (colId === node.id || colIds?.includes(node.id)) return true;

      if (node.children?.some((child) => entryMatchesCollection(entry, child))) {
        return true;
      }

      return false;
    },
    [],
  );

  // Nav counts
  const navCounts = useMemo(() => {
    let lib = 0;
    let bib = 0;
    let cited = 0;
    for (const item of allMergedItems) {
      if (item.source === 'library' || item.sourceFile === 'workspace-library') lib++;
      if (item.source === 'bib' || (item.sourceFile && item.sourceFile !== 'workspace-library'))
        bib++;
      if (item.key && citedKeysSet.has(item.key.toLowerCase())) cited++;
    }

    const counts: Record<string, number> = {
      all: allMergedItems.length,
      library: lib,
      bib,
      cited,
    };

    for (const [id, node] of collectionNodeMap.entries()) {
      counts[id] = allMergedItems.filter((entry) => entryMatchesCollection(entry, node)).length;
    }

    return counts;
  }, [allMergedItems, citedKeysSet, collectionNodeMap, entryMatchesCollection]);

  // Filtered by selected tree navigation
  const navFilteredItems = useMemo(() => {
    switch (selectedNav) {
      case 'all':
        return allMergedItems;
      case 'library':
        return allMergedItems.filter(
          (item) => item.source === 'library' || item.sourceFile === 'workspace-library',
        );
      case 'bib':
        return allMergedItems.filter(
          (item) =>
            item.source === 'bib' || (item.sourceFile && item.sourceFile !== 'workspace-library'),
        );
      case 'cited':
        return allMergedItems.filter(
          (item) => item.key && citedKeysSet.has(item.key.toLowerCase()),
        );
      default: {
        const node = collectionNodeMap.get(selectedNav);
        if (node) {
          const matched = allMergedItems.filter((entry) => entryMatchesCollection(entry, node));
          return matched.length > 0 ? matched : allMergedItems;
        }
        return allMergedItems;
      }
    }
  }, [allMergedItems, selectedNav, citedKeysSet, collectionNodeMap, entryMatchesCollection]);

  // Defer search to keep typing at 60 FPS without UI freezes
  const deferredSearch = useDeferredValue(search);

  // Filtered by search query across fields
  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return navFilteredItems;
    return navFilteredItems.filter((entry) => {
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
    });
  }, [navFilteredItems, deferredSearch]);

  // Keep a valid selected entry
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

  // Currently inspected entry
  const selectedEntry = useMemo(() => {
    if (!selectedKey) return filteredItems[0] || null;
    return (
      allMergedItems.find((item) => item.key.toLowerCase() === selectedKey.toLowerCase()) ||
      filteredItems[0] ||
      null
    );
  }, [allMergedItems, filteredItems, selectedKey]);

  // Check if search query matches DOI or arXiv identifier
  const isIdentifier = useMemo(() => {
    return validateAcademicIdentifier(search).isIdentifier;
  }, [search]);

  /**
   * Overleaf Parity Auto-Sync: Appends missing BibTeX entry to references.bib
   */
  const ensureBibtexInProject = useCallback(
    async (entry: BibEntry) => {
      if (!effectiveProjectId) return;

      const candidateMap = new Map<string, { id: string; title: string; content: string }>();
      for (const wf of workspaceCoordinator.getProjectFiles() || []) {
        const title = (wf.path || wf.title || '').trim();
        if (title.toLowerCase().endsWith('.bib')) {
          const cached = wf.id ? lruDocumentCache.get(wf.id) : undefined;
          candidateMap.set(wf.id || title.toLowerCase(), {
            id: wf.id,
            title,
            content: cached?.content ?? extractDocumentContentString(wf.content),
          });
        }
      }
      const files = Array.isArray(projectFiles) ? projectFiles : [];
      for (const f of files as Array<{ id: string; title?: string; name?: string; content?: string }>) {
        const title = (f.title || f.name || '').trim();
        if (title.toLowerCase().endsWith('.bib')) {
          const cached = f.id ? lruDocumentCache.get(f.id) : undefined;
          candidateMap.set(f.id || title.toLowerCase(), {
            id: f.id,
            title,
            content: cached?.content ?? f.content ?? '',
          });
        }
      }
      const bibFiles = Array.from(candidateMap.values());

      const storeBib = useSettingsStore.getState().mainBibFile;
      const preferredBib =
        storeBib && storeBib !== 'auto' ? storeBib : 'references.bib';
      const primaryBib =
        bibFiles.find(
          (f) => f.title.toLowerCase() === preferredBib.toLowerCase(),
        ) || bibFiles[0];

      let bibCode = '';
      const matchedLibItem = libraryItems.find(
        (it) => (it.citationKey || it.id)?.toLowerCase() === entry.key.toLowerCase(),
      );

      if (matchedLibItem) {
        bibCode = formatItemToBibtex(matchedLibItem);
      } else {
        bibCode = formatBibEntryToBibtex(entry);
      }

      if (!bibCode) return;

      if (primaryBib) {
        const currentContent = primaryBib.content || '';
        if (new RegExp(`@\\w+\\s*\\{\\s*${entry.key}\\s*,`, 'i').test(currentContent)) {
          return;
        }

        const newContent = currentContent
          ? `${currentContent.trim()}\n\n${bibCode}\n`
          : `${bibCode}\n`;
        lruDocumentCache.updateContent(primaryBib.id, newContent, true);
        sessionCoordinator.notifyContentChange(primaryBib.id, newContent);
        latexSymbolsIndex.indexFile(primaryBib.id, primaryBib.title || preferredBib, newContent);
        toast.success(`Synced @${entry.key} to ${primaryBib.title || preferredBib}`, {
          id: `sync-bib-${entry.key}`,
        });
      } else {
        const created = await workspaceCoordinator.createFile({
          name: preferredBib,
          content: `${bibCode}\n`,
          openAfterCreate: false,
        });
        if (created?.id) {
          latexSymbolsIndex.indexFile(created.id, preferredBib, `${bibCode}\n`);
        }
        toast.success(`Created ${preferredBib} and synced @${entry.key}`, {
          id: `sync-bib-${entry.key}`,
        });
      }

      if (rootId) {
        queryClient.invalidateQueries({ queryKey: filesQuery(rootId).queryKey });
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['project-citation-validation', effectiveProjectId] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
    },
    [effectiveProjectId, projectFiles, libraryItems, rootId, queryClient],
  );

  /**
   * Insertion executor
   */
  const insertCitation = useCallback(
    (entry: BibEntry) => {
      const snippet = formatCitationSnippet(entry.key, selectedStyle);

      if (onSelectCitation) {
        onSelectCitation(snippet, entry.key, entry);
      } else {
        const engine = getActiveEditorEngine();
        if (engine) {
          engine.insertText(snippet);
          engine.focus();
        } else {
          editorCommandBus.dispatch({ type: 'editor:insert-text', text: snippet });
          editorCommandBus.dispatch({ type: 'editor:focus' });
        }

        if (entry.source === 'library' || entry.sourceFile === 'workspace-library') {
          void ensureBibtexInProject(entry);
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

  const handleSelectCard = useCallback((entry: BibEntry) => {
    setSelectedKey(entry.key);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setActiveView('detail');
    }
  }, []);

  // Virtualizer for large lists (>= 25 cards)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] sm:max-w-5xl md:max-w-6xl h-[660px] max-h-[88vh] min-h-0 sm:min-h-[520px] p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-raised-500 bg-background flex flex-col"
      >
        {/* ── Top Header Toolbar: Title, Responsive Switcher & Close ── */}
        <div className="h-12 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-background border-b border-border/40 md:border-b-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Insert Citation
            </DialogTitle>

            {/* Mobile View Switcher Tabs (Visible only on < md viewports) */}
            <div className="flex md:hidden items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 select-none">
              <button
                type="button"
                onClick={() => setActiveView('tree')}
                className={cn(
                  'px-2.5 py-1 text-11 rounded-md transition-colors font-medium cursor-pointer',
                  activeView === 'tree'
                    ? 'bg-background text-foreground font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground border border-transparent',
                )}
              >
                Library
              </button>
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className={cn(
                  'px-2.5 py-1 text-11 rounded-md transition-colors font-medium cursor-pointer',
                  activeView === 'list'
                    ? 'bg-background text-foreground font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground border border-transparent',
                )}
              >
                Papers ({filteredItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveView('detail')}
                disabled={!selectedEntry}
                className={cn(
                  'px-2.5 py-1 text-11 rounded-md transition-colors font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                  activeView === 'detail'
                    ? 'bg-background text-foreground font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground border border-transparent',
                )}
              >
                Details
              </button>
            </div>
          </div>

          <DialogClose asChild>
            <button
              type="button"
              className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-['']"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>

        {/* ── 3-Column Cockpit Container ── */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-background">
          {/* COLUMN 1: Library Directory Tree */}
          <CitationCollectionTreePane
            activeView={activeView}
            selectedNav={selectedNav}
            navCounts={navCounts}
            collectionTree={collectionTree}
            onSelectNav={(navId) => {
              setSelectedNav(navId);
              setActiveView('list');
            }}
          />

          {/* ══════════════════════════════════════════════════════════════
              COLUMN 2: Paper Cards List & Search
             ══════════════════════════════════════════════════════════════ */}
          <div
            className={cn(
              'w-full md:w-[320px] lg:w-[350px] border-r border-border/70 flex flex-col min-h-0 bg-background shrink-0 h-full overflow-hidden',
              activeView !== 'list' && 'hidden md:flex',
            )}
          >
            {/* Search Input */}
            <div className="p-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search title, author, key, DOI..."
                  className="pl-8 pr-7 h-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border rounded-md"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Academic Identifier Notice */}
            {isIdentifier && effectiveProjectId && (
              <div className="mx-3 mb-2 p-2 rounded-md border border-border bg-muted/40 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <Binary className="size-3 text-foreground" />
                    <p className="text-11 font-medium text-foreground truncate">
                      Academic identifier
                    </p>
                  </div>
                  <p className="text-10 font-mono text-foreground opacity-80 truncate">
                    {search.trim()}
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleResolveIdentifier}
                  disabled={isResolving}
                  className="h-6 px-2 text-11 font-medium shrink-0 cursor-pointer text-foreground"
                >
                  {isResolving ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1 text-foreground motion-reduce:animate-none" />
                      Resolving...
                    </>
                  ) : (
                    'Resolve'
                  )}
                </Button>
              </div>
            )}

            {/* Paper Cards List */}
            <div
              ref={listRef}
              role="listbox"
              aria-label="Citations list"
              aria-activedescendant={selectedKey ? `citation-opt-${selectedKey}` : undefined}
              className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1 sidebar-scrollbar"
            >
              <div className="sr-only" aria-live="polite" aria-atomic="true">
                {filteredItems.length} citations found
              </div>

              {isSearchingServer && (
                <div className="flex items-center justify-center py-8 text-foreground gap-2">
                  <Loader2 className="size-3.5 animate-spin text-foreground motion-reduce:animate-none" />
                  <span className="text-xs">Searching references...</span>
                </div>
              )}

              {!isSearchingServer && filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-foreground px-4 space-y-2">
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-foreground">
                    <SearchX className="size-4 text-foreground" />
                  </div>
                  <p className="text-xs font-medium text-foreground">No citations found</p>
                  <p className="text-11 text-muted-foreground max-w-xs leading-normal">
                    {search
                      ? `No papers match "${search}". Try searching by author, title or DOI.`
                      : 'No citation entries found in this collection.'}
                  </p>
                </div>
              )}

              {!isSearchingServer && !isLargeCardsList && (
                <div className="space-y-1">
                  {filteredItems.map((entry, idx) => (
                    <CitationPickerCard
                      key={entry.key}
                      entry={entry}
                      idx={idx}
                      isSelected={selectedEntry?.key.toLowerCase() === entry.key.toLowerCase()}
                      isCited={Boolean(entry.key && citedKeysSet.has(entry.key.toLowerCase()))}
                      onSelect={handleSelectCard}
                      onDoubleClick={handleSelectItem}
                    />
                  ))}
                </div>
              )}

              {!isSearchingServer && isLargeCardsList && (
                <div
                  style={{
                    height: `${cardsVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {cardsVirtualizer.getVirtualItems().map((virtualRow) => {
                    const entry = filteredItems[virtualRow.index];
                    return (
                      <div
                        key={entry.key}
                        data-index={virtualRow.index}
                        ref={cardsVirtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <CitationPickerCard
                          entry={entry}
                          idx={virtualRow.index}
                          isSelected={selectedEntry?.key.toLowerCase() === entry.key.toLowerCase()}
                          isCited={Boolean(entry.key && citedKeysSet.has(entry.key.toLowerCase()))}
                          onSelect={handleSelectCard}
                          onDoubleClick={handleSelectItem}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: Paper Details & Inspector */}
          <CitationInspectorPane
            activeView={activeView}
            selectedEntry={selectedEntry}
            selectedStyle={selectedStyle}
            citedKeysSet={citedKeysSet}
            onSelectStyle={setSelectedStyle}
            onBackToList={() => setActiveView('list')}
            onCloseModal={() => onOpenChange(false)}
            copyCitationSnippet={copyCitationSnippet}
            copyBibtex={copyBibtex}
            copyKey={copyKey}
            copyDoi={copyDoi}
          />
        </div>

        {/* ── Bottom Footer Toolbar: 2 Buttons Only (No divider line) ── */}
        <div className="h-12 px-6 flex items-center justify-end gap-2 shrink-0 bg-background">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!selectedEntry}
            onClick={() => selectedEntry && handleSelectItem(selectedEntry)}
            className="h-8 px-4 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer disabled:opacity-50"
          >
            <Check className="size-3.5" />
            <span>Insert Citation</span>
          </Button>
        </div>
      </DialogContent>

      {/* Retraction Warning Dialog */}
      <CitationRetractionAlertDialog
        pendingRetracted={pendingRetracted}
        onDismiss={() => setPendingRetracted(null)}
        onConfirmCiteAnyway={(entry) => insertCitation(entry)}
      />
    </Dialog>
  );
}
