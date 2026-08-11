import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWorkspaceTrashedFiles } from '../services/storage.services';
import { restoreFile, permanentlyDeleteFile } from '../services/file.services';;
import type { StorageLevel } from '../types/storage.types';

export function useTrash(id: string) {
  const queryClient = useQueryClient();
  const queryFn = () => fetchWorkspaceTrashedFiles(id);
  const queryKey = ['workspace-trashed-files', id];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn,
    enabled: !!id,
  });

  const restoreFileMutation = useMutation({
    mutationFn: (fileId: string) => restoreFile(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  const permanentlyDeleteFileMutation = useMutation({
    mutationFn: (fileId: string) => permanentlyDeleteFile(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  const handleRestore = async (fileId: string) => {
    try { await restoreFileMutation.mutateAsync(fileId); } catch (error) { console.error('Error restoring file:', error); }
  };

  const handlePermanentlyDelete = async (fileId: string) => {
    try { await permanentlyDeleteFileMutation.mutateAsync(fileId); } catch (error) { console.error('Error permanently deleting file:', error); }
  };

  return {
    data, isLoading, error,
    handleRestore, handlePermanentlyDelete,
  };
}
