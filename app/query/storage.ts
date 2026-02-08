import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL;

// Workspace-level aggregated fetch functions
export const fetchWorkspaceFiles = async (workspaceId: string, parentId?: string | null) => {
    const url = parentId
        ? `${API_URL}/api/files/workspace/${workspaceId}/all?parentId=${parentId}`
        : `${API_URL}/api/files/workspace/${workspaceId}/all`;

    const response = await fetch(url, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch workspace files");
    }

    return response.json();
};

export const fetchWorkspaceMyFiles = async (workspaceId: string) => {
    const response = await fetch(`${API_URL}/api/files/workspace/${workspaceId}/my-files`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch workspace my files");
    }

    return response.json();
};

export const fetchWorkspaceStarredFiles = async (workspaceId: string) => {
    const response = await fetch(`${API_URL}/api/files/workspace/${workspaceId}/starred`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch workspace starred files");
    }

    return response.json();
};

export const fetchWorkspaceSharedFiles = async (workspaceId: string) => {
    const response = await fetch(`${API_URL}/api/files/workspace/${workspaceId}/shared`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch workspace shared files");
    }

    return response.json();
};

export const fetchWorkspaceTrashedFiles = async (workspaceId: string) => {
    const response = await fetch(`${API_URL}/api/files/workspace/${workspaceId}/trash`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch workspace trashed files");
    }

    return response.json();
};

// Fetch files in project or folder
export const fetchFiles = async (projectId: string, parentId?: string | null) => {
    const url = parentId
        ? `${API_URL}/api/files/project/${projectId}?parentId=${parentId}`
        : `${API_URL}/api/files/project/${projectId}`;

    const response = await fetch(url, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch files");
    }

    return response.json();
};

// Fetch my files
export const fetchMyFiles = async (projectId: string) => {
    const response = await fetch(`${API_URL}/api/files/my-files/${projectId}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch my files");
    }

    return response.json();
};

// Fetch starred files
export const fetchStarredFiles = async (projectId: string) => {
    const response = await fetch(`${API_URL}/api/files/starred/${projectId}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch starred files");
    }

    return response.json();
};

// Fetch shared files
export const fetchSharedFiles = async (projectId: string) => {
    const response = await fetch(`${API_URL}/api/files/shared/${projectId}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch shared files");
    }

    return response.json();
};

// Fetch trashed files
export const fetchTrashedFiles = async (projectId: string) => {
    const response = await fetch(`${API_URL}/api/files/trash/${projectId}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch trashed files");
    }

    return response.json();
};

// Helper to generate thumbnail
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
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(null);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, "image/jpeg", 0.7);
            };
            img.onerror = () => resolve(null);
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

// Upload file
export const uploadFile = async (file: File, projectId: string, workspaceId: string, parentId?: string | null) => {
    const timestamp = Date.now();
    const fileName = `${workspaceId}/${timestamp}-${file.name}`;
    
    // Get presigned URL for main file
    const presignResponse = await fetch(`${API_URL}/api/files/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName }),
    });

    if (!presignResponse.ok) {
        throw new Error("Failed to get presigned URL");
    }

    const { url: presignedUrl, path } = await presignResponse.json();

    // Upload to R2
    const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
    });

    if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to R2");
    }

    // Handle thumbnail
    let thumbnailUrl = undefined;
    if (file.type.startsWith("image/")) {
        try {
            const thumbnailBlob = await generateThumbnail(file);
            if (thumbnailBlob) {
                const thumbName = `${workspaceId}/thumbnails/${timestamp}-${file.name}_thumb.jpg`;
                
                const thumbPresignResponse = await fetch(`${API_URL}/api/files/presign`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ fileName: thumbName }),
                });

                if (thumbPresignResponse.ok) {
                    const { url: thumbPresignedUrl, path: thumbPath } = await thumbPresignResponse.json();
                    
                    const thumbUploadResponse = await fetch(thumbPresignedUrl, {
                        method: "PUT",
                        headers: { "Content-Type": "image/jpeg" },
                        body: thumbnailBlob,
                    });

                    if (thumbUploadResponse.ok) {
                        thumbnailUrl = `${API_URL}/api/files/${thumbPath}`;
                    }
                }
            }
        } catch (e) {
            console.error("Failed to generate/upload thumbnail", e);
            // Continue without thumbnail
        }
    }

    // Save metadata
    const metadataResponse = await fetch(`${API_URL}/api/files/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            filename: file.name,
            size: file.size,
            mimeType: file.type,
            url: `${API_URL}/api/files/${path}`,
            thumbnail: thumbnailUrl,
            workspaceId,
            projectId,
            parentId: parentId || null,
        }),
    });

    if (!metadataResponse.ok) {
        throw new Error("Failed to save file metadata");
    }

    return metadataResponse.json();
};

// Create folder
export const createFolder = async (name: string, projectId: string, workspaceId: string, parentId?: string | null) => {
    const response = await fetch(`${API_URL}/api/files/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            name,
            workspaceId,
            projectId,
            parentId: parentId || null,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to create folder");
    }

    return response.json();
};

// Toggle star
export const toggleStar = async (fileId: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/star`, {
        method: "PUT",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to toggle star");
    }

    return response.json();
};

// Delete file (move to trash)
export const deleteFile = async (fileId: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to delete file");
    }

    return response.json();
};

// Restore file from trash
export const restoreFile = async (fileId: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/restore`, {
        method: "PUT",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to restore file");
    }

    return response.json();
};

// Permanently delete file
export const permanentlyDeleteFile = async (fileId: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/permanent`, {
        method: "DELETE",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to permanently delete file");
    }

    return response.json();
};

// Share file
export const shareFile = async (fileId: string, userId: string, permission: "view" | "edit") => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/share`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, permission }),
    });

    if (!response.ok) {
        throw new Error("Failed to share file");
    }

    return response.json();
};

// Rename file
export const renameFile = async (fileId: string, name: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        throw new Error("Failed to rename file");
    }

    return response.json();
};

// Hook for fetching files
export const useFiles = (workspaceId: string, parentId?: string | null) => {
    return useQuery({
        queryKey: ["files", workspaceId, parentId],
        queryFn: () => fetchFiles(workspaceId, parentId),
        enabled: !!workspaceId,
    });
};

// Hook for uploading files
export const useUploadFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ file, projectId, workspaceId, parentId }: { file: File; projectId: string; workspaceId: string; parentId?: string | null }) =>
            uploadFile(file, projectId, workspaceId, parentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
};

// Hook for creating folders
export const useCreateFolder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ name, projectId, workspaceId, parentId }: { name: string; projectId: string; workspaceId: string; parentId?: string | null }) =>
            createFolder(name, projectId, workspaceId, parentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
};

// Hook for toggling star
export const useToggleStar = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (fileId: string) => toggleStar(fileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
};

// Hook for deleting files
export const useDeleteFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (fileId: string) => deleteFile(fileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
};

// Hook for restoring files
export const useRestoreFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (fileId: string) => restoreFile(fileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
};

// Hook for permanently deleting files
export const usePermanentlyDeleteFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (fileId: string) => permanentlyDeleteFile(fileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
};

// Hook for renaming files
export const useRenameFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ fileId, name }: { fileId: string; name: string }) => renameFile(fileId, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
};
