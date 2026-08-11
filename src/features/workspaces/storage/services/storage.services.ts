import { apiGet, apiPost } from "@/shared/lib/api";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';

// ── Response Types ───────────────────────────────────────────────────────────

export interface StorageResponse {
    files?: StorageItem[];
    project?: { _id: string; name: string };
    yourRole?: string;
    [key: string]: any;
}

// ── Workspace-level fetch ────────────────────────────────────────────────────

export const fetchWorkspaceHome = (workspaceId: string) =>
    apiGet<{
        projects: { _id: string; name: string; fileCount: number; totalSize: number }[];
        workspaceFiles: StorageItem[];
    }>(`/api/files/workspace/${workspaceId}/home`);

export const fetchWorkspaceFiles = (workspaceId: string, parentId?: string | null) =>
    apiGet<StorageResponse>(parentId
        ? `/api/files/workspace/${workspaceId}/all?parentId=${parentId}`
        : `/api/files/workspace/${workspaceId}/all`);

export const fetchWorkspaceMyFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/my-files`);

export const fetchWorkspaceStarredFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/starred`);

export const fetchWorkspaceSharedFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/shared`);

export const fetchWorkspaceTrashedFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/trash`);

export const createFolder = (name: string, params: { workspaceId: string; parentId?: string | null; parentPageId?: string | null }) => {
    return apiPost("/api/files/folder", {
        scope: "workspace",
        workspaceId: params.workspaceId,
        name,
        parentId: params.parentId ?? null,
        ...(params.parentPageId ? { parentPageId: params.parentPageId } : {}),
    });
};
