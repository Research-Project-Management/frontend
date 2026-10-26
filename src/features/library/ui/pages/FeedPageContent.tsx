'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Rss } from 'lucide-react';
import { LibraryTopbar, type BreadcrumbItem } from '@/features/library/ui/topbar/LibraryTopbar';
import { FeedViewContent } from '@/features/library/ui/content/FeedViewContent';
import { FeedItemInspector } from '@/features/library/ui/inspector/FeedItemInspector';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useFeedsStore, isFeedEntryInLibrary } from '@/features/library/core/store/feeds.store';
import { useLibraryPermissions } from '@/features/library/core/coordinator/permissions.coordinator';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useCreateLibraryItemMutation, useLibraryItemsQuery } from '@/features/library/sdk/queries/catalog.queries';
import { mapFeedEntryToCreateItemPayload, type ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';
import type { Collection } from '@/features/library/domain/types/library.types';
import { toast } from 'sonner';

export interface FeedPageContentProps {
  feedId?: string;
  scopeId?: string;
}

export function FeedPageContent({
  feedId: propFeedId,
  scopeId: propScopeId,
}: FeedPageContentProps) {
  const router = useRouter();
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);

  const feeds = useFeedsStore((s) => s.feeds);
  const loadFeeds = useFeedsStore((s) => s.loadFeeds);
  const triggerRefresh = useFeedsStore((s) => s.triggerRefresh);
  const selectedFeedEntry = useFeedsStore((s) => s.selectedFeedEntry);
  const currentFeedEntries = useFeedsStore((s) => s.currentFeedEntries);
  const readEntryIds = useFeedsStore((s) => s.readEntryIds);
  const toggleEntryRead = useFeedsStore((s) => s.toggleEntryRead);
  const markEntryAsRead = useFeedsStore((s) => s.markEntryAsRead);
  const markAllEntriesAsRead = useFeedsStore((s) => s.markAllEntriesAsRead);
  const savedEntryIds = useFeedsStore((s) => s.savedEntryIds);
  const savingEntryIds = useFeedsStore((s) => s.savingEntryIds);
  const markEntrySaved = useFeedsStore((s) => s.markEntrySaved);
  const setEntrySaving = useFeedsStore((s) => s.setEntrySaving);

  React.useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const effectiveScopeId =
    propScopeId ||
    (activeScope.type === 'project' ? activeScope.id : 'user');

  const { canEditItem: canEdit } = useLibraryPermissions();

  const currentFeed = useMemo(() => {
    if (!propFeedId) return feeds[0];
    return feeds.find((f) => f.id === propFeedId) || feeds[0];
  }, [feeds, propFeedId]);

  const { data: collections = [] } = useCollectionsQuery(effectiveScopeId);
  const collectionList: Collection[] = (collections as Collection[]) || [];

  const { mutateAsync: createItem } = useCreateLibraryItemMutation(effectiveScopeId);
  const { data: libraryData } = useLibraryItemsQuery(
    effectiveScopeId,
    { limit: 100, fields: ['id', 'title', 'doi', 'url'] },
    { enabled: true },
  );

  const handleSaveFeedItemFromInspector = async (entry: ParsedFeedEntry, targetColId?: string) => {
    markEntryAsRead(entry.id);
    setEntrySaving(entry.id, true);
    try {
      const payload = mapFeedEntryToCreateItemPayload(entry, {
        scopeId: effectiveScopeId,
        collectionId: targetColId,
      });
      await createItem({ ...payload, silent: true });
      markEntrySaved(entry.id);
      const colName = targetColId
        ? collectionList.find((c) => c.id === targetColId)?.name
        : undefined;
      toast.success(colName ? `Saved to "${colName}"` : 'Saved to Library', {
        description: `"${entry.title.slice(0, 48)}..." added to your collection.`,
      });
    } catch (err: unknown) {
      toast.error('Failed to save to library', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setEntrySaving(entry.id, false);
    }
  };

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    return [
      { id: '__feeds__', name: 'Feeds', icon: Rss, clickable: false },
      ...(currentFeed
        ? [
            {
              id: currentFeed.id,
              name: currentFeed.name,
              switcherPlaceholder: 'Find feed...',
              switcherOptions: feeds.map((f) => ({
                id: f.id,
                name: f.name,
                isActive: f.id === currentFeed.id,
                icon: Rss,
              })),
              onSelectSwitcherOption: (feedId: string) => {
                router.push(`/library/feeds/${feedId}`);
              },
            },
          ]
        : []),
    ];
  }, [currentFeed, feeds, router]);

  const handleNavigateCrumb = (crumbId?: string) => {
    if (!crumbId || crumbId === '__feeds__') {
      router.push('/library/feeds');
      return;
    }
    router.push(`/library/feeds/${crumbId}`);
  };

  return (
    <div className="flex h-full w-full min-h-0 relative">
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <LibraryTopbar
          title={currentFeed?.name || 'Feeds'}
          breadcrumbs={breadcrumbs}
          onNavigateCrumb={handleNavigateCrumb}
          scopeId={effectiveScopeId}
          canEdit={canEdit}
          isFeed={true}
          onRefreshFeed={() => {
            triggerRefresh();
            toast.info(`Refreshing "${currentFeed?.name || 'feed'}"...`);
          }}
          onMarkAllFeedRead={() => {
            const allIds = currentFeedEntries.map((e) => e.id);
            if (allIds.length > 0) {
              markAllEntriesAsRead(allIds);
            } else if (selectedFeedEntry) {
              markAllEntriesAsRead([selectedFeedEntry.id]);
            }
            toast.success(`Marked all articles in "${currentFeed?.name || 'feed'}" as read`);
          }}
        />

        <div className="flex-1 overflow-hidden min-h-0 relative">
          <FeedViewContent
            feedId={currentFeed?.id}
            scopeId={effectiveScopeId}
            canEdit={canEdit}
          />
        </div>
      </div>

      {/* Inspector Panel */}
      <ErrorBoundary variant="section" featureName="Feed Item Inspector">
        {isInspectorOpen && (
          <div className="hidden md:flex w-80 lg:w-[420px] xl:w-[480px] 2xl:w-[520px] h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background">
            <FeedItemInspector
              entry={selectedFeedEntry}
              feedTitle={currentFeed?.name}
              collections={collectionList}
              isRead={selectedFeedEntry ? readEntryIds.has(selectedFeedEntry.id) : false}
              isSaving={selectedFeedEntry ? savingEntryIds.includes(selectedFeedEntry.id) : false}
              isSaved={isFeedEntryInLibrary(selectedFeedEntry, savedEntryIds, libraryData?.items)}
              onToggleRead={toggleEntryRead}
              onSave={handleSaveFeedItemFromInspector}
              onClose={() => setIsInspectorOpen(false)}
            />
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}

export default FeedPageContent;
