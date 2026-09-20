/**
 * sticky.keys.ts
 * Query keys colocated with Stickies feature.
 */
export const stickyKeys = {
  all: ['stickies'] as const,
  list: () => [...stickyKeys.all, 'list'] as const,
  detail: (id: string) => [...stickyKeys.all, 'detail', id] as const,
};

