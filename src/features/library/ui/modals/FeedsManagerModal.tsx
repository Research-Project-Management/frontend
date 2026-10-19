'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Rss,
  Plus,
  Trash2,
  RefreshCw,
  BookPlus,
  ExternalLink,
  Check,
  Loader2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFetchAcademicFeed } from '@/features/library/sdk/queries/ingestion.queries';
import { useItems } from '@/features/library/sdk/queries/catalog.queries';
import {
  mapFeedEntryToCreateItemPayload,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser.domain';
import type { Collection } from '@/features/library/domain/types/library.types';
import { cn } from '@/shared/lib/utils';

export interface SavedFeedSubscription {
  id: string;
  name: string;
  url: string;
  lastRefreshed?: string;
}

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

const DEFAULT_ACADEMIC_FEEDS: SavedFeedSubscription[] = [
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv: Artificial Intelligence (cs.AI)',
    url: 'https://rss.arxiv.org/rss/cs.AI',
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv: Computation and Language (cs.CL)',
    url: 'https://rss.arxiv.org/rss/cs.CL',
  },
  {
    id: 'nature-main',
    name: 'Nature — Current Issue Research',
    url: 'https://www.nature.com/nature.rss',
  },
];

const FEEDS_STORAGE_KEY = 'flux_library_rss_feeds_v1';

export interface FeedsManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeId: string;
  collections?: Collection[];
  defaultCollectionId?: string | null;
}

export default function FeedsManagerModal({
  open,
  onOpenChange,
  scopeId,
  collections = [],
  defaultCollectionId = null,
}: FeedsManagerModalProps) {
  const { mutateAsync: fetchAcademicFeed } = useFetchAcademicFeed();
  const { createItem } = useItems({ scopeId, enabled: false });
  const [feeds, setFeeds] = useState<SavedFeedSubscription[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_ACADEMIC_FEEDS;
    try {
      const saved = window.localStorage.getItem(FEEDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_ACADEMIC_FEEDS;
  });

  const [activeFeedId, setActiveFeedId] = useState<string>(
    feeds[0]?.id || 'arxiv-cs-ai',
  );
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [targetCollectionId, setTargetCollectionId] = useState<string>(
    defaultCollectionId || '',
  );

  const [entries, setEntries] = useState<ParsedFeedEntry[]>([]);
  const [feedTitle, setFeedTitle] = useState<string>('');
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [savingEntryIds, setSavingEntryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [savedEntryIds, setSavedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );

  const persistFeeds = (nextFeeds: SavedFeedSubscription[]) => {
    setFeeds(nextFeeds);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(nextFeeds));
      } catch {
        // ignore storage errors
      }
    }
  };

  const activeFeed = feeds.find((f) => f.id === activeFeedId) || feeds[0];

  const loadFeedEntries = useCallback(async (feed: SavedFeedSubscription | undefined) => {
    if (!feed?.url) {
      setEntries([]);
      return;
    }
    setIsLoadingEntries(true);
    try {
      const res: FeedFetchApiResponse = await fetchAcademicFeed(feed.url);
      const payload = res?.data ?? res;
      if (payload && Array.isArray(payload.entries)) {
        setFeedTitle(payload.feedTitle || feed.name);
        setEntries(
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
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [fetchAcademicFeed]);

  useEffect(() => {
    if (open && activeFeed) {
      void loadFeedEntries(activeFeed);
    }
  }, [open, activeFeed, loadFeedEntries]);

  const handleAddFeedSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    const url = newFeedUrl.trim();
    if (!url) return;
    const name =
      newFeedName.trim() ||
      url.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 42);
    const id = `feed-${Date.now()}`;
    const next = [...feeds, { id, name, url }];
    persistFeeds(next);
    setActiveFeedId(id);
    setNewFeedName('');
    setNewFeedUrl('');
    setIsAddingFeed(false);
    toast.success(`Subscribed to "${name}"`);
  };

  const handleRemoveFeed = (id: string) => {
    const next = feeds.filter((f) => f.id !== id);
    persistFeeds(next);
    if (activeFeedId === id) {
      setActiveFeedId(next[0]?.id || '');
    }
  };

  const handleSaveEntryToLibrary = async (entry: ParsedFeedEntry) => {
    setSavingEntryIds((prev) => new Set(prev).add(entry.id));
    try {
      const createPayload = mapFeedEntryToCreateItemPayload(entry, {
        scopeId,
        collectionId: targetCollectionId || undefined,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { collectionId: _, ...itemData } = createPayload;
      await createItem({
        ...itemData,
        collectionIds: targetCollectionId ? [targetCollectionId] : undefined,
        silent: true,
      } as any);
      setSavedEntryIds((prev) => new Set(prev).add(entry.id));
      toast.success('Saved article to Library', {
        description: entry.title,
      });
    } catch (err) {
      toast.error('Failed to save article from feed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSavingEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[82vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border rounded-lg shadow-raised-200">
        {/* Header */}
        <DialogHeader className="px-4 py-3 pr-12 border-b border-border flex flex-row items-center justify-between shrink-0 m-0">
          <div className="flex items-center min-w-0">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Journal &amp; Preprint RSS Feeds
            </DialogTitle>
            <DialogDescription className="sr-only">
              Subscribe to academic journals and preprint repositories.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {collections.length > 0 && (
              <div className="flex items-center gap-1.5 text-11">
                <span className="text-muted-foreground hidden sm:inline">
                  Save to:
                </span>
                <select
                  value={targetCollectionId}
                  onChange={(e) => setTargetCollectionId(e.target.value)}
                  className="h-7 px-2 rounded-md border border-border bg-background text-11 text-foreground outline-none focus:border-primary"
                >
                  <option value="">My Library (Root)</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => activeFeed && loadFeedEntries(activeFeed)}
              disabled={isLoadingEntries || !activeFeed}
              className="h-7 px-2.5 text-11 gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={cn('size-3', isLoadingEntries && 'animate-spin')}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Body: Left Feed Subscriptions + Right Feed Articles */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          {/* Left Pane: Subscribed Feeds */}
          <div className="w-full md:w-64 shrink-0 flex flex-col bg-muted/20 p-2.5 gap-2 overflow-y-auto">
            <div className="flex items-center justify-between px-1">
              <span className="text-11 font-semibold text-muted-foreground uppercase tracking-wider">
                Subscribed Feeds ({feeds.length})
              </span>
              <button
                type="button"
                onClick={() => setIsAddingFeed((v) => !v)}
                className="h-6 px-1.5 rounded text-11 font-medium text-primary hover:bg-primary/10 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="size-3" />
                <span>New Feed</span>
              </button>
            </div>

            {isAddingFeed && (
              <form
                onSubmit={handleAddFeedSubscription}
                className="p-2 rounded-md border border-border bg-background flex flex-col gap-1.5 text-xs"
              >
                <input
                  type="url"
                  required
                  autoFocus
                  placeholder="https://rss.arxiv.org/rss/cs.LG"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  className="h-7 px-2 rounded border border-border bg-background text-11 text-foreground outline-none focus:border-primary"
                />
                <input
                  type="text"
                  placeholder="Feed title (optional)"
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  className="h-7 px-2 rounded border border-border bg-background text-11 text-foreground outline-none focus:border-primary"
                />
                <div className="flex items-center justify-end gap-1 pt-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingFeed(false)}
                    className="h-6 px-2 text-10"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="h-6 px-2.5 text-10">
                    Add Feed
                  </Button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-1">
              {feeds.map((f) => {
                const isActive = f.id === activeFeed?.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setActiveFeedId(f.id)}
                    className={cn(
                      'group flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Rss className="size-3.5 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </div>
                    {feeds.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFeed(f.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 size-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-opacity"
                        aria-label={`Remove feed ${f.name}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Feed Entries */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            {isLoadingEntries ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-12">Fetching latest articles from feed...</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
                <Sparkles className="size-6 stroke-1" />
                <p className="text-13 font-medium text-foreground">
                  No articles found in this feed
                </p>
                <p className="text-11 max-w-sm">
                  Check the RSS/Atom URL or click Refresh to try loading the feed again.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {entries.map((entry) => {
                  const isSaving = savingEntryIds.has(entry.id);
                  const isSaved = savedEntryIds.has(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className="p-3.5 hover:bg-muted/30 transition-colors flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-13 font-semibold text-foreground leading-snug">
                            {entry.title}
                          </h4>
                          {entry.authors.length > 0 && (
                            <p className="text-11 text-muted-foreground truncate mt-0.5">
                              {entry.authors.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {entry.url && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  entry.url,
                                  '_blank',
                                  'noopener,noreferrer',
                                )
                              }
                              className="h-7 px-2 text-11 gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <ExternalLink className="size-3" />
                              <span className="hidden sm:inline">Source</span>
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant={isSaved ? 'outline' : 'default'}
                            size="sm"
                            disabled={isSaving || isSaved}
                            onClick={() => handleSaveEntryToLibrary(entry)}
                            className="h-7 px-2.5 text-11 gap-1.5 cursor-pointer"
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
                        </div>
                      </div>

                      {entry.abstract && (
                        <p className="text-11 text-muted-foreground line-clamp-2 leading-relaxed">
                          {entry.abstract}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-10 text-muted-foreground font-mono">
                        {(entry.publicationTitle || feedTitle) && (
                          <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">
                            {entry.publicationTitle || feedTitle}
                          </span>
                        )}
                        {entry.year && <span>{entry.year}</span>}
                        {entry.doi && <span>DOI: {entry.doi}</span>}
                        {entry.arxivId && <span>arXiv:{entry.arxivId}</span>}
                        {entry.pdfUrl && (
                          <span className="inline-flex items-center gap-0.5 text-primary">
                            <FileText className="size-2.5" /> PDF available
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
