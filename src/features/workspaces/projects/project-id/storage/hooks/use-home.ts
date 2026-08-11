import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFiles } from '../services/storage.services';
import { toggleStar, deleteFile } from '@/features/workspaces/storage/services/file.services';;

export function useHome(projectId: string, currentFolder?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['files', projectId, currentFolder];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchFiles(projectId, currentFolder),
    enabled: !!projectId,
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
