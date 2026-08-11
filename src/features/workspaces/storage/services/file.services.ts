import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import { API_BASE_URL } from "@/shared/constants";
import { fetchWorkspaceFiles } from "./storage.services";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { extractPdfMetadataFromFile } from '@/features/editor';

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

// ── Mutations (plain functions) ──────────────────────────────────────────────

export const uploadFile = async (
    file: File,
    params: { workspaceId: string; parentId?: string | null; parentPageId?: string | null; onProgress?: (progress: number) => void }
) => {
    const storagePrefix = `workspace/${params.workspaceId}`;
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
                        const thumbName = `workspace/${params.workspaceId}/${Date.now()}-thumb.jpg`;
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
                        scope: "workspace",
                        workspaceId: params.workspaceId,
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
    params: { workspaceId: string },
) => {
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

export const updateFileMetadata = (fileId: string, metaData: Record<string, any>) =>
    apiPut(`/api/files/${fileId}/metadata`, { metaData });


export async function fetchFileArrayBufferService(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
        throw new Error(`Failed to fetch file buffer: ${response.statusText}`);
    }
    return response.arrayBuffer();
}

export async function fetchBlobService(url: string): Promise<Blob> {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }
    return response.blob();
}

export const uploadGenericFile = async (file: File, workspaceId: string): Promise<string> => {
    const fileName = `avatars/${workspaceId}-${Date.now()}`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", fileName);

    const uploadResponse = await fetch(`${API_BASE_URL}/api/files/upload-r2`, {
        method: "POST",
        body: formData,
        credentials: "include"
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status ${uploadResponse.status}`);
    }

    const { url } = await uploadResponse.json();
    return `${API_BASE_URL}${url}`;
};
