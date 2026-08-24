'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useUpload } from '@/shared/hooks/use-upload';
import { usePapers } from './use-papers';
import { extractMetadata } from '../../utils/library.util';
import {
  calculateDuplicatePaperIds,
  filterAndSortLibraryPapers,
  getCollectionWithDescendantIds,
} from '../../utils/filter.util';
import {
  collectionKeys,
  getCollections,
  invalidateCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../../services/collection.service';
import * as libraryService from '../../services/library.service';
import { libraryKeys } from '../../services/library.service';
import { fetchReferenceByDoi, searchReferences } from '../../services/reference.service';
import type {
  Paper,
  Collection,
  CollectionInput,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  CslStyle,
  PdfAnnotation,
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

  // Data Layer Services
  const paperService = usePapers({ workspaceId, collectionId: '' });
  const allPapers = useMemo(
    () => paperService.state.allPapers ?? [],
    [paperService.state.allPapers],
  );
  const isPapersLoading = paperService.state.isLoadingAll;
  const collectionService = useCollections(workspaceId);
  const collections = collectionService.state.collections;
  const { uploadFile } = useUpload();

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

      for (const file of files) {
        try {
          const fileStorageUrl = await uploadFile(file, {
            prefix: `workspace/${workspaceId}`,
            allowedTypes: ['application/pdf'],
          });

          let extractedTitle = file.name.replace(/\.[^/.]+$/, '');
          let extractedAuthors: string[] = [];
          let extractedYear: number | null = null;
          let extractedDoi = '';
          let extractedAbstract = '';
          let extractedJournal = '';
          let extractedPublisher = '';
          let extractedVolume = '';
          let extractedIssue = '';
          let extractedPages = '';
          let extractedUrl = '';
          let extractedType = 'journalArticle';

          try {
            const extracted = await extractMetadata(file);
            if (extracted.title) extractedTitle = extracted.title;
            if (extracted.authors && extracted.authors.length > 0)
              extractedAuthors = extracted.authors;
            if (extracted.year)
              extractedYear = parseInt(String(extracted.year), 10) || null;
            if (extracted.doi) extractedDoi = extracted.doi;
            if (extracted.abstract) extractedAbstract = extracted.abstract;
            if (extracted.journal || extracted.publicationTitle)
              extractedJournal = extracted.journal || extracted.publicationTitle || '';
            if (extracted.publisher) extractedPublisher = extracted.publisher;
            if (extracted.volume) extractedVolume = extracted.volume;
            if (extracted.issue) extractedIssue = extracted.issue;
            if (extracted.pages) extractedPages = extracted.pages;
            if (extracted.url) extractedUrl = extracted.url;
            if (extracted.itemType || extracted.type)
              extractedType = extracted.itemType || extracted.type || 'journalArticle';
          } catch {
            // Fallback to filename
          }

          await handleAddPaper({
            title: extractedTitle,
            authors: extractedAuthors,
            year: extractedYear,
            doi: extractedDoi,
            abstract: extractedAbstract,
            fileUrl: fileStorageUrl,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            size: file.size,
            collectionId: collectionId || undefined,
            journal: extractedJournal || undefined,
            publisher: extractedPublisher || undefined,
            volume: extractedVolume || undefined,
            issue: extractedIssue || undefined,
            pages: extractedPages || undefined,
            url: extractedUrl || undefined,
            type: extractedType || undefined,
          });

          successCount++;
        } catch (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
        }
      }

      toast.dismiss(loadingToastId);
      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} document(s) into library!`);
      } else {
        toast.error('Failed to upload selected documents.');
      }
    },
    [uploadFile, workspaceId, collectionId, handleAddPaper],
  );

  const handleDirectFolderUpload = useCallback(
    async (files: File[], folderName: string) => {
      if (!files.length) return;
      const loadingToastId = toast.loading(
        `Batch importing ${files.length} documents from "${folderName}"...`,
      );
      let successCount = 0;

      for (const file of files) {
        try {
          const fileStorageUrl = await uploadFile(file, {
            prefix: `workspace/${workspaceId}`,
            allowedTypes: ['application/pdf'],
          });

          let extractedTitle = file.name.replace(/\.[^/.]+$/, '');
          let extractedAuthors: string[] = [];
          let extractedYear: number | null = null;
          let extractedDoi = '';
          let extractedAbstract = '';
          let extractedJournal = '';
          let extractedPublisher = '';
          let extractedVolume = '';
          let extractedIssue = '';
          let extractedPages = '';
          let extractedUrl = '';
          let extractedType = 'journalArticle';

          try {
            const extracted = await extractMetadata(file);
            if (extracted.title) extractedTitle = extracted.title;
            if (extracted.authors && extracted.authors.length > 0)
              extractedAuthors = extracted.authors;
            if (extracted.year)
              extractedYear = parseInt(String(extracted.year), 10) || null;
            if (extracted.doi) extractedDoi = extracted.doi;
            if (extracted.abstract) extractedAbstract = extracted.abstract;
            if (extracted.journal || extracted.publicationTitle)
              extractedJournal = extracted.journal || extracted.publicationTitle || '';
            if (extracted.publisher) extractedPublisher = extracted.publisher;
            if (extracted.volume) extractedVolume = extracted.volume;
            if (extracted.issue) extractedIssue = extracted.issue;
            if (extracted.pages) extractedPages = extracted.pages;
            if (extracted.url) extractedUrl = extracted.url;
            if (extracted.itemType || extracted.type)
              extractedType = extracted.itemType || extracted.type || 'journalArticle';
          } catch {
            // Fallback to filename
          }

          await handleAddPaper({
            title: extractedTitle,
            authors: extractedAuthors,
            year: extractedYear,
            doi: extractedDoi,
            abstract: extractedAbstract,
            fileUrl: fileStorageUrl,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            size: file.size,
            collectionId: collectionId || undefined,
            journal: extractedJournal || undefined,
            publisher: extractedPublisher || undefined,
            volume: extractedVolume || undefined,
            issue: extractedIssue || undefined,
            pages: extractedPages || undefined,
            url: extractedUrl || undefined,
            type: extractedType || undefined,
          });

          successCount++;
        } catch (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
        }
      }

      toast.dismiss(loadingToastId);
      if (successCount > 0) {
        toast.success(
          `Imported ${successCount}/${files.length} documents from "${folderName}"!`,
        );
      } else {
        toast.error(`Failed to import documents from "${folderName}".`);
      }
    },
    [uploadFile, workspaceId, collectionId, handleAddPaper],
  );

  const handleAddLinkSubmit = useCallback(
    async (linkData: AddLinkData) => {
      await handleAddPaper({
        title: linkData.title,
        authors: linkData.authors,
        year: linkData.year,
        doi: linkData.doi,
        abstract: linkData.abstract,
        fileUrl: linkData.fileUrl,
        filename: linkData.filename,
        mimeType: linkData.mimeType,
        size: linkData.size,
        collectionId: collectionId || undefined,
        journal: linkData.journal,
        publisher: linkData.publisher,
        volume: linkData.volume,
        issue: linkData.issue,
        pages: linkData.pages,
        url: linkData.url,
        type: linkData.type,
      });
      toast.success('Link added to library successfully!');
    },
    [collectionId, handleAddPaper],
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

// ── 2. Subcollection Page View Model Hook ───────────────────────────────────

export function useCollection() {
  const { workspaceId: workspaceSlug, collectionId } = useParams() as {
    workspaceId: string;
    collectionId: string;
  };
  const router = useRouter();
  const { workspace } = useWorkspace(workspaceSlug!);
  const workspaceId = workspace?.id || workspaceSlug || '';

  const paperService = usePapers({ workspaceId, collectionId: collectionId ?? '' });
  const collectionPapers = useMemo(
    () => paperService.state.collectionPapers?.papers ?? [],
    [paperService.state.collectionPapers?.papers],
  );
  const isLoading = paperService.state.isLoadingCollection;
  const collectionService = useCollections(workspaceId);
  const collections = collectionService.state.collections;

  const [search, setSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);

  const collectionMap = useMemo(
    () => Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    [collections],
  );

  const currentCollection = useMemo(
    () => (collectionId ? collectionMap[collectionId] ?? null : null),
    [collectionId, collectionMap],
  );

  const filteredPapers = useMemo(() => {
    return filterAndSortLibraryPapers({
      papers: collectionPapers,
      searchQuery: search,
    });
  }, [collectionPapers, search]);

  const selectedPaper = useMemo(
    () => collectionPapers.find((paper: Paper) => paper.id === selectedPaperId) || null,
    [collectionPapers, selectedPaperId],
  );

  return {
    state: {
      workspaceId,
      workspaceSlug,
      collectionId,
      currentCollection,
      papers: collectionPapers,
      filteredPapers,
      collections,
      collectionMap,
      isLoading,
      search,
      selectedPaperId,
      selectedPaper,
      addLinkOpen: isAddLinkModalOpen,
      createCollectionOpen: isCreateCollectionModalOpen,
      isAddingPaper: paperService.state.isAdding,
      isCreatingCollection: collectionService.state.isCreating,
    },
    actions: {
      setSearch,
      setSelectedPaperId,
      setAddLinkOpen: setIsAddLinkModalOpen,
      setCreateCollectionOpen: setIsCreateCollectionModalOpen,
      handleAddPaper: paperService.actions.addPaper,
      handleDeletePaper: paperService.actions.deletePaper,
      navigate: router.push,
    },
  };
}

// ── 3. Collections Query Hook ───────────────────────────────────────────────

export function useCollections(workspaceId: string) {
  const queryClient = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(workspaceId),
    queryFn: () => getCollections(workspaceId),
    enabled: Boolean(workspaceId),
    select: (data) => data.collections || [],
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDTO) => createCollection(workspaceId, data),
    onSuccess: () => invalidateCollections(queryClient, workspaceId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCollectionDTO & { collectionId: string }) => {
      const { collectionId, ...rest } = data;
      return updateCollection(workspaceId, collectionId, rest);
    },
    onSuccess: () => invalidateCollections(queryClient, workspaceId),
  });

  const deleteMutation = useMutation({
    mutationFn: (collectionId: string) => deleteCollection(workspaceId, collectionId),
    onSuccess: () => invalidateCollections(queryClient, workspaceId),
  });

  const collections = collectionsQuery.data ?? [];

  return {
    state: {
      collections,
      isLoading: collectionsQuery.isLoading,
      isError: collectionsQuery.isError,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
    actions: {
      create: createMutation.mutate,
      createAsync: createMutation.mutateAsync,
      update: updateMutation.mutate,
      updateAsync: updateMutation.mutateAsync,
      delete: deleteMutation.mutate,
      deleteAsync: deleteMutation.mutateAsync,
      refetch: collectionsQuery.refetch,
    },
  };
}

// ── 4. References Hook ──────────────────────────────────────────────────────

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

// ── 5. CSL Citation Formatting Hook ─────────────────────────────────────────

export function useCslCitation(
  workspaceId: string,
  paperId: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: libraryKeys.citationItem(workspaceId, paperId, style, index),
    queryFn: () =>
      libraryService.formatCslCitation(workspaceId, paperId, style, index),
    enabled: Boolean(workspaceId && paperId),
    staleTime: 1000 * 60 * 30,
  });
}

// ── 6. Duplicates, Safe Merge & Integrity Hooks ─────────────────────────────

export function useDuplicateGroups(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.duplicates(workspaceId),
    queryFn: () => libraryService.getDuplicateGroups(workspaceId),
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
    }) => libraryService.mergePapers(workspaceId, masterPaperId, sourcePaperIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.duplicates(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.integrity(workspaceId) });
      toast.success(`Merged ${response.mergedCount} duplicate papers into master`);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to merge papers');
    },
  });
}

export function useLibraryIntegrity(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.integrity(workspaceId),
    queryFn: () => libraryService.getLibraryIntegrityReport(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

// ── 7. Related Papers & Knowledge Graph Hooks ───────────────────────────────

export function useRelatedPapers(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.relations(workspaceId, paperId),
    queryFn: () => libraryService.getRelatedPapers(workspaceId, paperId),
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
    }) => libraryService.linkPapers(workspaceId, paperId, targetPaperId, relationType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.relations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({ queryKey: libraryKeys.graph(workspaceId) });
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
      libraryService.unlinkPapers(workspaceId, paperId, targetPaperId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.relations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({ queryKey: libraryKeys.graph(workspaceId) });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      toast.success('Related paper unlinked');
    },
  });
}

export function useWorkspaceKnowledgeGraph(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.graph(workspaceId),
    queryFn: () => libraryService.getWorkspaceKnowledgeGraph(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

// ── 8. PDF Annotations & Extracted Notes Hooks ──────────────────────────────

export function useAnnotations(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.annotations(workspaceId, paperId),
    queryFn: () => libraryService.getAnnotations(workspaceId, paperId),
    enabled: Boolean(workspaceId && paperId),
  });
}

export function useCreateAnnotation(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: Partial<PdfAnnotation>) =>
      libraryService.createAnnotation(workspaceId, paperId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.annotations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
    },
  });
}

export function useDeleteAnnotation(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (annotationId: string) =>
      libraryService.deleteAnnotation(workspaceId, paperId, annotationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.annotations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
    },
  });
}

export function useExtractNotes(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      libraryService.extractNotesFromAnnotations(workspaceId, paperId),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperDetail(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      const count =
        response?.literatureNote?.annotationCount ??
        response?.totalExtracted ??
        'all';
      toast.success(`Synthesized ${count} highlight(s) into Literature Note`);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to extract notes');
    },
  });
}

// ── 9. Async Ingestion Polling Hook ─────────────────────────────────────────

export function useAsyncJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? libraryKeys.job(jobId) : ['library', 'job', 'idle'],
    queryFn: () => (jobId ? libraryService.getAsyncJobStatus(jobId) : null),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status === 'processing' || data.status === 'queued') {
        return 1000;
      }
      return false;
    },
  });
}
