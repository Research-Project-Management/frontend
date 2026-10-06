'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Trash2 } from 'lucide-react';
import { LibraryTopbar, type BreadcrumbItem } from '../components/topbar';
import { LibraryContent } from '../components/content';
import { LibraryInspector } from '../components/inspector';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';

const LibraryModals = dynamic(
  () => import('../components/modals').then((m) => m.LibraryModals),
  { ssr: false }
);
import {
  useLibrarySidebarStore,
  useLibraryModalStore,
  useLibraryUIStore,
  useProcessModalStore,
  useLibraryPermissions,
} from '../store';
import {
  useCollectionsQuery,
  useSavedSearches,
  useSavedSearchResults,
  useTrash,
  useLibraryCountsQuery,
  useItemTypes,
  libraryServices,
  itemKeys,
  invalidateCollections,
} from '../data';
import { formatItemTypeLabel } from '../domain';
import { parseEmojiPrefix } from '../utils';

interface LibraryPageProps {
  scopeId?: string;
  collectionId?: string;
  view?: string;
  title?: string;
}



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
  const queryClient = useQueryClient();
  const params = useParams() as { collectionId?: string; projectId?: string };
  const activeScope = useLibrarySidebarStore((s) => s.activeScope);
  const openModal = useLibraryModalStore((s) => s.openModal);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);
  const startBatchUpload = useProcessModalStore((s) => s.startBatchUpload);

  const effectiveScopeId =
    propScopeId ||
    (activeScope.type === 'project' ? activeScope.id : 'user');

  const effectiveCollectionId =
    propCollectionId || params?.collectionId || undefined;

  const isUserScope = activeScope.type === 'user';
  const { canEditItem: canEdit } = useLibraryPermissions();

  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const savedSearchId = searchParams.get('savedSearchId') || undefined;
  const isSavedSearchView = filterParam === 'saved-search' && Boolean(savedSearchId);
  const effectiveView = view || (filterParam && filterParam !== 'saved-search' ? filterParam : undefined);

  const filterTitleMap: Record<string, string> = {
    'my-publications': 'My Publications',
    publications: 'My Publications',
    retracted: 'Retracted Items',
    starred: 'Starred Items',
    unfiled: 'Unfiled Items',
    trash: 'Trash',
    duplicates: 'Duplicate Items',
    recent: 'Recently Read',
    'recently-read': 'Recently Read',
  };

  const resolvedTitle = title || (effectiveView ? filterTitleMap[effectiveView] : undefined);

  // Warm up dynamic item types schema from backend authoritative registry
  useItemTypes(effectiveScopeId);

  const { data: collections = [] } = useCollectionsQuery(effectiveScopeId);
  const { savedSearches = [] } = useSavedSearches(effectiveScopeId);
  const currentCollection = effectiveCollectionId
    ? collections.find((c) => c.id === effectiveCollectionId)
    : undefined;
  const currentSavedSearch = savedSearchId
    ? savedSearches.find((s) => s.id === savedSearchId)
    : undefined;

  const savedSearchResults = useSavedSearchResults(
    effectiveScopeId,
    isSavedSearchView && savedSearchId ? savedSearchId : null,
  );

  // Deep linking: auto-select item and open inspector if ?item=... or ?selected=... is in URL
  const itemParam = searchParams.get('item') || searchParams.get('selected');
  React.useEffect(() => {
    if (itemParam) {
      setActiveItem(itemParam);
      selectOnly(itemParam);
      setIsInspectorOpen(true);
    }
  }, [itemParam, setActiveItem, selectOnly, setIsInspectorOpen]);

  // Breadcrumb navigation with full ancestor chain
  const breadcrumbs = useMemo<BreadcrumbItem[] | undefined>(() => {
    const rootName = activeScope.type === 'user' ? 'Library' : (activeScope.name || 'Library');
    if (isSavedSearchView && currentSavedSearch) {
      const { label: cleanName } = parseEmojiPrefix(currentSavedSearch.name);
      return [
        { name: rootName },
        { id: currentSavedSearch.id, name: cleanName },
      ];
    }
    if (resolvedTitle && resolvedTitle !== 'My Library' && resolvedTitle !== 'Library' && !currentCollection) {
      return [
        { name: rootName },
        { name: resolvedTitle },
      ];
    }
    if (!currentCollection) return undefined;

    const crumbs: BreadcrumbItem[] = [{ name: rootName }];
    const chain: any[] = [];
    let curr: any = currentCollection;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      chain.unshift(curr);
      if (curr.parentId) {
        const parentId: string = curr.parentId;
        curr = collections.find((c: any) => c.id === parentId);
      } else {
        break;
      }
    }
    for (const c of chain) {
      crumbs.push({ id: c.id, name: c.name });
    }
    return crumbs;
  }, [isSavedSearchView, currentSavedSearch, currentCollection, collections, activeScope.name, activeScope.type, resolvedTitle]);

  const handleNavigateCrumb = (crumbId?: string) => {
    if (!crumbId) {
      router.push('/library');
    } else {
      router.push(`/library/${crumbId}`);
    }
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
        void queryClient.invalidateQueries({ queryKey: ['library', 'items'] });
        void queryClient.invalidateQueries({ queryKey: ['library', 'counts'] });
      },
    });
  };

  const handleDirectFilesUpload = processUpload;
  const handleDirectFolderUpload = (files: File[], _folderName: string) => processUpload(files);


  // Manual reference creation handler
  const handleNewManualItem = async (itemType: string) => {
    const label = formatItemTypeLabel(itemType);
    const toastId = toast.loading(`Creating ${label}...`, { id: 'create-ref' });
    try {
      const newItem = await libraryServices.items.create(effectiveScopeId, effectiveCollectionId || '', {
        itemType,
        title: `Untitled ${label}`,
        collectionId: effectiveCollectionId,
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScopeId) });
      if (effectiveCollectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(effectiveScopeId, effectiveCollectionId),
        });
      }
      invalidateCollections(queryClient, effectiveScopeId);

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

  const isTrash = view === 'trash';
  const { state: trashState, actions: trashActions } = useTrash(effectiveScopeId);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);

  // Opens the confirmation dialog instead of using window.confirm.
  // The actual deletion is dispatched via onConfirm inside LibraryModals.
  const handleEmptyTrash = () => {
    if (trashState.trashItems.length === 0) {
      toast.info('Trash is already empty', { id: 'empty-trash' });
      return;
    }
    openModal('TRASH_CONFIRM', {
      onConfirm: async () => {
        try {
          await trashActions.emptyTrash();
          clearSelection();
        } catch (err: unknown) {
          console.error('Failed to empty trash:', err);
        }
      },
    });
  };


  const { data: countsData } = useLibraryCountsQuery(effectiveScopeId);
  const displayCount = useMemo(() => {
    if (isTrash) return trashState.trashItems.length;
    if (isSavedSearchView) {
      if (savedSearchResults.data?.items) {
        return savedSearchResults.data.items.length;
      }
      return currentSavedSearch?.cachedCount ?? 0;
    }
    if (currentCollection) {
      return currentCollection.itemCount ?? currentCollection.paperCount ?? 0;
    }
    return countsData?.total;
  }, [
    isTrash,
    trashState.trashItems.length,
    isSavedSearchView,
    savedSearchResults.data?.items,
    currentSavedSearch?.cachedCount,
    currentCollection,
    countsData?.total,
  ]);

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
          icon={isTrash ? Trash2 : undefined}
          count={displayCount}
          breadcrumbs={breadcrumbs}
          onNavigateCrumb={handleNavigateCrumb}
          scopeId={effectiveScopeId}
          canEdit={canEdit}
          isTrash={isTrash}
          onEmptyTrash={canEdit && isTrash ? handleEmptyTrash : undefined}
          onDirectFilesUpload={canEdit ? handleDirectFilesUpload : undefined}
          onDirectFolderUpload={canEdit ? handleDirectFolderUpload : undefined}
          onAddLink={canEdit ? () => openModal('ADD_LINK', { collectionId: effectiveCollectionId }) : undefined}
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
            savedSearchId={isSavedSearchView ? savedSearchId : undefined}
            view={effectiveView}
            canEdit={canEdit}
            onDirectFilesUpload={canEdit ? handleDirectFilesUpload : undefined}
            onAddLink={canEdit ? () => openModal('ADD_LINK', { collectionId: effectiveCollectionId }) : undefined}
            onEmptyTrash={canEdit && isTrash ? handleEmptyTrash : undefined}
          />
        </div>
      </div>

      {/* Inspector Panel (Right side details, metadata, attachments) */}
      <ErrorBoundary variant="section" featureName="Metadata Inspector">
        <LibraryInspector scopeId={effectiveScopeId} canEdit={canEdit} />
      </ErrorBoundary>

      {/* Modals (Centralized Dialog Bus) */}
      <LibraryModals scopeId={effectiveScopeId} />
    </div>
  );
}

export default ModernLibraryPage;
