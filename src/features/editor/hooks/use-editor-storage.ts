import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, API_BASE_URL } from '@/shared/constants';
import { apiGet, apiPost } from '@/shared/lib/api';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { fetchFiles, createFolder as createProjectFolder } from "@/features/workspaces/projects/project-id/storage/services/storage.services";
import { uploadFile, permanentlyDeleteFile, renameFile, moveFile } from "@/features/workspaces/projects/project-id/storage/services/storage.services";

export function useEditorStorage(parentPageId: string | null | undefined, parentId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.storage.projectFilesEditor(parentPageId ?? undefined, parentId);
  const { data: children, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<StorageItem[]> => {
      if (!parentPageId) return [];
      const endpoint = parentId
        ? `/api/files/page/${parentPageId}?parentId=${parentId}`
        : `/api/files/page/${parentPageId}`;
      const data = await apiGet<{ files: StorageItem[] }>(endpoint);
      return data.files;
    },
    enabled: !!parentPageId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const uploadFileMutation = useMutation({
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
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? (reader.result as string));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", fileName);

      const response = await fetch(`${API_BASE_URL}/api/files/upload-r2`, {
          method: "POST",
          body: formData,
          credentials: "include"
      });

      if (!response.ok) throw new Error("Upload to R2 proxy failed");
      
      const { url, path } = await response.json();
      await apiPost(`/api/files/upload`, {
        filename: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        url: `/api/files/r2/${path}`,
        workspaceId,
        projectId,
        parentId: parentId || null,
        parentPageId,
        fileBase64,
      });
    },
    onSuccess: (_, variables) => {
      if (variables.parentPageId || variables.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor(variables.parentPageId || variables.projectId) });
      }
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: ({ name, projectId, workspaceId, parentId, parentPageId }: {
      name: string;
      projectId: string;
      workspaceId: string;
      parentId?: string | null;
      parentPageId?: string | null;
    }) =>
      createProjectFolder(name, {
        projectId,
        workspaceId,
        parentId: parentId ?? null,
        parentPageId: parentPageId ?? null,
      }),
    onSuccess: (_, variables) => {
      if (variables.parentPageId || variables.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor(variables.parentPageId || variables.projectId) });
      }
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => permanentlyDeleteFile(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor() }),
  });

  const renameFileMutation = useMutation({
    mutationFn: ({ fileId, name }: { fileId: string; name: string }) => renameFile(fileId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor() }),
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ fileId, parentId }: { fileId: string; parentId: string | null }) => moveFile(fileId, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.projectFilesEditor() }),
  });

  return {
    children,
    isLoading,
    uploadFileMutation,
    createFolderMutation,
    deleteFileMutation,
    renameFileMutation,
    moveFileMutation,
  };
}
