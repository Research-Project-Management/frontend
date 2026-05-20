import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import type {
  Collection,
  Paper,
  ProjectCollection,
} from "~/types/library";

// ── Query keys ────────────────────────────────────────────────────────────────

const QK = {
  collections: (workspaceId: string) => ["library-collections", workspaceId],
  papers: (workspaceId: string, collectionId: string) => [
    "library-papers",
    workspaceId,
    collectionId,
  ],
  projectCollections: (projectId: string) => [
    "project-collections",
    projectId,
  ],
};

const invalidateLibrary = (
  qc: ReturnType<typeof useQueryClient>,
  workspaceId: string,
) => {
  qc.invalidateQueries({ queryKey: ["library-collections", workspaceId] });
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE LIBRARY COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

// --- raw fetchers ---

export const fetchCollections = (workspaceId: string) =>
  apiGet<{ collections: Collection[] }>(
    `/api/library/${workspaceId}/collections`,
  );

export const fetchCollectionPapers = (
  workspaceId: string,
  collectionId: string,
) =>
  apiGet<{ collection: Collection; papers: Paper[] }>(
    `/api/library/${workspaceId}/collections/${collectionId}/papers`,
  );

// --- hooks ---

export const useCollections = (workspaceId: string) =>
  useQuery({
    queryKey: QK.collections(workspaceId),
    queryFn: () => fetchCollections(workspaceId),
    enabled: !!workspaceId,
    select: (d) => d.collections,
  });

export const useAllPapers = (workspaceId: string) =>
  useQuery({
    queryKey: ["library-all-papers", workspaceId],
    queryFn: () => apiGet<{ papers: Paper[] }>(`/api/library/${workspaceId}/papers`),
    enabled: !!workspaceId,
    select: (d) => d.papers,
  });

export const useCollectionPapers = (
  workspaceId: string,
  collectionId: string,
) =>
  useQuery({
    queryKey: QK.papers(workspaceId, collectionId),
    queryFn: () => fetchCollectionPapers(workspaceId, collectionId),
    enabled: !!workspaceId && !!collectionId,
  });

// --- mutations ---

export const useCreateCollection = (workspaceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      parent?: string | null;
    }) =>
      apiPost<{ collection: Collection }>(
        `/api/library/${workspaceId}/collections`,
        data,
      ),
    onSuccess: () => invalidateLibrary(qc, workspaceId),
  });
};

export const useUpdateCollection = (workspaceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      ...data
    }: {
      collectionId: string;
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
    }) =>
      apiPut<{ collection: Collection }>(
        `/api/library/${workspaceId}/collections/${collectionId}`,
        data,
      ),
    onSuccess: () => invalidateLibrary(qc, workspaceId),
  });
};

export const useDeleteCollection = (workspaceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (collectionId: string) =>
      apiDelete(`/api/library/${workspaceId}/collections/${collectionId}`),
    onSuccess: () => invalidateLibrary(qc, workspaceId),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PAPERS
// ─────────────────────────────────────────────────────────────────────────────

export const useAddPaper = (workspaceId: string, collectionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      authors?: string[];
      year?: number | null;
      doi?: string;
      abstract?: string;
      keywords?: string[];
      journal?: string;
      publisher?: string;
      fileUrl: string;
      filename: string;
      mimeType?: string;
      size?: number;
      tags?: string[];
      volume?: string;
      issue?: string;
      pages?: string;
      issn?: string;
      isbn?: string;
      url?: string;
      type?: string;
      language?: string;
      journalAbbr?: string;
      shortTitle?: string;
      rights?: string;
      extra?: string;
      notes?: Array<{
        content: string;
      }>;
    }) =>
      apiPost<{ paper: Paper }>(
        `/api/library/${workspaceId}/collections/${collectionId}/papers`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QK.papers(workspaceId, collectionId),
      });
      qc.invalidateQueries({ queryKey: ["library-all-papers", workspaceId] });
      invalidateLibrary(qc, workspaceId); // refresh paper counts
    },
  });
};

export const useUpdatePaper = (workspaceId: string, collectionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      ...data
    }: {
      paperId: string;
      title?: string;
      authors?: string[];
      year?: number | null;
      doi?: string;
      abstract?: string;
      keywords?: string[];
      journal?: string;
      publisher?: string;
      tags?: string[];
      volume?: string;
      issue?: string;
      pages?: string;
      issn?: string;
      isbn?: string;
      url?: string;
      type?: string;
      language?: string;
      journalAbbr?: string;
      shortTitle?: string;
      rights?: string;
      extra?: string;
      notes?: Array<{
        _id?: string;
        content: string;
        createdAt?: string;
        updatedAt?: string;
      }>;
    }) =>
      apiPut<{ paper: Paper }>(
        `/api/library/${workspaceId}/papers/${paperId}`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QK.papers(workspaceId, collectionId),
      });
      qc.invalidateQueries({
        queryKey: ["library-all-papers", workspaceId],
      });
    },
  });
};

export const useDeletePaper = (workspaceId: string, collectionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paperId: string) =>
      apiDelete(`/api/library/${workspaceId}/papers/${paperId}`),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QK.papers(workspaceId, collectionId),
      });
      qc.invalidateQueries({ queryKey: ["library-all-papers", workspaceId] });
      invalidateLibrary(qc, workspaceId);
    },
  });
};

export const reindexPaper = (workspaceId: string, paperId: string) =>
  apiPost<{ message: string; paperId: string }>(
    `/api/library/${workspaceId}/papers/${paperId}/reindex`,
  );

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const useProjectCollections = (projectId: string) =>
  useQuery({
    queryKey: QK.projectCollections(projectId),
    queryFn: () =>
      apiGet<{ projectCollections: ProjectCollection[] }>(
        `/api/library/project/${projectId}/collections`,
      ),
    enabled: !!projectId,
    select: (d) => d.projectCollections,
  });

export const useCreateProjectCollection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiPost<{ projectCollection: ProjectCollection }>(
        `/api/library/project/${projectId}/collections`,
        data,
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QK.projectCollections(projectId) }),
  });
};

export const useDeleteProjectCollection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pcId: string) =>
      apiDelete(`/api/library/project/${projectId}/collections/${pcId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QK.projectCollections(projectId) }),
  });
};

export const useImportLibraryCollection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pcId,
      collectionId,
    }: {
      pcId: string;
      collectionId: string;
    }) =>
      apiPost(
        `/api/library/project/${projectId}/collections/${pcId}/import-library`,
        { collectionId },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QK.projectCollections(projectId) }),
  });
};

export const useAddPaperToProjectCollection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pcId,
      paperId,
      note,
    }: {
      pcId: string;
      paperId: string;
      note?: string;
    }) =>
      apiPost(
        `/api/library/project/${projectId}/collections/${pcId}/papers`,
        { paperId, note },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QK.projectCollections(projectId) }),
  });
};

export const useRemovePaperFromProjectCollection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pcId, paperId }: { pcId: string; paperId: string }) =>
      apiDelete(
        `/api/library/project/${projectId}/collections/${pcId}/papers/${paperId}`,
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QK.projectCollections(projectId) }),
  });
};
