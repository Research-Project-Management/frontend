'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DraftService } from '../services/draft.service';
import type { CreateTaskInput } from '../types/work-item.types';

export const draftKeys = {
  all: ['drafts'] as const,
  project: (projectId?: string) => ['drafts', projectId || 'global'] as const,
  detail: (id: string) => ['draft', id] as const,
};

export const useDraftsQuery = (projectId?: string) =>
  useQuery({
    queryKey: draftKeys.project(projectId),
    queryFn: () => DraftService.getDrafts(projectId),
  });

export const useCreateDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateTaskInput> & { projectId: string }) =>
      DraftService.createDraft(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('Draft saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save draft'),
  });
};

export const useUpdateDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTaskInput> }) =>
      DraftService.updateDraft(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update draft'),
  });
};

export const usePublishDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, columnId }: { id: string; columnId?: string }) =>
      DraftService.publishDraft(id, { columnId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Draft published to project');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to publish draft'),
  });
};

export const useDeleteDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DraftService.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('Draft deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete draft'),
  });
};

export const useWorkItemDraftNotification = () => {
  const notifyDiscard = useCallback(() => {
    toast.info('Work item creation discarded');
  }, []);
  const notifyCleared = useCallback(() => {
    toast.info('Draft cleared');
  }, []);
  return { notifyDiscard, notifyCleared };
};
