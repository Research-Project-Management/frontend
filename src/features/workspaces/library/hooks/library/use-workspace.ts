'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiGet } from '@/shared/lib/api';

export interface LibraryWorkspace {
  id: string;
  name: string;
  slug?: string;
  [key: string]: any;
}

export function useWorkspace(explicitWorkspaceId?: string) {
  const params = useParams<{ workspaceId?: string }>();
  const rawId = explicitWorkspaceId || params?.workspaceId || '';

  const { data, isLoading } = useQuery({
    queryKey: ['library', 'workspace', rawId],
    queryFn: async () => {
      if (!rawId) return null;
      try {
        const res = await apiGet<any>(`/api/v1/workspaces/${encodeURIComponent(rawId)}`);
        return (res?.workspace || res?.data?.workspace || (res?.id ? res : null)) as LibraryWorkspace | null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(rawId),
    staleTime: 5 * 60 * 1000,
  });

  const workspaceId = data?.id || rawId;

  const state = {
    workspace: data,
    workspaceId,
    isLoading,
  };

  return {
    state,
    actions: {},
    ...state,
  };
}

export const useLibraryWorkspace = useWorkspace;
