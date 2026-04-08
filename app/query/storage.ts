import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, apiFetch, apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import type { StorageItem } from "~/components/workspace/storage/types";

// ── Workspace-level fetch ─────────────────────────────────────────────────────

export const fetchWorkspaceHome = (workspaceId: string) =>
    apiGet<{
        projects: { _id: string; name: string; fileCount: number; totalSize: number }[];
        workspaceFiles: StorageItem[];
    }>(`/api/files/workspace/${workspaceId}/home`);

export const fetchWorkspaceFiles = (workspaceId: string, parentId?: string | null) =>
    apiGet(parentId
        ? `/api/files/workspace/${workspaceId}/all?parentId=${parentId}`
        : `/api/files/workspace/${workspaceId}/all`);

export const fetchWorkspaceMyFiles = (workspaceId: string) =>
    apiGet(`/api/files/workspace/${workspaceId}/my-files`);

export const fetchWorkspaceStarredFiles = (workspaceId: string) =>
    apiGet(`/api/files/workspace/${workspaceId}/starred`);

export const fetchWorkspaceSharedFiles = (workspaceId: string) =>
    apiGet(`/api/files/workspace/${workspaceId}/shared`);

export const fetchWorkspaceTrashedFiles = (workspaceId: string) =>
    apiGet(`/api/files/workspace/${workspaceId}/trash`);

// ── Project-level fetch ───────────────────────────────────────────────────────

export const fetchFiles = (projectId: string, parentId?: string | null) =>
    apiGet(parentId
        ? `/api/files/project/${projectId}?parentId=${parentId}`
        : `/api/files/project/${projectId}`);

export const fetchMyFiles = (projectId: string) =>
    apiGet(`/api/files/my-files/${projectId}`);

export const fetchStarredFiles = (projectId: string) =>
    apiGet(`/api/files/starred/${projectId}`);

export const fetchSharedFiles = (projectId: string) =>
    apiGet(`/api/files/shared/${projectId}`);

export const fetchTrashedFiles = (projectId: string) =>
    apiGet(`/api/files/trash/${projectId}`);

// ── Thumbnail helper ──────────────────────────────────────────────────────────

const generateThumbnail = async (file: File): Promise<Blob | null> => {
    if (!file.type.startsWith("image/")) return null;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_SIZE = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { resolve(null); return; }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
            };
            img.onerror = () => resolve(null);
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

// ── Mutations (plain functions) ───────────────────────────────────────────────

export const uploadFile = async (file: File, projectId: string, workspaceId: string, parentId?: string | null) => {
    const timestamp = Date.now();
    const fileName = `${workspaceId}/${timestamp}-${file.name}`;

    // Get presigned URL for main file
    const { url: presignedUrl, path } = await apiPost<{ url: string; path: string }>(
        `/api/files/presign`, { fileName },
    );

    // Upload to R2 (direct, not through our API)
    const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
    });
    if (!uploadResponse.ok) throw new Error("Failed to upload file to R2");

    // Handle thumbnail
    let thumbnailUrl: string | undefined;
    if (file.type.startsWith("image/")) {
        try {
            const thumbnailBlob = await generateThumbnail(file);
            if (thumbnailBlob) {
                const thumbName = `${workspaceId}/thumbnails/${timestamp}-${file.name}_thumb.jpg`;
                const { url: thumbPresignedUrl, path: thumbPath } = await apiPost<{ url: string; path: string }>(
                    `/api/files/presign`, { fileName: thumbName },
                );

                const thumbUploadResponse = await fetch(thumbPresignedUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "image/jpeg" },
                    body: thumbnailBlob,
                });

                if (thumbUploadResponse.ok) {
                    thumbnailUrl = `${API_URL}/api/files/${thumbPath}`;
                }
            }
        } catch (e) {
            console.error("Failed to generate/upload thumbnail", e);
        }
    }

    // Save metadata
    return apiPost(`/api/files/upload`, {
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: `${API_URL}/api/files/${path}`,
        thumbnail: thumbnailUrl,
        workspaceId,
        projectId,
        parentId: parentId || null,
    });
};

export const createFolder = (name: string, projectId: string, workspaceId: string, parentId?: string | null, parentPageId?: string | null) =>
    apiPost(`/api/files/folder`, { name, workspaceId, projectId, parentId: parentId || null, parentPageId: parentPageId || null });

export const toggleStar = (fileId: string) =>
    apiPut(`/api/files/${fileId}/star`);

export const deleteFile = (fileId: string) =>
    apiDelete(`/api/files/${fileId}`);

export const restoreFile = (fileId: string) =>
    apiPut(`/api/files/${fileId}/restore`);

export const permanentlyDeleteFile = (fileId: string) =>
    apiDelete(`/api/files/${fileId}/permanent`);

export const shareFile = (fileId: string, userId: string, permission: "view" | "edit") =>
    apiPut(`/api/files/${fileId}/share`, { userId, permission });

export const renameFile = (fileId: string, name: string) =>
    apiPut(`/api/files/${fileId}/rename`, { name });

// ── React Query Hooks ─────────────────────────────────────────────────────────

export const useFiles = (workspaceId: string, parentId?: string | null) =>
    useQuery({
        queryKey: ["files", workspaceId, parentId],
        queryFn: () => fetchFiles(workspaceId, parentId),
        enabled: !!workspaceId,
    });

export const useUploadFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ file, projectId, workspaceId, parentId }: { file: File; projectId: string; workspaceId: string; parentId?: string | null }) =>
            uploadFile(file, projectId, workspaceId, parentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
            queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
        },
    });
};

export const useCreateFolder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, projectId, workspaceId, parentId }: { name: string; projectId: string; workspaceId: string; parentId?: string | null }) =>
            createFolder(name, projectId, workspaceId, parentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
            queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
        },
    });
};

export const useToggleStar = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => toggleStar(fileId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); },
    });
};

export const useDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => deleteFile(fileId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); },
    });
};

export const useRestoreFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => restoreFile(fileId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); },
    });
};

export const usePermanentlyDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => permanentlyDeleteFile(fileId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); },
    });
};

export const useRenameFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ fileId, name }: { fileId: string; name: string }) => renameFile(fileId, name),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); },
    });
};

export const moveFile = (fileId: string, parentId: string | null) =>
    apiPut(`/api/files/${fileId}/move`, { parentId });

export const checkDuplicate = (filename: string, parentId: string | null, projectId?: string, workspaceId?: string) =>
    apiPost<{ exists: boolean; existingFile: { _id: string; filename: string } | null }>(
        `/api/files/check-duplicate`, { filename, parentId, projectId, workspaceId },
    );

export const useMoveFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ fileId, parentId }: { fileId: string; parentId: string | null }) =>
            moveFile(fileId, parentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
            queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
        },
    });
};

// ── Crossref & Metadata ───────────────────────────────────────────────────

export type CrossrefWork = {
    title: string;
    authors: string[];
    doi: string;
    journal: string;
    publisher: string;
    issn: string;
    isbn: string;
    volume: string;
    issue: string;
    pages: string;
    year: number | string;
    type: string;
    abstract: string;
    url: string;
    score: number;
};

export const searchCrossref = (query: string, rows = 5) =>
    apiGet<{ works: CrossrefWork[]; totalResults: number }>(
        `/api/files/crossref/search?query=${encodeURIComponent(query)}&rows=${rows}`,
    );

export const lookupDoi = (doi: string) =>
    apiGet<{ work: CrossrefWork }>(`/api/files/crossref/doi/${encodeURIComponent(doi)}`);

export const updateFileMetadata = (fileId: string, metaData: Record<string, any>) =>
    apiPut(`/api/files/${fileId}/metadata`, { metaData });

export const useUpdateFileMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ fileId, metaData }: { fileId: string; metaData: Record<string, any> }) =>
            updateFileMetadata(fileId, metaData),
        onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};

// ── Editor-scoped project file hooks ──────────────────────────────────────────
// These hooks scope files to a specific project and use a separate query key
// ("project-files-editor") to avoid conflicting with the Storage section cache.

export const useProjectFilesEditor = (parentPageId: string | null | undefined, parentId?: string | null) =>
  useQuery({
    queryKey: ["project-files-editor", parentPageId, parentId ?? null],
    queryFn: async () => {
      // If parentPageId is provided, use the page-based endpoint
      // Otherwise, return empty array (requires a page to fetch files)
      if (!parentPageId) {
        console.log("[useProjectFilesEditor] No parentPageId, returning empty");
        return [];
      }
      
      console.log("[useProjectFilesEditor] Fetching files:", { parentPageId, parentId });
      
      // Use page-based endpoint when parentPageId is provided
      const endpoint = parentId
        ? `/api/files/page/${parentPageId}?parentId=${parentId}`
        : `/api/files/page/${parentPageId}`;
      
      const data = await apiGet<{ files: StorageItem[] }>(endpoint);
      console.log("[useProjectFilesEditor] Files fetched:", data.files?.length || 0);
      return data.files;
    },
    enabled: !!parentPageId,
    staleTime: 0, // Always fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

export const useUploadFileForEditor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      projectId,
      workspaceId,
      parentPageId,
      parentId,
    }: {
      file: File;
      projectId: string;
      workspaceId: string;
      parentPageId: string;
      parentId?: string | null;
    }) => {
      const timestamp = Date.now();
      const fileName = `${workspaceId}/${timestamp}-${file.name}`;

      // 1. Get presigned URL
      const { url: presignedUrl, path } = await apiPost<{ url: string; path: string }>(
        `/api/files/presign`, { fileName },
      );

      // 2. Upload to R2
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload to R2 failed");

      const fileUrl = `${API_URL}/api/files/${path}`;

      // 3. Save metadata — backend fetches from R2 and syncs to compiler automatically
      //    when parentPageId is provided.
      await apiPost(`/api/files/upload`, {
        filename: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        url: fileUrl,
        workspaceId,
        projectId,
        parentId: parentId || null,
        parentPageId,   // ← backend will sync to compiler and associate with page
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate queries based on parentPageId, not projectId
      if (variables.parentPageId) {
        queryClient.invalidateQueries({ queryKey: ["project-files-editor", variables.parentPageId] });
      } else if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-files-editor", variables.projectId] });
      }
    },
  });
};


export const useCreateFolderForEditor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, projectId, workspaceId, parentId, parentPageId }: {
      name: string; projectId: string; workspaceId: string; parentId?: string | null; parentPageId?: string | null;
    }) => createFolder(name, projectId, workspaceId, parentId, parentPageId),
    onSuccess: (_, variables) => {
      // Invalidate queries for the page-specific files
      if (variables.parentPageId) {
        queryClient.invalidateQueries({ queryKey: ["project-files-editor", variables.parentPageId] });
      } else if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-files-editor", variables.projectId] });
      }
    },
  });
};

export const useDeleteFileForEditor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => permanentlyDeleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-files-editor"] });
    },
  });
};

export const useRenameFileForEditor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, name }: { fileId: string; name: string }) => renameFile(fileId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-files-editor"] });
    },
  });
};

export const useMoveFileForEditor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, parentId }: { fileId: string; parentId: string | null }) => moveFile(fileId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-files-editor"] });
    },
  });
};
