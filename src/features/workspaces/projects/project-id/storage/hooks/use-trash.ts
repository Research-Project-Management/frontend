import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTrashedFiles } from '../services/storage.services';
import { restoreFile, permanentlyDeleteFile } from '@/features/workspaces/storage/services/file.services';;

export function useTrash(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['trashed-files', projectId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchTrashedFiles(projectId),
    enabled: !!projectId,
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
