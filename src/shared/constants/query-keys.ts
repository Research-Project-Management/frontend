/**
 * query-keys.ts
 *
 * Centralized Query Key factory for TanStack React Query v5.
 * All keys are defined as const tuples to enable type-safe cache invalidation.
 *
 * Convention:
 *   - Root key = feature name
 *   - Use factory functions for parameterized keys (list filters, detail IDs)
 *
 * Usage:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
 *   useQuery({ queryKey: queryKeys.tasks.detail(taskId), ... })
 */
export const queryKeys = {
  // ──────────────── Auth ────────────────
  auth: {
    all: ['auth'] as const,
    session: ['auth', 'session'] as const,
    profile: ['auth', 'profile'] as const,
  },

  // ──────────────── Workspaces ────────────────
  workspaces: {
    all: ['workspaces'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['workspaces', 'list', filters] as const,
    detail: (id: string) => ['workspaces', 'detail', id] as const,
    members: (workspaceId: string) =>
      ['workspaces', 'detail', workspaceId, 'members'] as const,
  },

  // ──────────────── Projects ────────────────
  projects: {
    all: ['projects'] as const,
    list: (workspaceId: string, filters?: Record<string, unknown>) =>
      ['projects', workspaceId, 'list', filters] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
    members: (projectId: string) =>
      ['projects', 'detail', projectId, 'members'] as const,
  },

  // ──────────────── Tasks ────────────────
  tasks: {
    all: ['tasks'] as const,
    list: (projectId: string, filters?: Record<string, unknown>) =>
      ['tasks', projectId, 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },

  // ──────────────── Cycles ────────────────
  cycles: {
    all: ['cycles'] as const,
    list: (projectId: string) => ['cycles', projectId, 'list'] as const,
    detail: (id: string) => ['cycles', 'detail', id] as const,
    tasks: (cycleId: string) => ['cycles', 'detail', cycleId, 'tasks'] as const,
  },

  // ──────────────── Pages ────────────────
  pages: {
    all: ['pages'] as const,
    list: (projectId: string) => ['pages', projectId, 'list'] as const,
    detail: (id: string) => ['pages', 'detail', id] as const,
  },

  // ──────────────── Comments ────────────────
  comments: {
    all: ['comments'] as const,
    list: (entityId: string, entityType: string) =>
      ['comments', entityType, entityId, 'list'] as const,
  },

  // ──────────────── Labels ────────────────
  labels: {
    all: ['labels'] as const,
    list: (workspaceId: string) => ['labels', workspaceId, 'list'] as const,
  },

  // ──────────────── Storage ────────────────
  storage: {
    all: ['storage'] as const,
    list: (workspaceId: string, filters?: Record<string, unknown>) =>
      ['storage', workspaceId, 'list', filters] as const,
    detail: (id: string) => ['storage', 'detail', id] as const,
  },

  // ──────────────── Library ────────────────
  library: {
    all: ['library'] as const,
    list: (workspaceId: string, filters?: Record<string, unknown>) =>
      ['library', workspaceId, 'list', filters] as const,
    detail: (id: string) => ['library', 'detail', id] as const,
  },

  // ──────────────── Stickies ────────────────
  stickies: {
    all: ['stickies'] as const,
    list: (workspaceId: string) => ['stickies', workspaceId, 'list'] as const,
    detail: (id: string) => ['stickies', 'detail', id] as const,
  },

  // ──────────────── Profile / Settings ────────────────
  profile: {
    all: ['profile'] as const,
    me: ['profile', 'me'] as const,
    settings: ['profile', 'settings'] as const,
  },

  // ──────────────── Chat AI ────────────────
  chatAi: {
    all: ['chat-ai'] as const,
    sessions: (workspaceId: string) =>
      ['chat-ai', workspaceId, 'sessions'] as const,
    messages: (sessionId: string) =>
      ['chat-ai', 'sessions', sessionId, 'messages'] as const,
  },
} as const;
