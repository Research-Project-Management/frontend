'use client';

import { useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { openInNewTab } from '@/features/library/core/coordinator/browser-io.helpers';
import { isProjectScope } from '@/features/library/domain/item-url';
import { ItemsService } from '@/features/library/sdk/library.client';
import { libraryKeys, itemKeys } from '@/features/library/sdk/query-keys';
import { useCitationStyles } from '@/features/library/sdk/queries/citation.queries';
import { useAssignCollectionItemsMutation } from '@/features/library/sdk/queries/collections.queries';
import {
  useReResolveItemMetadataMutation,
  useSetMyPublicationMutation,
} from '@/features/library/sdk/queries/catalog.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useRetraction } from '@/features/library/sdk/queries/ingestion.queries';
import { useItemTypeConversion } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import {
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
} from '@/features/library/core/coordinator/citation-export.coordinator';
import {
  DEFAULT_CITATION_STYLES,
  getCleanStyleLabel,
} from '@/features/library/domain/citations';
import type { Item, Collection, CslStyle } from '@/features/library/domain/types/library.types';

export interface UseItemActionHandlersOptions {
  scopeId?: string;
  isMenuOpen?: boolean;
  onOpenItem?: (id: string) => void;
  onAddToCollection?: (collectionId: string) => void;
  onMoveToCollection?: (collectionId: string) => void;
  onAfterAction?: () => void;
}

export interface CitationStyleOption {
  id: string;
  label: string;
}

/**
 * Shared Action & Citation Orchestration Hook for Library Item Row Actions & Context Menus.
 *
 * Eliminates duplicated mutation wiring and citation style resolution across
 * `ItemRowActions` and `ItemContextMenu`.
 */
export function useItemActionHandlers(
  item: Item,
  options: UseItemActionHandlersOptions = {},
) {
  const {
    scopeId,
    isMenuOpen = false,
    onOpenItem,
    onAddToCollection,
    onMoveToCollection,
    onAfterAction,
  } = options;

  const effectiveScope = scopeId || item.projectId || 'user';

  const assignCollectionItemsMutation = useAssignCollectionItemsMutation(scopeId);
  const reResolveMutation = useReResolveItemMetadataMutation(scopeId);
  const setMyPublicationMutation = useSetMyPublicationMutation(scopeId);
  const { flagItem, unflagItem } = useRetraction(scopeId, { includeItems: false });
  const itemTypeConversion = useItemTypeConversion(effectiveScope);
  const { data: serverStyles = [] } = useCitationStyles(scopeId, { enabled: isMenuOpen });

  const availableStyles = useMemo<CitationStyleOption[]>(() => {
    if (serverStyles.length > 0) {
      return serverStyles.map((s) => ({
        id: s.id,
        label: s.shortTitle || s.name || getCleanStyleLabel(s.id),
      }));
    }
    return DEFAULT_CITATION_STYLES.map((s) => ({
      id: s.id,
      label: getCleanStyleLabel(s.id, s.label),
    }));
  }, [serverStyles]);

  const isStarred =
    Boolean(item.isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  const handleOpen = useCallback(() => {
    onAfterAction?.();
    if (onOpenItem) {
      onOpenItem(item.id);
    } else {
      const projectId = item.projectId || (isProjectScope(effectiveScope) ? effectiveScope : undefined);
      const qs = projectId ? `?projectId=${encodeURIComponent(String(projectId))}` : '';
      openInNewTab(`/library/papers/${item.id}${qs}`);
    }
  }, [item.id, item.projectId, effectiveScope, onAfterAction, onOpenItem]);

  const handleCopyBibliography = useCallback(
    async (style: CslStyle = 'apa-7th') => {
      onAfterAction?.();
      if (style === 'bibtex') {
        await executeExportAllBibtex([item], effectiveScope, 1);
        return;
      }
      await executeCopyMultiCite([item], effectiveScope, style);
    },
    [effectiveScope, item, onAfterAction],
  );

  const handleCopyBibtex = useCallback(async () => {
    onAfterAction?.();
    await executeExportAllBibtex([item], effectiveScope, 1);
  }, [effectiveScope, item, onAfterAction]);

  const handleCopyInTextCitation = useCallback(
    async (style: CslStyle = 'apa-7th') => {
      onAfterAction?.();
      await executeCopyInTextCite([item], effectiveScope, style);
    },
    [effectiveScope, item, onAfterAction],
  );

  const handleCopyCitationKey = useCallback(
    (prefixLabel = 'Copied citation key') => {
      onAfterAction?.();
      const effectiveCiteKey = item.citationKey?.trim();
      if (effectiveCiteKey) {
        void copyToClipboard(effectiveCiteKey);
        toast.success(`${prefixLabel}: ${effectiveCiteKey}`, {
          id: 'library-clipboard',
        });
      } else {
        toast.info('Item does not have a citation key', {
          id: 'library-clipboard',
        });
      }
    },
    [item.citationKey, onAfterAction],
  );

  const handleRefreshMetadata = useCallback(() => {
    onAfterAction?.();
    void reResolveMutation.mutateAsync({
      itemId: item.id,
      attachOaPdf: true,
    });
  }, [item.id, onAfterAction, reResolveMutation]);

  const openModal = useLibraryUIStore((s) => s.openModal);

  const handleToggleMyPublications = useCallback(() => {
    onAfterAction?.();
    if (item.isMyPublication) {
      void setMyPublicationMutation.mutateAsync({
        itemId: item.id,
        isMyPublication: false,
      });
    } else {
      openModal('MY_PUBLICATION_CONFIRM', { item });
    }
  }, [item, onAfterAction, openModal, setMyPublicationMutation]);

  const handleToggleRetraction = useCallback(() => {
    onAfterAction?.();
    if (item.isRetracted) {
      void unflagItem(item.id);
    } else {
      void flagItem({
        itemId: item.id,
        data: {
          nature: 'retraction',
          reason: 'Manually flagged as retracted by user',
        },
      });
    }
  }, [flagItem, item.id, item.isRetracted, onAfterAction, unflagItem]);

  const handleSelectCollection = useCallback(
    async (col: Collection) => {
      onAfterAction?.();
      if (onAddToCollection) {
        onAddToCollection(col.id);
        return;
      }
      if (onMoveToCollection) {
        onMoveToCollection(col.id);
        return;
      }
      try {
        await assignCollectionItemsMutation.mutateAsync({
          collectionId: col.id,
          itemIds: [item.id],
        });
        toast.success(`Added to "${col.name}"`);
      } catch (err) {
        toast.error('Failed to add to collection', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [
      assignCollectionItemsMutation,
      item.id,
      onAddToCollection,
      onAfterAction,
      onMoveToCollection,
    ],
  );

  const handleConvertType = useCallback(
    async (targetType: string, retainUnmappedInExtra = true) => {
      onAfterAction?.();
      await itemTypeConversion.convertAsync({
        itemId: item.id,
        targetType,
        expectedVersion: item.version,
        retainUnmappedInExtra,
      });
    },
    [item.id, item.version, itemTypeConversion, onAfterAction],
  );

  return {
    availableStyles,
    isStarred,
    handleOpen,
    handleCopyCitation: handleCopyBibliography,
    handleCopyBibliography,
    handleCopyBibtex,
    handleCopyInTextCitation,
    handleCopyCitationKey,
    handleRefreshMetadata,
    handleToggleMyPublications,
    handleToggleRetraction,
    handleSelectCollection,
    handleConvertType,
    itemTypeConversion,
  };
}

/**
 * Hook to handle dragging and dropping items directly into the "My Publications" system collection.
 * Conforms to SC-009 by abstracting queryClient/ItemsService lookup into a coordinator hook.
 */
export function useDropToMyPublications(effectiveScopeId: string = 'user') {
  const queryClient = useQueryClient();
  const openModal = useLibraryUIStore((s) => s.openModal);

  return useCallback(
    async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      const targetId = ids[0];
      try {
        let item: Item | undefined =
          queryClient.getQueryData<Item>(itemKeys.byId(effectiveScopeId, targetId));
        if (!item) {
          const cachedQueries = queryClient.getQueriesData<unknown>({ queryKey: libraryKeys.all });
          for (const [_, data] of cachedQueries) {
            const list = Array.isArray(data)
              ? data
              : (data as { items?: unknown[] })?.items;
            if (Array.isArray(list)) {
              const found = list.find((it) => (it as { id?: string })?.id === targetId);
              if (found) {
                item = found as Item;
                break;
              }
            }
          }
        }
        if (!item) {
          item = ((await ItemsService.getById(effectiveScopeId, targetId)) ?? undefined) as Item | undefined;
        }
        if (item) {
          openModal('MY_PUBLICATION_CONFIRM', { item });
        }
      } catch {
        toast.error('Failed to prepare item for My Publications', { id: 'drop-to-my-pub-error' });
      }
    },
    [queryClient, effectiveScopeId, openModal],
  );
}
