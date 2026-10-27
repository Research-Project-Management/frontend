'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  useLibraryUIStore,
  type LibraryModalType,
} from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import {
  useBatchRestoreItemsMutation,
  useUpdateLibraryItemMutation,
  useLibraryCacheSynchronizer,
  useViewItems,
} from '@/features/library/sdk/queries/catalog.queries';
import {
  useLibraryCommandStore,
  buildPreConversionSnapshot,
  createConvertItemTypeCommand,
  createMergeDuplicatesCommand,
} from '@/features/library/core/manager/library-command.manager';
import { useItemTypeConversion } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import {
  useTrackedIdentifierIngestion,
  useMergeDuplicates,
  useUndoMergeDuplicatesMutation,
  useDismissDuplicatesMutation,
  useFetchAcademicFeed,
  useSubscribeFeedMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';
import { parseOpmlFeeds } from '@/features/library/domain/feed-parser.domain';
import type { AddFeedFormValues } from '@/features/library/domain/types/forms.types';
import { parseBatchIdentifiersInput } from '@/features/library/domain/identifiers';
import {
  ALL_ITEM_TYPES_FLAT,
  type Item,
} from '@/features/library/domain/types/library.types';
import {
  type LibraryModalPayload,
  type ModalHostProps,
  CollectionModalsHost,
  DestructiveItemModalsHost,
  SavedSearchModalHost,
} from './modal-hosts';

export {
  type LibraryModalPayload,
  type ModalHostProps,
  CollectionModalsHost,
  DestructiveItemModalsHost,
  SavedSearchModalHost,
};

const AddLinkModal = dynamic(() => import('./AddLinkModal'), { ssr: false });
const ImportFromPersonalModal = dynamic(() => import('./ImportFromPersonalModal'), { ssr: false });
const TypeConversionModal = dynamic(
  () => import('./TypeConversionModal').then((m) => m.TypeConversionModal),
  { ssr: false },
);
const MergeModal = dynamic(() => import('./MergeModal'), { ssr: false });
const UploadFilesModal = dynamic(() => import('./UploadFilesModal'), { ssr: false });
const AddFeedModal = dynamic(() => import('./AddFeedModal'), { ssr: false });
const EditFeedModal = dynamic(
  () => import('./EditFeedModal').then((m) => m.EditFeedModal),
  { ssr: false },
);
const CslStyleSearchModal = dynamic(() => import('./CslStyleSearchModal'), { ssr: false });

/**
 * 4. CurationModalsHost
 * Only mounts duplicate merge, duplicate dismiss, item type conversion, and item update hooks when open.
 * Pushes reversible Undo/Redo commands onto `useLibraryCommandStore`.
 */
export function CurationModalsHost({
  activeModal,
  payload,
  effectiveScope,
  closeModal,
}: ModalHostProps) {
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const {
    invalidateScopeItemsAndCounts,
    resolveCachedItem,
    syncConvertedOrPatchedItem,
  } = useLibraryCacheSynchronizer(effectiveScope);

  const mergeDuplicatesMutation = useMergeDuplicates(effectiveScope);
  const undoMergeDuplicatesMutation = useUndoMergeDuplicatesMutation(effectiveScope);
  const dismissDuplicatesMutation = useDismissDuplicatesMutation(effectiveScope);
  const restoreItemsMutation = useBatchRestoreItemsMutation(effectiveScope);
  const updateItemMutation = useUpdateLibraryItemMutation(effectiveScope);
  const { convertAsync } = useItemTypeConversion(effectiveScope);

  const isConvertOpen =
    activeModal === 'TYPE_CONVERSION' || activeModal === 'CONVERT_ITEM_TYPE';
  const isMergeOpen =
    activeModal === 'MERGE_DUPLICATES' || activeModal === 'RESOLVE_CONFLICT';

  const sourceItemForConversion = React.useMemo<Item | undefined>(() => {
    const targetId = payload?.item?.id || payload?.itemId;
    const cached = targetId ? resolveCachedItem(targetId, effectiveScope) : undefined;
    if (payload?.item && cached) {
      return { ...cached, ...payload.item };
    }
    if (payload?.item) return payload.item;
    if (cached) return cached;
    if (payload?.itemId) {
      return {
        id: payload.itemId,
        itemType: (payload.currentType || 'journalArticle') as Item['itemType'],
        title: payload.itemTitle || '',
      } as Item;
    }
    return undefined;
  }, [
    effectiveScope,
    payload?.currentType,
    payload?.item,
    payload?.itemId,
    payload?.itemTitle,
    resolveCachedItem,
  ]);

  const mergeDuplicates = payload?.items || payload?.duplicates || [];

  const handleMergeDuplicates = async (
    masterPaper: Item,
    mergedFields: Record<string, unknown>,
    duplicateIdsToDelete: string[],
  ) => {
    const cachedPrimary = resolveCachedItem(masterPaper.id, effectiveScope);
    const snapshotPrimary: Item = cachedPrimary
      ? { ...masterPaper, ...cachedPrimary }
      : masterPaper;

    await useLibraryCommandStore.getState().executeCommand(
      createMergeDuplicatesCommand({
        primaryItem: snapshotPrimary,
        duplicateIdsToDelete,
        mergedFields,
        mergeMutation: { mutateAsync: mergeDuplicatesMutation.mutateAsync },
        undoMergeMutation: { mutateAsync: undoMergeDuplicatesMutation.mutateAsync },
        restoreMutation: { mutateAsync: restoreItemsMutation.mutateAsync },
        updateItemMutation: {
          mutateAsync: ({ itemId, data, silent }) =>
            updateItemMutation.mutateAsync({ itemId, data, silent }),
        },
        onUndone: () => {
          void invalidateScopeItemsAndCounts(effectiveScope);
        },
      }),
      { silentToast: false },
    );

    clearSelection();
    closeModal();
  };

  const handleDismissDuplicates = async (itemIds: string[]) => {
    if (payload?.onDismissDuplicate) {
      await payload.onDismissDuplicate(itemIds);
    } else {
      await dismissDuplicatesMutation.mutateAsync(itemIds);
    }
    clearSelection();
    closeModal();
  };

  if (isConvertOpen) {
    const targetType = payload?.targetType || 'journalArticle';
    const targetTypeLabel =
      ALL_ITEM_TYPES_FLAT.find((t) => t.value === targetType)?.label || targetType;
    // Freeze a complete bibliographic pre-conversion snapshot before TypeConversionModal mutates the item
    const preConversionSnapshot: Partial<Item> | undefined = sourceItemForConversion
      ? buildPreConversionSnapshot(sourceItemForConversion)
      : undefined;

    return (
      <TypeConversionModal
        open={isConvertOpen}
        onOpenChange={(open) => !open && closeModal()}
        item={sourceItemForConversion}
        targetType={targetType}
        scopeId={effectiveScope}
        onSuccess={(updatedItem: Item, retainUnmapped?: boolean) => {
          const targetItemId =
            updatedItem?.id || sourceItemForConversion?.id || payload?.itemId;
          if (targetItemId && updatedItem) {
            syncConvertedOrPatchedItem(targetItemId, updatedItem, effectiveScope);
          } else {
            void invalidateScopeItemsAndCounts(effectiveScope);
          }

          if (
            targetItemId &&
            preConversionSnapshot &&
            preConversionSnapshot.itemType &&
            preConversionSnapshot.itemType !== targetType
          ) {
            useLibraryCommandStore.getState().pushExecutedCommand(
              createConvertItemTypeCommand({
                itemId: targetItemId,
                itemTitle: preConversionSnapshot.title || updatedItem?.title,
                sourceItem: preConversionSnapshot,
                targetType,
                targetTypeLabel,
                retainUnmappedInExtra: retainUnmapped ?? true,
                convertType: convertAsync,
                applyMetadataPatch: (itemId, patch) =>
                  updateItemMutation.mutateAsync({
                    itemId,
                    data: patch,
                    silent: true,
                  }),
                onStateSynced: (syncedItem) => {
                  if (syncedItem) {
                    syncConvertedOrPatchedItem(targetItemId, syncedItem, effectiveScope);
                  } else {
                    void invalidateScopeItemsAndCounts(effectiveScope);
                  }
                },
              }),
            );
          }

          closeModal();
        }}
      />
    );
  }

  if (isMergeOpen && mergeDuplicates.length >= 2) {
    return (
      <MergeModal
        open={isMergeOpen}
        onOpenChange={(open) => !open && closeModal()}
        duplicates={mergeDuplicates}
        recommendedMasterId={payload?.recommendedMasterId}
        scopeId={effectiveScope}
        onMerge={handleMergeDuplicates}
        onDismissDuplicate={handleDismissDuplicates}
      />
    );
  }

  return null;
}

/**
 * 5. IngestionAndUtilityModalsHost
 * Lazy host for identifier link ingestion, PDF upload, personal library import, feeds, and CSL style picker.
 */
export function IngestionAndUtilityModalsHost({
  activeModal,
  payload,
  effectiveScope,
  closeModal,
}: ModalHostProps) {
  const runTrackedIdentifierIngestion = useTrackedIdentifierIngestion(effectiveScope);
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const addProcessingItem = useProcessModalStore((s) => s.addProcessingItem);
  const dismissProcessingItem = useProcessModalStore((s) => s.dismissProcessingItem);
  const { invalidateScopeItemsAndCounts } = useLibraryCacheSynchronizer(effectiveScope);

  const isImportFromUserOpen = activeModal === 'IMPORT_FROM_USER';
  const { data: projectItemsData } = useViewItems(
    isImportFromUserOpen ? effectiveScope : undefined,
    'all',
    { limit: 500 },
    { enabled: isImportFromUserOpen },
  );
  const existingProjectTitles = React.useMemo(() => {
    if (payload?.existingTitles && Array.isArray(payload.existingTitles)) {
      return payload.existingTitles;
    }
    return (projectItemsData?.items || []).map((it) => it.title).filter(Boolean);
  }, [payload?.existingTitles, projectItemsData?.items]);

  const [isSubmittingLink, setIsSubmittingLink] = React.useState(false);
  const router = useRouter();
  const { mutateAsync: subscribeFeed } = useSubscribeFeedMutation();
  const { mutateAsync: fetchAcademicFeed } = useFetchAcademicFeed();
  const addFeedToStore = useFeedsStore((s) => s.addFeed);
  const [isSubmittingFeed, setIsSubmittingFeed] = React.useState(false);

  const handleAddFeedSubmit = async (data: AddFeedFormValues) => {
    setIsSubmittingFeed(true);
    try {
      let finalName = (data.name || '').trim();
      if (!finalName) {
        try {
          const res = await fetchAcademicFeed(data.url);
          const payload =
            typeof res === 'object' && res !== null && 'data' in res
              ? (res as { data?: { feedTitle?: string } }).data
              : (res as { feedTitle?: string });
          if (payload?.feedTitle) {
            finalName = payload.feedTitle.trim();
          }
        } catch {
          // fallback to domain naming in store
        }
      }

      const newFeed = await subscribeFeed({
        name: finalName || 'Academic Feed',
        url: data.url,
        retentionDays: data.cleanupUnreadAfter ?? data.retentionDays,
        cleanupReadAfter: data.cleanupReadAfter ?? 7,
        cleanupUnreadAfter: data.cleanupUnreadAfter ?? data.retentionDays,
      });
      toast.success(`Subscribed to "${newFeed.name}"`);
      await invalidateScopeItemsAndCounts(effectiveScope);
      closeModal();
      if (newFeed.id) {
        router.push(`/library/feeds/${newFeed.id}`);
      }
    } catch {
      toast.error('Failed to subscribe to feed');
    } finally {
      setIsSubmittingFeed(false);
    }
  };

  const handleImportOpml = async (content: string) => {
    try {
      const parsed = parseOpmlFeeds(content);
      if (parsed.length > 0) {
        for (const item of parsed) {
          addFeedToStore(item.name, item.url, 30);
        }
        toast.success(`Imported ${parsed.length} feeds from OPML`);
        await invalidateScopeItemsAndCounts(effectiveScope);
        closeModal();
      } else {
        toast.error('No valid RSS/Atom feeds found in OPML file');
      }
    } catch {
      toast.error('Failed to parse OPML file');
    }
  };

  const handleAddLinkSubmit = async (data: {
    url: string;
    title?: string;
    attachOaPdf?: boolean;
    saveSnapshot?: boolean;
  }) => {
    const raw = (data.url || '').trim();
    if (!raw) return;

    const batchItems = parseBatchIdentifiersInput(raw);
    const inputsToIngest =
      batchItems.length > 1 ? batchItems.map((entry) => entry.raw) : [raw];

    setIsSubmittingLink(true);
    try {
      if (inputsToIngest.length > 1) {
        closeModal();
        await Promise.allSettled(
          inputsToIngest.map((singleInput) =>
            runTrackedIdentifierIngestion({
              rawInput: singleInput,
              title: undefined,
              attachOaPdf: data.attachOaPdf,
              saveSnapshot: data.saveSnapshot,
              collectionId: payload?.collectionId,
              onCloseModal: () => {},
              onAddProvisionalItem: addProcessingItem,
              onDismissProvisionalItem: dismissProcessingItem,
            }),
          ),
        );
      } else {
        await runTrackedIdentifierIngestion({
          rawInput: inputsToIngest[0]!,
          title: data.title,
          attachOaPdf: data.attachOaPdf,
          saveSnapshot: data.saveSnapshot,
          collectionId: payload?.collectionId,
          onCloseModal: closeModal,
          onAddProvisionalItem: addProcessingItem,
          onDismissProvisionalItem: dismissProcessingItem,
        });
      }
    } finally {
      setIsSubmittingLink(false);
    }
  };

  if (activeModal === 'ADD_BY_IDENTIFIER') {
    return (
      <AddLinkModal
        open={true}
        onOpenChange={(open) => !open && closeModal()}
        onSubmit={handleAddLinkSubmit}
        isPending={isSubmittingLink}
      />
    );
  }

  if (isImportFromUserOpen) {
    return (
      <ImportFromPersonalModal
        open={true}
        onOpenChange={(open) => !open && closeModal()}
        scopeId={effectiveScope}
        projectName={activeScope?.name || 'Project'}
        existingTitles={existingProjectTitles}
        onSuccess={() => {
          void invalidateScopeItemsAndCounts(effectiveScope);
          closeModal();
        }}
      />
    );
  }

  if (activeModal === 'UPLOAD_PDF') {
    return (
      <UploadFilesModal
        open={true}
        onOpenChange={(open) => !open && closeModal()}
        scopeId={effectiveScope}
        defaultCollectionId={payload?.collectionId || ''}
        initialFiles={payload?.files || payload?.initialFiles || []}
        onSuccess={() => {
          void invalidateScopeItemsAndCounts(effectiveScope);
          closeModal();
        }}
      />
    );
  }

  if (activeModal === 'ADD_FEED') {
    return (
      <AddFeedModal
        open={true}
        onOpenChange={(open) => !open && closeModal()}
        onSubmit={handleAddFeedSubmit}
        onImportOpml={handleImportOpml}
        isPending={isSubmittingFeed}
      />
    );
  }

  if (activeModal === 'EDIT_FEED') {
    return (
      <EditFeedModal
        open={true}
        onOpenChange={(open) => !open && closeModal()}
        feed={payload?.feed as SavedFeedSubscription | null}
      />
    );
  }

  if (activeModal === 'CSL_STYLE_MANAGER') {
    return (
      <CslStyleSearchModal
        open={true}
        onOpenChange={(open) => !open && closeModal()}
        currentStyleId={
          typeof payload?.currentStyleId === 'string'
            ? payload.currentStyleId
            : undefined
        }
        onSelectStyle={(style) => {
          if (typeof payload?.onSelectStyle === 'function') {
            payload.onSelectStyle(style);
          }
          closeModal();
        }}
      />
    );
  }

  return null;
}

/**
 * Declarative Strategy Registry mapping every `LibraryModalType` to its lazy host container.
 * Ensures zero modal-specific TanStack Query / Mutation hooks subscribe when `activeModal === null`.
 */
export const ACTIVE_MODAL_REGISTRY: Partial<
  Record<LibraryModalType, React.ComponentType<ModalHostProps>>
> = {
  CREATE_COLLECTION: CollectionModalsHost,
  RENAME_COLLECTION: CollectionModalsHost,
  DELETE_COLLECTION: CollectionModalsHost,
  EXPORT_LIBRARY: CollectionModalsHost,
  FEEDS_MANAGER: CollectionModalsHost,
  DELETE_CONFIRM: DestructiveItemModalsHost,
  CONFIRM_DELETE: DestructiveItemModalsHost,
  CONFIRM_RESTORE: DestructiveItemModalsHost,
  EMPTY_TRASH: DestructiveItemModalsHost,
  MERGE_DUPLICATES: CurationModalsHost,
  RESOLVE_CONFLICT: CurationModalsHost,
  TYPE_CONVERSION: CurationModalsHost,
  CONVERT_ITEM_TYPE: CurationModalsHost,
  SAVED_SEARCH: SavedSearchModalHost,
  ADD_BY_IDENTIFIER: IngestionAndUtilityModalsHost,
  IMPORT_FROM_USER: IngestionAndUtilityModalsHost,
  UPLOAD_PDF: IngestionAndUtilityModalsHost,
  ADD_FEED: IngestionAndUtilityModalsHost,
  EDIT_FEED: IngestionAndUtilityModalsHost,
  CSL_STYLE_MANAGER: IngestionAndUtilityModalsHost,
};
