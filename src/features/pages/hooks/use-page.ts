import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { PageService } from '../services/page.service';
import type { CreatePageInput, PageStatus } from '../types/page.types';
import { toast } from 'sonner';

export const pageKeys = {
  all: ['pages'] as const,
  space: (spaceId: string, status?: string, search?: string) =>
    [...pageKeys.all, 'space', spaceId, { status, search }] as const,
  trash: (spaceId: string) => [...pageKeys.all, 'trash', spaceId] as const,
  detail: (pageId: string) => [...pageKeys.all, 'detail', pageId] as const,
};

export const pagesQueryOptions = (
  spaceId: string,
  status?: string,
  search?: string,
) =>
  queryOptions({
    queryKey: pageKeys.space(spaceId, status, search),
    queryFn: () => PageService.list(spaceId, status, search),
    enabled: Boolean(spaceId),
    staleTime: 30_000,
  });

export const trashPagesQueryOptions = (spaceId: string, enabled = true) =>
  queryOptions({
    queryKey: pageKeys.trash(spaceId),
    queryFn: () => PageService.getTrash(spaceId),
    enabled: Boolean(spaceId) && enabled,
    staleTime: 15_000,
  });

export const usePages = (
  spaceId: string,
  status?: string,
  search?: string,
) => useQuery(pagesQueryOptions(spaceId, status, search));

export const usePageActions = () => {
  const queryClient = useQueryClient();

  const createPage = useMutation({
    mutationFn: (input: CreatePageInput) => PageService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page created', { id: 'page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create page', { id: 'page-action' }),
  });

  const deletePage = useMutation({
    mutationFn: (pageId: string) => PageService.delete(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page moved to trash', { id: 'page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete page', { id: 'page-action' }),
  });

  const restorePage = useMutation({
    mutationFn: (pageId: string) => PageService.restore(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page restored', { id: 'page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to restore page', { id: 'page-action' }),
  });

  const purgePage = useMutation({
    mutationFn: (pageId: string) => PageService.purge(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page permanently deleted', { id: 'page-action' });
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to permanently delete page', { id: 'page-action' }),
  });

  const duplicatePage = useMutation({
    mutationFn: (pageId: string) => PageService.duplicate(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page duplicated', { id: 'page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to duplicate page', { id: 'page-action' }),
  });

  const updateTitle = useMutation({
    mutationFn: ({ pageId, title }: { pageId: string; title: string }) =>
      PageService.update(pageId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Title updated', { id: 'page-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update title', { id: 'page-action' }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ pageId, status }: { pageId: string; status: PageStatus }) =>
      PageService.update(pageId, { status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success(variables.status === 'archived' ? 'Page archived' : 'Page restored', {
        id: 'page-action',
      });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update page status', { id: 'page-action' }),
  });

  const savePage = useMutation({
    mutationFn: async ({
      pageId,
      spaceId,
      title,
      status,
      description,
      labelIds,
    }: {
      pageId: string;
      spaceId?: string;
      title: string;
      status: PageStatus;
      description: string;
      labelIds?: string[];
    }) => {
      const updated = await PageService.update(pageId, { title, status, description });
      if (spaceId && labelIds) {
        await PageService.replaceLabels(spaceId, pageId, labelIds);
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Page updated', { id: 'page-action' });
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update page', { id: 'page-action' }),
  });

  return {
    createPage,
    deletePage,
    restorePage,
    purgePage,
    duplicatePage,
    updateTitle,
    updateStatus,
    savePage,
  };
};
