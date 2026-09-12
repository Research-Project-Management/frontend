import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DraftService } from '../services/draft.service';
import type {
  DraftQueryFilter,
  CreateDraftInput,
  UpdateDraftInput,
  PublishDraftInput,
} from '../types/draft.types';

export const draftKeys = {
  all: ['drafts'] as const,
  lists: () => [...draftKeys.all, 'list'] as const,
  list: (filter?: DraftQueryFilter) => [...draftKeys.lists(), filter] as const,
  details: () => [...draftKeys.all, 'detail'] as const,
  detail: (id: string) => [...draftKeys.details(), id] as const,
};

export const useDrafts = (filter?: DraftQueryFilter) => {
  return useQuery({
    queryKey: draftKeys.list(filter),
    queryFn: () => DraftService.getMyDrafts(filter),
    staleTime: 30_000,
  });
};

export const useDraft = (id?: string) => {
  return useQuery({
    queryKey: id ? draftKeys.detail(id) : draftKeys.details(),
    queryFn: () => (id ? DraftService.getDraft(id) : Promise.reject(new Error('No ID provided'))),
    enabled: Boolean(id),
  });
};

export const useCreateDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDraftInput) => DraftService.createDraft(input),
    onSuccess: () => {
      toast.success('Draft saved');
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save draft');
    },
  });
};

export const useUpdateDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDraftInput }) =>
      DraftService.updateDraft(id, input),
    onSuccess: (_, { id }) => {
      toast.success('Draft updated');
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
      queryClient.invalidateQueries({ queryKey: draftKeys.detail(id) });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update draft');
    },
  });
};

export const useDuplicateDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => DraftService.duplicateDraft(id),
    onSuccess: (data) => {
      toast.success(`Created copy: ${data.title}`);
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to duplicate draft');
    },
  });
};

export const usePublishDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PublishDraftInput }) =>
      DraftService.publishDraft(id, input),
    onSuccess: (data) => {
      const taskIdentifier =
        data?.task?.identifier || (data?.task?.id ? `#${data.task.id.slice(0, 6)}` : 'Work item');
      toast.success(`Published as ${taskIdentifier}`);
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to move draft to project');
    },
  });
};

export const useDeleteDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => DraftService.deleteDraft(id),
    onSuccess: () => {
      toast.success('Draft deleted');
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete draft');
    },
  });
};
