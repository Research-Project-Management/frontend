import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { PageService } from '../services/page.service';
import type { CreatePageInput } from '../types/page.types';
import { toast } from 'sonner';

export const pageKeys = {
  all: ['pages'] as const,
  project: (projectId: string, status?: string, search?: string) =>
    [...pageKeys.all, 'project', projectId, { status, search }] as const,
  detail: (pageId: string) => [...pageKeys.all, 'detail', pageId] as const,
};

export const projectPagesQueryOptions = (projectId: string, status?: string, search?: string) =>
  queryOptions({
    queryKey: pageKeys.project(projectId, status, search),
    queryFn: () => PageService.getProjectPages(projectId, status, search),
    enabled: !!projectId,
  });

export const usePageActions = () => {
  const queryClient = useQueryClient();

  const createPage = useMutation({
    mutationFn: (input: CreatePageInput) => PageService.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create page'),
  });

  const deletePage = useMutation({
    mutationFn: (pageId: string) => PageService.delete(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete page'),
  });

  const updateTitle = useMutation({
    mutationFn: ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) =>
      PageService.updateTitle(pageId, title, oldTitle),
    onSuccess: (data) => {
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: pageKeys.detail(data.id) });
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Title updated');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update title'),
  });

  return { createPage, deletePage, updateTitle };
};
