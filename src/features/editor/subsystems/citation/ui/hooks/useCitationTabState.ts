'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  usePageStore,
  editorCommandBus,
  workspaceCoordinator,
  documentAuthority,
} from '@/features/editor/core';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { useEditorCitations } from '@/features/editor/subsystems/citation/ui/hooks/useCitation';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { type CitationValidationResult } from '@/features/editor/sdk/manuscript/types';
import { generateCitationKey } from '@/features/library/domain/citations';
import { filesQuery } from '@/features/editor/ui/hooks/document.queries';
import { parseBibContent, type BibEntry } from '@/features/editor/domain/latex/bib-parser';
import {
  extractCitationKeys,
  stripLatexComments,
  formatBibEntryAuthorSummary,
} from '@/features/editor/subsystems/citation/model/citation-formatter';
import { extractProjectId, extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

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
const MAX_BIB_PARSE_CACHE_SIZE = 50;
const bibParseCache = new Map<string, CachedBibFile>();
const BIBITEM_REGEX = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g;

function setBibParseCache(key: string, value: CachedBibFile): void {
  if (bibParseCache.has(key)) {
    bibParseCache.delete(key);
  } else if (bibParseCache.size >= MAX_BIB_PARSE_CACHE_SIZE) {
    const oldestKey = bibParseCache.keys().next().value;
    if (oldestKey !== undefined) {
      bibParseCache.delete(oldestKey);
    }
  }
  bibParseCache.set(key, value);
}

export function useCitationTabState() {
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
  const projectId = params?.projectId || storeProjectId || currentPageProjectId || '';

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
      bibParseCache.clear();
      refreshContent();
    };
    return editorCommandBus.subscribe('filetree:updated', handleClearBibCache);
  }, [refreshContent]);

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
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: Boolean(projectId),
  });

  // Parse BibTeX entries from all .bib files with cache lookup
  const bibEntries = useMemo<BibEntry[]>(() => {
    type BibCandidate = { id: string; name?: string; title?: string; filename?: string; path?: string; content?: unknown };
    const candidateMap = new Map<string, { id: string; fileName: string; content: string }>();

    const registerCandidate = (id: string, fileName: string, rawContent: unknown) => {
      const normalizedName = fileName.trim();
      if (!normalizedName.toLowerCase().endsWith('.bib')) return;
      const liveContent = id ? documentAuthority.getDocumentContent(id) : '';
      const cached = id ? lruDocumentCache.get(id) : undefined;
      const resolvedContent =
        liveContent || cached?.content || extractDocumentContentString(rawContent);
      if (!resolvedContent) return;
      const dedupeKey = id || normalizedName.toLowerCase();
      candidateMap.set(dedupeKey, {
        id: id || normalizedName,
        fileName: normalizedName,
        content: resolvedContent,
      });
    };

    for (const wf of workspaceCoordinator.getProjectFiles() || []) {
      const fname = wf.path || wf.title || '';
      registerCandidate(wf.id, fname, wf.content);
    }

    for (const f of (projectFiles || []) as BibCandidate[]) {
      const fname = f.name || f.title || f.filename || f.path || '';
      registerCandidate(f.id, fname, f.content);
    }

    for (const m of lruDocumentCache.getAllModels()) {
      registerCandidate(m.fileId, m.filePath || '', m.content);
    }

    const list: BibEntry[] = [];
    const seenKeys = new Set<string>();

    for (const f of candidateMap.values()) {
      if (!f.content || typeof f.content !== 'string') continue;
      const fileId = f.id || f.fileName || 'bib-file';
      const sample = f.content.length > 200 ? f.content.slice(0, 100) + f.content.slice(-100) : f.content;
      const cached = bibParseCache.get(fileId);

      let entries: BibEntry[];
      if (cached && cached.length === f.content.length && cached.sample === sample) {
        entries = cached.entries;
      } else {
        try {
          entries = parseBibContent(f.content);
          setBibParseCache(fileId, {
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
  }, [projectFiles, content]);

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

    // 3. Add inline \bibitem entries from document content with extracted metadata
    if (content && content.indexOf('\\bibitem') !== -1) {
      const sanitized = stripLatexComments(content);
      // Match each \bibitem up to the next \bibitem or \end{thebibliography}
      const bibitemBlockRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}([\s\S]*?)(?=\\bibitem|\\end\{thebibliography\}|$)/g;
      let bMatch: RegExpExecArray | null;
      while ((bMatch = bibitemBlockRegex.exec(sanitized)) !== null) {
        const key = bMatch[1]?.trim();
        const rawBody = bMatch[2] || '';
        const lowerKey = key?.toLowerCase();
        if (lowerKey && !map.has(lowerKey)) {
          // Clean body text from TeX commands
          const cleanBody = rawBody
            .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, (m, opt, arg) => {
              const inner = m.match(/\{([^}]*)\}/);
              return inner ? inner[1] : ' ';
            })
            .replace(/[{}$_~#^%]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Extract year if present (e.g. 1999, 2024)
          const yearMatch = cleanBody.match(/\b(19\d{2}|20\d{2})\b/);
          const year = yearMatch ? yearMatch[1] : undefined;

          // Split parts: author / title / venue
          const parts = cleanBody.split(/[.,;]\s+/).map((p) => p.trim()).filter(Boolean);
          const authorPart = parts.length > 0 ? parts[0] : '';
          const titlePart = parts.length > 1 ? parts.slice(1).join('. ') : (authorPart || key);

          map.set(lowerKey, {
            id: `bibitem-${key}`,
            key,
            title: titlePart || key,
            authorsSummary: authorPart && authorPart !== titlePart ? authorPart : '',
            year,
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
