'use client';

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Trash2, Files, Rss, Star, Inbox, Award, ShieldAlert, History } from 'lucide-react';
import { LibraryTopbar, type BreadcrumbItem } from '@/features/library/ui/topbar/LibraryTopbar';
import { LibraryContent, mapOrderByToSavedSearchSortBy } from '@/features/library/ui/content/LibraryContent';
import { LibraryInspector } from '@/features/library/ui/inspector/LibraryInspector';
import { DuplicateMergeInspector } from '@/features/library/ui/inspector/DuplicateMergeInspector';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import { useLibraryNavigation } from '@/features/library/core/coordinator/navigation.coordinator';

const LibraryModals = dynamic(
  () => import('@/features/library/ui/modals/LibraryModals').then((m) => m.LibraryModals), { ssr: false }
);
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import { useLibraryPermissions } from '@/features/library/core/coordinator/permissions.coordinator';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import { useCollectionsQuery, invalidateCollections } from '@/features/library/sdk/queries/collections.queries';
import { useSavedSearches, useSavedSearchResults } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import { useTrash, useLibraryCountsQuery, useItemTypes, useItems, useLibraryDeltaSync, itemKeys } from '@/features/library/sdk/queries/catalog.queries';
import { useMergeDuplicates } from '@/features/library/sdk/queries/ingestion.queries';
import { formatItemTypeLabel } from '@/features/library/domain/metadata';
import { parseEmojiPrefix } from '@/features/library/domain/academic-text';
import type { Item, DuplicateGroup } from '@/features/library/domain/types/library.types';

interface LibraryPageProps {
  scopeId?: string;
  collectionId?: string;
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
  view,
  title,
}: LibraryPageProps) {
  const router = useRouter();
  const nav = useLibraryNavigation();
  const queryClient = useQueryClient();
  const params = useParams() as { collectionId?: string; projectId?: string };
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);
  const displayOptions = useLibraryUIStore((s) => s.displayOptions);
  const startBatchUpload = useProcessModalStore((s) => s.startBatchUpload);
  const feeds = useFeedsStore((s) => s.feeds);
  const loadFeeds = useFeedsStore((s) => s.loadFeeds);
  const triggerRefresh = useFeedsStore((s) => s.triggerRefresh);

  React.useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const currentFeed = useMemo(() => {
    if (!nav.feedId) return feeds[0];
    return feeds.find((f) => f.id === nav.feedId) || feeds[0];
  }, [feeds, nav.feedId]);

  const effectiveScopeId =
    propScopeId ||
    (activeScope.type === 'project' ? activeScope.id : 'user');

  const effectiveCollectionId =
    propCollectionId || params?.collectionId || undefined;

  const { canEditItem: canEdit } = useLibraryPermissions();

  const isSavedSearchView = nav.isSavedSearchView;
  const effectiveView = view || (nav.filterParam && nav.filterParam !== 'saved-search' ? nav.filterParam : undefined);

  const filterTitle = effectiveView === 'feed'
    ? (currentFeed ? currentFeed.name : 'Feeds')
    : (effectiveView ? FILTER_TITLE_MAP[effectiveView] : undefined);
  const resolvedTitle =
    filterTitle ||
    (title && title !== 'Library' && title !== 'My Library' ? title : undefined);

  // Warm up dynamic item types schema from backend authoritative registry
  useItemTypes(effectiveScopeId);
  useLibraryDeltaSync(effectiveScopeId);

  const { data: collections = [] } = useCollectionsQuery(effectiveScopeId);
  const { savedSearches = [] } = useSavedSearches(effectiveScopeId);
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

  const effectiveOrderBy = nav.orderBy || displayOptions?.orderBy;
  const effectiveOrderDirection = nav.orderDirection || displayOptions?.orderDirection;

  const savedSearchResults = useSavedSearchResults(
    effectiveScopeId,
    isSavedSearchView && nav.savedSearchId ? nav.savedSearchId : null,
    {
      page: nav.page,
      limit: 50,
      sortBy: mapOrderByToSavedSearchSortBy(effectiveOrderBy),
      sortOrder: effectiveOrderDirection,
    },
  );

  // Deep linking: auto-select item and open inspector if ?item=... or ?selected=... is in URL
  React.useEffect(() => {
    if (nav.selectedItemId) {
      setActiveItem(nav.selectedItemId);
      selectOnly(nav.selectedItemId);
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
                  router.push(`/library?filter=feed&feedId=${feedId}`);
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
      router.push(`/library?filter=feed&feedId=${crumbId}`);
      return;
    }
    nav.navigateToCollection(crumbId);
  };

  // Shared upload handler — used for both file and folder uploads.
  // folderName is accepted by the folder variant but not used in the upload logic
  // (folder structure is implicit in the File.webkitRelativePath metadata).
  const processUpload = (files: File[]) => {
    if (!files?.length) return;
    void startBatchUpload(files, {
      scopeId: effectiveScopeId,
      collectionId: effectiveCollectionId,
      queryClient,
      onSuccess: () => {
        invalidateCollections(queryClient, effectiveScopeId);
        void queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScopeId) });
        void queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScopeId) });
      },
    });
  };

  const handleDirectFilesUpload = processUpload;
  const handleDirectFolderUpload = (files: File[], _folderName: string) => processUpload(files);


  const { createItem } = useItems({
    scopeId: effectiveScopeId,
    collectionId: effectiveCollectionId,
    enabled: false,
  });

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

  // Opens the confirmation dialog instead of using window.confirm.
  // The actual deletion is dispatched via onConfirm inside LibraryModals.
  const handleEmptyTrash = () => {
    if (trashItems.length === 0) {
      toast.info('Trash is already empty', { id: 'empty-trash' });
      return;
    }
    openModal('DELETE_CONFIRM', {
      onConfirm: async () => {
        try {
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
    if (isSavedSearchView) {
      if (typeof savedSearchResults.data?.meta?.totalCount === 'number') {
        return savedSearchResults.data.meta.totalCount;
      }
      if (savedSearchResults.data?.items) {
        return savedSearchResults.data.items.length;
      }
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
    isSavedSearchView,
    savedSearchResults.data?.meta?.totalCount,
    savedSearchResults.data?.items,
    currentSavedSearch?.cachedCount,
    currentCollection,
    displayOptions?.includeSubcollections,
    countsData?.total,
  ]);

  const mergeMutation = useMergeDuplicates(effectiveScopeId);
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
      await mergeMutation.mutateAsync({
        primaryItemId: masterPaper.id,
        duplicateItemIds: duplicateIdsToDelete,
        overrides: Object.keys(mergedFields).length > 0 ? mergedFields : undefined,
      });
    },
    [mergeMutation],
  );

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
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <LibraryTopbar
          title={displayTitle}
          icon={
            isTrash
              ? Trash2
              : (effectiveView ? FILTER_ICON_MAP[effectiveView] : undefined)
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

      {/* Inspector Panel (Right side details, metadata, attachments, or duplicate merge workbench) */}
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
              }}
            />
          </div>
        ) : (
          <LibraryInspector scopeId={effectiveScopeId} canEdit={canEdit} />
        )}
      </ErrorBoundary>

      {/* Modals (Centralized Dialog Bus) */}
      <LibraryModals scopeId={effectiveScopeId} />
    </div>
  );
}

export default ModernLibraryPage;



