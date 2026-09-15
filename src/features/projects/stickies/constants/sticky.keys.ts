/**
 * sticky.keys.ts
 * Query keys colocated with Stickies feature.
 */
export const stickyKeys = {
  all: ['stickies'] as const,
  list: (search?: string, projectId?: string) =>
    [...stickyKeys.all, 'list', { search: search || undefined, projectId: projectId || undefined }] as const,
  detail: (id: string) => [...stickyKeys.all, 'detail', id] as const,
};

