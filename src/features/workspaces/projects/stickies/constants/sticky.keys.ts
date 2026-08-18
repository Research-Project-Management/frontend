/**
 * sticky.keys.ts
 * Query keys colocated with Stickies feature.
 */
export const stickyKeys = {
  all: ['stickies'] as const,
  workspaceList: (workspaceId: string, search?: string, projectId?: string) =>
    [...stickyKeys.all, 'list', { workspaceId, search, projectId }] as const,
  detail: (id: string) => [...stickyKeys.all, 'detail', id] as const,
};
