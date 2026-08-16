import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, API_BASE_URL } from '@/shared/constants';
import { apiGet, apiPost } from '@/shared/lib/api';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { getAllFiles, createFolder as createProjectFolder } from "@/features/workspaces/projects/project-id/storage/services/file.service";
import { uploadFile, permanentlyDeleteItem, renameItem, moveItem } from "@/features/workspaces/projects/project-id/storage/services/file.service";

export function useEditorStorage(pageId: string | null | undefined, parentId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.storage.projectFilesEditor(pageId ?? undefined, parentId);
  const { data: children, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<StorageItem[]> => {
      if (!pageId) return [];
      const endpoint = parentId
        ? `/api/files/page/${pageId}?parentId=${parentId}`
        : `/api/files/page/${pageId}`;
      const data = await apiGet<{ files: StorageItem[] }>(endpoint);
      return data.files;
    },
    enabled: !!pageId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({
      file,
      projectId,
      workspaceId,
      pageId,
      parentId,
    }: {
      file: File;
      projectId: string;
      workspaceId: string;
      pageId: string;
      parentId?: string | null;
    }) => {
      const timestamp = Date.now();
      const fileName = `workspace/${workspaceId}/${timestamp}-${file.name}`;
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? (reader.result as string));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", fileName);

      const response = await fetch(`${API_BASE_URL}/api/files/page/${pageId}/upload-r2`, {
          method: "POST",
          body: formData,
          credentials: "include"
      });

      if (!response.ok) throw new Error("Upload to R2 proxy failed");
      
      const { url, path } = await response.json();
      await apiPost(`/api/files/page/${pageId}/upload`, {
        filename: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        url: `/api/files/r2/${path}`,
        parentId: parentId || null,
        fileBase64,
      });
    },
    onSuccess: (_, variables) => {
      if (variables.pageId || variables.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor(variables.pageId || variables.projectId) });
      }
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: ({ name, projectId, workspaceId, parentId, pageId }: {
      name: string;
      projectId: string;
      workspaceId: string;
      parentId?: string | null;
      pageId?: string | null;
    }) => {
      if (pageId) {
        return apiPost(`/api/files/page/${pageId}/folder`, {
          name,
          parentId: parentId ?? null,
        });
      }
      return createProjectFolder(name, {
        projectId,
        parentId: parentId ?? null,
      });
    },
    onSuccess: (_, variables) => {
      if (variables.pageId || variables.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor(variables.pageId || variables.projectId) });
      }
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => permanentlyDeleteItem(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor() }),
  });

  const renameFileMutation = useMutation({
    mutationFn: ({ fileId, name }: { fileId: string; name: string }) => renameItem(fileId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor() }),
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ fileId, parentId }: { fileId: string; parentId: string | null }) => moveItem(fileId, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor() }),
  });

  return {
    files: children,
    isLoading,
    uploadFile: uploadFileMutation,
    createFolder: createFolderMutation,
    deleteFile: deleteFileMutation,
    renameFile: renameFileMutation,
    moveFile: moveFileMutation,
  };
}
