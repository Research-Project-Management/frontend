/**
 * storage.keys.ts
 * Query keys colocated with Storage domain.
 */
export const storageKeys = {
  all: ['storage'] as const,
  scoped: (scopeId?: string) => [...storageKeys.all, 'scoped', scopeId || 'me'] as const,
  workspaceHomeFiles: (scopeId?: string, parentId?: string | null) =>
    [...storageKeys.scoped(scopeId), 'home', parentId ?? 'root'] as const,
  workspaceFiles: (scopeId?: string, parentId?: string | null) =>
    [...storageKeys.scoped(scopeId), 'files', parentId ?? 'root'] as const,
  workspaceMyFiles: (scopeId?: string) =>
    [...storageKeys.scoped(scopeId), 'my-files'] as const,
  workspaceShared: (scopeId?: string) =>
    [...storageKeys.scoped(scopeId), 'shared'] as const,
  workspaceStarred: (scopeId?: string) =>
    [...storageKeys.scoped(scopeId), 'starred'] as const,
  workspaceTrashed: (scopeId?: string) =>
    [...storageKeys.scoped(scopeId), 'trashed'] as const,
  workspaceUsage: (scopeId?: string) =>
    [...storageKeys.scoped(scopeId), 'usage'] as const,
  quota: (projectId?: string) =>
    [...storageKeys.all, 'quota', projectId || 'me'] as const,

  project: (projectId: string) => [...storageKeys.all, 'project', projectId] as const,
  projectHomeFiles: (projectId: string, parentId?: string | null) =>
    [...storageKeys.project(projectId), 'home', parentId ?? 'root'] as const,
  projectMyFiles: (projectId: string) =>
    [...storageKeys.project(projectId), 'my-files'] as const,
  projectShared: (projectId: string) =>
    [...storageKeys.project(projectId), 'shared'] as const,
  projectStarred: (projectId: string) =>
    [...storageKeys.project(projectId), 'starred'] as const,
  projectTrashed: (projectId: string) =>
    [...storageKeys.project(projectId), 'trashed'] as const,
  projectFilesEditor: (pageId?: string, parentId?: string | null) =>
    [...storageKeys.all, 'project-files-editor', pageId ?? 'root', parentId ?? 'root'] as const,
};
