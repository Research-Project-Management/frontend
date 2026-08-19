'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryKeys } from '../constants/library.keys';
import * as libraryService from '../services/library.service';
import type {
  PaperQueryParams,
  CslStyle,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  PdfAnnotation,
  Paper,
} from '../types/library.types';
import { toast } from 'sonner';

// ── 1. Unified Academic Facade ───────────────────────────────────────────────

export function usePaperAcademicBundle(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.paperBundle(workspaceId, paperId),
    queryFn: () => libraryService.getPaperAcademicBundle(workspaceId, paperId),
    enabled: Boolean(workspaceId && paperId),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

// ── 2. Papers & Smart Filters ────────────────────────────────────────────────

export function useLibraryPapers(workspaceId: string, query?: PaperQueryParams) {
  return useQuery({
    queryKey: libraryKeys.paperList(workspaceId, query),
    queryFn: () => libraryService.getPapers(workspaceId, query),
    enabled: Boolean(workspaceId),
    staleTime: 1000 * 60 * 2,
  });
}

export function usePaper(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.paperDetail(workspaceId, paperId),
    queryFn: () => libraryService.getPaperById(workspaceId, paperId),
    enabled: Boolean(workspaceId && paperId),
  });
}

export function useUpdatePaper(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Paper>) =>
      libraryService.updatePaper(workspaceId, paperId, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      queryClient.setQueryData(libraryKeys.paperDetail(workspaceId, paperId), res);
      toast.success('Paper metadata updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update paper');
    },
  });
}

export function useDeletePaper(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paperId: string) =>
      libraryService.deletePaper(workspaceId, paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      toast.success('Paper moved to trash');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete paper');
    },
  });
}

// ── 3. Collections ───────────────────────────────────────────────────────────

export function useCollections(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.collections(workspaceId),
    queryFn: () => libraryService.getCollections(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCollection(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateCollectionDTO) =>
      libraryService.createCollection(workspaceId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.collections(workspaceId) });
      toast.success('Collection created');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create collection');
    },
  });
}

export function useUpdateCollection(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      dto,
    }: {
      collectionId: string;
      dto: UpdateCollectionDTO;
    }) => libraryService.updateCollection(workspaceId, collectionId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.collections(workspaceId) });
      toast.success('Collection updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update collection');
    },
  });
}

export function useDeleteCollection(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      strategy,
    }: {
      collectionId: string;
      strategy?: 'move-to-parent' | 'orphan' | 'cascade';
    }) => libraryService.deleteCollection(workspaceId, collectionId, strategy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.collections(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      toast.success('Collection deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete collection');
    },
  });
}

// ── 4. CSL Citation Formatting ───────────────────────────────────────────────

export function useCslCitation(
  workspaceId: string,
  paperId: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: libraryKeys.citationItem(workspaceId, paperId, style),
    queryFn: () =>
      libraryService.formatCslCitation(workspaceId, paperId, style, index),
    enabled: Boolean(workspaceId && paperId),
    staleTime: 1000 * 60 * 30, // 30 minutes cache for static citations
  });
}

// ── 5. PDF Annotations ───────────────────────────────────────────────────────

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
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperDetail(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      toast.success(`Synthesized ${res.totalExtracted} highlights into Literature Note`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to extract notes');
    },
  });
}

// ── 6. Relations & Knowledge Graph ──────────────────────────────────────────

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

// ── 7. Quality, Duplicates & Safe Merge ─────────────────────────────────────

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
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.duplicates(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.integrity(workspaceId) });
      toast.success(`Merged ${res.mergedCount} duplicate papers into master`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to merge papers');
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

// ── 8. Async Job Tracker Hook ───────────────────────────────────────────────

export function useAsyncJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? libraryKeys.job(jobId) : ['library', 'job', 'idle'],
    queryFn: () => (jobId ? libraryService.getAsyncJobStatus(jobId) : null),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status === 'processing' || data.status === 'queued') {
        return 1000; // Poll every second while processing
      }
      return false; // Stop polling on complete/fail
    },
  });
}
