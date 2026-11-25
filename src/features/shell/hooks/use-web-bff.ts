'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchWebProjectBootstrap,
  fetchWebWorkspaceShell,
  hydrateProjectBootstrapCache,
  hydrateWorkspaceShellCache,
  webBffKeys,
} from '../services/web-bff.client';

/**
 * Hydrates the Web workspace shell (projects, your-work, chat unread summary)
 * in a single BFF request and populates downstream TanStack Query caches.
 */
export function useWebWorkspaceShell(enabled = true) {
  return useQuery({
    queryKey: webBffKeys.workspaceShell(),
    enabled,
    staleTime: 20_000,
    queryFn: async ({ signal, client }) => {
      const envelope = await fetchWebWorkspaceShell({ signal });
      hydrateWorkspaceShellCache(client, envelope);
      return envelope;
    },
  });
}

/**
 * Hydrates a Web project screen (overview + shaped chat channels) in a single
 * BFF request and populates the project overview cache.
 */
export function useWebProjectBootstrap(projectId?: string) {
  return useQuery({
    queryKey: webBffKeys.projectBootstrap(projectId || ''),
    enabled: Boolean(projectId),
    staleTime: 15_000,
    queryFn: async ({ signal, client }) => {
      const envelope = await fetchWebProjectBootstrap(projectId!, { signal });
      hydrateProjectBootstrapCache(client, projectId!, envelope);
      return envelope;
    },
  });
}
