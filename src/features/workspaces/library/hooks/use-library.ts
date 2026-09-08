'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useUpload } from '@/shared/hooks/use-upload';
import { useCatalogItems, catalogItemKeys } from './use-items';
import {
  formatCslCitation,
} from '../services/citation.service';
import { useUnifiedIngest } from './use-ingest';
import { useCollections } from './use-collections';
import { useAsyncJobStatus } from './use-ingest';
import {
  getDescendantIds,
  getDuplicateIds,
  sortFilterItems,
} from '../utils/filter.util';
import type {
  Paper,
  CollectionInput,
  CslStyle,
  AddLinkData,
  ItemQueryParams,
} from '../types/library.types';

// ── Canonical Library Query Keys ──────────────────────────────────────────────
export const libraryKeys = {
  all: ['library'] as const,

  items: (workspaceId: string) => [...libraryKeys.all, 'items', workspaceId] as const,
  itemList: (workspaceId: string, filter?: ItemQueryParams) =>
    [...libraryKeys.items(workspaceId), 'list', filter] as const,
  itemDetail: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'detail', itemId] as const,
  itemBundle: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'bundle', itemId] as const,

  // Aliases kept for backward compat with useLinkPapers / useMergePapers consumers
  papers: (workspaceId: string) => [...libraryKeys.all, 'items', workspaceId] as const,
  paperBundle: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'bundle', itemId] as const,

  collections: (workspaceId: string) =>
    [...libraryKeys.all, 'collections', workspaceId] as const,

  citations: (workspaceId: string) =>
    [...libraryKeys.all, 'citations', workspaceId] as const,
  citationItem: (workspaceId: string, itemId: string, style: CslStyle, index: number = 1) =>
    [...libraryKeys.citations(workspaceId), itemId, style, index] as const,

  annotations: (workspaceId: string, itemId: string) =>
    [...libraryKeys.all, 'annotations', workspaceId, itemId] as const,

  relations: (workspaceId: string, itemId: string) =>
    [...libraryKeys.all, 'relations', workspaceId, itemId] as const,

  duplicates: (workspaceId: string) =>
    [...libraryKeys.all, 'duplicates', workspaceId] as const,
  integrity: (workspaceId: string) =>
    [...libraryKeys.all, 'integrity', workspaceId] as const,

  job: (jobId: string) => [...libraryKeys.all, 'job', jobId] as const,
};

/**
 * Invalidates all item-related queries for a workspace (and optionally a collection).
 * Use after any mutation that modifies the item catalog.
 */
function invalidateLibraryItems(
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>,
  workspaceId: string,
  workspaceSlug: string | undefined,
  collectionId: string | undefined | null,
): void {
  queryClient.invalidateQueries({ queryKey: catalogItemKeys.all(workspaceId) });
  if (workspaceSlug && workspaceSlug !== workspaceId) {
    queryClient.invalidateQueries({ queryKey: catalogItemKeys.all(workspaceSlug) });
  }
  if (collectionId) {
    queryClient.invalidateQueries({ queryKey: catalogItemKeys.byCollection(workspaceId, collectionId) });
    if (workspaceSlug && workspaceSlug !== workspaceId) {
      queryClient.invalidateQueries({ queryKey: catalogItemKeys.byCollection(workspaceSlug, collectionId) });
    }
  }
}

/**
 * Executes file uploads with a controlled concurrency pool to prevent saturating
 * the browser network stack or Fastify upload limits, while reporting item progress.
 */
async function uploadFilesWithConcurrency(
  files: File[],
  concurrencyLimit: number,
  onUploadItem: (file: File, completedCount: number) => Promise<void>,
): Promise<{ successCount: number; lastErrorMessage: string }> {
  let successCount = 0;
  let completedCount = 0;
  let lastErrorMessage = '';
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(concurrencyLimit, files.length) },
    async () => {
      while (cursor < files.length) {
        const index = cursor++;
        const file = files[index];
        try {
          await onUploadItem(file, completedCount + 1);
          successCount++;
        } catch (err: any) {
          lastErrorMessage = err?.message || `Failed to upload ${file.name}`;
          console.error(`Upload error for ${file.name}:`, err);
        } finally {
          completedCount++;
        }
      }
    },
  );

  await Promise.all(workers);
  return { successCount, lastErrorMessage };
}

// ── 1. Unified Main Library View Model Hook ──────────────────────────────────

export function useLibrary() {
  const params = useParams() as { workspaceId?: string; collectionId?: string };
  const workspaceSlug = params.workspaceId;
  const collectionId = params.collectionId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get('tag');
  const activeFilter = searchParams.get('filter');

  const { workspace } = useWorkspace(workspaceSlug!);
  const workspaceId = workspace?.id || workspaceSlug || '';
  const queryClient = useQueryClient();

  // Data Layer Services
  const itemsHook = useCatalogItems({ workspaceId, collectionId: '' });
  const allPapers = useMemo(
    () => itemsHook.state.allPapers ?? [],
    [itemsHook.state.allPapers],
  );
  const isPapersLoading = itemsHook.state.isLoadingAll;
  const collectionService = useCollections(workspaceId);
  const collections = collectionService.state.collections;
  const { uploadFile, uploadFileDetailed } = useUpload();
  const { ingest: ingestUnified } = useUnifiedIngest(workspaceId);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);

  // Computed Maps & Duplicate Indexes
  const collectionMap = useMemo(
    () => Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    [collections],
  );

  const descendantIds = useMemo(
    () => (collectionId ? getDescendantIds(collectionId, collections) : undefined),
    [collectionId, collections],
  );

  const duplicateIds = useMemo(
    () => getDuplicateIds(allPapers),
    [allPapers],
  );

  const filteredPapers = useMemo(
    () =>
      sortFilterItems({
        items: allPapers,
        searchQuery,
        activeFilter,
        activeTag,
        activeCollectionId: collectionId,
        collectionIds: descendantIds,
        duplicateItemIds: duplicateIds,
      }),
    [allPapers, searchQuery, activeFilter, activeTag, collectionId, descendantIds, duplicateIds],
  );

  const selectedPaper = useMemo(
    () => allPapers.find((paper: Paper) => paper.id === selectedPaperId) || null,
    [allPapers, selectedPaperId],
  );

  const selectedCollection = useMemo(
    () =>
      collectionId
        ? collectionMap[collectionId] ?? null
        : selectedPaper?.collectionId
        ? collectionMap[selectedPaper.collectionId] ?? null
        : null,
    [collectionId, selectedPaper, collectionMap],
  );

  // Action Handlers
  const addPaper = itemsHook.actions.addPaper;
  const handleAddPaper = useCallback(
    async (paperPayload: Parameters<typeof addPaper>[0]) => {
      return await addPaper(paperPayload);
    },
    [addPaper],
  );

  const handleDirectFilesUpload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const loadingToastId = toast.loading(`Uploading ${files.length} document(s)...`);

      const { successCount, lastErrorMessage } = await uploadFilesWithConcurrency(
        files,
        3,
        async (file, count) => {
          toast.loading(`Uploading document ${count} of ${files.length}...`, {
            id: loadingToastId,
          });

          const { fileId } = await uploadFileDetailed(file, {
            prefix: `${workspaceId}/library`,
            allowedTypes: ['application/pdf'],
          });

          if (!fileId) {
            throw new Error(`Upload succeeded but no fileId returned for ${file.name}`);
          }

          await ingestUnified({
            source: 'pdf',
            fileId,
            filename: file.name,
            collectionId: collectionId || undefined,
            silent: true,
          } as any);
        },
      );

      if (successCount > 0) {
        invalidateLibraryItems(queryClient, workspaceId, workspaceSlug, collectionId);
        toast.success('Import submitted', {
          description: `${successCount} of ${files.length} document(s) uploaded. Ingestion pipeline is extracting metadata in background.`,
          id: loadingToastId,
        });
      } else {
        toast.error('Upload failed', {
          description: lastErrorMessage || 'Unable to process selected documents.',
          id: loadingToastId,
        });
      }
    },
    [uploadFileDetailed, ingestUnified, workspaceId, workspaceSlug, collectionId, queryClient],
  );

  const handleDirectFolderUpload = useCallback(
    async (files: File[], folderName: string) => {
      if (!files.length) return;
      const loadingToastId = toast.loading(
        `Importing ${files.length} document(s) from "${folderName}"...`,
      );

      const { successCount, lastErrorMessage } = await uploadFilesWithConcurrency(
        files,
        3,
        async (file, count) => {
          toast.loading(
            `Importing from "${folderName}": ${count} of ${files.length}...`,
            { id: loadingToastId },
          );

          const uploadRes = await uploadFileDetailed(file, {
            prefix: `${workspaceId}/library`,
            allowedTypes: ['application/pdf'],
          });

          if (!uploadRes?.fileId) {
            throw new Error(`Upload failed for ${file.name}`);
          }

          await ingestUnified({
            source: 'pdf',
            fileId: uploadRes.fileId,
            filename: file.name,
            collectionId: collectionId ?? undefined,
            silent: true,
          } as any);
        },
      );

      if (successCount > 0) {
        invalidateLibraryItems(queryClient, workspaceId, workspaceSlug, collectionId);
        toast.success('Folder import submitted', {
          description: `${successCount} of ${files.length} document(s) uploaded and queued for processing.`,
          id: loadingToastId,
        });
      } else {
        toast.error('Import failed', {
          description: lastErrorMessage || `Failed to import documents from "${folderName}".`,
          id: loadingToastId,
        });
      }
    },
    [uploadFileDetailed, ingestUnified, workspaceId, workspaceSlug, collectionId, queryClient],
  );

  const handleAddLinkSubmit = useCallback(
    async (linkData: AddLinkData) => {
      try {
        const rawInput = (linkData.url || linkData.doi || '').trim();
        const doiMatch = rawInput.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
        const isPureDoi = rawInput.startsWith('10.') || (doiMatch && !rawInput.includes('http') && !rawInput.includes('arxiv'));

        if (isPureDoi || linkData.doi) {
          const doi = linkData.doi || (doiMatch ? doiMatch[1] : rawInput);
          await ingestUnified({
            source: 'doi',
            doi,
            collectionId: collectionId || undefined,
            overrides: linkData.title ? { title: linkData.title } : undefined,
          });
        } else if (rawInput) {
          await ingestUnified({
            source: 'url',
            url: rawInput,
            collectionId: collectionId || undefined,
            overrides: linkData.title ? { title: linkData.title } : undefined,
          });
        } else {
          await handleAddPaper({
            title: linkData.title || 'Document',
            authors: linkData.authors || [],
            year: linkData.year,
            doi: linkData.doi,
            abstract: linkData.abstract,
            fileUrl: linkData.fileUrl || '',
            filename: linkData.filename || 'document.pdf',
            mimeType: linkData.mimeType || 'application/pdf',
            size: linkData.size || 0,
            collectionId: collectionId || undefined,
            journal: linkData.journal,
            publisher: linkData.publisher,
            volume: linkData.volume,
            issue: linkData.issue,
            pages: linkData.pages,
            url: linkData.url,
            type: linkData.type,
          });
        }
        invalidateLibraryItems(queryClient, workspaceId, workspaceSlug, collectionId);
      } catch {
        // Errors already toasted by ingestUnified / handleAddPaper mutations
      }
    },
    [workspaceId, workspaceSlug, collectionId, ingestUnified, handleAddPaper, queryClient],
  );


  const handleCreateCollection = useCallback(
    (collectionData: CollectionInput) => {
      const rawParent = collectionData.parentId ?? collectionData.parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      collectionService.actions.create(
        {
          ...collectionData,
          parentId: cleanParentId,
          parent: cleanParentId,
        },
        {
          onSuccess: () => setIsCreateCollectionModalOpen(false),
        },
      );
    },
    [collectionService.actions],
  );

  const handleDeletePaper = useCallback(
    (paperId: string) => {
      itemsHook.actions.deletePaper({ paperId });
      if (selectedPaperId === paperId) setSelectedPaperId(null);
    },
    [itemsHook.actions, selectedPaperId],
  );

  const handleBatchDeletePapers = useCallback(
    async (paperIds: string[]) => {
      if (!paperIds.length) return;
      const loadingId = toast.loading(`Moving ${paperIds.length} item(s) to trash...`, { id: 'batch-trash-action' });
      try {
        await Promise.all(
          paperIds.map((paperId) => itemsHook.actions.deletePaper({ paperId, silent: true })),
        );
        if (selectedPaperId && paperIds.includes(selectedPaperId)) {
          setSelectedPaperId(null);
        }
        toast.success('Moved to trash', {
          description: `${paperIds.length} document(s) moved to trash.`,
          id: loadingId,
        });
      } catch (err: any) {
        toast.error('Failed to delete items', {
          description: err?.message || 'Could not move selected documents to trash.',
          id: loadingId,
        });
      }
    },
    [itemsHook.actions, selectedPaperId],
  );

  const handleBatchMovePapers = useCallback(
    async (paperIds: string[], targetCollectionId: string | null) => {
      if (!paperIds.length) return;
      const loadingId = toast.loading(`Moving ${paperIds.length} item(s)...`, { id: 'batch-move-action' });
      try {
        await Promise.all(
          paperIds.map((paperId) =>
            itemsHook.actions.updatePaper({
              paperId,
              collectionId: targetCollectionId ?? undefined,
              silent: true,
            }),
          ),
        );
        toast.success('Documents moved', {
          description: `Moved ${paperIds.length} item(s) to target collection.`,
          id: loadingId,
        });
      } catch (err: any) {
        toast.error('Failed to move items', {
          description: err?.message || 'Could not move selected documents.',
          id: loadingId,
        });
      }
    },
    [itemsHook.actions],
  );

  return {
    state: {
      workspaceId,
      workspaceSlug,
      items: allPapers,
      papers: allPapers,
      collections,
      isLoading: isPapersLoading,
      search: searchQuery,
      activeTag,
      activeFilter,
      selectedItemId: selectedPaperId,
      selectedPaperId,
      selectedItem: selectedPaper,
      selectedPaper,
      filtered: filteredPapers,
      filteredItems: filteredPapers,
      filteredPapers,
      selectedCollection,
      collectionMap,
      addLinkOpen: isAddLinkModalOpen,
      createCollectionOpen: isCreateCollectionModalOpen,
      isAddingItem: itemsHook.state.isAdding,
      isAddingPaper: itemsHook.state.isAdding,
      isCreatingCollection: collectionService.state.isCreating,
    },
    actions: {
      setSearch: setSearchQuery,
      setSelectedItemId: setSelectedPaperId,
      setSelectedPaperId,
      setAddLinkOpen: setIsAddLinkModalOpen,
      handleDirectFilesUpload,
      handleDirectFolderUpload,
      handleAddLinkSubmit,
      setCreateCollectionOpen: setIsCreateCollectionModalOpen,
      handleAddItem: handleAddPaper,
      handleAddPaper,
      handleCreateCollection,
      handleDeleteItem: handleDeletePaper,
      handleDeletePaper,
      handleBatchDeleteItems: handleBatchDeletePapers,
      handleBatchDeletePapers,
      handleBatchMoveItems: handleBatchMovePapers,
      handleBatchMovePapers,
      navigate: router.push,
    },
  };
}

// ── Specialized Hooks (Consolidated) ─────────────────────────────────────────

export { useCollections } from './use-collections';
export { useAsyncJobStatus } from './use-ingest';

export function useCslCitation(
  workspaceId: string,
  paperId: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: libraryKeys.citationItem(workspaceId, paperId, style, index),
    queryFn: () => formatCslCitation(workspaceId, paperId, style, index),
    enabled: Boolean(workspaceId && paperId),
    staleTime: 1000 * 60 * 30,
  });
}

// ── Quality & Duplicate Hooks ──

export {
  useDuplicateGroups,
  useMergePapers,
  useLibraryIntegrity,
  useDuplicates,
  useMergeItems,
  useIntegrity,
} from './use-curation';
