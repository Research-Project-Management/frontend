'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from './use-workspace';
import { useUpload } from '@/shared/hooks/use-upload';
import { useCatalogItems, catalogItemKeys } from './use-items';
import {
  fetchReferenceByDoi,
  searchReferences,
  formatCslCitation,
} from '../../services/citation.service';
import {
  getRelatedPapers,
  linkPapers,
  unlinkPapers,
  getDuplicateGroups,
  mergePapers,
  getLibraryIntegrityReport,
} from '../../services/catalog.service';
import { useUnifiedIngest } from './use-ingest';
import { useCollections } from './use-collections';
import {
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useExtractNotes,
} from './use-annotations';
import { useAsyncJobStatus } from './use-ingest';
import { extractMetadata } from '../../utils/library.util';
import {
  calculateDuplicateItemIds,
  filterAndSortLibraryPapers,
  getCollectionWithDescendantIds,
} from '../../utils/filter.util';
import type {
  Paper,
  CollectionInput,
  CslStyle,
  AddLinkData,
  PaperQueryParams,
} from '../../types/library.types';

// ── Canonical Library Query Keys ──────────────────────────────────────────────
export const libraryKeys = {
  all: ['library'] as const,

  items: (workspaceId: string) => [...libraryKeys.all, 'items', workspaceId] as const,
  itemList: (workspaceId: string, filter?: PaperQueryParams) =>
    [...libraryKeys.items(workspaceId), 'list', filter] as const,
  itemDetail: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'detail', itemId] as const,
  itemBundle: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'bundle', itemId] as const,

  papers: (workspaceId: string) => [...libraryKeys.all, 'items', workspaceId] as const,
  paperList: (workspaceId: string, filter?: PaperQueryParams) =>
    [...libraryKeys.items(workspaceId), 'list', filter] as const,
  paperDetail: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'detail', itemId] as const,
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
  const CatalogItemService = useCatalogItems({ workspaceId, collectionId: '' });
  const allPapers = useMemo(
    () => CatalogItemService.state.allPapers ?? [],
    [CatalogItemService.state.allPapers],
  );
  const isPapersLoading = CatalogItemService.state.isLoadingAll;
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

  const descendantCollectionIds = useMemo(
    () => (collectionId ? getCollectionWithDescendantIds(collectionId, collections) : undefined),
    [collectionId, collections],
  );

  const duplicatePaperIds = useMemo(
    () => calculateDuplicateItemIds(allPapers),
    [allPapers],
  );

  const filteredPapers = useMemo(
    () =>
      filterAndSortLibraryPapers({
        items: allPapers,
        searchQuery,
        activeFilter,
        activeTag,
        activeCollectionId: collectionId,
        collectionIds: descendantCollectionIds,
        duplicateItemIds: duplicatePaperIds,
      }),
    [allPapers, searchQuery, activeFilter, activeTag, collectionId, descendantCollectionIds, duplicatePaperIds],
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
  const addPaper = CatalogItemService.actions.addPaper;
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
      let successCount = 0;
      let lastErrorMessage = '';

      for (const file of files) {
        try {
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

          successCount++;
        } catch (uploadError: any) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          lastErrorMessage = uploadError?.message || `Failed to upload ${file.name}`;
        }
      }

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['items'] });
        queryClient.invalidateQueries({ queryKey: ['papers'] });
        queryClient.invalidateQueries({ queryKey: ['library'] });
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
        await CatalogItemService.actions.refetchAll();
        if (collectionId) {
          await CatalogItemService.actions.refetchCollection();
        }
        toast.success('Upload completed', {
          description: `Added ${successCount} document(s) to library.`,
          id: loadingToastId,
        });
      } else {
        toast.error('Upload failed', {
          description: lastErrorMessage || 'Unable to process selected documents.',
          id: loadingToastId,
        });
      }
    },
    [uploadFileDetailed, ingestUnified, workspaceId, workspaceSlug, collectionId, queryClient, CatalogItemService.actions],
  );

  const handleDirectFolderUpload = useCallback(
    async (files: File[], folderName: string) => {
      if (!files.length) return;
      const loadingToastId = toast.loading(
        `Importing ${files.length} document(s) from "${folderName}"...`,
      );
      let successCount = 0;
      let lastErrorMessage = '';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const uploadRes = await uploadFileDetailed(file, {
            prefix: `${workspaceId}/library`,
            allowedTypes: ['application/pdf'],
          });
          if (uploadRes?.fileId) {
            await ingestUnified({
              source: 'pdf',
              fileId: uploadRes.fileId,
              filename: file.name,
              collectionId: collectionId ?? undefined,
              silent: true,
            } as any);
            successCount++;
          }
        } catch (err: any) {
          lastErrorMessage = err?.message || 'Unknown upload error';
        }
      }

      if (successCount > 0) {
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
        queryClient.invalidateQueries({ queryKey: ['papers'] });
        queryClient.invalidateQueries({ queryKey: ['library'] });
        await CatalogItemService.actions.refetchAll();
        if (collectionId) {
          await CatalogItemService.actions.refetchCollection();
        }
        toast.success('Folder imported', {
          description: `Added ${successCount} of ${files.length} document(s) from "${folderName}".`,
          id: loadingToastId,
        });
      } else {
        toast.error('Import failed', {
          description: lastErrorMessage || `Failed to import documents from "${folderName}".`,
          id: loadingToastId,
        });
      }
    },
    [uploadFileDetailed, ingestUnified, workspaceId, workspaceSlug, collectionId, queryClient, CatalogItemService.actions],
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
        queryClient.invalidateQueries({ queryKey: ['items'] });
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
        queryClient.invalidateQueries({ queryKey: ['papers'] });
        queryClient.invalidateQueries({ queryKey: ['library'] });
        await CatalogItemService.actions.refetchAll();
        if (collectionId) {
          await CatalogItemService.actions.refetchCollection();
        }
      } catch {
        // Errors already toasted by ingestUnified / handleAddPaper mutations
      }
    },
    [workspaceId, workspaceSlug, collectionId, ingestUnified, handleAddPaper, queryClient, CatalogItemService.actions],
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
      if (!confirm('Remove this paper?')) return;
      CatalogItemService.actions.deletePaper({ paperId });
      if (selectedPaperId === paperId) setSelectedPaperId(null);
    },
    [CatalogItemService.actions, selectedPaperId],
  );

  const handleBatchDeletePapers = useCallback(
    async (paperIds: string[]) => {
      if (!paperIds.length) return;
      const loadingId = toast.loading(`Moving ${paperIds.length} item(s) to trash...`, { id: 'batch-trash-action' });
      try {
        await Promise.all(
          paperIds.map((paperId) => CatalogItemService.actions.deletePaper({ paperId, silent: true })),
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
    [CatalogItemService.actions, selectedPaperId],
  );

  const handleBatchMovePapers = useCallback(
    async (paperIds: string[], targetCollectionId: string | null) => {
      if (!paperIds.length) return;
      const loadingId = toast.loading(`Moving ${paperIds.length} item(s)...`, { id: 'batch-move-action' });
      try {
        await Promise.all(
          paperIds.map((paperId) =>
            CatalogItemService.actions.updatePaper({
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
    [CatalogItemService.actions],
  );

  return {
    state: {
      workspaceId,
      workspaceSlug,
      workspaceUrl: workspaceSlug,
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
      isAddingItem: CatalogItemService.state.isAdding,
      isAddingPaper: CatalogItemService.state.isAdding,
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
export {
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useExtractNotes,
} from './use-annotations';
export { useAsyncJobStatus } from './use-ingest';

// ── References & Citation Hooks ──

export function useReferences() {
  const lookupDoiMutation = useMutation({
    mutationFn: fetchReferenceByDoi,
  });

  const searchCrossrefMutation = useMutation({
    mutationFn: (query: string) => searchReferences(query),
  });

  return {
    state: {
      isLookingUp: lookupDoiMutation.isPending,
      isSearching: searchCrossrefMutation.isPending,
    },
    actions: {
      lookupDoi: lookupDoiMutation.mutateAsync,
      searchCrossref: searchCrossrefMutation.mutateAsync,
    },
  };
}

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

// ── Relation & Knowledge Graph Hooks ──

export function useRelatedPapers(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.relations(workspaceId, paperId),
    queryFn: () => getRelatedPapers(workspaceId, paperId),
    enabled: Boolean(workspaceId && paperId),
  });
}

export function useLinkPapers(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetPaperId,
      relationType,
    }: {
      targetPaperId: string;
      relationType?: string;
    }) => linkPapers(workspaceId, paperId, targetPaperId, relationType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.relations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      toast.success('Related paper linked', { id: 'relation-mutation' });
    },
  });
}

export function useUnlinkPapers(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetPaperId: string) =>
      unlinkPapers(workspaceId, paperId, targetPaperId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.relations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      toast.success('Related paper unlinked', { id: 'relation-mutation' });
    },
  });
}

// ── Quality & Duplicate Hooks ──

export function useDuplicateGroups(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.duplicates(workspaceId),
    queryFn: () => getDuplicateGroups(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useMergePapers(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      masterPaperId,
      sourcePaperIds,
    }: {
      masterPaperId: string;
      sourcePaperIds: string[];
    }) => mergePapers(workspaceId, masterPaperId, sourcePaperIds),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.duplicates(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.integrity(workspaceId) });
      const count = response.mergedCount ?? response.data?.mergedCount ?? 1;
      toast.success('Duplicates merged', {
        description: `Consolidated ${count} duplicate record(s) into master. Notes and citations preserved.`,
        id: 'library-merge',
      });
    },
    onError: (error: any) => {
      toast.error('Merge failed', {
        description: error?.message || 'Unable to consolidate duplicate papers.',
        id: 'library-merge',
      });
    },
  });
}

export function useLibraryIntegrity(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.integrity(workspaceId),
    queryFn: () => getLibraryIntegrityReport(workspaceId),
    enabled: Boolean(workspaceId),
  });
}




