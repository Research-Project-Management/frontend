import {
    QueryClient,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import {
    uploadFile,
    toggleStar,
    deleteFile,
    restoreFile,
    permanentlyDeleteFile,
    renameFile,
    moveFile,
    updateFileMetadata,
} from "../services/file.services";
import { createFolder } from "../services/storage.services";

const invalidateWorkspaceStorageQueries = (
    queryClient: QueryClient,
    workspaceId?: string
) => {
    if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ["workspace-home", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-home-files", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-my-files", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-starred-files", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-shared-files", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspace-trashed-files", workspaceId] });
    } else {
        queryClient.invalidateQueries({ queryKey: ["workspace-home"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-home-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-my-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-starred-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-shared-files"] });
        queryClient.invalidateQueries({ queryKey: ["workspace-trashed-files"] });
    }
};

export const useUploadFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ file, workspaceId, parentId, onProgress }: {
            file: File;
            workspaceId: string;
            parentId?: string | null;
            onProgress?: (progress: number) => void;
        }) =>
            uploadFile(file, { workspaceId, parentId, onProgress }),
        onSuccess: (_, variables) => {
            invalidateWorkspaceStorageQueries(queryClient, variables.workspaceId);
        },
    });
};

export const useCreateFolder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, workspaceId, parentId }: {
            name: string;
            workspaceId: string;
            parentId?: string | null;
        }) =>
            createFolder(name, { workspaceId, parentId }),
        onSuccess: (_, variables) => {
            invalidateWorkspaceStorageQueries(queryClient, variables.workspaceId);
        },
    });
};

export const useToggleStar = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return toggleStar(fileId);
        },
        onSuccess: (_, args) => {
            invalidateWorkspaceStorageQueries(queryClient, typeof args === "string" ? undefined : args.workspaceId);
        },
    });
};

export const useDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return deleteFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateWorkspaceStorageQueries(queryClient, typeof args === "string" ? undefined : args.workspaceId);
        },
    });
};

export const useRestoreFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return restoreFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateWorkspaceStorageQueries(queryClient, typeof args === "string" ? undefined : args.workspaceId);
        },
    });
};

export const usePermanentlyDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: string | { fileId: string; workspaceId?: string }) => {
            const fileId = typeof args === "string" ? args : args.fileId;
            return permanentlyDeleteFile(fileId);
        },
        onSuccess: (_, args) => {
            invalidateWorkspaceStorageQueries(queryClient, typeof args === "string" ? undefined : args.workspaceId);
        },
    });
};

export const useRenameFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { fileId: string; name: string; workspaceId?: string }) =>
            renameFile(args.fileId, args.name),
        onSuccess: (_, args) => {
            invalidateWorkspaceStorageQueries(queryClient, args.workspaceId);
        },
    });
};

export const useMoveFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { fileId: string; parentId: string | null; workspaceId?: string }) =>
            moveFile(args.fileId, args.parentId),
        onSuccess: (_, args) => {
            invalidateWorkspaceStorageQueries(queryClient, args.workspaceId);
        },
    });
};

export const useUpdateFileMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { fileId: string; metaData: Record<string, any>; workspaceId?: string }) =>
            updateFileMetadata(args.fileId, args.metaData),
        onSuccess: (_, args) => {
            invalidateWorkspaceStorageQueries(queryClient, args.workspaceId);
        },
    });
};
