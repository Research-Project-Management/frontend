'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search as SearchIcon,
  Copy,
  Check,
  Plus,
  AlertCircle,
  AlertTriangle,
  X,
  FileText,
  Library,
  BookMarked,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useEditorCitations } from '@/features/editor/hooks/use-citation';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { generateCitationKey } from '@/features/library';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { parseBibContent, type BibEntry } from '@/features/editor/utils/bib-parser.util';
import { extractCitationKeys } from '@/features/editor/utils/citation.util';
import { PlaneEmptyState, PlaneErrorState } from '@/shared/components/ui';

interface CitationTabProps {
  onClose?: () => void;
}

interface UnifiedCitation {
  id: string;
  key: string;
  title: string;
  authorsSummary: string;
  year?: string;
  journal?: string;
  source: 'bib' | 'library';
}

export default function CitationTab({ onClose }: CitationTabProps) {
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
  const [filterTab, setFilterTab] = useState<'document' | 'library'>('document');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync content from active editor
  const refreshContent = useCallback(() => {
    const current = getContent();
    setContent(current);
  }, [getContent]);

  useEffect(() => {
    refreshContent();
    if (!engine) return;
    const unsub = engine.onContentChange((val) => {
      setContent(val);
    });
    return unsub;
  }, [engine, refreshContent]);

  // Load project files to extract citations from any project .bib files
  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  // Fetch authoritative bibliography validation (duplicate keys, missing required fields)
  const { data: citationValidation } = useQuery({
    queryKey: ['project-citation-validation', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      try {
        return await manuscriptService.citations.validate(projectId);
      } catch {
        return null;
      }
    },
    enabled: Boolean(projectId),
  });

  // Parse BibTeX entries from all .bib files in the project
  const bibEntries = useMemo<BibEntry[]>(() => {
    const bibFiles = (projectFiles || []).filter((f: any) => {
      const fileName = (f?.name || f?.title || f?.filename || '').toLowerCase();
      return fileName.endsWith('.bib') && Boolean(f?.content);
    });

    const list: BibEntry[] = [];
    const seenKeys = new Set<string>();

    for (const f of bibFiles) {
      if (!f.content) continue;
      try {
        const entries = parseBibContent(f.content);
        for (const entry of entries) {
          const lowerKey = entry.key?.toLowerCase();
          if (lowerKey && !seenKeys.has(lowerKey)) {
            seenKeys.add(lowerKey);
            list.push(entry);
          }
        }
      } catch {
        // Ignore parsing errors for malformed bib files
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
        journal: item.journal || item.publicationTitle,
        source: 'library',
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

  // Filter lists based on search query
  const filteredCitedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return citedEntries;
    return citedEntries.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.authorsSummary.toLowerCase().includes(q) ||
        (item.year && item.year.includes(q)),
    );
  }, [citedEntries, searchQuery]);

  const filteredAvailableEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allAvailableEntries;
    return allAvailableEntries.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.authorsSummary.toLowerCase().includes(q) ||
        (item.year && item.year.includes(q)),
    );
  }, [allAvailableEntries, searchQuery]);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(`\\cite{${key}}`);
    setCopiedKey(key);
    toast.success(`Copied \\cite{${key}} to clipboard`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleInsertKey = (key: string) => {
    const matchedEntry = allAvailableEntries.find(
      (e) => e.key.toLowerCase() === key.toLowerCase(),
    );
    if (engine) {
      engine.insertText(`\\cite{${key}}`);
      engine.focus();
      toast.success(`Inserted \\cite{${key}}`);
      refreshContent();
      EditorEventBus.emit('flux:insert-citation', {
        bibKey: key,
        textInserted: true,
        entry: matchedEntry ? {
          key: matchedEntry.key,
          title: matchedEntry.title,
          year: matchedEntry.year,
          journal: matchedEntry.journal,
          source: matchedEntry.source,
        } : undefined,
      });
      return;
    }
    EditorEventBus.emit('flux:insert-citation', {
      bibKey: key,
      textInserted: false,
      entry: matchedEntry ? {
        key: matchedEntry.key,
        title: matchedEntry.title,
        year: matchedEntry.year,
        journal: matchedEntry.journal,
        source: matchedEntry.source,
      } : undefined,
    });
    toast.success(`Inserted \\cite{${key}}`);
  };

  const openPickerModal = useCallback((initialQuery?: unknown, initialKey?: unknown) => {
    const query = typeof initialQuery === 'string' ? initialQuery : undefined;
    const key = typeof initialKey === 'string' ? initialKey : query;
    EditorEventBus.emit(
      'flux:open-citation-picker',
      query ? { initialQuery: query, initialKey: key } : undefined,
    );
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground select-none">
      {/* ── Header Toolbar (h-9) ── */}
      <div className="h-9 px-3 border-b border-border flex items-center justify-between shrink-0 bg-background">
        <span className="text-xs font-semibold text-foreground">Citations</span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openPickerModal()}
                className="size-7 flex items-center justify-center rounded-sm text-foreground/80 hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
                aria-label="Insert citation"
              >
                <Plus className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Insert citation</TooltipContent>
          </Tooltip>

          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="size-7 flex items-center justify-center rounded-sm text-foreground/80 hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
                  aria-label="Close panel"
                >
                  <X className="size-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close panel</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="p-2 border-b border-border shrink-0 bg-background">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
          <Input
            type="text"
            placeholder="Search citations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background border border-border rounded-md placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary w-full transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer relative after:absolute after:-inset-2 after:content-['']"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Content List ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 pb-4 space-y-1 bg-background">
        {filterTab === 'document' ? (
          <>
            {/* Bibliography Validation Warnings (Backend Citations Service Parity) */}
            {citationValidation && citationValidation.duplicateKeys && citationValidation.duplicateKeys.length > 0 && (
              <div className="mb-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>Duplicate Citation Keys ({citationValidation.duplicateKeys.length})</span>
                </div>
                <p className="text-12 leading-normal text-destructive/90">
                  Duplicate keys in your .bib files cause broken citations and compilation errors.
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {citationValidation.duplicateKeys.map((k) => (
                    <span key={k} className="px-1.5 py-0.5 font-mono text-11 font-medium rounded bg-destructive/20 text-destructive">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {citationValidation && citationValidation.missingFieldWarnings && citationValidation.missingFieldWarnings.length > 0 && (
              <div className="mb-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-foreground text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Missing Required Metadata ({citationValidation.missingFieldWarnings.length})</span>
                </div>
                <div className="space-y-0.5 text-12 text-muted-foreground max-h-20 overflow-y-auto">
                  {citationValidation.missingFieldWarnings.map((w) => (
                    <div key={w.key} className="truncate">
                      <span className="font-mono text-foreground font-medium">{w.key}</span>: missing {w.missingFields.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing/Unresolved Keys */}
            {missingKeys.length > 0 && (
              <div className="mb-2 space-y-1">
                <div className="flex items-center gap-1.5 px-1 py-0.5 text-11 font-medium text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Unresolved in Library ({missingKeys.length})</span>
                </div>
                {missingKeys.map((key) => (
                  <div
                    key={key}
                    onClick={() => openPickerModal(key)}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-foreground cursor-pointer hover:bg-amber-500/15 transition-colors group"
                  >
                    <span className="font-mono text-11 font-medium text-amber-700 dark:text-amber-300 truncate">
                      {key}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPickerModal(key);
                        }}
                        className="h-6 px-1.5 rounded-xs text-10 font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center gap-1"
                        title="Search reference in inspector"
                      >
                        <SearchIcon className="size-2.5" />
                        <span>Find</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyKey(key);
                        }}
                        className="h-6 px-1.5 rounded-xs text-11 text-muted-foreground hover:text-foreground hover:bg-amber-500/20 transition-colors cursor-pointer"
                        title="Copy \cite command"
                      >
                        {copiedKey === key ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved Cited Items */}
            {filteredCitedEntries.length === 0 && missingKeys.length === 0 ? (
              searchQuery ? (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="search"
                    isCompact
                    title="No citations found"
                    description={`No citations matching "${searchQuery}"`}
                  />
                </div>
              ) : (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="citations"
                    isCompact
                    title="No citations in document"
                    description="Citations added with \cite{...} will appear here."
                    action={
                      <button
                        type="button"
                        onClick={() => openPickerModal()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="size-3.5" />
                        <span>Insert Citation</span>
                      </button>
                    }
                  />
                </div>
              )
            ) : (
              <div className="space-y-0.5">
                {filteredCitedEntries.map((item) => (
                  <div
                    key={item.key}
                    onClick={() => handleInsertKey(item.key)}
                    className="group relative flex flex-col gap-0.5 p-2 rounded-md hover:bg-muted/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-xs truncate shrink-0 max-w-[150px]">
                          {item.key}
                        </span>
                        {item.source === 'bib' && (
                          <span className="text-11 font-mono px-1.5 py-0.5 rounded-xs bg-muted text-muted-foreground shrink-0">
                            .bib
                          </span>
                        )}
                      </div>
                      {item.year && (
                        <span className="text-11 text-muted-foreground font-mono shrink-0">
                          {item.year}
                        </span>
                      )}
                    </div>

                    <p className="text-13 font-serif font-normal text-foreground line-clamp-2 leading-snug tracking-normal">
                      {item.title}
                    </p>

                    <p className="text-12 text-muted-foreground truncate font-sans">
                      {item.authorsSummary}
                      {item.journal ? ` · ${item.journal}` : ''}
                    </p>

                    {/* Quick actions on hover */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/95 backdrop-blur-xs p-0.5 rounded-md border border-border">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPickerModal(item.key, item.key);
                        }}
                        className="size-7 flex items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Inspect paper details"
                        aria-label="Inspect paper details"
                      >
                        <Info className="size-3.5 shrink-0 text-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyKey(item.key);
                        }}
                        className="size-7 flex items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Copy \cite command"
                        aria-label="Copy citation command"
                      >
                        {copiedKey === item.key ? (
                          <Check className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="size-3.5 shrink-0 text-foreground" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInsertKey(item.key);
                        }}
                        className="size-7 flex items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Insert \cite at cursor"
                        aria-label="Insert citation at cursor"
                      >
                        <Plus className="size-3.5 shrink-0 text-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Library Tab */
          <>
            {isLibraryLoading ? (
              <div className="py-10 text-center text-12 text-muted-foreground">
                Loading workspace references...
              </div>
            ) : isLibraryError ? (
              <div className="py-6 px-2">
                <PlaneErrorState
                  title="Unable to load citations"
                  description="An issue occurred while loading references from your library."
                  error={new Error('Failed to load workspace references')}
                />
              </div>
            ) : filteredAvailableEntries.length === 0 ? (
              searchQuery ? (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="search"
                    isCompact
                    title="No citations found"
                    description={`No citations matching "${searchQuery}"`}
                  />
                </div>
              ) : (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="citations"
                    isCompact
                    title="Workspace library is empty"
                    description="Add papers to your workspace library or create a .bib file in this project."
                    action={
                      <button
                        type="button"
                        onClick={() => openPickerModal()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="size-3.5" />
                        <span>Search References</span>
                      </button>
                    }
                  />
                </div>
              )
            ) : (
              <div className="space-y-0.5">
                {filteredAvailableEntries.map((item) => (
                  <div
                    key={item.key}
                    onClick={() => handleInsertKey(item.key)}
                    className="group relative flex flex-col gap-0.5 p-2 rounded-md hover:bg-muted/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-xs truncate shrink-0 max-w-[150px]">
                          {item.key}
                        </span>
                        {item.source === 'bib' && (
                          <span className="text-11 font-mono px-1.5 py-0.5 rounded-xs bg-muted text-muted-foreground shrink-0">
                            .bib
                          </span>
                        )}
                      </div>
                      {item.year && (
                        <span className="text-11 text-muted-foreground font-mono shrink-0">
                          {item.year}
                        </span>
                      )}
                    </div>

                    <p className="text-13 font-serif font-normal text-foreground line-clamp-2 leading-snug tracking-normal">
                      {item.title}
                    </p>

                    <p className="text-12 text-muted-foreground truncate font-sans">
                      {item.authorsSummary}
                      {item.journal ? ` · ${item.journal}` : ''}
                    </p>

                    {/* Quick actions on hover */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/95 backdrop-blur-xs p-0.5 rounded-md border border-border">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPickerModal(item.key, item.key);
                        }}
                        className="size-7 flex items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Inspect paper details"
                        aria-label="Inspect paper details"
                      >
                        <Info className="size-3.5 shrink-0 text-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyKey(item.key);
                        }}
                        className="size-7 flex items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Copy \cite command"
                        aria-label="Copy citation command"
                      >
                        {copiedKey === item.key ? (
                          <Check className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="size-3.5 shrink-0 text-foreground" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInsertKey(item.key);
                        }}
                        className="size-7 flex items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Insert \cite at cursor"
                        aria-label="Insert citation at cursor"
                      >
                        <Plus className="size-3.5 shrink-0 text-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bottom Navigation Tabs: In Document vs Library (Unified with Review Tab) ── */}
      <nav aria-label="Citations filter" className="flex h-12 shrink-0 items-center border-t border-border bg-background px-2 pb-2 pt-1 select-none">
        {/* Tab 1: In Document */}
        <button
          type="button"
          onClick={() => setFilterTab('document')}
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-1 py-1 px-2 rounded-md transition-colors cursor-pointer font-medium',
            filterTab === 'document'
              ? 'text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {filterTab === 'document' && (
            <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-full" />
          )}
          <FileText className="size-3.5 shrink-0 text-foreground" />
          <span className="text-12 leading-normal">In Document</span>
        </button>

        {/* Tab 2: Library */}
        <button
          type="button"
          onClick={() => setFilterTab('library')}
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-1 py-1 px-2 rounded-md transition-colors cursor-pointer font-medium',
            filterTab === 'library'
              ? 'text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {filterTab === 'library' && (
            <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-full" />
          )}
          <Library className="size-3.5 shrink-0 text-foreground" />
          <span className="text-12 leading-normal">Library</span>
        </button>
      </nav>
    </div>
  );
}
