import {
    QueryClient,
    useQuery,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { API_URL, apiFetch, apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import type { StorageItem } from "~/components/workspace/storage/types";
import { extractPdfMetadataFromFile } from "~/lib/pdf";

type StorageScope = "project" | "workspace";

type ScopedStorageParams = {
    scope: StorageScope;
    projectId?: string;
    workspaceId?: string;
    parentId?: string | null;
    parentPageId?: string | null;
};

const resolveScopedStorageBody = (params: ScopedStorageParams) => {
    if (params.scope === "project") {
        if (!params.projectId) {
            throw new Error("projectId is required for project storage actions");
        }

        return {
            scope: "project" as const,
            projectId: params.projectId,
            workspaceId: params.workspaceId,
        };
    }

    if (!params.workspaceId) {
        throw new Error("workspaceId is required for workspace storage actions");
    }

    return {
        scope: "workspace" as const,
        workspaceId: params.workspaceId,
    };
};

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

const invalidateStorageQueries = (
    queryClient: QueryClient,
    params?: { scope?: StorageScope; projectId?: string; workspaceId?: string }
) => {
    if (!params) {
        queryClient.invalidateQueries({ queryKey: ["files"] });
        queryClient.invalidateQueries({ queryKey: ["my-files"] });
        queryClient.invalidateQueries({ queryKey: ["starred-files"] });
        queryClient.invalidateQueries({ queryKey: ["shared-files"] });
        queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-home-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-my-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-starred-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-shared-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-trashed-files"] });
        return;
    }

    if (params.scope === "project" && params.projectId) {
        queryClient.invalidateQueries({ queryKey: ["files", params.projectId] });
        queryClient.invalidateQueries({ queryKey: ["my-files", params.projectId] });
        queryClient.invalidateQueries({ queryKey: ["starred-files", params.projectId] });
        queryClient.invalidateQueries({ queryKey: ["shared-files", params.projectId] });
        queryClient.invalidateQueries({ queryKey: ["trashed-files", params.projectId] });
        if (params.workspaceId) {
            queryClient.invalidateQueries({ queryKey: ["workspace-home", params.workspaceId] });
        } else {
            queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
        }
    } else if (params.scope === "workspace" && params.workspaceId) {
        queryClient.invalidateQueries({ queryKey: ["workspace-home", params.workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-home-files", params.workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-my-files", params.workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-starred-files", params.workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-shared-files", params.workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-trashed-files", params.workspaceId] });
    } else {
        queryClient.invalidateQueries({ queryKey: ["files"] });
        queryClient.invalidateQueries({ queryKey: ["my-files"] });
        queryClient.invalidateQueries({ queryKey: ["starred-files"] });
        queryClient.invalidateQueries({ queryKey: ["shared-files"] });
        queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-home-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-my-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-starred-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-shared-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-trashed-files"] });
    }
};

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

export const uploadFile = async (
    file: File,
    params: ScopedStorageParams,
) => {
    const scopeBody = resolveScopedStorageBody(params);
    const storagePrefix =
        params.scope === "project"
            ? `project/${params.projectId}`
            : `workspace/${params.workspaceId}`;
    const timestamp = Date.now();
    const fileName = `${storagePrefix}/${timestamp}-${file.name}`;

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
                const thumbName = `${storagePrefix}/thumbnails/${timestamp}-${file.name}_thumb.jpg`;
                const { url: thumbPresignedUrl, path: thumbPath } = await apiPost<{ url: string; path: string }>(
                    `/api/files/presign`, { fileName: thumbName },
                );

                const thumbUploadResponse = await fetch(thumbPresignedUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "image/jpeg" },
                    body: thumbnailBlob,
                });

                if (thumbUploadResponse.ok) {
                    thumbnailUrl = `/api/files/${thumbPath}`;
                }
            }
        } catch (e) {
            console.error("Failed to generate/upload thumbnail", e);
        }
    }

    // Save metadata
    let extractedMetadata = undefined;
    try {
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            const pdfMeta = await extractPdfMetadataFromFile(file);
            if (pdfMeta) {
                extractedMetadata = pdfMeta;
            }
        }
    } catch (err) {
        console.error("Failed to extract PDF metadata during upload:", err);
    }

    return apiPost("/api/files/upload", {
        ...scopeBody,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: `/api/files/${path}`,
        thumbnail: thumbnailUrl,
        parentId: params.parentId || null,
        metaData: extractedMetadata,
    });
};

export const createFolder = (name: string, params: ScopedStorageParams) => {
    const scopeBody = resolveScopedStorageBody(params);
    return apiPost("/api/files/folder", {
        ...scopeBody,
        name,
        parentId: params.parentId ?? null,
        ...(params.parentPageId ? { parentPageId: params.parentPageId } : {}),
    });
};

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

export const useFiles = (projectId: string, parentId?: string | null) =>
    useQuery({
        queryKey: ["files", projectId, parentId],
        queryFn: () => fetchFiles(projectId, parentId),
        enabled: !!projectId,
    });

export const useUploadFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ file, scope, projectId, workspaceId, parentId }: {
            file: File;
            scope: StorageScope;
            projectId?: string;
            workspaceId?: string;
            parentId?: string | null;
        }) =>
            uploadFile(file, { scope, projectId, workspaceId, parentId }),
        onSuccess: (_, variables) => {
            invalidateStorageQueries(queryClient, {
                scope: variables.scope,
                projectId: variables.projectId,
                workspaceId: variables.workspaceId,
            });
        },
    });
};

export const useCreateFolder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, scope, projectId, workspaceId, parentId }: {
            name: string;
            scope: StorageScope;
            projectId?: string;
            workspaceId?: string;
            parentId?: string | null;
        }) =>
            createFolder(name, { scope, projectId, workspaceId, parentId }),
        onSuccess: (_, variables) => {
            invalidateStorageQueries(queryClient, {
                scope: variables.scope,
                projectId: variables.projectId,
                workspaceId: variables.workspaceId,
            });
        },
    });
};

export const useToggleStar = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; scope?: StorageScope; projectId?: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return toggleStar(fileId);
        },
        onSuccess: (_, args) => {
            invalidateStorageQueries(queryClient, typeof args === "string" ? undefined : args);
        },
    });
};

export const useDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; scope?: StorageScope; projectId?: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return deleteFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateStorageQueries(queryClient, typeof args === "string" ? undefined : args);
        },
    });
};

export const useRestoreFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; scope?: StorageScope; projectId?: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return restoreFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateStorageQueries(queryClient, typeof args === "string" ? undefined : args);
        },
    });
};

export const usePermanentlyDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; scope?: StorageScope; projectId?: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return permanentlyDeleteFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateStorageQueries(queryClient, typeof args === "string" ? undefined : args);
        },
    });
};

export const useRenameFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { fileId: string; name: string; scope?: StorageScope; projectId?: string; workspaceId?: string }) =>
            renameFile(args.fileId, args.name),
        onSuccess: (_, args) => {
            invalidateStorageQueries(queryClient, args);
        },
    });
};

export const moveFile = (fileId: string, parentId: string | null) =>
    apiPut(`/api/files/${fileId}/move`, { parentId });

export const checkDuplicate = (
    filename: string,
    parentId: string | null,
    params: Omit<ScopedStorageParams, "parentId">,
) => {
    if (params.scope === "project") {
        if (!params.projectId) {
            throw new Error("projectId is required for project storage actions");
        }

        return fetchFiles(params.projectId, parentId).then((data: any) => {
            const files: StorageItem[] = data?.files || [];
            const existingFile = files.find(
                (item) => !item.isFolder && item.filename === filename,
            );

            return {
                exists: !!existingFile,
                existingFile: existingFile
                    ? { _id: existingFile._id, filename: existingFile.filename }
                    : null,
            };
        });
    }

    if (!params.workspaceId) {
        throw new Error("workspaceId is required for workspace storage actions");
    }

    return fetchWorkspaceFiles(params.workspaceId, parentId).then((data: any) => {
        const files: StorageItem[] = data?.files || [];
        const existingFile = files.find(
            (item) => !item.isFolder && item.filename === filename,
        );

        return {
            exists: !!existingFile,
            existingFile: existingFile
                ? { _id: existingFile._id, filename: existingFile.filename }
                : null,
        };
    });
};

export const useMoveFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { fileId: string; parentId: string | null; scope?: StorageScope; projectId?: string; workspaceId?: string }) =>
            moveFile(args.fileId, args.parentId),
        onSuccess: (_, args) => {
            invalidateStorageQueries(queryClient, args);
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
    language?: string;
    journalAbbr?: string;
    shortTitle?: string;
    rights?: string;
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
        mutationFn: (args: { fileId: string; metaData: Record<string, any>; scope?: StorageScope; projectId?: string; workspaceId?: string }) =>
            updateFileMetadata(args.fileId, args.metaData),
        onSuccess: (_, args) => {
            invalidateStorageQueries(queryClient, args);
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
      const fileName = `workspace/${workspaceId}/${timestamp}-${file.name}`;

      // 1. Read file as base64 on the client (used for compiler sync — avoids
      //    the backend having to re-download from R2)
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URL prefix (e.g. "data:image/png;base64,")
          resolve(result.split(",")[1] ?? result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Upload to R2 (backup / CDN access)
      const { url: presignedUrl, path } = await apiPost<{ url: string; path: string }>(
        `/api/files/presign`, { fileName },
      );
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload to R2 failed");

      const fileUrl = `/api/files/${path}`;

      // 3. Save metadata + send base64 so backend can sync to compiler
      //    immediately without re-fetching from R2.
      await apiPost(`/api/files/upload`, {
        filename: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        url: fileUrl,
        workspaceId,
        projectId,
        parentId: parentId || null,
        parentPageId,   // ← associate with LaTeX page-project
        fileBase64,     // ← skip R2 re-download in backend compiler sync
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate ALL project-files-editor queries for this page (root + all sub-folders)
      const pageKey = variables.parentPageId || variables.projectId;
      if (pageKey) {
        queryClient.invalidateQueries({
          queryKey: ["project-files-editor", pageKey],
          exact: false, // ← invalidates root AND all folderId sub-queries
        });
      }
    },
  });
};



export const useCreateFolderForEditor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, projectId, workspaceId, parentId, parentPageId }: {
            name: string;
            projectId: string;
            workspaceId: string;
            parentId?: string | null;
            parentPageId?: string | null;
        }) =>
            createFolder(name, {
                scope: "project",
                projectId,
                workspaceId,
                parentId: parentId ?? null,
                parentPageId: parentPageId ?? null,
            }),
        onSuccess: (_, variables) => {
            const pageKey = variables.parentPageId || variables.projectId;
            if (pageKey) {
                queryClient.invalidateQueries({
                    queryKey: ["project-files-editor", pageKey],
                    exact: false, // invalidate root + all sub-folder queries
                });
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
