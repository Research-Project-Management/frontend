import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { PageService } from '../services/page.service';
import type { CreatePageInput } from '../types/page.types';
import { toast } from 'sonner';

export const pageKeys = {
  all: ['pages'] as const,
  project: (
    projectId: string,
    status?: string,
    search?: string,
    forceEmpty?: string,
    forceError?: string,
  ) => [...pageKeys.all, 'project', projectId, { status, search, forceEmpty, forceError }] as const,
  detail: (pageId: string) => [...pageKeys.all, 'detail', pageId] as const,
};

export const projectPagesQueryOptions = (
  projectId: string,
  status?: string,
  search?: string,
  forceEmpty?: string,
  forceError?: string,
) =>
  queryOptions({
    queryKey: pageKeys.project(projectId, status, search, forceEmpty, forceError),
    queryFn: () =>
      PageService.getProjectPages(projectId, status, search, forceEmpty, forceError),
    enabled: !!projectId,
    staleTime: 30_000,
  });

export const useProjectPages = (
  projectId: string,
  status?: string,
  search?: string,
  forceEmpty?: string,
  forceError?: string,
) =>
  useQuery(projectPagesQueryOptions(projectId, status, search, forceEmpty, forceError));

export const usePageActions = () => {
  const queryClient = useQueryClient();

  const createPage = useMutation({
    mutationFn: (input: CreatePageInput) => PageService.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page created', { id: 'project-page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create page', { id: 'project-page-action' }),
  });

  const deletePage = useMutation({
    mutationFn: (pageId: string) => PageService.delete(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page deleted', { id: 'project-page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete page', { id: 'project-page-action' }),
  });

  const duplicatePage = useMutation({
    mutationFn: (pageId: string) => PageService.duplicate(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page duplicated', { id: 'project-page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to duplicate page', { id: 'project-page-action' }),
  });

  const updateTitle = useMutation({
    mutationFn: ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) =>
      PageService.updateTitle(pageId, title, oldTitle),
    onSuccess: (data) => {
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: pageKeys.detail(data.id) });
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Title updated', { id: 'project-page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update title', { id: 'project-page-action' }),
  });

  return { createPage, deletePage, duplicatePage, updateTitle };
};
