/**
 * workspace.keys.ts
 * Query keys colocated with Workspace domain.
 */
export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...workspaceKeys.lists(), filters] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (idOrUrl: string) => [...workspaceKeys.details(), idOrUrl] as const,
  members: (workspaceId: string) => [...workspaceKeys.detail(workspaceId), 'members'] as const,
};
