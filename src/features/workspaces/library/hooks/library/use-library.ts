'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useUpload } from '@/shared/hooks/use-upload';
import { usePapers } from './use-papers';
import { paperKeys } from '../../services/paper.service';
import { libraryKeys } from '../../services/library.service';
import {
  fetchReferenceByDoi,
  searchReferences,
  formatCslCitation,
} from '../../services/reference.service';
import {
  getRelatedPapers,
  linkPapers,
  unlinkPapers,
} from '../../services/relation.service';
import {
  getDuplicateGroups,
  mergePapers,
  getLibraryIntegrityReport,
} from '../../services/quality.service';
import { useUnifiedIngest } from './use-unified-ingest';
import { useCollections } from './use-collections';
import {
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useExtractNotes,
} from './use-annotations';
import { useAsyncJobStatus } from './use-async-job';
import { extractMetadata } from '../../utils/library.util';
import {
  calculateDuplicatePaperIds,
  filterAndSortLibraryPapers,
  getCollectionWithDescendantIds,
} from '../../utils/filter.util';
import type {
  Paper,
  CollectionInput,
  CslStyle,
} from '../../types/library.types';
import type { AddLinkData } from '../../components/system/AddLinkModal';

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
  const paperService = usePapers({ workspaceId, collectionId: '' });
  const allPapers = useMemo(
    () => paperService.state.allPapers ?? [],
    [paperService.state.allPapers],
  );
  const isPapersLoading = paperService.state.isLoadingAll;
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
    () => calculateDuplicatePaperIds(allPapers),
    [allPapers],
  );

  const filteredPapers = useMemo(
    () =>
      filterAndSortLibraryPapers({
        papers: allPapers,
        searchQuery,
        activeFilter,
        activeTag,
        activeCollectionId: collectionId,
        collectionIds: descendantCollectionIds,
        duplicatePaperIds,
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
  const addPaper = paperService.actions.addPaper;
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
          });

          successCount++;
        } catch (uploadError: any) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          lastErrorMessage = uploadError?.message || `Failed to upload ${file.name}`;
        }
      }

      toast.dismiss(loadingToastId);
      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
        queryClient.invalidateQueries({ queryKey: ['papers'] });
        queryClient.invalidateQueries({ queryKey: ['library'] });
        toast.success(`Successfully uploaded ${successCount} document(s) into library!`);
      } else {
        toast.error(lastErrorMessage || 'Failed to upload selected documents.');
      }
    },
    [uploadFileDetailed, ingestUnified, workspaceId, collectionId, queryClient],
  );

  const handleDirectFolderUpload = useCallback(
    async (files: File[], folderName: string) => {
      if (!files.length) return;
      const loadingToastId = toast.loading(
        `Batch importing ${files.length} documents from "${folderName}"...`,
      );
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
          });

          successCount++;
        } catch (uploadError: any) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          lastErrorMessage = uploadError?.message || `Failed to upload ${file.name}`;
        }
      }

      toast.dismiss(loadingToastId);
      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
        queryClient.invalidateQueries({ queryKey: ['papers'] });
        queryClient.invalidateQueries({ queryKey: ['library'] });
        toast.success(
          `Imported ${successCount}/${files.length} documents from "${folderName}"!`,
        );
      } else {
        toast.error(lastErrorMessage || `Failed to import documents from "${folderName}".`);
      }
    },
    [uploadFileDetailed, ingestUnified, workspaceId, collectionId, queryClient],
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
        queryClient.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
        queryClient.invalidateQueries({ queryKey: ['papers'] });
        queryClient.invalidateQueries({ queryKey: ['library'] });
        toast.success('Document added to library successfully!');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to add document to library');
      }
    },
    [workspaceId, collectionId, ingestUnified, handleAddPaper, queryClient],
  );


  const handleCreateCollection = useCallback(
    (collectionData: CollectionInput) => {
      collectionService.actions.create(collectionData, {
        onSuccess: () => setIsCreateCollectionModalOpen(false),
      });
    },
    [collectionService.actions],
  );

  const handleDeletePaper = useCallback(
    (paperId: string) => {
      if (!confirm('Remove this paper?')) return;
      paperService.actions.deletePaper({ paperId });
      if (selectedPaperId === paperId) setSelectedPaperId(null);
    },
    [paperService.actions, selectedPaperId],
  );

  const handleBatchDeletePapers = useCallback(
    async (paperIds: string[]) => {
      if (!paperIds.length) return;
      if (!confirm(`Delete ${paperIds.length} selected paper(s)?`)) return;
      const loadingId = toast.loading(`Deleting ${paperIds.length} paper(s)...`);
      try {
        await Promise.all(
          paperIds.map((paperId) => paperService.actions.deletePaper({ paperId })),
        );
        if (selectedPaperId && paperIds.includes(selectedPaperId)) {
          setSelectedPaperId(null);
        }
        toast.dismiss(loadingId);
        toast.success(`Successfully deleted ${paperIds.length} paper(s)`);
      } catch (err: any) {
        toast.dismiss(loadingId);
        toast.error(err?.message || 'Failed to delete some papers');
      }
    },
    [paperService.actions, selectedPaperId],
  );

  const handleBatchMovePapers = useCallback(
    async (paperIds: string[], targetCollectionId: string | null) => {
      if (!paperIds.length) return;
      const loadingId = toast.loading(`Moving ${paperIds.length} paper(s)...`);
      try {
        await Promise.all(
          paperIds.map((paperId) =>
            paperService.actions.updatePaper({
              paperId,
              collectionId: targetCollectionId ?? undefined,
            }),
          ),
        );
        toast.dismiss(loadingId);
        toast.success(`Successfully moved ${paperIds.length} paper(s)`);
      } catch (err: any) {
        toast.dismiss(loadingId);
        toast.error(err?.message || 'Failed to move some papers');
      }
    },
    [paperService.actions],
  );

  return {
    state: {
      workspaceId,
      workspaceSlug,
      workspaceUrl: workspaceSlug,
      papers: allPapers,
      collections,
      isLoading: isPapersLoading,
      search: searchQuery,
      activeTag,
      activeFilter,
      selectedPaperId,
      filtered: filteredPapers,
      selectedPaper,
      selectedCollection,
      collectionMap,
      addLinkOpen: isAddLinkModalOpen,
      createCollectionOpen: isCreateCollectionModalOpen,
      isAddingPaper: paperService.state.isAdding,
      isCreatingCollection: collectionService.state.isCreating,
    },
    actions: {
      setSearch: setSearchQuery,
      setSelectedPaperId,
      setAddLinkOpen: setIsAddLinkModalOpen,
      handleDirectFilesUpload,
      handleDirectFolderUpload,
      handleAddLinkSubmit,
      setCreateCollectionOpen: setIsCreateCollectionModalOpen,
      handleAddPaper,
      handleCreateCollection,
      handleDeletePaper,
      handleBatchDeletePapers,
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
export { useAsyncJobStatus } from './use-async-job';

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
      toast.success('Related paper linked');
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
      toast.success('Related paper unlinked');
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
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.duplicates(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.integrity(workspaceId) });
      const count = response.mergedCount ?? response.data?.mergedCount ?? 1;
      toast.success(`Merged ${count} duplicate papers into master`);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to merge papers');
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
