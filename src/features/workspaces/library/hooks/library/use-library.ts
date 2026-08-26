'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useUpload } from '@/shared/hooks/use-upload';
import { usePapers } from './use-papers';
import { useCollections } from './use-collections';
import { useCollection } from './use-collection';
import { useReferences, useCslCitation } from './use-references';
import {
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useExtractNotes,
} from './use-annotations';
import {
  useRelatedPapers,
  useLinkPapers,
  useUnlinkPapers,
  useWorkspaceKnowledgeGraph,
} from './use-relations';
import {
  useDuplicateGroups,
  useMergePapers,
  useLibraryIntegrity,
} from './use-quality';
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
            prefix: `${workspaceId}/library`,
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
            prefix: `${workspaceId}/library`,
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

// ── Re-exports for 100% Backward Compatibility ──────────────────────────────

export { useCollection } from './use-collection';
export { useCollections } from './use-collections';
export { useReferences, useCslCitation } from './use-references';
export {
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useExtractNotes,
} from './use-annotations';
export {
  useRelatedPapers,
  useLinkPapers,
  useUnlinkPapers,
  useWorkspaceKnowledgeGraph,
} from './use-relations';
export {
  useDuplicateGroups,
  useMergePapers,
  useLibraryIntegrity,
} from './use-quality';
export { useAsyncJobStatus } from './use-async-job';
