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
import { RefreshCw, Plus, Rss, Trash2, Loader2, ExternalLink, Check, BookPlus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { safeHttpUrl } from '@/features/library/domain/retraction';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { FeedStackIllustration } from '@/features/library/ui/content/LibraryIllustrations';
import {
  useFetchAcademicFeed,
  useIngestMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import { useCreateLibraryItemMutation, useLibraryItemsQuery } from '@/features/library/sdk/queries/catalog.queries';
import {
  normalizeFetchedFeedEntries,
  executeSaveFeedEntryToLibrary,
  type ParsedFeedEntry,
  type FeedFetchApiResponse,
} from '@/features/library/domain/feed-parser.domain';
import type { Collection } from '@/features/library/domain/types/library.types';
import { cn } from '@/shared/lib/utils';
import { useFeedsStore, isFeedEntryInLibrary } from '@/features/library/core/store/feeds.store';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';

export type { SavedFeedSubscription };

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
  const { mutateAsync: createItem } = useCreateLibraryItemMutation(scopeId);
  const { mutateAsync: ingestItem } = useIngestMutation(scopeId);
  const { data: libraryData } = useLibraryItemsQuery(
    scopeId,
    { limit: 100, fields: ['id', 'title', 'doi', 'url'] },
    { enabled: open },
  );
  const feeds = useFeedsStore((s) => s.feeds);
  const activeFeedId = useFeedsStore((s) => s.activeFeedId);
  const loadFeeds = useFeedsStore((s) => s.loadFeeds);
  const hydrateReadEntries = useFeedsStore((s) => s.hydrateReadEntries);
  const setActiveFeedId = useFeedsStore((s) => s.setActiveFeedId);
  const addFeed = useFeedsStore((s) => s.addFeed);
  const removeFeed = useFeedsStore((s) => s.removeFeed);
  const markEntryAsRead = useFeedsStore((s) => s.markEntryAsRead);
  const savedEntryIds = useFeedsStore((s) => s.savedEntryIds);
  const savingEntryIds = useFeedsStore((s) => s.savingEntryIds);
  const markEntrySaved = useFeedsStore((s) => s.markEntrySaved);
  const setEntrySaving = useFeedsStore((s) => s.setEntrySaving);

  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isSubmittingNewFeed, setIsSubmittingNewFeed] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [targetCollectionId, setTargetCollectionId] = useState<string>(
    defaultCollectionId || '',
  );

  const [entries, setEntries] = useState<ParsedFeedEntry[]>([]);
  const [feedTitle, setFeedTitle] = useState<string>('');
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  useEffect(() => {
    setTargetCollectionId(defaultCollectionId || '');
  }, [defaultCollectionId]);

  useEffect(() => {
    if (open) {
      loadFeeds();
    } else {
      setIsAddingFeed(false);
      setNewFeedName('');
      setNewFeedUrl('');
    }
  }, [open, loadFeeds]);

  const activeFeed = feeds.find((f) => f.id === activeFeedId) || feeds[0];

  const loadFeedEntries = useCallback(async (feed: SavedFeedSubscription | undefined, forceRefresh = false) => {
    if (!feed?.url) {
      setEntries([]);
      return;
    }
    setIsLoadingEntries(true);
    try {
      const res: FeedFetchApiResponse = await fetchAcademicFeed({ url: feed.url, forceRefresh });
      const payload = res?.data ?? res;
      if (payload && Array.isArray(payload.entries)) {
        setFeedTitle(payload.feedTitle || feed.name);
        const normalized = normalizeFetchedFeedEntries(payload.entries);
        setEntries(normalized);
        const readIds = normalized.filter((e) => e.isRead === true).map((e) => e.id);
        if (readIds.length > 0) {
          hydrateReadEntries(readIds);
        }
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [fetchAcademicFeed, hydrateReadEntries]);

  useEffect(() => {
    if (open && activeFeed) {
      void loadFeedEntries(activeFeed);
    }
  }, [open, activeFeed, loadFeedEntries]);

  const handleAddFeedSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = newFeedUrl.trim();
    if (!url || isSubmittingNewFeed) return;
    setIsSubmittingNewFeed(true);
    try {
      const newFeed = await addFeed(newFeedName, url);
      setNewFeedName('');
      setNewFeedUrl('');
      setIsAddingFeed(false);
      toast.success(`Subscribed to "${newFeed.name}"`);
    } catch {
      toast.error('Failed to subscribe to feed');
    } finally {
      setIsSubmittingNewFeed(false);
    }
  };

  const handleRemoveFeed = async (id: string) => {
    try {
      await removeFeed(id);
      if (activeFeedId === id) {
        const remaining = feeds.filter((f) => f.id !== id);
        setActiveFeedId(remaining[0]?.id || null);
      }
    } catch {
      toast.error('Failed to remove feed');
    }
  };

  const handleSaveEntryToLibrary = async (entry: ParsedFeedEntry) => {
    markEntryAsRead(entry.id);
    setEntrySaving(entry.id, true);
    try {
      await executeSaveFeedEntryToLibrary({
        entry,
        scopeId,
        targetCollectionId: targetCollectionId || undefined,
        createItem,
        ingestItem,
      });
      markEntrySaved(entry.id);
      toast.success('Saved article to Library', {
        description: entry.title,
      });
    } catch (err) {
      toast.error('Failed to save article from feed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setEntrySaving(entry.id, false);
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
              onClick={() => activeFeed && loadFeedEntries(activeFeed, true)}
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
              <span className="text-12 font-medium text-foreground">
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
                    disabled={isSubmittingNewFeed}
                    onClick={() => setIsAddingFeed(false)}
                    className="h-7 px-2.5 text-12 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingNewFeed}
                    className="h-7 px-3 text-12 cursor-pointer"
                  >
                    {isSubmittingNewFeed ? 'Adding...' : 'Add Feed'}
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
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveFeedId(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveFeedId(f.id);
                      }
                    }}
                    className={cn(
                      'group flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Rss className="size-3.5 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemoveFeed(f.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 size-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={`Remove feed ${f.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Feed Entries */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            {!activeFeed ? (
              <PlaneEmptyState
                illustration={FeedStackIllustration}
                title="No feed selected"
                description="Select a feed from the list or subscribe to a new feed."
                isCompact
              />
            ) : isLoadingEntries ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-12">Fetching latest articles from feed...</span>
              </div>
            ) : entries.length === 0 ? (
              <PlaneEmptyState
                illustration={FeedStackIllustration}
                title="No articles found"
                description="Check the RSS/Atom URL or click Refresh to try loading the feed again."
                isCompact
              />
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {entries.map((entry) => {
                  const isSaving = savingEntryIds.includes(entry.id);
                  const isSaved = isFeedEntryInLibrary(entry, savedEntryIds, libraryData?.items);

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
                              onClick={() => {
                                const safe = safeHttpUrl(entry.url);
                                if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
                              }}
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
                                <Check className="size-3 text-foreground" />
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

                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-11 text-muted-foreground">
                        {(entry.publicationTitle || feedTitle) && (
                          <span className="font-normal text-muted-foreground">
                            {entry.publicationTitle || feedTitle}
                          </span>
                        )}
                        {entry.year && <span>{entry.year}</span>}
                        {entry.doi && <span>DOI: {entry.doi}</span>}
                        {entry.arxivId && <span>arXiv:{entry.arxivId}</span>}
                        {entry.pdfUrl && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                            <FileText className="size-3 text-muted-foreground" /> PDF available
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
