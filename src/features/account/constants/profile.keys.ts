/**
 * profile.keys.ts
 * Query keys colocated with Account/Profile feature.
 */
export const profileKeys = {
  all: ['profile'] as const,
  current: () => [...profileKeys.all, 'current'] as const,
};
