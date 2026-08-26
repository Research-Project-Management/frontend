'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import { toast } from 'sonner';

export interface LibraryNote {
  id: string;
  workspaceId: string;
  itemId?: string | null;
  title: string;
  contentJson?: any;
  contentMd: string;
  tags: string[];
  version: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export const noteKeys = {
  all: ['notes'] as const,
  byWorkspace: (workspaceId: string, itemId?: string) =>
    [...noteKeys.all, workspaceId, itemId] as const,
  detail: (workspaceId: string, noteId: string) =>
    [...noteKeys.all, workspaceId, 'detail', noteId] as const,
};

export function useNotes(workspaceId: string, itemId?: string) {
  const queryClient = useQueryClient();
  const queryKey = noteKeys.byWorkspace(workspaceId, itemId);

  const notesQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<LibraryNote[]> => {
      const itemQuery = itemId ? `?itemId=${encodeURIComponent(itemId)}` : '';
      const res = await apiGet<{ success: boolean; data: LibraryNote[] }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes${itemQuery}`,
      );
      return res.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      itemId?: string | null;
      title?: string;
      contentJson?: any;
      contentMd?: string;
      tags?: string[];
    }) => {
      return apiPost<{ success: boolean; data: LibraryNote }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes`,
        payload,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success('Note created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      expectedVersion,
      ...patch
    }: {
      id: string;
      expectedVersion: number;
      title?: string;
      contentJson?: any;
      contentMd?: string;
      tags?: string[];
    }) => {
      return apiPatch<{ success: boolean; data: LibraryNote }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${id}`,
        { ...patch, expectedVersion },
        { headers: { 'If-Match': `"${expectedVersion}"` } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success('Note updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, expectedVersion }: { id: string; expectedVersion?: number }) => {
      const headers = expectedVersion ? { 'If-Match': `"${expectedVersion}"` } : undefined;
      return apiDelete<{ success: boolean; data: { deleted: boolean } }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${id}`,
        { headers },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success('Note deleted');
    },
  });

  return {
    notes: notesQuery.data || [],
    isLoading: notesQuery.isLoading,
    createNote: createMutation.mutateAsync,
    updateNote: updateMutation.mutateAsync,
    deleteNote: deleteMutation.mutateAsync,
  };
}
