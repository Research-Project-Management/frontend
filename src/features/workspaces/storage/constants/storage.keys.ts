/**
 * storage.keys.ts
 * Query keys colocated with Storage domain.
 */
export const storageKeys = {
  all: ['storage'] as const,
  workspace: (workspaceId: string) => [...storageKeys.all, 'workspace', workspaceId] as const,
  workspaceHomeFiles: (workspaceId: string, parentId?: string | null) =>
    [...storageKeys.workspace(workspaceId), 'home', parentId ?? 'root'] as const,
  workspaceMyFiles: (workspaceId: string) =>
    [...storageKeys.workspace(workspaceId), 'my-files'] as const,
  workspaceShared: (workspaceId: string) =>
    [...storageKeys.workspace(workspaceId), 'shared'] as const,
  workspaceStarred: (workspaceId: string) =>
    [...storageKeys.workspace(workspaceId), 'starred'] as const,
  workspaceTrashed: (workspaceId: string) =>
    [...storageKeys.workspace(workspaceId), 'trashed'] as const,

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
