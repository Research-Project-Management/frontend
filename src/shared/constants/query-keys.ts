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
    
    // Project storage keys
    projectFiles: (projectId?: string, parentId?: string | null) => 
      projectId ? (parentId ? ['storage', 'project-files', projectId, parentId] as const : ['storage', 'project-files', projectId] as const) : ['storage', 'project-files'] as const,
    projectMyFiles: (projectId?: string) => projectId ? ['storage', 'project-my-files', projectId] as const : ['storage', 'project-my-files'] as const,
    projectStarred: (projectId?: string) => projectId ? ['storage', 'project-starred-files', projectId] as const : ['storage', 'project-starred-files'] as const,
    projectShared: (projectId?: string) => projectId ? ['storage', 'project-shared-files', projectId] as const : ['storage', 'project-shared-files'] as const,
    projectTrashed: (projectId?: string) => projectId ? ['storage', 'project-trashed-files', projectId] as const : ['storage', 'project-trashed-files'] as const,
    
    workspaceHome: (workspaceId?: string) => workspaceId ? ['storage', 'workspace-home', workspaceId] as const : ['storage', 'workspace-home'] as const,
    workspaceHomeFiles: (workspaceId?: string, parentId?: string | null) => workspaceId ? (parentId ? ['storage', 'workspace-home-files', workspaceId, parentId] as const : ['storage', 'workspace-home-files', workspaceId] as const) : ['storage', 'workspace-home-files'] as const,
    workspaceMyFiles: (workspaceId?: string) => workspaceId ? ['storage', 'workspace-my-files', workspaceId] as const : ['storage', 'workspace-my-files'] as const,
    workspaceStarred: (workspaceId?: string) => workspaceId ? ['storage', 'workspace-starred-files', workspaceId] as const : ['storage', 'workspace-starred-files'] as const,
    workspaceShared: (workspaceId?: string) => workspaceId ? ['storage', 'workspace-shared-files', workspaceId] as const : ['storage', 'workspace-shared-files'] as const,
    workspaceTrashed: (workspaceId?: string) => workspaceId ? ['storage', 'workspace-trashed-files', workspaceId] as const : ['storage', 'workspace-trashed-files'] as const,
    
    // Editor specific storage keys
    projectFilesEditor: (pageId?: string, parentId?: string | null) => 
      pageId ? (parentId ? ['storage', 'project-files-editor', pageId, parentId] as const : ['storage', 'project-files-editor', pageId] as const) : ['storage', 'project-files-editor'] as const,
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
