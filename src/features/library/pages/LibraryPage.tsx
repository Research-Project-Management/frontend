'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LibraryTopbar } from '../components/topbar';
import { LibraryContent } from '../components/content';
import { LibraryInspector } from '../components/inspector';
import { LibraryModals } from '../components/modals';
import {
  useLibrarySidebarStore,
  useLibraryModalStore,
  useLibraryUIStore,
} from '../store';
import {
  useCollectionsQuery,
  useSavedSearches,
  useBatchPurgeItemsMutation,
  uploadLibraryFile,
  IngestionService,
  ItemService,
  itemKeys,
  invalidateCollections,
} from '../data';

interface LibraryPageProps {
  scopeId?: string;
  collectionId?: string;
  view?: string;
  title?: string;
}

function formatItemTypeLabel(type: string): string {
  switch (type) {
    case 'journalArticle':
      return 'Journal Article';
    case 'book':
      return 'Book';
    case 'bookSection':
      return 'Book Section';
    case 'conferencePaper':
      return 'Conference Paper';
    case 'preprint':
      return 'Preprint';
    case 'report':
      return 'Report';
    case 'thesis':
      return 'Thesis';
    case 'webpage':
      return 'Web Page';
    case 'dataset':
      return 'Dataset';
    default:
      return type.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }
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

  const effectiveScopeId =
    propScopeId ||
    (activeScope.type === 'project' ? activeScope.id : 'user');

  const effectiveCollectionId =
    propCollectionId || params?.collectionId || undefined;

  const isPersonalScope = activeScope.type === 'personal';
  const canEdit =
    isPersonalScope ||
    activeScope.role === 'owner' ||
    activeScope.role === 'coordinator' ||
    activeScope.role === 'contributor';

  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const savedSearchId = searchParams.get('savedSearchId') || undefined;
  const isSavedSearchView = filterParam === 'saved-search' && Boolean(savedSearchId);

  const { data: collections = [] } = useCollectionsQuery(effectiveScopeId);
  const { savedSearches = [] } = useSavedSearches(effectiveScopeId);
  const currentCollection = effectiveCollectionId
    ? collections.find((c) => c.id === effectiveCollectionId)
    : undefined;
  const currentSavedSearch = savedSearchId
    ? savedSearches.find((s) => s.id === savedSearchId)
    : undefined;

  // Breadcrumb navigation
  const breadcrumbs = useMemo(() => {
    if (isSavedSearchView && currentSavedSearch) {
      return [
        { id: undefined, name: activeScope.name || 'My Library' },
        { id: currentSavedSearch.id, name: currentSavedSearch.name },
      ];
    }
    if (!currentCollection) return undefined;
    return [
      { id: undefined, name: activeScope.name || 'My Library' },
      { id: currentCollection.id, name: currentCollection.name },
    ];
  }, [isSavedSearchView, currentSavedSearch, currentCollection, activeScope.name]);

  const handleNavigateCrumb = (crumbId?: string) => {
    if (!crumbId) {
      router.push('/library');
    } else {
      router.push(`/library/${crumbId}`);
    }
  };

  // Direct files upload handler (opens the interactive UploadFilesModal)
  const handleDirectFilesUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    openModal('UPLOAD_FILES', {
      collectionId: effectiveCollectionId,
      initialFiles: files,
    });
  };

  // Direct folder upload handler
  const handleDirectFolderUpload = async (files: File[], folderName: string) => {
    if (!files || files.length === 0) return;
    openModal('UPLOAD_FILES', {
      collectionId: effectiveCollectionId,
      initialFiles: files,
    });
  };

  // Manual reference creation handler
  const handleNewManualItem = async (itemType: string) => {
    const label = formatItemTypeLabel(itemType);
    const toastId = toast.loading(`Creating ${label}...`, { id: 'create-ref' });
    try {
      const newItem = await ItemService.create(effectiveScopeId, effectiveCollectionId || '', {
        itemType,
        title: `Untitled ${label}`,
        collectionId: effectiveCollectionId,
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScopeId) });
      queryClient.invalidateQueries({ queryKey: ['items', effectiveScopeId] });
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
  const purgeMutation = useBatchPurgeItemsMutation(effectiveScopeId);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);

  const handleEmptyTrash = async () => {
    if (
      !window.confirm(
        'Are you sure you want to permanently empty the trash? All items will be permanently deleted and cannot be recovered.',
      )
    ) {
      return;
    }

    const toastId = toast.loading('Emptying trash...', { id: 'empty-trash' });
    try {
      const trashData = await ItemService.getAll(effectiveScopeId, { view: 'trash', limit: 500 });
      const ids = (trashData?.items || []).map((it) => it.id);
      if (ids.length === 0) {
        toast.info('Trash is already empty', { id: toastId });
        return;
      }
      await purgeMutation.mutateAsync(ids);
      clearSelection();
      toast.success('Trash emptied', {
        description: `Permanently deleted ${ids.length} item(s).`,
        id: toastId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not empty trash.';
      toast.error('Failed to empty trash', {
        description: message,
        id: toastId,
      });
    }
  };

  const displayTitle =
    title ||
    (isSavedSearchView && currentSavedSearch ? currentSavedSearch.name : undefined) ||
    (currentCollection ? currentCollection.name : undefined) ||
    activeScope.name ||
    'My Library';

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main Workspace (Topbar + Data Content) */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <LibraryTopbar
          title={displayTitle}
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
          onImportFromPersonal={
            canEdit && activeScope.type === 'project'
              ? () => openModal('IMPORT_FROM_PERSONAL')
              : undefined
          }
          isSubcollection={Boolean(effectiveCollectionId)}
        />
        <div className="flex-1 overflow-hidden min-h-0 relative">
          <LibraryContent
            scopeId={effectiveScopeId}
            collectionId={effectiveCollectionId}
            savedSearchId={isSavedSearchView ? savedSearchId : undefined}
            view={view}
            canEdit={canEdit}
            onDirectFilesUpload={canEdit ? handleDirectFilesUpload : undefined}
            onAddLink={canEdit ? () => openModal('ADD_LINK', { collectionId: effectiveCollectionId }) : undefined}
          />
        </div>
      </div>

      {/* Inspector Panel (Right side details, metadata, attachments) */}
      <LibraryInspector scopeId={effectiveScopeId} canEdit={canEdit} />

      {/* Modals (Centralized Dialog Bus) */}
      <LibraryModals scopeId={effectiveScopeId} />
    </div>
  );
}

export default ModernLibraryPage;
