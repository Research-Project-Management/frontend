import {
    QueryClient,
    useQuery,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import { API_BASE_URL } from "@/shared/constants";
import type { StorageResponse, StorageItem } from '../types/storage.types';
import { extractPdfMetadataFromFile } from '@/features/editor';

// ── Queries ───────────────────────────────────────────────────────────────────

export const fetchFiles = (projectId: string, parentId?: string | null) =>
    apiGet<StorageResponse>(parentId
        ? `/api/files/project/${projectId}?parentId=${parentId}`
        : `/api/files/project/${projectId}`);

export const fetchMyFiles = (projectId: string) =>
    apiGet<StorageResponse>(`/api/files/my-files/${projectId}`);

export const fetchStarredFiles = (projectId: string) =>
    apiGet<StorageResponse>(`/api/files/starred/${projectId}`);

export const fetchSharedFiles = (projectId: string) =>
    apiGet<StorageResponse>(`/api/files/shared/${projectId}`);

export const fetchTrashedFiles = (projectId: string) =>
    apiGet<StorageResponse>(`/api/files/trash/${projectId}`);

// ── Query Invalidation Helper ─────────────────────────────────────────────────

const invalidateProjectStorageQueries = (queryClient: QueryClient, projectId?: string) => {
    if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-files", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project-my-files", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project-starred-files", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project-shared-files", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project-trashed-files", projectId] });
    } else {
        queryClient.invalidateQueries({ queryKey: ["project-files"] });
        queryClient.invalidateQueries({ queryKey: ["project-my-files"] });
        queryClient.invalidateQueries({ queryKey: ["project-starred-files"] });
        queryClient.invalidateQueries({ queryKey: ["project-shared-files"] });
        queryClient.invalidateQueries({ queryKey: ["project-trashed-files"] });
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
    params: { projectId: string; workspaceId: string; parentId?: string | null; parentPageId?: string | null; onProgress?: (progress: number) => void }
) => {
    const storagePrefix = `project/${params.projectId}`;
    const timestamp = Date.now();
    const fileName = `${storagePrefix}/${timestamp}-${file.name}`;
    const thumbnailBlob = file.type.startsWith("image/") ? await generateThumbnail(file) : null;

    return new Promise<void>((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", fileName);

        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && params.onProgress) {
                const percentComplete = Math.round((event.loaded / event.total) * 90);
                params.onProgress(percentComplete);
            }
        };

        xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    const uploadUrl = `${API_BASE_URL}${response.url}`;
                    let thumbnailUrl;

                    if (thumbnailBlob) {
                        const thumbName = `project/${params.projectId}/${Date.now()}-thumb.jpg`;
                        const thumbFormData = new FormData();
                        thumbFormData.append("file", thumbnailBlob);
                        thumbFormData.append("fileName", thumbName);

                        const thumbResponse = await fetch(`${API_BASE_URL}/api/files/upload-r2`, {
                            method: "POST",
                            body: thumbFormData,
                            credentials: "include"
                        });
                        if (thumbResponse.ok) {
                            const thumbData = await thumbResponse.json();
                            thumbnailUrl = `${API_BASE_URL}${thumbData.url}`;
                        }
                    }

                    let extractedMetadata = undefined;
                    try {
                        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
                            const pdfMeta = await extractPdfMetadataFromFile(file);
                            if (pdfMeta) extractedMetadata = pdfMeta;
                        }
                    } catch (err) { console.error(err); }

                    await apiPost("/api/files/upload", {
                        scope: "project",
                        workspaceId: params.workspaceId,
                        projectId: params.projectId,
                        filename: file.name,
                        size: file.size,
                        mimeType: file.type,
                        url: uploadUrl,
                        thumbnail: thumbnailUrl,
                        parentId: params.parentId || null,
                        metaData: extractedMetadata,
                    });

                    if (params.onProgress) params.onProgress(100);
                    resolve();
                } catch (error) { reject(error); }
            } else {
                reject(new Error("Failed to upload file to backend proxy"));
            }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));

        xhr.open("POST", `${API_BASE_URL}/api/files/upload-r2`, true);
        xhr.send(formData);
    });
};

export const createFolder = (name: string, params: { projectId: string; workspaceId?: string; parentId?: string | null; parentPageId?: string | null }) => {
    return apiPost("/api/files/folder", {
        scope: "project",
        projectId: params.projectId,
        workspaceId: params.workspaceId,
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

export const moveFile = (fileId: string, parentId: string | null) =>
    apiPut(`/api/files/${fileId}/move`, { parentId });

export const checkDuplicate = (
    filename: string,
    parentId: string | null,
    params: { projectId: string }
) => {
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
};

// ── React Query Hooks ─────────────────────────────────────────────────────────

export const useFiles = (projectId: string, parentId?: string | null) =>
    useQuery({
        queryKey: ["project-files", projectId, parentId],
        queryFn: () => fetchFiles(projectId, parentId),
        enabled: !!projectId,
    });

export const useUploadFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ file, projectId, workspaceId, parentId, onProgress }: {
            file: File;
            projectId: string;
            workspaceId: string;
            parentId?: string | null;
            onProgress?: (progress: number) => void;
        }) =>
            uploadFile(file, { projectId, workspaceId, parentId, onProgress }),
        onSuccess: (_, variables) => {
            invalidateProjectStorageQueries(queryClient, variables.projectId);
        },
    });
};

export const useCreateFolder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, projectId, workspaceId, parentId }: {
            name: string;
            projectId: string;
            workspaceId?: string;
            parentId?: string | null;
        }) =>
            createFolder(name, { projectId, workspaceId, parentId }),
        onSuccess: (_, variables) => {
            invalidateProjectStorageQueries(queryClient, variables.projectId);
        },
    });
};

export const useToggleStar = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; projectId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return toggleStar(fileId);
        },
        onSuccess: (_, args) => {
            invalidateProjectStorageQueries(queryClient, typeof args === "string" ? undefined : args.projectId);
        },
    });
};

export const useDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; projectId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return deleteFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateProjectStorageQueries(queryClient, typeof args === "string" ? undefined : args.projectId);
        },
    });
};

export const useRestoreFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; projectId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return restoreFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateProjectStorageQueries(queryClient, typeof args === "string" ? undefined : args.projectId);
        },
    });
};

export const usePermanentlyDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; projectId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return permanentlyDeleteFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateProjectStorageQueries(queryClient, typeof args === "string" ? undefined : args.projectId);
        },
    });
};

export const useRenameFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { fileId: string; name: string; projectId?: string }) =>
            renameFile(args.fileId, args.name),
        onSuccess: (_, args) => {
            invalidateProjectStorageQueries(queryClient, args.projectId);
        },
    });
};

export const useMoveFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { fileId: string; parentId: string | null; projectId?: string }) =>
            moveFile(args.fileId, args.parentId),
        onSuccess: (_, args) => {
            invalidateProjectStorageQueries(queryClient, args.projectId);
        },
    });
};
