/**
 * @file use-file-versions.ts
 * @description React Query hooks for file versioning, timeline tracking, and rollbacks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFileVersions,
  uploadNewFileVersion,
  revertFileVersion,
  type FileVersionsResponse,
} from '../services/version.service';
import { toast } from 'sonner';

export function useFileVersions(fileId?: string) {
  return useQuery({
    queryKey: ['file-versions', fileId],
    queryFn: () => (fileId ? getFileVersions(fileId) : Promise.reject('No fileId')),
    enabled: Boolean(fileId),
    staleTime: 10 * 1000,
  });
}

export function useUploadNewVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      file,
      changeComment,
      onProgress,
    }: {
      fileId: string;
      file: File;
      changeComment?: string;
      onProgress?: (progress: number) => void;
    }) => {
      return uploadNewFileVersion(fileId, file, changeComment, onProgress);
    },
    onSuccess: (_, variables) => {
      toast.success('New version uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['file-versions', variables.fileId] });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload new version');
    },
  });
}

export function useRevertFileVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      versionNumber,
    }: {
      fileId: string;
      versionNumber: number;
    }) => {
      return revertFileVersion(fileId, versionNumber);
    },
    onSuccess: (_, variables) => {
      toast.success(`Reverted to version ${variables.versionNumber}!`);
      queryClient.invalidateQueries({ queryKey: ['file-versions', variables.fileId] });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to revert version');
    },
  });
}
