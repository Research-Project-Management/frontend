'use client';

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Trash2, Files, Rss, Star, Inbox, Award, ShieldAlert, History } from 'lucide-react';
import { LibraryTopbar, type BreadcrumbItem } from '@/features/library/ui/topbar/LibraryTopbar';
import {
  LibraryContent,
  ITEM_LIST_FIELDS,
  PAGE_SIZE,
} from '@/features/library/ui/content/LibraryContent';
import { LibraryInspector } from '@/features/library/ui/inspector/LibraryInspector';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import { useLibraryNavigation } from '@/features/library/core/coordinator/navigation.coordinator';

const DuplicateMergeInspector = dynamic(
  () => import('@/features/library/ui/inspector/DuplicateMergeInspector').then((m) => m.DuplicateMergeInspector),
  { ssr: false }
);
const FeedItemInspector = dynamic(
  () => import('@/features/library/ui/inspector/FeedItemInspector').then((m) => m.FeedItemInspector),
  { ssr: false }
);
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import {
  useLibraryCommandStore,
  createMergeDuplicatesCommand,
} from '@/features/library/core/manager/library-command.manager';
import { useFeedsStore, isFeedEntryInLibrary } from '@/features/library/core/store/feeds.store';
import { useLibraryPermissions } from '@/features/library/core/coordinator/permissions.coordinator';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import {
  useTrash,
  useLibraryBootstrapQuery,
  useLibraryCountsQuery,
  useItemTypes,
  useCreateLibraryItemMutation,
  useBatchRestoreItemsMutation,
  useUpdateLibraryItemMutation,
  useLibraryItemsQuery,
  useLibraryDeltaSync,
  useLibraryCacheSynchronizer,
} from '@/features/library/sdk/queries/catalog.queries';
import {
  useMergeDuplicates,
  useUndoMergeDuplicatesMutation,
  useDuplicateGroups,
  useIngestMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import { formatItemTypeLabel } from '@/features/library/domain/metadata';
import { parseEmojiPrefix } from '@/features/library/domain/academic-text';
import { executeSaveFeedEntryToLibrary, type ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';
import type { Item, DuplicateGroup, Collection } from '@/features/library/domain/types/library.types';

interface LibraryPageProps {
  scopeId?: string;
  collectionId?: string;
  feedId?: string;
  view?: string;
  title?: string;
}

const FILTER_TITLE_MAP: Record<string, string> = {
  'my-publications': 'My Publications',
  publications: 'My Publications',
  retracted: 'Retracted Items',
  starred: 'Starred Items',
  unfiled: 'Unfiled Items',
  trash: 'Trash',
  duplicates: 'Duplicate Items',
  recent: 'Recently Read',
  'recently-read': 'Recently Read',
  feed: 'Feeds',
};

const FILTER_ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number | string }>> = {
  starred: Star,
  unfiled: Inbox,
  duplicates: Files,
  'my-publications': Award,
  publications: Award,
  retracted: ShieldAlert,
  trash: Trash2,
  recent: History,
  'recently-read': History,
  feed: Rss,
};

/**
 * Modern Workspace Engine Library Page
 * Decoupled layout frame combining 5 autonomous UI zones.
 */
export function ModernLibraryPage({
  scopeId: propScopeId,
  collectionId: propCollectionId,
  feedId: propFeedId,
  view,
  title,
}: LibraryPageProps) {
  const router = useRouter();
  const nav = useLibraryNavigation();
  const { queryClient, invalidateScopeItemsAndCounts, resolveCachedItem } =
    useLibraryCacheSynchronizer(propScopeId);
  const params = useParams() as { collectionId?: string; projectId?: string; feedId?: string };
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const isInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);
  const displayOptions = useLibraryUIStore((s) => s.displayOptions);
  const startBatchUpload = useProcessModalStore((s) => s.startBatchUpload);
  const feeds = useFeedsStore((s) => s.feeds);
  const loadFeeds = useFeedsStore((s) => s.loadFeeds);
  const triggerRefresh = useFeedsStore((s) => s.triggerRefresh);
  const selectedFeedEntry = useFeedsStore((s) => s.selectedFeedEntry);
  const readEntryIds = useFeedsStore((s) => s.readEntryIds);
  const currentFeedEntries = useFeedsStore((s) => s.currentFeedEntries);
  const toggleEntryRead = useFeedsStore((s) => s.toggleEntryRead);
  const markEntryAsRead = useFeedsStore((s) => s.markEntryAsRead);
  const markAllEntriesAsRead = useFeedsStore((s) => s.markAllEntriesAsRead);
  const savedEntryIds = useFeedsStore((s) => s.savedEntryIds);
  const savingEntryIds = useFeedsStore((s) => s.savingEntryIds);
  const markEntrySaved = useFeedsStore((s) => s.markEntrySaved);
  const setEntrySaving = useFeedsStore((s) => s.setEntrySaving);

  const isSavedSearchView = nav.isSavedSearchView;
  const effectiveView = view || (nav.filterParam && nav.filterParam !== 'saved-search' ? nav.filterParam : undefined);
  const effectiveFeedId = propFeedId || params?.feedId || nav.feedId;

  const currentFeed = useMemo(() => {
    if (!effectiveFeedId) return feeds[0];
    return feeds.find((f) => f.id === effectiveFeedId) || feeds[0];
  }, [feeds, effectiveFeedId]);

  const effectiveScopeId =
    propScopeId ||
    params?.projectId ||
    (activeScope.type === 'project' ? activeScope.id : 'user');

  const effectiveCollectionId =
    propCollectionId || params?.collectionId || undefined;

  const { canEditItem: canEdit } = useLibraryPermissions();

  // Master-Detail Layout: Auto-open Inspector when viewing RSS feeds on desktop
  React.useEffect(() => {
    if (effectiveView === 'feed') {
      loadFeeds();
      setIsInspectorOpen(true);
    }
  }, [effectiveView, loadFeeds, setIsInspectorOpen]);

  const filterTitle = effectiveView === 'feed'
    ? (currentFeed ? currentFeed.name : 'Feeds')
    : (effectiveView ? FILTER_TITLE_MAP[effectiveView] : undefined);
  const resolvedTitle =
    filterTitle ||
    (title && title !== 'Library' && title !== 'My Library' ? title : undefined);

  const effectiveOrderBy = nav.orderBy || displayOptions?.orderBy;
  const effectiveOrderDirection = nav.orderDirection || displayOptions?.orderDirection;

  const bootstrapItemParams = useMemo(
    () => ({
      collectionId: effectiveCollectionId,
      includeSubcollections: displayOptions?.includeSubcollections ?? true,
      view: effectiveView,
      search: nav.search,
      searchMode: nav.searchMode,
      type: nav.type,
      fromYear: nav.fromYear,
      toYear: nav.toYear,
      readStatus: nav.readStatus,
      hasFile: nav.hasFile,
      hasNotes: nav.hasNotes,
      tag: nav.tag,
      orderBy: effectiveOrderBy,
      orderDirection: effectiveOrderDirection,
      fields: ITEM_LIST_FIELDS,
      page: nav.page,
      limit: PAGE_SIZE,
    }),
    [
      effectiveCollectionId,
      displayOptions?.includeSubcollections,
      effectiveView,
      nav.search,
      nav.searchMode,
      nav.type,
      nav.fromYear,
      nav.toYear,
      nav.readStatus,
      nav.hasFile,
      nav.hasNotes,
      nav.tag,
      effectiveOrderBy,
      effectiveOrderDirection,
      nav.page,
    ],
  );

  const shouldBootstrapIncludeItems =
    !isSavedSearchView && effectiveView !== 'duplicates' && effectiveView !== 'feed';

  // Single-request workspace bootstrap: populates counts, collections, savedSearches,
  // itemTypes, syncVersion, feedSubscriptions, and initial items into TanStack Query cache.
  useLibraryBootstrapQuery(effectiveScopeId, bootstrapItemParams, {
    includeItems: shouldBootstrapIncludeItems,
  });

  // Warm up dynamic item types schema from backend authoritative registry
  useItemTypes(effectiveScopeId);
  useLibraryDeltaSync(effectiveScopeId);

  const { data: collections = [] } = useCollectionsQuery(effectiveScopeId);
  const collectionList: Collection[] = (collections as Collection[]) || [];
  const { savedSearches = [] } = useSavedSearches(effectiveScopeId, { enabled: isSavedSearchView });
  const collectionMap = useMemo(() => {
    const map = new Map<string, (typeof collections)[number]>();
    for (const c of collections) {
      if (c?.id) map.set(c.id, c);
    }
    return map;
  }, [collections]);

  const currentCollection = effectiveCollectionId
    ? collectionMap.get(effectiveCollectionId)
    : undefined;
  const currentSavedSearch = nav.savedSearchId
    ? savedSearches.find((s) => s.id === nav.savedSearchId)
    : undefined;

  const duplicateGroupsQuery = useDuplicateGroups(effectiveScopeId, {
    enabled: effectiveView === 'duplicates',
  });

  // Deep linking: auto-select item and open inspector if ?item=... or ?selected=... is in URL
  const lastConsumedItemIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const selectedId = nav.selectedItemId;
    if (selectedId && selectedId !== lastConsumedItemIdRef.current) {
      lastConsumedItemIdRef.current = selectedId;
      setActiveItem(selectedId);
      selectOnly(selectedId);
      setIsInspectorOpen(true);
    }
  }, [nav.selectedItemId, setActiveItem, selectOnly, setIsInspectorOpen]);

  // Breadcrumb navigation with full ancestor chain
  const breadcrumbs = useMemo<BreadcrumbItem[] | undefined>(() => {
    const rootName = activeScope.type === 'user' ? 'My Library' : (activeScope.name || 'Library');
    if (isSavedSearchView && currentSavedSearch) {
      const { label: cleanName } = parseEmojiPrefix(currentSavedSearch.name);
      return [
        { id: '__root__', name: rootName },
        { id: currentSavedSearch.id, name: cleanName },
      ];
    }
    if (effectiveView === 'feed') {
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
    }
    // For smart filters/pages (e.g. Duplicates, Trash, Starred, Unfiled, etc.), show single title with icon instead of breadcrumbs
    if (effectiveView && !currentCollection) {
      return undefined;
    }
    if (resolvedTitle && resolvedTitle !== 'My Library' && resolvedTitle !== 'Library' && !currentCollection) {
      return undefined;
    }
    if (!currentCollection) return undefined;

    const crumbs: BreadcrumbItem[] = [{ id: '__root__', name: rootName, clickable: false }];
    const chain: NonNullable<typeof currentCollection>[] = [];
    let curr: typeof currentCollection | undefined = currentCollection;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      chain.push(curr);
      if (curr.parentId) {
        curr = collectionMap.get(curr.parentId);
      } else {
        break;
      }
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      const c = chain[i]!;
      const siblings = collections.filter(
        (col) => (col.parentId || null) === (c.parentId || null),
      );
      crumbs.push({
        id: c.id,
        name: c.name,
        switcherPlaceholder: 'Find collection...',
        switcherOptions: siblings.map((s) => ({
          id: s.id,
          name: s.name,
          isActive: s.id === c.id,
        })),
        onSelectSwitcherOption: (colId: string) => {
          nav.navigateToCollection(colId);
        },
      });
    }
    return crumbs;
  }, [isSavedSearchView, currentSavedSearch, currentCollection, collectionMap, collections, activeScope.name, activeScope.type, resolvedTitle, effectiveView, currentFeed, feeds, router, nav]);

  const handleNavigateCrumb = (crumbId?: string) => {
    if (!crumbId || crumbId === '__root__') {
      router.push('/library');
      return;
    }
    if (effectiveView === 'feed') {
      if (!crumbId || crumbId === '__feeds__') {
        router.push('/library/feeds');
        return;
      }
      router.push(`/library/feeds/${crumbId}`);
      return;
    }
    nav.navigateToCollection(crumbId);
  };

  // Shared upload handler
  const processUpload = (files: File[]) => {
    if (!files?.length) return;
    void startBatchUpload(files, {
      scopeId: effectiveScopeId,
      collectionId: effectiveCollectionId,
      queryClient,
      onSuccess: () => {
        void invalidateScopeItemsAndCounts(effectiveScopeId, { includeCollections: true });
      },
    });
  };

  const handleDirectFilesUpload = processUpload;
  const handleDirectFolderUpload = (files: File[], _folderName: string) => processUpload(files);

  const { mutateAsync: createItem } = useCreateLibraryItemMutation(
    effectiveScopeId,
    effectiveCollectionId,
  );

  // Manual reference creation handler
  const handleNewManualItem = async (itemType: string) => {
    const label = formatItemTypeLabel(itemType);
    const toastId = toast.loading(`Creating ${label}...`, { id: 'create-ref' });
    try {
      const newItem = await createItem({
        itemType,
        title: `Untitled ${label}`,
        collectionIds: effectiveCollectionId ? [effectiveCollectionId] : undefined,
      });

      const createdId = newItem?.id;
      if (createdId) {
        setActiveItem(createdId);
        selectOnly(createdId);
        setIsInspectorOpen(true);
      }

      toast.success(`${label} created`, {
        description: 'Ready to edit in the details inspector.',
        id: toastId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create reference.';
      toast.error(`Failed to create ${label}`, {
        description: message,
        id: toastId,
      });
    }
  };

  const isTrash = effectiveView === 'trash';
  const { trashItems, emptyTrash } = useTrash(effectiveScopeId, { enabled: isTrash });
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);

  const handleEmptyTrash = () => {
    if (trashItems.length === 0) {
      toast.info('Trash is already empty', { id: 'empty-trash' });
      return;
    }
    openModal('DELETE_CONFIRM', {
      permanent: true,
      onConfirm: async () => {
        try {
          useLibraryCommandStore.getState().clear();
          await emptyTrash();
          clearSelection();
        } catch (err: unknown) {
          toast.error('Failed to empty trash', { id: 'empty-trash-error' });
        }
      },
    });
  };

  const { data: countsData } = useLibraryCountsQuery(effectiveScopeId);
  const displayCount = useMemo(() => {
    if (isTrash) return trashItems.length;
    if (effectiveView === 'duplicates') {
      return duplicateGroupsQuery.data?.duplicateGroups?.length ?? 0;
    }
    if (isSavedSearchView) {
      return currentSavedSearch?.cachedCount ?? 0;
    }
    if (currentCollection) {
      const showSubcollections = displayOptions?.includeSubcollections ?? true;
      if (showSubcollections && currentCollection.recursiveItemCount !== undefined) {
        return currentCollection.recursiveItemCount;
      }
      return currentCollection.itemCount ?? 0;
    }
    return countsData?.total;
  }, [
    isTrash,
    trashItems.length,
    effectiveView,
    duplicateGroupsQuery.data?.duplicateGroups?.length,
    isSavedSearchView,
    currentSavedSearch?.cachedCount,
    currentCollection,
    displayOptions?.includeSubcollections,
    countsData?.total,
  ]);

  const mergeMutation = useMergeDuplicates(effectiveScopeId);
  const undoMergeMutation = useUndoMergeDuplicatesMutation(effectiveScopeId);
  const restoreItemsMutation = useBatchRestoreItemsMutation(effectiveScopeId);
  const updateItemMutation = useUpdateLibraryItemMutation(effectiveScopeId);
  const [selectedDuplicateGroup, setSelectedDuplicateGroup] = useState<DuplicateGroup | null>(null);
  const [selectedDuplicateGroupKey, setSelectedDuplicateGroupKey] = useState<string | null>(null);
  const dismissDuplicateGroupRef = useRef<((groupKey: string) => void) | null>(null);
  const openMergeModalRef = useRef<((group: DuplicateGroup, groupKey?: string) => void) | null>(null);

  const handleSelectedDuplicateGroupChange = useCallback(
    (
      group: DuplicateGroup | null,
      groupKey: string | null,
      dismissGroup: (groupKey: string) => void,
      openMerge: (group: DuplicateGroup, groupKey?: string) => void,
    ) => {
      setSelectedDuplicateGroup(group);
      setSelectedDuplicateGroupKey(groupKey);
      dismissDuplicateGroupRef.current = dismissGroup;
      openMergeModalRef.current = openMerge;
    },
    [],
  );

  const selectedDuplicateGroupItems = useMemo(() => {
    if (effectiveView !== 'duplicates' || !selectedDuplicateGroup) return [];
    return (selectedDuplicateGroup.items || []) as Item[];
  }, [effectiveView, selectedDuplicateGroup]);

  const handleExecuteDuplicateMerge = useCallback(
    async (
      masterPaper: Item,
      mergedFields: Partial<Item>,
      duplicateIdsToDelete: string[],
    ) => {
      const cachedPrimary = resolveCachedItem(masterPaper.id, effectiveScopeId);
      const snapshotPrimary: Item = cachedPrimary
        ? { ...masterPaper, ...cachedPrimary }
        : masterPaper;

      await useLibraryCommandStore.getState().executeCommand(
        createMergeDuplicatesCommand({
          primaryItem: snapshotPrimary,
          duplicateIdsToDelete,
          mergedFields: mergedFields as Record<string, unknown>,
          mergeMutation: { mutateAsync: mergeMutation.mutateAsync },
          undoMergeMutation: { mutateAsync: undoMergeMutation.mutateAsync },
          restoreMutation: { mutateAsync: restoreItemsMutation.mutateAsync },
          updateItemMutation: {
            mutateAsync: ({ itemId, data, silent }) =>
              updateItemMutation.mutateAsync({ itemId, data, silent }),
          },
          onUndone: () => {
            void invalidateScopeItemsAndCounts(effectiveScopeId);
          },
        }),
        { silentToast: false },
      );
    },
    [
      effectiveScopeId,
      invalidateScopeItemsAndCounts,
      mergeMutation.mutateAsync,
      resolveCachedItem,
      restoreItemsMutation.mutateAsync,
      undoMergeMutation.mutateAsync,
      updateItemMutation,
    ],
  );

  const { data: feedLibraryData } = useLibraryItemsQuery(
    effectiveScopeId,
    { limit: 100, fields: ['id', 'title', 'doi', 'url'] },
    { enabled: effectiveView === 'feed' },
  );

  const { mutateAsync: ingestFeedItem } = useIngestMutation(effectiveScopeId);

  const handleSaveFeedItemFromInspector = async (entry: ParsedFeedEntry, targetColId?: string) => {
    markEntryAsRead(entry.id);
    setEntrySaving(entry.id, true);
    try {
      await executeSaveFeedEntryToLibrary({
        entry,
        scopeId: effectiveScopeId,
        targetCollectionId: targetColId,
        createItem,
        ingestItem: ingestFeedItem,
      });
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

  const savedSearchTitle = currentSavedSearch
    ? parseEmojiPrefix(currentSavedSearch.name).label
    : undefined;

  const displayTitle =
    resolvedTitle ||
    (isSavedSearchView && savedSearchTitle ? savedSearchTitle : undefined) ||
    (currentCollection ? currentCollection.name : undefined) ||
    (activeScope.type === 'user' ? 'My Library' : activeScope.name) ||
    'My Library';

  return (
    <div className="flex h-full w-full min-h-0 relative">
      {/* Main Workspace (Topbar + Data Content) */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <LibraryTopbar
          title={displayTitle}
          icon={
            isTrash
              ? Trash2
              : ((effectiveView && effectiveView !== 'feed') ? FILTER_ICON_MAP[effectiveView] : undefined)
          }
          count={effectiveView === 'feed' ? undefined : displayCount}
          breadcrumbs={breadcrumbs}
          onNavigateCrumb={handleNavigateCrumb}
          scopeId={effectiveScopeId}
          canEdit={canEdit}
          isTrash={isTrash}
          onEmptyTrash={canEdit && isTrash ? handleEmptyTrash : undefined}
          isFeed={effectiveView === 'feed'}
          onRefreshFeed={
            effectiveView === 'feed'
              ? () => {
                  triggerRefresh();
                  toast.info(`Refreshing "${currentFeed?.name || 'feed'}"...`);
                }
              : undefined
          }
          onMarkAllFeedRead={
            effectiveView === 'feed'
              ? () => {
                  const allIds = currentFeedEntries.map((e) => e.id);
                  if (allIds.length > 0) {
                    markAllEntriesAsRead(allIds);
                  } else if (selectedFeedEntry) {
                    markAllEntriesAsRead([selectedFeedEntry.id]);
                  }
                  toast.success(`Marked all articles in "${currentFeed?.name || 'feed'}" as read`);
                }
              : undefined
          }
          onDirectFilesUpload={canEdit ? handleDirectFilesUpload : undefined}
          onDirectFolderUpload={canEdit ? handleDirectFolderUpload : undefined}
          onAddLink={canEdit ? () => openModal('ADD_BY_IDENTIFIER', { collectionId: effectiveCollectionId }) : undefined}
          onNewManualItem={canEdit ? handleNewManualItem : undefined}
          onAddCollection={
            canEdit
              ? () => openModal('CREATE_COLLECTION', { parentId: effectiveCollectionId })
              : undefined
          }
          onImportFromUser={
            canEdit && activeScope.type === 'project'
              ? () => openModal('IMPORT_FROM_USER')
              : undefined
          }
          isSubcollection={Boolean(effectiveCollectionId)}
        />
        <div className="flex-1 overflow-hidden min-h-0 relative">
          <LibraryContent
            scopeId={effectiveScopeId}
            collectionId={effectiveCollectionId}
            savedSearchId={isSavedSearchView ? nav.savedSearchId : undefined}
            feedId={effectiveFeedId}
            view={effectiveView}
            canEdit={canEdit}
            onDirectFilesUpload={canEdit ? handleDirectFilesUpload : undefined}
            onAddLink={canEdit ? () => openModal('ADD_BY_IDENTIFIER', { collectionId: effectiveCollectionId }) : undefined}
            onSelectedDuplicateGroupChange={
              effectiveView === 'duplicates' ? handleSelectedDuplicateGroupChange : undefined
            }
          />
        </div>
      </div>

      {/* Inspector Panel (Right side details, metadata, attachments, duplicate merge workbench, or Feed Inspector) */}
      <ErrorBoundary variant="section" featureName="Metadata Inspector">
        {effectiveView === 'duplicates' && selectedDuplicateGroupItems.length >= 2 ? (
          <div className="hidden md:flex w-80 lg:w-96 xl:w-[420px] h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background">
            <DuplicateMergeInspector
              items={selectedDuplicateGroupItems}
              recommendedMasterId={selectedDuplicateGroup?.recommendedMasterId}
              scopeId={effectiveScopeId}
              canEdit={canEdit}
              onOpenModal={() => {
                if (selectedDuplicateGroup) {
                  openMergeModalRef.current?.(
                    selectedDuplicateGroup,
                    selectedDuplicateGroupKey || undefined,
                  );
                }
              }}
              onMerge={handleExecuteDuplicateMerge}
              onDismiss={() => {
                if (selectedDuplicateGroupKey) {
                  dismissDuplicateGroupRef.current?.(selectedDuplicateGroupKey);
                }
                setSelectedDuplicateGroup(null);
                setSelectedDuplicateGroupKey(null);
              }}
            />
          </div>
        ) : effectiveView === 'feed' ? (
          isInspectorOpen ? (
            <div className="hidden md:flex w-80 lg:w-[420px] xl:w-[480px] 2xl:w-[520px] h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background">
              <FeedItemInspector
                entry={selectedFeedEntry}
                feedTitle={currentFeed?.name}
                collections={collectionList}
                isRead={selectedFeedEntry ? readEntryIds.has(selectedFeedEntry.id) : false}
                isSaving={selectedFeedEntry ? savingEntryIds.includes(selectedFeedEntry.id) : false}
                isSaved={isFeedEntryInLibrary(selectedFeedEntry, savedEntryIds, feedLibraryData?.items)}
                onToggleRead={toggleEntryRead}
                onSave={handleSaveFeedItemFromInspector}
                onClose={() => setIsInspectorOpen(false)}
              />
            </div>
          ) : null
        ) : (
          <LibraryInspector scopeId={effectiveScopeId} canEdit={canEdit} isLibrary={true} />
        )}
      </ErrorBoundary>

      {/* Modals (Centralized Dialog Bus) */}
      {/* LibraryModals mounted at LibraryLayout */}
    </div>
  );
}

export default ModernLibraryPage;
