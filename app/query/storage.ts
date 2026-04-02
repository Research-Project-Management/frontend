import {
    QueryClient,
    useQuery,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { API_URL, apiFetch, apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import type { StorageItem } from "~/components/workspace/storage/types";

type StorageScope = "project" | "workspace";

type ScopedStorageParams = {
    scope: StorageScope;
    projectId?: string;
    workspaceId?: string;
    parentId?: string | null;
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

const invalidateStorageQueries = (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["my-files"] });
    queryClient.invalidateQueries({ queryKey: ["starred-files"] });
    queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-my-files"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-starred-files"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-shared-files"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-trashed-files"] });
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
                    thumbnailUrl = `${API_URL}/api/files/${thumbPath}`;
                }
            }
        } catch (e) {
            console.error("Failed to generate/upload thumbnail", e);
        }
    }

    // Save metadata
    return apiPost("/api/files/upload", {
        ...scopeBody,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: `${API_URL}/api/files/${path}`,
        thumbnail: thumbnailUrl,
        parentId: params.parentId || null,
    });
};

export const createFolder = (name: string, params: ScopedStorageParams) => {
    const scopeBody = resolveScopedStorageBody(params);
    return apiPost("/api/files/folder", {
        ...scopeBody,
        name,
        parentId: params.parentId || null,
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

export const useFiles = (workspaceId: string, parentId?: string | null) =>
    useQuery({
        queryKey: ["files", workspaceId, parentId],
        queryFn: () => fetchFiles(workspaceId, parentId),
        enabled: !!workspaceId,
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
        onSuccess: () => {
            invalidateStorageQueries(queryClient);
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
        onSuccess: () => {
            invalidateStorageQueries(queryClient);
        },
    });
};

export const useToggleStar = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => toggleStar(fileId),
        onSuccess: () => { invalidateStorageQueries(queryClient); },
    });
};

export const useDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => deleteFile(fileId),
        onSuccess: () => { invalidateStorageQueries(queryClient); },
    });
};

export const useRestoreFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => restoreFile(fileId),
        onSuccess: () => { invalidateStorageQueries(queryClient); },
    });
};

export const usePermanentlyDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => permanentlyDeleteFile(fileId),
        onSuccess: () => { invalidateStorageQueries(queryClient); },
    });
};

export const useRenameFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ fileId, name }: { fileId: string; name: string }) => renameFile(fileId, name),
        onSuccess: () => { invalidateStorageQueries(queryClient); },
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
        mutationFn: ({ fileId, parentId }: { fileId: string; parentId: string | null }) =>
            moveFile(fileId, parentId),
        onSuccess: () => {
            invalidateStorageQueries(queryClient);
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
            invalidateStorageQueries(queryClient);
        },
    });
};
