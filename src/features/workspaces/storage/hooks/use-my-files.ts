import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWorkspaceMyFiles } from '../services/storage.services';
import { toggleStar, deleteFile } from '../services/file.services';;
import type { StorageLevel } from '../types/storage.types';

export function useMyFiles(id: string) {
  const queryClient = useQueryClient();
  const queryFn = () => fetchWorkspaceMyFiles(id);
  const queryKey = ['workspace-my-files', id];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn,
    enabled: !!id,
  });

  const toggleStarMutation = useMutation({
    mutationFn: (fileId: string) => toggleStar(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  const handleToggleStar = async (fileId: string) => {
    try { await toggleStarMutation.mutateAsync(fileId); } catch (error) { console.error('Error toggling star:', error); }
  };

  const handleDelete = async (fileId: string) => {
    try { await deleteFileMutation.mutateAsync(fileId); } catch (error) { console.error('Error deleting file:', error); }
  };

  return {
    data, isLoading, error,
    handleToggleStar, handleDelete,
  };
}
