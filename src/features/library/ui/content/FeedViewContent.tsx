'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import {
  useAcademicFeedArticlesQuery,
  useFetchAcademicFeed,
  useIngestMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import {
  useCreateLibraryItemMutation,
  useLibraryItemsQuery,
} from '@/features/library/sdk/queries/catalog.queries';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import type { Collection } from '@/features/library/domain/types/library.types';
import {
  mapFeedEntryToCreateItemPayload,
  executeSaveFeedEntryToLibrary,
  normalizeFetchedFeedEntries,
  filterFeedEntriesByRetention,
  filterFeedEntriesByReadAndQuery,
  type ParsedFeedEntry,
  type FeedFetchApiResponse,
} from '@/features/library/domain/feed-parser.domain';
import {
  useFeedsStore,
  isFeedEntryInLibrary,
} from '@/features/library/core/store/feeds.store';
import { ContentSkeleton } from '@/features/library/ui/content/ContentSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import {
  FeedStackIllustration,
  FeedAllReadIllustration,
  SearchStackIllustration,
} from '@/features/library/ui/content/LibraryIllustrations';
import { useSearchParams } from 'next/navigation';
import {
  FeedSubNavigationBar,
  FeedArticleRow,
} from './FeedViewSubcomponents';

export { FeedSubNavigationBar, FeedArticleRow };

interface FeedViewContentProps {
  feedId?: string | null;
  scopeId?: string;
  canEdit?: boolean;
  onMarkAllRead?: (entryIds: string[]) => void;
}

export function FeedViewContent({
  feedId,
  scopeId = 'user',
  canEdit = true,
}: FeedViewContentProps) {
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get('q') || '').trim();
  const { mutateAsync: createItem } = useCreateLibraryItemMutation(scopeId);
  const { mutateAsync: ingestItem } = useIngestMutation(scopeId);
  const { collections = [] } = useCollections(scopeId);
  const collectionList: Collection[] = (collections as Collection[]) || [];

  const feeds = useFeedsStore((s) => s.feeds);
  const loadFeeds = useFeedsStore((s) => s.loadFeeds);
  const refreshCounter = useFeedsStore((s) => s.refreshCounter);
  const readEntryIds = useFeedsStore((s) => s.readEntryIds);
  const savedEntryIds = useFeedsStore((s) => s.savedEntryIds);
  const savingEntryIds = useFeedsStore((s) => s.savingEntryIds);
  const savingEntryIdsSet = useMemo(() => new Set(savingEntryIds), [savingEntryIds]);
  const selectedFeedEntry = useFeedsStore((s) => s.selectedFeedEntry);
  const setSelectedFeedEntry = useFeedsStore((s) => s.setSelectedFeedEntry);
  const setCurrentFeedEntries = useFeedsStore((s) => s.setCurrentFeedEntries);
  const readFilter = useFeedsStore((s) => s.readFilter);
  const setReadFilter = useFeedsStore((s) => s.setReadFilter);
  const markEntryAsRead = useFeedsStore((s) => s.markEntryAsRead);
  const toggleEntryRead = useFeedsStore((s) => s.toggleEntryRead);
  const isEntryRead = useFeedsStore((s) => s.isEntryRead);
  const markEntrySaved = useFeedsStore((s) => s.markEntrySaved);
  const setEntrySaving = useFeedsStore((s) => s.setEntrySaving);

  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const activeFeed = useMemo(() => {
    if (!feedId) return feeds[0];
    return feeds.find((f) => f.id === feedId) || feeds[0];
  }, [feeds, feedId]);

  const { mutateAsync: fetchAcademicFeed, isPending: isRefreshingFeed } =
    useFetchAcademicFeed();
  const feedArticlesQuery = useAcademicFeedArticlesQuery(
    scopeId,
    activeFeed?.url,
    {
      enabled: Boolean(activeFeed?.url),
    },
  );
  const isFetching = feedArticlesQuery.isLoading || isRefreshingFeed;

  const { data: libraryData } = useLibraryItemsQuery(
    scopeId,
    { limit: 100, fields: ['id', 'title', 'doi', 'url'] },
    { enabled: true },
  );

  const [manualEntries, setManualEntries] = useState<ParsedFeedEntry[] | null>(
    null,
  );
  const [manualFeedTitle, setManualFeedTitle] = useState<string>('');
  const [manualError, setManualError] = useState<Error | null>(null);

  useEffect(() => {
    setManualEntries(null);
    setManualFeedTitle('');
    setManualError(null);
  }, [activeFeed?.url]);

  const rawEntries = useMemo(() => {
    if (manualEntries !== null) return manualEntries;
    const res = feedArticlesQuery.data as FeedFetchApiResponse | undefined;
    const payload =
      res && typeof res === 'object' && 'data' in res && res.data
        ? res.data
        : res;
    if (
      payload &&
      typeof payload === 'object' &&
      Array.isArray(payload.entries)
    ) {
      return normalizeFetchedFeedEntries(payload.entries);
    }
    return [];
  }, [manualEntries, feedArticlesQuery.data]);

  const feedTitle = useMemo(() => {
    if (manualFeedTitle) return manualFeedTitle;
    const res = feedArticlesQuery.data as FeedFetchApiResponse | undefined;
    const payload =
      res && typeof res === 'object' && 'data' in res && res.data
        ? res.data
        : res;
    return (
      (payload && typeof payload === 'object' && payload.feedTitle) ||
      activeFeed?.name ||
      ''
    );
  }, [manualFeedTitle, feedArticlesQuery.data, activeFeed?.name]);

  const fetchError =
    manualError ??
    (feedArticlesQuery.error instanceof Error
      ? feedArticlesQuery.error
      : feedArticlesQuery.error
        ? new Error('Failed to fetch feed')
        : null);

  const toggleAbstract = useCallback((id: string) => {
    setExpandedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const loadFeedEntries = useCallback(
    async (forceRefresh = false) => {
      if (!activeFeed?.url) {
        setManualEntries([]);
        return;
      }
      if (!forceRefresh) {
        setManualError(null);
        setManualEntries(null);
        await feedArticlesQuery.refetch();
        return;
      }
      setManualError(null);
      try {
        const res: FeedFetchApiResponse | string = await fetchAcademicFeed({
          url: activeFeed.url,
          forceRefresh: true,
        });
        const payload =
          typeof res === 'object' && res !== null && res.data ? res.data : res;
        if (
          payload &&
          typeof payload === 'object' &&
          Array.isArray(payload.entries)
        ) {
          setManualFeedTitle(payload.feedTitle || activeFeed.name);
          setManualEntries(normalizeFetchedFeedEntries(payload.entries));
        } else {
          setManualEntries([]);
        }
      } catch (err: unknown) {
        setManualError(
          err instanceof Error ? err : new Error('Failed to fetch feed'),
        );
        setManualEntries([]);
      }
    },
    [activeFeed, fetchAcademicFeed, feedArticlesQuery],
  );

  const prevRefreshCounter = useRef(refreshCounter);
  useEffect(() => {
    if (refreshCounter > prevRefreshCounter.current) {
      prevRefreshCounter.current = refreshCounter;
      void loadFeedEntries(true);
    }
  }, [loadFeedEntries, refreshCounter]);

  const retentionFilteredEntries = useMemo(
    () =>
      filterFeedEntriesByRetention(rawEntries, activeFeed?.retentionDays, {
        cleanupReadAfter: activeFeed?.cleanupReadAfter,
        cleanupUnreadAfter:
          activeFeed?.cleanupUnreadAfter ?? activeFeed?.retentionDays,
        readEntryIds,
      }),
    [
      rawEntries,
      activeFeed?.retentionDays,
      activeFeed?.cleanupReadAfter,
      activeFeed?.cleanupUnreadAfter,
      readEntryIds,
    ],
  );

  const filteredEntries = useMemo(
    () =>
      filterFeedEntriesByReadAndQuery(
        retentionFilteredEntries,
        readFilter,
        readEntryIds,
        searchQuery,
      ),
    [retentionFilteredEntries, readFilter, readEntryIds, searchQuery],
  );

  useEffect(() => {
    setCurrentFeedEntries(retentionFilteredEntries);
  }, [retentionFilteredEntries, setCurrentFeedEntries]);

  useEffect(() => {
    if (filteredEntries.length > 0) {
      if (
        !selectedFeedEntry ||
        !filteredEntries.some((e) => e.id === selectedFeedEntry.id)
      ) {
        setSelectedFeedEntry(filteredEntries[0]);
      }
    }
  }, [filteredEntries, selectedFeedEntry, setSelectedFeedEntry]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110,
    overscan: 10,
  });

  const isItemInLibrary = useCallback(
    (entry: ParsedFeedEntry) =>
      isFeedEntryInLibrary(entry, savedEntryIds, libraryData?.items),
    [savedEntryIds, libraryData?.items],
  );

  const handleSaveEntry = useCallback(
    async (entry: ParsedFeedEntry, targetCollectionId?: string) => {
      markEntryAsRead(entry.id);
      setEntrySaving(entry.id, true);
      try {
        await executeSaveFeedEntryToLibrary({
          entry,
          scopeId,
          targetCollectionId,
          createItem,
          ingestItem,
        });
        markEntrySaved(entry.id);

        const colName = targetCollectionId
          ? collectionList.find((c: Collection) => c.id === targetCollectionId)
              ?.name
          : undefined;

        toast.success(colName ? `Saved to "${colName}"` : 'Saved to Library', {
          description: `"${entry.title.slice(0, 48)}..." added to your collection.`,
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Could not add feed item.';
        toast.error('Failed to save to library', { description: msg });
      } finally {
        setEntrySaving(entry.id, false);
      }
    },
    [
      collectionList,
      createItem,
      ingestItem,
      markEntryAsRead,
      markEntrySaved,
      scopeId,
      setEntrySaving,
    ],
  );

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

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'S' || e.key === 's')
      ) {
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
        const currentIndex = filteredEntries.findIndex(
          (item) => item.id === selectedFeedEntry?.id,
        );
        const nextIndex =
          currentIndex < filteredEntries.length - 1 ? currentIndex + 1 : 0;
        const nextEntry = filteredEntries[nextIndex];
        setSelectedFeedEntry(nextEntry);
        rowVirtualizer.scrollToIndex(nextIndex, { align: 'auto' });
        if (!isEntryRead(nextEntry.id)) {
          markEntryAsRead(nextEntry.id);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (filteredEntries.length === 0) return;
        e.preventDefault();
        const currentIndex = filteredEntries.findIndex(
          (item) => item.id === selectedFeedEntry?.id,
        );
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : filteredEntries.length - 1;
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
    handleSaveEntry,
    toggleEntryRead,
    setSelectedFeedEntry,
    isEntryRead,
    markEntryAsRead,
    rowVirtualizer,
  ]);

  const handleSelectEntry = useCallback(
    (entry: ParsedFeedEntry) => {
      if (!isEntryRead(entry.id)) {
        markEntryAsRead(entry.id);
      }
      setSelectedFeedEntry(entry);
    },
    [isEntryRead, markEntryAsRead, setSelectedFeedEntry],
  );

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
      <FeedSubNavigationBar
        readFilter={readFilter}
        onChangeReadFilter={setReadFilter}
        lastRefreshed={activeFeed?.lastRefreshed}
        isFetching={isFetching}
        onSync={() => void loadFeedEntries(true)}
      />

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
                  <FeedArticleRow
                    entry={entry}
                    feedTitle={feedTitle}
                    canEdit={canEdit}
                    collectionList={collectionList}
                    isSaving={savingEntryIdsSet.has(entry.id)}
                    isSaved={isItemInLibrary(entry)}
                    isRead={isEntryRead(entry.id)}
                    isExpanded={expandedEntryIds.has(entry.id)}
                    isSelected={selectedFeedEntry?.id === entry.id}
                    onSelectEntry={handleSelectEntry}
                    onToggleRead={toggleEntryRead}
                    onMarkEntryAsRead={markEntryAsRead}
                    onSaveEntry={(ent, colId) => void handleSaveEntry(ent, colId)}
                    onToggleAbstract={toggleAbstract}
                  />
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
