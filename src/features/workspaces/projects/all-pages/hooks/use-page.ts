import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { PageService } from '../services/page.service';
import type { CreatePageInput } from '../types/page.types';
import { toast } from 'sonner';

export const pageKeys = {
  all: ['pages'] as const,
  workspace: (workspaceId: string, status?: string, search?: string) =>
    [...pageKeys.all, 'workspace', workspaceId, { status, search }] as const,
};

export const workspacePagesQueryOptions = (workspaceId: string, status?: string, search?: string) =>
  queryOptions({
    queryKey: pageKeys.workspace(workspaceId, status, search),
    queryFn: () => PageService.getWorkspacePages(workspaceId, status, search),
    enabled: !!workspaceId,
  });

export const usePageActions = () => {
  const queryClient = useQueryClient();

  const createPage = useMutation({
    mutationFn: (input: CreatePageInput) => PageService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create page'),
  });

  return { createPage };
};