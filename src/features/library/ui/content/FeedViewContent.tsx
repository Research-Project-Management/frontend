'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {} from 'lucide-react';
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
import { useItems } from '@/features/library/sdk/queries/catalog.queries';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import type { Collection } from '@/features/library/domain/types/library.types';
import {
  parseFeedXml,
  mapFeedEntryToCreateItemPayload,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser.domain';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { ContentSkeleton } from '@/features/library/ui/content/ContentSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

interface FeedCreatorApiItem {
  firstName?: string;
  lastName?: string;
  creatorType?: string;
}

interface FeedEntryApiItem {
  id?: string;
  title: string;
  authors: string[];
  creators?: FeedCreatorApiItem[];
  doi?: string;
  arxivId?: string;
  url?: string;
  link?: string;
  pdfUrl?: string;
  publicationDate?: string;
  published?: string;
  year?: number | null;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  summary?: string;
  keywords?: string[];
}

interface FeedFetchApiResponse {
  feedTitle?: string;
  entries?: FeedEntryApiItem[];
  data?: FeedFetchApiResponse;
}

interface FeedViewContentProps {
  feedId?: string | null;
  scopeId?: string;
  canEdit?: boolean;
}

export function FeedViewContent({ feedId, scopeId = 'user', canEdit = true }: FeedViewContentProps) {
  const router = useRouter();
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
    markEntryAsRead,
    toggleEntryRead,
    markAllEntriesAsRead,
    isEntryRead,
  } = useFeedsStore();
  const openModal = useLibraryUIStore((s) => s.openModal);

  // Tab filter: 'all' or 'unread'
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
  // State for expanded abstracts
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const activeFeed = useMemo(() => {
    if (!feedId) return feeds[0];
    return feeds.find((f) => f.id === feedId) || feeds[0];
  }, [feeds, feedId]);

  const { mutateAsync: fetchAcademicFeed, isPending: isFetching } = useFetchAcademicFeed();

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

  const loadFeedEntries = useCallback(async () => {
    if (!activeFeed?.url) {
      setRawEntries([]);
      return;
    }
    setFetchError(null);
    try {
      const res: FeedFetchApiResponse | string = await fetchAcademicFeed(activeFeed.url);
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
            url: e.url || e.link,
            pdfUrl: e.pdfUrl,
            publishedAt: e.publicationDate || e.published,
            year: e.year ?? undefined,
            publicationTitle: e.publicationTitle,
            volume: e.volume,
            issue: e.issue,
            pages: e.pages,
            abstract: e.abstract || e.summary,
            categories: e.keywords || [],
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

  useEffect(() => {
    void loadFeedEntries();
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

  // Count unread items
  const unreadCount = useMemo(() => {
    return retentionFilteredEntries.filter((e) => !readEntryIds.has(e.id)).length;
  }, [retentionFilteredEntries, readEntryIds]);

  // Read filter + search filter
  const filteredEntries = useMemo(() => {
    let list = retentionFilteredEntries;

    if (readFilter === 'unread') {
      list = list.filter((e) => !readEntryIds.has(e.id));
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

  const handleSaveEntry = async (entry: ParsedFeedEntry, targetCollectionId?: string) => {
    markEntryAsRead(entry.id);
    setSavingEntryIds((prev) => new Set(prev).add(entry.id));
    try {
      const createPayload = mapFeedEntryToCreateItemPayload(entry, {
        scopeId,
        collectionId: targetCollectionId,
      });
      await createItem({ ...createPayload, silent: true } as any);
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

  const handleMarkAllRead = () => {
    const allIds = retentionFilteredEntries.map((e) => e.id);
    markAllEntriesAsRead(allIds);
    toast.success('Marked all as read', {
      description: `All ${allIds.length} articles in this feed are marked as read.`,
    });
  };

  if (!activeFeed) {
    return (
      <div className="flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none bg-background">
        <Rss className="size-10 text-muted-foreground mb-3" strokeWidth={1.5} />
        <h3 className="text-16 font-semibold text-foreground mb-1">No RSS Feeds Subscribed</h3>
        <p className="text-13 text-foreground max-w-sm mb-4">
          Stay updated with preprints and peer-reviewed articles by subscribing to feeds.
        </p>
        <Button
          size="sm"
          onClick={() => openModal('ADD_FEED')}
          className="h-8 gap-1.5 cursor-pointer font-medium"
        >
          <Rss className="size-3.5" />
          Subscribe to New Feed
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      {/* Top Filter Bar: All / Unread Filter + Quick Actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setReadFilter('all')}
            className={cn(
              'h-7 px-2.5 rounded-md text-12 font-medium transition-colors cursor-pointer select-none',
              readFilter === 'all'
                ? 'bg-background text-foreground shadow-2xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            All ({retentionFilteredEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setReadFilter('unread')}
            className={cn(
              'h-7 px-2.5 rounded-md text-12 font-medium transition-colors cursor-pointer select-none flex items-center gap-1.5',
              readFilter === 'unread'
                ? 'bg-background text-foreground shadow-2xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {unreadCount > 0 && <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />}
            Unread ({unreadCount})
          </button>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="h-7 px-2 text-11 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer gap-1.5"
                >
                  <CheckCheck className="size-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Mark all feed items as read</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void loadFeedEntries()}
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                aria-label="Refresh feed"
              >
                <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh feed</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main Feed Content List */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-background divide-y divide-border">
        {isFetching && rawEntries.length === 0 ? (
          <div className="p-6">
            <ContentSkeleton rowCount={6} />
          </div>
        ) : fetchError ? (
          <PlaneErrorState
            title="Failed to load RSS feed"
            description={fetchError.message || 'Unable to reach or parse the feed URL.'}
            error={fetchError}
          />
        ) : filteredEntries.length === 0 ? (
          <div className="flex-1 w-full h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center text-foreground">
            <CheckCircle2 className="size-8 stroke-1 mb-2 text-muted-foreground" />
            <h4 className="text-14 font-semibold text-foreground mb-1">
              {readFilter === 'unread'
                ? 'All caught up!'
                : searchQuery
                  ? 'No matching articles'
                  : 'No articles in this feed'}
            </h4>
            <p className="text-12 text-muted-foreground max-w-sm mb-4">
              {readFilter === 'unread'
                ? 'You have read all articles in this feed.'
                : searchQuery
                  ? `No feed articles matched "${searchQuery}".`
                  : 'The feed returned no articles or might be temporarily unavailable.'}
            </p>
            {readFilter === 'unread' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReadFilter('all')}
                className="h-8 gap-1.5 text-12 cursor-pointer"
              >
                View all articles
              </Button>
            ) : !searchQuery ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadFeedEntries()}
                className="h-8 gap-1.5 text-12 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                Try Again
              </Button>
            ) : null}
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSaving = savingEntryIds.has(entry.id);
            const isSaved = savedEntryIds.has(entry.id);
            const isRead = isEntryRead(entry.id);
            const isExpanded = expandedEntryIds.has(entry.id);

            return (
              <div
                key={entry.id}
                onClick={() => {
                  if (!isRead) markEntryAsRead(entry.id);
                }}
                className={cn(
                  'p-4 hover:bg-muted/40 transition-colors flex flex-col gap-1.5 cursor-pointer relative',
                  !isRead && 'bg-blue-50/20 dark:bg-blue-950/10',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start gap-2">
                      {/* Unread indicator dot */}
                      {!isRead ? (
                        <span
                          className="size-2 rounded-full bg-blue-500 shrink-0 mt-1.5"
                          title="Unread"
                        />
                      ) : (
                        <span className="size-2 shrink-0 mt-1.5 opacity-0" />
                      )}

                      <h3
                        className={cn(
                          'text-13 leading-snug tracking-tight',
                          isRead
                            ? 'font-medium text-foreground/80'
                            : 'font-semibold text-foreground',
                        )}
                      >
                        {entry.title}
                      </h3>
                    </div>

                    {entry.authors.length > 0 && (
                      <p className="text-11 text-muted-foreground truncate pl-4">
                        {entry.authors.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Read / Unread toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleEntryRead(entry.id)}
                          className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
                        >
                          {isRead ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5 text-blue-500" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isRead ? 'Mark as unread' : 'Mark as read'}
                      </TooltipContent>
                    </Tooltip>

                    {entry.url && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')}
                            className="h-7 px-2 text-11 gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          >
                            <ExternalLink className="size-3" />
                            <span className="hidden sm:inline">Source</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Open in new tab</TooltipContent>
                      </Tooltip>
                    )}

                    {canEdit && (
                      <div className="flex items-center -space-x-px">
                        <Button
                          type="button"
                          variant={isSaved ? 'outline' : 'default'}
                          size="sm"
                          disabled={isSaving || isSaved}
                          onClick={() => handleSaveEntry(entry)}
                          className={cn(
                            'h-7 px-2.5 text-11 gap-1.5 cursor-pointer shadow-none',
                            collections.length > 0 && !isSaved && 'rounded-r-none border-r-0',
                          )}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="size-3 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : isSaved ? (
                            <>
                              <Check className="size-3 text-emerald-500" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <BookPlus className="size-3" />
                              <span>Save to Library</span>
                            </>
                          )}
                        </Button>

                        {/* Save to Collection Dropdown */}
                        {collectionList.length > 0 && !isSaved && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="default"
                                size="icon"
                                disabled={isSaving || isSaved}
                                className="h-7 w-6 rounded-l-none px-0 shadow-none border-l border-primary-foreground/20 cursor-pointer"
                                aria-label="Save to specific collection"
                              >
                                <ChevronDown className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
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
                                <BookPlus className="size-3.5 mr-2 text-primary" />
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
                  <div className="pl-4">
                    <p
                      className={cn(
                        'text-11 leading-relaxed text-foreground/90 transition-all',
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
                        className="inline-flex items-center gap-1 text-10 font-medium text-primary hover:underline mt-0.5 cursor-pointer"
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

                {/* Metadata Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 pl-4 text-10 font-mono text-muted-foreground">
                  {(entry.publicationTitle || feedTitle) && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-foreground font-sans">
                      {entry.publicationTitle || feedTitle}
                    </span>
                  )}
                  {entry.year && (
                    <span className="flex items-center gap-0.5 text-foreground">
                      <Calendar className="size-3" /> {entry.year}
                    </span>
                  )}
                  {entry.arxivId ? (
                    <a
                      href={`https://arxiv.org/abs/${entry.arxivId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-primary hover:underline cursor-pointer"
                    >
                      arXiv:{entry.arxivId}
                    </a>
                  ) : entry.doi ? (
                    <a
                      href={`https://doi.org/${entry.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-primary hover:underline cursor-pointer"
                    >
                      DOI: {entry.doi}
                    </a>
                  ) : null}

                  {/* Direct clickable PDF available badge */}
                  {entry.pdfUrl && (
                    <a
                      href={entry.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        markEntryAsRead(entry.id);
                      }}
                      className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer font-sans font-medium px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/15 transition-colors"
                      title="Open PDF in new tab"
                    >
                      <FileText className="size-3" /> PDF available
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default FeedViewContent;
