'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui';
import {
  Library,
  Folder,
  FolderOpen,
  ChevronRight,
  FileText,
  FileCode,
  BookMarked,
  Search,
  X,
  Copy,
  Loader2,
  Check,
  ExternalLink,
  Code2,
  SearchX,
  Binary,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { formatCitationSnippet, formatBibEntryToBibtex } from '../../utils/citation.util';
import type { BibEntry } from '@/features/editor/utils/bib-parser.util';
import { manuscriptService, type BibEntryDto } from '@/features/editor/services/manuscript.service';
import { useCollections, useRetractedItems } from '@/features/library/data';
import { buildRetractedCitationMap } from '../../utils/retracted-citations.util';
import type { RetractedItemInfo } from '../../utils/latex-linter.util';

export type CitationStyle =
  | 'latex-cite'
  | 'latex-citep'
  | 'latex-citet'
  | 'markdown-bracket'
  | 'markdown-inline';

export interface CitationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BibEntry[];
  onSelectCitation: (snippet: string, citeKey: string, entry?: BibEntry) => void;
  defaultStyle?: CitationStyle;
  projectId?: string;
  initialQuery?: string;
  initialKey?: string;
  citedKeys?: string[];
}

const STYLE_OPTIONS: { id: CitationStyle; label: string; preview: string }[] = [
  { id: 'latex-cite', label: '\\cite', preview: '\\cite{key}' },
  { id: 'latex-citep', label: '\\citep', preview: '\\citep{key}' },
  { id: 'latex-citet', label: '\\citet', preview: '\\citet{key}' },
  { id: 'markdown-bracket', label: 'Pandoc', preview: '[@key]' },
];

interface CollectionNode {
  id: string;
  name: string;
  keywords?: string[];
  children?: CollectionNode[];
}

const DEFAULT_COLLECTIONS: CollectionNode[] = [
  {
    id: 'col-ml',
    name: 'Machine Learning',
    keywords: ['machine learning', 'learning', 'model', 'neural', 'deep', 'network', 'training'],
    children: [
      {
        id: 'col-opt',
        name: 'Optimization',
        keywords: ['optimization', 'optimizer', 'stochastic', 'gradient', 'adam', 'sgd', 'decay', 'weight'],
      },
      {
        id: 'col-deep',
        name: 'Deep Architectures',
        keywords: ['transformer', 'attention', 'architecture', 'resnet', 'cnn', 'layer', 'diffusion'],
      },
    ],
  },
  {
    id: 'col-nlp',
    name: 'Natural Language Processing',
    keywords: ['language', 'nlp', 'text', 'llama', 'bert', 'gpt', 'token', 'pre-training'],
    children: [
      {
        id: 'col-llm',
        name: 'Large Language Models',
        keywords: ['llama', 'gpt', 'llm', 'few-shot', 'prompt', 'reasoning'],
      },
    ],
  },
  {
    id: 'col-cv',
    name: 'Computer Vision',
    keywords: ['vision', 'image', 'visual', 'segmentation', 'object', 'detection'],
  },
];

export default function CitationPickerModal({
  open,
  onOpenChange,
  items,
  onSelectCitation,
  defaultStyle = 'latex-cite',
  projectId,
  initialQuery = '',
  initialKey = '',
  citedKeys = [],
}: CitationPickerModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>(defaultStyle);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedNav, setSelectedNav] = useState<string>('all');
  const [activeView, setActiveView] = useState<'tree' | 'list' | 'detail'>('list');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['col-ml', 'col-nlp']),
  );
  const [serverItems, setServerItems] = useState<BibEntry[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isBibtexOpen, setIsBibtexOpen] = useState(true);

  // Copy feedback states
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDoi, setCopiedDoi] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Query collections from backend
  const { collections: serverCollections = [] } = useCollections(projectId || 'user');

  const selectedOption = useMemo(
    () => STYLE_OPTIONS.find((opt) => opt.id === selectedStyle) || STYLE_OPTIONS[0],
    [selectedStyle],
  );

  // Set of lowercase cited keys in the active document
  const citedKeysSet = useMemo(() => {
    return new Set((citedKeys || []).map((k) => k.toLowerCase()));
  }, [citedKeys]);

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

  // Search backend manuscript citations if projectId is present and query >= 2 chars
  useEffect(() => {
    if (!projectId || !open || search.trim().length < 2) {
      setServerItems([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const results = await manuscriptService.citations.search(projectId, search.trim(), 25);
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
          }));
          setServerItems(mapped);
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
  }, [open, projectId, search]);

  // Merge local parsed items and backend results without duplicates
  const allMergedItems = useMemo(() => {
    const map = new Map<string, BibEntry>();
    for (const item of items) {
      if (item.key) map.set(item.key.toLowerCase(), item);
    }
    for (const sItem of serverItems) {
      if (sItem.key && !map.has(sItem.key.toLowerCase())) {
        map.set(sItem.key.toLowerCase(), sItem);
      }
    }
    return Array.from(map.values());
  }, [items, serverItems]);

  // Retraction awareness (Zotero parity): confirm before citing a retracted work.
  const { data: retractedItems } = useRetractedItems(projectId, open);
  const retractedMap = useMemo(
    () => buildRetractedCitationMap(allMergedItems, retractedItems),
    [allMergedItems, retractedItems],
  );
  const [pendingRetracted, setPendingRetracted] = useState<{
    entry: BibEntry;
    info: RetractedItemInfo;
  } | null>(null);

  // Built collection tree structure (combining backend collections with defaults)
  const collectionTree = useMemo<CollectionNode[]>(() => {
    if (serverCollections && serverCollections.length > 0) {
      const map = new Map<string, CollectionNode>();
      const roots: CollectionNode[] = [];
      for (const c of serverCollections) {
        if (!c.id) continue;
        map.set(c.id, { id: c.id, name: c.name, children: [] });
      }
      for (const node of map.values()) {
        const rawParent = (node as any).parentId || (node as any).parent;
        if (rawParent && rawParent !== node.id && map.has(rawParent)) {
          map.get(rawParent)!.children!.push(node);
        } else {
          roots.push(node);
        }
      }
      return roots;
    }
    return DEFAULT_COLLECTIONS;
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

  // Precomputed lowercase search corpus per entry to eliminate O(N×M) string allocations on every render
  const entryCorpusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of allMergedItems) {
      if (!entry.key) continue;
      const text = `${entry.title || ''} ${entry.abstract || ''} ${entry.journal || ''} ${entry.booktitle || ''} ${entry.publisher || ''} ${entry.key || ''}`.toLowerCase();
      map.set(entry.key.toLowerCase(), text);
    }
    return map;
  }, [allMergedItems]);

  // Helper to check if an entry matches a collection node
  const entryMatchesCollection = useCallback(
    (entry: BibEntry, node: CollectionNode): boolean => {
      // Direct collection ID match
      const colId = (entry as any).collectionId;
      const colIds = (entry as any).collectionIds as string[] | undefined;
      if (colId === node.id || colIds?.includes(node.id)) return true;

      // Check children recursively
      if (node.children?.some((child) => entryMatchesCollection(entry, child))) {
        return true;
      }

      // Keyword match based on collection name and keywords
      const keywords = node.keywords || [node.name.toLowerCase()];
      const textCorpus = entry.key ? entryCorpusMap.get(entry.key.toLowerCase()) || '' : '';

      return keywords.some((kw) => textCorpus.includes(kw.toLowerCase()));
    },
    [entryCorpusMap],
  );

  // Nav counts
  const navCounts = useMemo(() => {
    let lib = 0;
    let bib = 0;
    let cited = 0;
    for (const item of allMergedItems) {
      if (item.source === 'library') lib++;
      if (item.source === 'bib') bib++;
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
  }, [allMergedItems, citedKeysSet, collectionNodeMap]);

  // Filtered by selected tree navigation
  const navFilteredItems = useMemo(() => {
    switch (selectedNav) {
      case 'all':
        return allMergedItems;
      case 'library':
        return allMergedItems.filter((item) => item.source === 'library');
      case 'bib':
        return allMergedItems.filter((item) => item.source === 'bib');
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
  }, [allMergedItems, selectedNav, citedKeysSet, collectionNodeMap]);

  // Filtered by search query across fields
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
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
  }, [navFilteredItems, search]);

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
    const trimmed = search.trim();
    return (
      /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(trimmed) ||
      /^(arxiv:)?\d{4}\.\d{4,5}(v\d+)?$/i.test(trimmed)
    );
  }, [search]);

  const insertCitation = (entry: BibEntry) => {
    const snippet = formatCitationSnippet(entry.key, selectedStyle);
    onSelectCitation(snippet, entry.key, entry);
    onOpenChange(false);
  };

  const handleSelectItem = (entry: BibEntry) => {
    const info = retractedMap.get(entry.key);
    if (info) {
      setPendingRetracted({ entry, info });
      return;
    }
    insertCitation(entry);
  };

  const handleCopyCitationSnippet = (entry: BibEntry) => {
    const snippet = formatCitationSnippet(entry.key, selectedStyle);
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    toast.success(`Copied "${snippet}"`);
    setTimeout(() => setCopiedSnippet(false), 1500);
  };

  const handleCopyBibtex = (entry: BibEntry) => {
    const code = formatBibEntryToBibtex(entry);
    navigator.clipboard.writeText(code);
    setCopiedBibtex(true);
    toast.success(`Copied BibTeX for ${entry.key}`);
    setTimeout(() => setCopiedBibtex(false), 1500);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success(`Copied citation key "${key}"`);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  const handleCopyDoi = (doi: string) => {
    navigator.clipboard.writeText(doi);
    setCopiedDoi(true);
    toast.success(`Copied DOI "${doi}"`);
    setTimeout(() => setCopiedDoi(false), 1500);
  };

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
    if (!projectId || !search.trim()) return;
    setIsResolving(true);
    try {
      const res = await manuscriptService.citations.resolve(projectId, search.trim());
      if (res?.entry?.key) {
        toast.success(`Resolved BibTeX for ${res.entry.key}`);
        const newEntry: BibEntry = {
          key: res.entry.key,
          type: res.entry.type || 'article',
          title: res.entry.title,
          authors: res.entry.author ? [res.entry.author] : undefined,
          year: res.entry.year,
          journal: res.entry.journal,
          doi: res.entry.doi,
          raw: res.entry.rawBibtex,
          source: 'server',
        };
        setServerItems((prev) => [newEntry, ...prev]);
        setSelectedKey(newEntry.key);
      } else {
        toast.error('Identifier could not be resolved');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve academic identifier';
      toast.error(message);
    } finally {
      setIsResolving(false);
    }
  };

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const venueString = useMemo(() => {
    if (!selectedEntry) return '';
    return [
      selectedEntry.journal || selectedEntry.booktitle || selectedEntry.publisher,
      selectedEntry.volume ? `Vol. ${selectedEntry.volume}` : '',
      selectedEntry.number ? `No. ${selectedEntry.number}` : '',
      selectedEntry.pages ? `pp. ${selectedEntry.pages}` : '',
    ]
      .filter(Boolean)
      .join(', ');
  }, [selectedEntry]);

  const doiUrl = useMemo(() => {
    if (!selectedEntry?.doi) return null;
    return selectedEntry.doi.startsWith('http')
      ? selectedEntry.doi
      : `https://doi.org/${selectedEntry.doi}`;
  }, [selectedEntry]);

  // Selected nav label display
  const currentNavLabel = useMemo(() => {
    if (selectedNav === 'all') return 'All References';
    if (selectedNav === 'cited') return 'In Document';
    if (selectedNav === 'library') return 'Workspace Library';
    if (selectedNav === 'bib') return 'Project .bib';
    return collectionNodeMap.get(selectedNav)?.name || 'Collection';
  }, [selectedNav, collectionNodeMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] sm:max-w-5xl md:max-w-6xl h-[660px] max-h-[88vh] min-h-[520px] p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-raised-500 bg-background flex flex-col"
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
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
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
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
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
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Details
              </button>
            </div>
          </div>

          <DialogClose asChild>
            <button
              type="button"
              className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>

        {/* ── 3-Column Cockpit Container ── */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-background">
          {/* ══════════════════════════════════════════════════════════════════
              COLUMN 1: Library Directory Tree
             ══════════════════════════════════════════════════════════════════ */}
          <div
            className={cn(
              'w-full md:w-56 shrink-0 bg-muted/20 border-r border-border/70 flex flex-col min-h-0 overflow-hidden',
              activeView !== 'tree' && 'hidden md:flex',
            )}
          >
            <div
              role="tree"
              aria-label="Reference collections"
              className="flex-1 min-h-0 overflow-y-auto p-2 space-y-4 sidebar-scrollbar"
            >
              {/* Scope & System Sections */}
              <div className="space-y-0.5">
                <div className="px-2 pb-1 text-11 font-medium text-foreground select-none">
                  My Library
                </div>

                <button
                  type="button"
                  role="treeitem"
                  aria-selected={selectedNav === 'all'}
                  onClick={() => {
                    setSelectedNav('all');
                    setActiveView('list');
                  }}
                  className={cn(
                    'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none select-none text-left',
                    selectedNav === 'all'
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Library className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
                  <span className="truncate flex-1">All References</span>
                  <span className="text-10 font-mono opacity-70">{navCounts.all}</span>
                </button>

                <button
                  type="button"
                  role="treeitem"
                  aria-selected={selectedNav === 'cited'}
                  onClick={() => {
                    setSelectedNav('cited');
                    setActiveView('list');
                  }}
                  className={cn(
                    'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none select-none text-left',
                    selectedNav === 'cited'
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <FileText className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
                  <span className="truncate flex-1">In Document</span>
                  <span className="text-10 font-mono opacity-70">{navCounts.cited}</span>
                </button>

                <button
                  type="button"
                  role="treeitem"
                  aria-selected={selectedNav === 'library'}
                  onClick={() => {
                    setSelectedNav('library');
                    setActiveView('list');
                  }}
                  className={cn(
                    'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none select-none text-left',
                    selectedNav === 'library'
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <BookMarked className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
                  <span className="truncate flex-1">Workspace Library</span>
                  <span className="text-10 font-mono opacity-70">{navCounts.library}</span>
                </button>

                <button
                  type="button"
                  role="treeitem"
                  aria-selected={selectedNav === 'bib'}
                  onClick={() => {
                    setSelectedNav('bib');
                    setActiveView('list');
                  }}
                  className={cn(
                    'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none select-none text-left',
                    selectedNav === 'bib'
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <FileCode className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
                  <span className="truncate flex-1">Project .bib</span>
                  <span className="text-10 font-mono opacity-70">{navCounts.bib}</span>
                </button>
              </div>

              {/* Collections Tree Section */}
              <div className="space-y-0.5">
                <div className="px-2 pb-1 text-11 font-medium text-foreground select-none">
                  Collections
                </div>

                {collectionTree.map((rootNode) => {
                  const isExpanded = expandedFolders.has(rootNode.id);
                  const isSelected = selectedNav === rootNode.id;
                  const hasChildren = rootNode.children && rootNode.children.length > 0;
                  const count = navCounts[rootNode.id] ?? 0;

                  return (
                    <div key={rootNode.id} className="space-y-0.5">
                      <div
                        role="treeitem"
                        tabIndex={0}
                        aria-expanded={hasChildren ? isExpanded : undefined}
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedNav(rootNode.id);
                          setActiveView('list');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedNav(rootNode.id);
                            setActiveView('list');
                          } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
                            e.preventDefault();
                            toggleFolder(rootNode.id, e as any);
                          } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
                            e.preventDefault();
                            toggleFolder(rootNode.id, e as any);
                          }
                        }}
                        className={cn(
                          'w-full h-7 px-2 flex items-center gap-1.5 rounded-md text-12 transition-colors cursor-pointer outline-none select-none text-left group focus-visible:ring-1 focus-visible:ring-primary',
                          isSelected
                            ? 'bg-muted text-foreground font-medium'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => toggleFolder(rootNode.id, e)}
                            className="p-0.5 hover:bg-muted rounded text-foreground"
                            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                          >
                            <ChevronRight
                              className={cn(
                                'size-3 transition-transform duration-150',
                                isExpanded && 'rotate-90',
                              )}
                            />
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}

                        {isExpanded ? (
                          <FolderOpen className="size-3.5 shrink-0 text-foreground" />
                        ) : (
                          <Folder className="size-3.5 shrink-0 text-foreground" />
                        )}

                        <span className="truncate flex-1">{rootNode.name}</span>
                        {count > 0 && (
                          <span className="text-10 font-mono opacity-70">{count}</span>
                        )}
                      </div>

                      {/* Sub-collections */}
                      {hasChildren && isExpanded && (
                        <div className="pl-4 space-y-0.5 border-l border-border/50 ml-3.5 my-0.5">
                          {rootNode.children!.map((subNode) => {
                            const isSubSelected = selectedNav === subNode.id;
                            const subCount = navCounts[subNode.id] ?? 0;

                            return (
                              <button
                                key={subNode.id}
                                type="button"
                                role="treeitem"
                                aria-selected={isSubSelected}
                                onClick={() => {
                                  setSelectedNav(subNode.id);
                                  setActiveView('list');
                                }}
                                className={cn(
                                  'w-full h-6 px-2 flex items-center gap-2 rounded-md text-11 transition-colors cursor-pointer outline-none select-none text-left focus-visible:ring-1 focus-visible:ring-primary',
                                  isSubSelected
                                    ? 'bg-muted text-foreground font-medium'
                                    : 'text-foreground hover:bg-muted',
                                )}
                              >
                                <Folder className="size-3 shrink-0 text-foreground" />
                                <span className="truncate flex-1">{subNode.name}</span>
                                {subCount > 0 && (
                                  <span className="text-10 font-mono opacity-70">{subCount}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              COLUMN 2: Paper Cards List & Search
             ══════════════════════════════════════════════════════════════════ */}
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
                  className="pl-8 pr-7 h-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary rounded-md"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Academic Identifier Notice */}
            {isIdentifier && projectId && (
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
                      <Loader2 className="size-3 animate-spin mr-1 text-foreground" />
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
              {/* Screen reader live announcement */}
              <div className="sr-only" aria-live="polite" aria-atomic="true">
                {filteredItems.length} citations found
              </div>

              {isSearchingServer && (
                <div className="flex items-center justify-center py-8 text-foreground gap-2">
                  <Loader2 className="size-3.5 animate-spin text-foreground" />
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

              {!isSearchingServer &&
                filteredItems.map((entry, idx) => {
                  const isSelected = selectedEntry?.key.toLowerCase() === entry.key.toLowerCase();
                  const authorSummary =
                    entry.authors && entry.authors.length > 0
                      ? entry.authors.length <= 2
                        ? entry.authors.join(' & ')
                        : `${entry.authors[0]} et al.`
                      : 'Unknown author';
                  const isCited = entry.key && citedKeysSet.has(entry.key.toLowerCase());

                  return (
                    <div
                      key={entry.key}
                      id={`citation-opt-${entry.key}`}
                      role="option"
                      tabIndex={0}
                      data-index={idx}
                      aria-selected={isSelected}
                      aria-label={`${entry.title || entry.key} by ${authorSummary}`}
                      onClick={() => {
                        setSelectedKey(entry.key);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                          setActiveView('detail');
                        }
                      }}
                      onDoubleClick={() => handleSelectItem(entry)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSelectItem(entry);
                        }
                      }}
                      className={cn(
                        'group flex flex-col gap-1 p-2.5 rounded-md cursor-pointer transition-colors border text-left select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isSelected
                          ? 'bg-muted border-border text-foreground'
                          : 'border-transparent hover:bg-muted text-foreground',
                      )}
                    >
                      {/* Title */}
                      <p className="text-xs font-medium line-clamp-2 leading-snug text-foreground">
                        {entry.title || entry.key}
                      </p>

                      {/* Author + Year */}
                      <p className="text-11 text-muted-foreground truncate leading-normal">
                        {authorSummary}
                        {entry.year ? ` (${entry.year})` : ''}
                      </p>

                      {/* Badges / Key row */}
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        <span className="font-mono text-10 px-1.5 py-0.5 rounded bg-background border border-border text-foreground truncate max-w-[140px]">
                          {entry.key}
                        </span>

                        {entry.source === 'library' && (
                          <span className="text-10 font-mono px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                            Library
                          </span>
                        )}
                        {entry.source === 'bib' && (
                          <span className="text-10 font-mono px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                            .bib
                          </span>
                        )}

                        {isCited && (
                          <span className="text-10 font-mono font-medium px-1.5 py-0.5 rounded bg-muted text-foreground border border-border ml-auto">
                            Cited
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              COLUMN 3: Paper Details & Inspector
             ══════════════════════════════════════════════════════════════════ */}
          <div
            className={cn(
              'flex-1 min-w-0 flex flex-col bg-background h-full overflow-y-auto p-4 sm:p-6 space-y-4 select-text sidebar-scrollbar',
              activeView !== 'detail' && 'hidden md:flex',
            )}
          >
            {/* Mobile Back Button to Return to List */}
            <div className="md:hidden flex items-center justify-between pb-2 border-b border-border/60">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="inline-flex items-center gap-1.5 text-xs text-foreground font-medium hover:underline cursor-pointer"
              >
                <span>← Back to references list</span>
              </button>
            </div>
            {selectedEntry ? (
              <>
                {/* ── 1. Paper Header ── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-10 px-2 py-0.5 rounded bg-muted text-foreground border border-border font-medium">
                      {(selectedEntry.type || 'article').toLowerCase()}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-15 font-semibold text-foreground leading-snug tracking-tight">
                    {selectedEntry.title || selectedEntry.key}
                  </h3>

                  {/* Authors */}
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Authors: </span>
                    {selectedEntry.authors && selectedEntry.authors.length > 0
                      ? selectedEntry.authors.join(', ')
                      : 'Not specified'}
                  </div>

                  {/* Venue / Publication */}
                  {venueString && (
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Publication: </span>
                      {venueString}
                    </div>
                  )}

                  {/* DOI & URL links */}
                  {(doiUrl || (selectedEntry.url && !selectedEntry.doi)) && (
                    <div className="flex items-center gap-3 pt-0.5 flex-wrap">
                      {selectedEntry.doi && doiUrl && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <a
                            href={doiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-11 text-foreground hover:underline"
                          >
                            <span>DOI: {selectedEntry.doi}</span>
                            <ExternalLink className="size-3 text-foreground" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyDoi(selectedEntry.doi!)}
                            className="p-1 rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Copy DOI"
                          >
                            {copiedDoi ? (
                              <Check className="size-3 text-foreground" />
                            ) : (
                              <Copy className="size-3 text-foreground" />
                            )}
                          </button>
                        </div>
                      )}

                      {selectedEntry.url && !selectedEntry.doi && (
                        <a
                          href={selectedEntry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-11 text-foreground hover:underline"
                        >
                          <span>Open link</span>
                          <ExternalLink className="size-3 text-foreground" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* ── 2. Quick Actions Row ── */}
                <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-7 px-2.5 text-11 rounded border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedSnippet ? <Check className="size-3 text-foreground" /> : <Code2 className="size-3 text-foreground" />}
                        <span>Copy {selectedOption.label}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 p-1">
                      {STYLE_OPTIONS.map((opt) => (
                        <DropdownMenuItem
                          key={opt.id}
                          onClick={() => {
                            setSelectedStyle(opt.id);
                            const snippet = formatCitationSnippet(selectedEntry.key, opt.id);
                            navigator.clipboard.writeText(snippet);
                            toast.success(`Copied "${snippet}"`);
                          }}
                          className={cn(
                            'flex items-center justify-between px-2.5 py-1.5 text-xs font-mono rounded-md cursor-pointer text-foreground',
                            selectedStyle === opt.id && 'bg-muted font-medium text-foreground',
                          )}
                        >
                          <span>{opt.label}</span>
                          <span className="text-10 text-muted-foreground font-sans">{opt.preview}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    type="button"
                    onClick={() => handleCopyBibtex(selectedEntry)}
                    className="h-7 px-2.5 text-11 rounded border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedBibtex ? <Check className="size-3 text-foreground" /> : <FileCode className="size-3 text-foreground" />}
                    <span>Copy BibTeX</span>
                  </button>
                </div>

                {/* ── 3. Abstract Section ── */}
                <div className="space-y-1.5">
                  <h4 className="text-12 font-medium text-muted-foreground">
                    Abstract
                  </h4>
                  {selectedEntry.abstract ? (
                    <div className="text-xs text-foreground/85 leading-relaxed bg-muted/20 p-3 rounded-md border border-border max-h-40 overflow-y-auto whitespace-pre-wrap select-text">
                      {selectedEntry.abstract}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic bg-muted/10 p-2.5 rounded-md border border-dashed border-border">
                      No abstract provided in reference metadata.
                    </div>
                  )}
                </div>

                {/* ── 4. BibTeX Source Section ── */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsBibtexOpen((prev) => !prev)}
                      className="text-12 font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 transition-transform duration-150',
                          isBibtexOpen && 'rotate-90',
                        )}
                      />
                      <span>BibTeX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyBibtex(selectedEntry)}
                      className="text-11 text-foreground hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="size-3 text-foreground" />
                      <span>Copy</span>
                    </button>
                  </div>
                  {isBibtexOpen && (
                    <pre className="p-3 rounded-md bg-muted/20 border border-border text-11 font-mono leading-relaxed text-foreground overflow-x-auto whitespace-pre select-text max-h-48">
                      <code>{formatBibEntryToBibtex(selectedEntry)}</code>
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-6 py-16 space-y-3">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <FileText className="size-5" />
                </div>
                <h4 className="text-xs font-semibold text-foreground">Select a Reference</h4>
                <p className="text-11 text-muted-foreground max-w-xs leading-relaxed">
                  Choose a paper from the list to inspect its details and insert citations into your
                  document.
                </p>
              </div>
            )}
          </div>
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

      <AlertDialog
        open={Boolean(pendingRetracted)}
        onOpenChange={(next) => {
          if (!next) setPendingRetracted(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This work has been retracted</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRetracted?.info.title
                ? `"${pendingRetracted.info.title}" `
                : 'This reference '}
              is listed as retracted
              {pendingRetracted?.info.reason ? `: ${pendingRetracted.info.reason}` : '.'}{' '}
              Do you still want to cite it?
              {pendingRetracted?.info.noticeUrl && (
                <>
                  {' '}
                  <a
                    href={pendingRetracted.info.noticeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    View retraction notice
                  </a>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRetracted) insertCitation(pendingRetracted.entry);
                setPendingRetracted(null);
              }}
            >
              Cite anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}