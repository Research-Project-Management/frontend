/**
 * sticky.keys.ts
 * Query keys colocated with Stickies feature.
 */
export const stickyKeys = {
  all: ['stickies'] as const,
  list: (search?: string) => [...stickyKeys.all, 'list', { search }] as const,
  workspaceList: (_workspaceId?: string, search?: string, _projectId?: string) =>
    [...stickyKeys.all, 'list', { search }] as const,
  detail: (id: string) => [...stickyKeys.all, 'detail', id] as const,
};
