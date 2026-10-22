'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Rss,
  EyeOff,
  Eye,
  ExternalLink,
  Loader2,
  Check,
  BookPlus,
  ChevronDown,
  Folder,
  ChevronUp,
  Calendar,
  Bookmark,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useFetchAcademicFeed } from '@/features/library/sdk/queries/ingestion.queries';
import { useItems, useLibraryItemsQuery } from '@/features/library/sdk/queries/catalog.queries';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import type { Collection } from '@/features/library/domain/types/library.types';
import {
  parseFeedXml,
  mapFeedEntryToCreateItemPayload,
  type ParsedFeedEntry,
  type FeedCreatorApiItem,
  type FeedEntryApiItem,
  type FeedFetchApiResponse,
} from '@/features/library/domain/feed-parser.domain';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { ContentSkeleton } from '@/features/library/ui/content/ContentSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import {
  FeedStackIllustration,
  FeedAllReadIllustration,
  SearchStackIllustration,
} from '@/features/library/ui/content/LibraryIllustrations';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

interface FeedViewContentProps {
  feedId?: string | null;
  scopeId?: string;
  canEdit?: boolean;
}

export function FeedViewContent({ feedId, scopeId = 'user', canEdit = true }: FeedViewContentProps) {
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get('q') || '').trim();
  const { createItem } = useItems({ scopeId, enabled: false });
  const { collections = [] } = useCollections(scopeId);
  const collectionList: Collection[] = (collections as Collection[]) || [];
  const {
    feeds,
    loadFeeds,
    refreshCounter,
    readEntryIds,
    selectedFeedEntry,
    setSelectedFeedEntry,
    readFilter,
    setReadFilter,
    markEntryAsRead,
    toggleEntryRead,
    isEntryRead,
  } = useFeedsStore();
  const openModal = useLibraryUIStore((s) => s.openModal);
  const isInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);

  // State for expanded abstracts in inline view
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const activeFeed = useMemo(() => {
    if (!feedId) return feeds[0];
    return feeds.find((f) => f.id === feedId) || feeds[0];
  }, [feeds, feedId]);

  const { mutateAsync: fetchAcademicFeed, isPending: isFetching } = useFetchAcademicFeed();

  // Query library items to cross-reference if an article is already saved in library
  const { data: libraryData } = useLibraryItemsQuery(
    scopeId,
    { limit: 100, fields: ['id', 'title', 'doi', 'url'] },
    { enabled: true },
  );

  const libraryItemLookup = useMemo(() => {
    const doiMap = new Set<string>();
    const titleMap = new Set<string>();
    const items = libraryData?.items || [];
    for (const item of items) {
      if (item.doi) doiMap.add(item.doi.trim().toLowerCase());
      if (item.title) titleMap.add(item.title.trim().toLowerCase());
    }
    return { doiMap, titleMap };
  }, [libraryData?.items]);

  const [rawEntries, setRawEntries] = useState<ParsedFeedEntry[]>([]);
  const [feedTitle, setFeedTitle] = useState<string>('');
  const [savingEntryIds, setSavingEntryIds] = useState<Set<string>>(() => new Set());
  const [savedEntryIds, setSavedEntryIds] = useState<Set<string>>(() => new Set());
  const [fetchError, setFetchError] = useState<Error | null>(null);

  const toggleAbstract = (id: string) => {
    setExpandedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadFeedEntries = useCallback(async (forceRefresh = false) => {
    if (!activeFeed?.url) {
      setRawEntries([]);
      return;
    }
    setFetchError(null);
    try {
      const res: FeedFetchApiResponse | string = await fetchAcademicFeed({
        url: activeFeed.url,
        forceRefresh,
      });
      const payload = typeof res === 'object' && res !== null && res.data ? res.data : res;
      if (payload && typeof payload === 'object' && Array.isArray(payload.entries)) {
        setFeedTitle(payload.feedTitle || activeFeed.name);
        setRawEntries(
          payload.entries.map((e: FeedEntryApiItem, idx: number) => ({
            id: e.id || e.url || e.link || `feed-item-${idx}`,
            title: e.title,
            authors: e.authors || [],
            creators: (e.creators || []).map((c: FeedCreatorApiItem) => ({
              firstName: c.firstName || '',
              lastName: c.lastName || '',
              creatorType: 'author' as const,
            })),
            doi: e.doi,
            arxivId: e.arxivId,
            primaryCategory: e.primaryCategory || e.keywords?.[0],
            url: e.url || e.link,
            pdfUrl: e.pdfUrl,
            publishedAt: e.publicationDate || e.published || e.updated,
            updatedAt: e.updated,
            year: e.year ?? undefined,
            publicationTitle: e.publicationTitle,
            volume: e.volume,
            issue: e.issue,
            pages: e.pages,
            abstract: e.abstract || e.summary,
            categories: e.keywords || [],
            comment: e.comment,
            rights: e.rights,
            feedFormat: 'rss2',
          })),
        );
      } else if (typeof payload === 'string') {
        setRawEntries(parseFeedXml(payload));
      } else {
        setRawEntries([]);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err : new Error('Failed to fetch feed'));
      setRawEntries([]);
    }
  }, [activeFeed, fetchAcademicFeed]);

  const prevRefreshCounter = useRef(refreshCounter);
  useEffect(() => {
    const isManualTrigger = refreshCounter > prevRefreshCounter.current;
    prevRefreshCounter.current = refreshCounter;
    void loadFeedEntries(isManualTrigger);
  }, [loadFeedEntries, refreshCounter]);

  // Retention filter: filter out items older than activeFeed.retentionDays (if set and > 0)
  const retentionFilteredEntries = useMemo(() => {
    const days = activeFeed?.retentionDays ?? 30;
    if (!days || days <= 0) return rawEntries;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return rawEntries.filter((e) => {
      if (!e.publishedAt) return true;
      const t = Date.parse(e.publishedAt);
      if (isNaN(t)) return true;
      return t >= cutoff;
    });
  }, [rawEntries, activeFeed?.retentionDays]);

  // Read filter + search filter
  const filteredEntries = useMemo(() => {
    let list = retentionFilteredEntries;

    if (readFilter === 'unread') {
      list = list.filter((e) => !readEntryIds.has(e.id));
    } else if (readFilter === 'read') {
      list = list.filter((e) => readEntryIds.has(e.id));
    }

    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.authors.some((a) => a.toLowerCase().includes(q)) ||
        (e.abstract && e.abstract.toLowerCase().includes(q)) ||
        (e.doi && e.doi.toLowerCase().includes(q)) ||
        (e.arxivId && e.arxivId.toLowerCase().includes(q)),
    );
  }, [retentionFilteredEntries, readFilter, readEntryIds, searchQuery]);

  // Master-Detail: Auto-select the first article if none is currently selected
  useEffect(() => {
    if (filteredEntries.length > 0) {
      if (!selectedFeedEntry || !filteredEntries.some((e) => e.id === selectedFeedEntry.id)) {
        setSelectedFeedEntry(filteredEntries[0]);
      }
    }
  }, [filteredEntries, selectedFeedEntry, setSelectedFeedEntry]);

  // Virtualizer for scalable performance with 500-1000+ items
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110,
    overscan: 10,
  });

  // Keyboard navigation shortcuts: Backtick (`) or m to toggle read, j/k or ArrowDown/ArrowUp
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Ctrl/Cmd + Shift + S: Save selected feed entry to My Library
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        if (selectedFeedEntry && canEdit) {
          e.preventDefault();
          void handleSaveEntry(selectedFeedEntry);
        }
      } else if (e.key === '`' || e.key === 'm') {
        if (selectedFeedEntry) {
          e.preventDefault();
          toggleEntryRead(selectedFeedEntry.id);
        }
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        if (filteredEntries.length === 0) return;
        e.preventDefault();
        const currentIndex = filteredEntries.findIndex((item) => item.id === selectedFeedEntry?.id);
        const nextIndex = currentIndex < filteredEntries.length - 1 ? currentIndex + 1 : 0;
        const nextEntry = filteredEntries[nextIndex];
        setSelectedFeedEntry(nextEntry);
        rowVirtualizer.scrollToIndex(nextIndex, { align: 'auto' });
        if (!isEntryRead(nextEntry.id)) {
          markEntryAsRead(nextEntry.id);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (filteredEntries.length === 0) return;
        e.preventDefault();
        const currentIndex = filteredEntries.findIndex((item) => item.id === selectedFeedEntry?.id);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredEntries.length - 1;
        const prevEntry = filteredEntries[prevIndex];
        setSelectedFeedEntry(prevEntry);
        rowVirtualizer.scrollToIndex(prevIndex, { align: 'auto' });
        if (!isEntryRead(prevEntry.id)) {
          markEntryAsRead(prevEntry.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedFeedEntry,
    filteredEntries,
    canEdit,
    toggleEntryRead,
    setSelectedFeedEntry,
    isEntryRead,
    markEntryAsRead,
    rowVirtualizer,
  ]);

  // Check if article is already in library (via DOI or exact Title)
  const isItemInLibrary = useCallback(
    (entry: ParsedFeedEntry) => {
      if (savedEntryIds.has(entry.id)) return true;
      if (entry.doi && libraryItemLookup.doiMap.has(entry.doi.trim().toLowerCase())) return true;
      if (entry.title && libraryItemLookup.titleMap.has(entry.title.trim().toLowerCase())) return true;
      return false;
    },
    [savedEntryIds, libraryItemLookup],
  );

  const handleSaveEntry = async (entry: ParsedFeedEntry, targetCollectionId?: string) => {
    markEntryAsRead(entry.id);
    setSavingEntryIds((prev) => new Set(prev).add(entry.id));
    try {
      const createPayload = mapFeedEntryToCreateItemPayload(entry, {
        scopeId,
        collectionId: targetCollectionId,
      });
      await createItem({ ...createPayload, silent: true });
      setSavedEntryIds((prev) => new Set(prev).add(entry.id));

      const colName = targetCollectionId
        ? collectionList.find((c: Collection) => c.id === targetCollectionId)?.name
        : undefined;

      toast.success(colName ? `Saved to "${colName}"` : 'Saved to Library', {
        description: `"${entry.title.slice(0, 48)}..." added to your collection.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not add feed item.';
      toast.error('Failed to save to library', { description: msg });
    } finally {
      setSavingEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const handleSelectEntry = (entry: ParsedFeedEntry) => {
    if (!isEntryRead(entry.id)) {
      markEntryAsRead(entry.id);
    }
    setSelectedFeedEntry(entry);
  };

  if (!activeFeed) {
    return (
      <PlaneEmptyState
        illustration={FeedStackIllustration}
        title="No RSS feeds subscribed"
        description="Stay updated with preprints and peer-reviewed articles by subscribing to feeds."
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      {/* Sub Navigation Bar: All / Unread / Read (Your Work style) */}
      <nav
        aria-label="Feed read state filter"
        className="flex items-center gap-1 border-b border-border px-4 bg-background select-none shrink-0 h-10 min-h-10"
      >
        <button
          type="button"
          onClick={() => setReadFilter('all')}
          className={cn(
            'relative flex h-full items-center px-3.5 text-13 font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0',
            readFilter === 'all'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>All</span>
          {readFilter === 'all' && (
            <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setReadFilter('unread')}
          className={cn(
            'relative flex h-full items-center px-3.5 text-13 font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0',
            readFilter === 'unread'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>Unread</span>
          {readFilter === 'unread' && (
            <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setReadFilter('read')}
          className={cn(
            'relative flex h-full items-center px-3.5 text-13 font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0',
            readFilter === 'read'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>Read</span>
          {readFilter === 'read' && (
            <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary" />
          )}
        </button>
      </nav>

      {/* Main Feed Content List - Virtualized for instant smooth scrolling */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto min-h-0 bg-transparent pb-10 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {isFetching && rawEntries.length === 0 ? (
          <div className="p-3">
            <ContentSkeleton rowCount={8} />
          </div>
        ) : fetchError ? (
          <PlaneErrorState
            title="Failed to load RSS feed"
            description="Unable to reach or parse the RSS feed URL. The remote server may be temporarily down or blocking external requests."
            error={fetchError}
            className="h-full min-h-[440px]"
          />
        ) : filteredEntries.length === 0 ? (
          searchQuery ? (
            <PlaneEmptyState
              illustration={SearchStackIllustration}
              title="No matching articles"
              description={`No feed articles matched "${searchQuery}". Try checking for spelling errors or searching with different keywords.`}
              className="h-full min-h-[400px]"
            />
          ) : readFilter === 'unread' ? (
            <PlaneEmptyState
              illustration={FeedAllReadIllustration}
              title="All caught up!"
              description="You have read all articles in this feed."
              className="h-full min-h-[400px]"
            />
          ) : readFilter === 'read' ? (
            <PlaneEmptyState
              illustration={FeedStackIllustration}
              title="No read articles"
              description="Articles you read in this feed will be listed here."
              className="h-full min-h-[400px]"
            />
          ) : (
            <PlaneEmptyState
              illustration={FeedStackIllustration}
              title="No articles in this feed"
              description="The feed returned no articles or might be temporarily unavailable."
              className="h-full min-h-[400px]"
            />
          )
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filteredEntries[virtualRow.index];
              if (!entry) return null;

              const isSaving = savingEntryIds.has(entry.id);
              const isSaved = isItemInLibrary(entry);
              const isRead = isEntryRead(entry.id);
              const isExpanded = expandedEntryIds.has(entry.id);
              const isSelected = selectedFeedEntry?.id === entry.id;

              return (
                <div
                  key={entry.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-border/60"
                >
                  <article
                    aria-label={entry.title}
                    onClick={() => handleSelectEntry(entry)}
                    className={cn(
                      'px-4 py-3.5 flex flex-col gap-2 cursor-pointer relative',
                      isSelected && 'bg-muted/60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-14 sm:text-[15px] font-semibold text-foreground leading-snug tracking-tight block">
                          {entry.title}
                        </h3>

                        {entry.authors.length > 0 && (
                          <p className="text-12 text-muted-foreground truncate font-normal leading-normal">
                            {entry.authors.join(', ')}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Read / Unread toggle */}
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleEntryRead(entry.id)}
                              className="size-7 rounded-md text-foreground cursor-pointer"
                              aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
                            >
                              {isRead ? (
                                <EyeOff className="size-3.5 text-foreground" />
                              ) : (
                                <Eye className="size-3.5 text-foreground" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {isRead ? 'Mark as unread' : 'Mark as read'}
                          </TooltipContent>
                        </Tooltip>

                        {entry.url && (
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')}
                                className="size-7 rounded-md text-foreground cursor-pointer"
                                aria-label="View source"
                              >
                                <ExternalLink className="size-3.5 text-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">View source</TooltipContent>
                          </Tooltip>
                        )}

                        {canEdit && (
                          <div className="flex items-center -space-x-px">
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={isSaving || isSaved}
                                  onClick={() => handleSaveEntry(entry)}
                                  className={cn(
                                    'size-7 text-foreground cursor-pointer',
                                    collectionList.length > 0 && !isSaved ? 'rounded-l-md rounded-r-none' : 'rounded-md',
                                  )}
                                  aria-label={isSaved ? 'In library' : isSaving ? 'Saving to library...' : 'Save to library'}
                                >
                                  {isSaving ? (
                                    <Loader2 className="size-3.5 animate-spin text-foreground" />
                                  ) : isSaved ? (
                                    <Check className="size-3.5 text-foreground" />
                                  ) : (
                                    <BookPlus className="size-3.5 text-foreground" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {isSaved ? 'In library' : isSaving ? 'Saving to library...' : 'Save to library'}
                              </TooltipContent>
                            </Tooltip>

                            {/* Save to Collection Dropdown */}
                            {collectionList.length > 0 && !isSaved && (
                              <DropdownMenu>
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={isSaving || isSaved}
                                        className="h-7 w-4.5 rounded-l-none rounded-r-md px-0 text-foreground cursor-pointer"
                                        aria-label="Save to specific collection"
                                      >
                                        <ChevronDown className="size-3 text-foreground" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Save to collection...
                                  </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent
                                  align="end"
                                  side="bottom"
                                  sideOffset={4}
                                  className="w-56 p-1 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 select-none"
                                >
                                  <div className="px-2 py-1.5 text-11 font-medium text-muted-foreground">
                                    Save to collection...
                                  </div>
                                  <DropdownMenuSeparator className="my-1" />
                                  <DropdownMenuItem
                                    onClick={() => handleSaveEntry(entry)}
                                    className="h-7.5 px-2 text-12 font-medium cursor-pointer rounded hover:bg-muted"
                                  >
                                    <BookPlus className="size-3.5 mr-2 text-muted-foreground" />
                                    <span>My Library (Root)</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="my-1" />
                                  <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-none">
                                    {collectionList.map((col: Collection) => (
                                      <DropdownMenuItem
                                        key={col.id}
                                        onClick={() => handleSaveEntry(entry, col.id)}
                                        className="h-7.5 px-2 text-12 cursor-pointer rounded hover:bg-muted flex items-center gap-2"
                                      >
                                        <Folder className="size-3.5 text-muted-foreground shrink-0" />
                                        <span className="truncate">{col.name}</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Abstract with Expand / Collapse */}
                    {entry.abstract && (
                      <div className="w-full">
                        <p
                          className={cn(
                            'text-[13px] leading-relaxed text-muted-foreground transition-all',
                            !isExpanded && 'line-clamp-2',
                          )}
                        >
                          {entry.abstract}
                        </p>
                        {entry.abstract.length > 140 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAbstract(entry.id);
                            }}
                            className="inline-flex items-center gap-1 text-12 font-medium text-muted-foreground hover:text-foreground hover:underline mt-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
                          >
                            {isExpanded ? (
                              <>
                                <span>Show less</span>
                                <ChevronUp className="size-3" />
                              </>
                            ) : (
                              <>
                                <span>Show more</span>
                                <ChevronDown className="size-3" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Metadata & Links - Clean academic citation order (Date -> Source -> Identifier -> Direct Resource) */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-12 text-foreground">
                      {/* 1. Date of publication (full date formatted or year fallback) */}
                      {(() => {
                        const dateVal = entry.publishedAt || (entry.year ? String(entry.year) : null);
                        if (!dateVal) return null;
                        let formattedDate: string | null = null;
                        if (entry.publishedAt) {
                          const d = new Date(entry.publishedAt);
                          if (!isNaN(d.getTime())) {
                            formattedDate = new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(d);
                          }
                        }
                        const displayDate = formattedDate || (entry.year ? String(entry.year) : dateVal);
                        return (
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Calendar className="size-3.5 text-foreground shrink-0" />
                            <span>{displayDate}</span>
                          </span>
                        );
                      })()}

                      {/* 2. Publication / Venue / Journal */}
                      {entry.publicationTitle && entry.publicationTitle !== feedTitle && (
                        <span className="inline-flex items-center font-normal">
                          {entry.publicationTitle}
                        </span>
                      )}

                      {/* 2.5 Primary Category / Subject (e.g. cs.AI, Physics) */}
                      {(entry.primaryCategory || (entry.categories && entry.categories.length > 0)) && (
                        <span className="inline-flex items-center font-normal text-muted-foreground">
                          {entry.primaryCategory || entry.categories[0]}
                        </span>
                      )}

                      {/* 3. Canonical Permanent Identifier (arXiv ID or DOI) */}
                      {entry.arxivId ? (
                        <a
                          href={`https://arxiv.org/abs/${entry.arxivId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                        >
                          <Bookmark className="size-3.5 text-foreground shrink-0" />
                          <span>arXiv:{entry.arxivId}</span>
                        </a>
                      ) : entry.doi ? (
                        <a
                          href={`https://doi.org/${entry.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center hover:underline cursor-pointer"
                        >
                          DOI: {entry.doi}
                        </a>
                      ) : null}

                      {/* 4. Direct External Link / PDF Resource */}
                      {(() => {
                        const targetUrl = entry.pdfUrl || entry.url;
                        if (!targetUrl) return null;
                        let displayLabel = targetUrl;
                        try {
                          const parsed = new URL(targetUrl);
                          displayLabel = parsed.hostname.replace(/^www\./, '') + (parsed.pathname.length > 20 ? parsed.pathname.slice(0, 18) + '…' : parsed.pathname);
                        } catch {
                          displayLabel = targetUrl.length > 28 ? targetUrl.slice(0, 26) + '…' : targetUrl;
                        }
                        return (
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                              markEntryAsRead(entry.id);
                            }}
                            className="inline-flex items-center gap-1.5 hover:underline cursor-pointer max-w-[240px] truncate"
                            title={targetUrl}
                          >
                            <ExternalLink className="size-3.5 text-foreground shrink-0" />
                            <span className="truncate">{displayLabel}</span>
                          </a>
                        );
                      })()}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedViewContent;
