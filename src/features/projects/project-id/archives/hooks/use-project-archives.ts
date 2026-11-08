import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ProjectArchiveService,
  projectArchiveKeys,
} from '../services/archive.service';

export function useProjectArchives(projectId: string, search?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: projectArchiveKeys.filtered(projectId, search),
    queryFn: ({ signal }) =>
      ProjectArchiveService.getProjectArchives(projectId, search, signal),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

  const restoreMutation = useMutation({
    mutationFn: (payload: { workItemIds?: string[]; pageIds?: string[] }) =>
      ProjectArchiveService.restoreItems(projectId, payload),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({
        queryKey: projectArchiveKeys.all(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['archived-work-items'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['work-items'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project-pages', projectId],
      });
      toast.success(res.message || 'Restored from project archives');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to restore archived items');
    },
  });

  return {
    workItems: query.data?.workItems ?? [],
    pages: query.data?.pages ?? [],
    counts: query.data?.counts ?? { workItems: 0, pages: 0, total: 0 },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    restoreItems: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
  };
}
