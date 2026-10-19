/**
 * storage.keys.ts
 * Query keys colocated with Storage domain.
 */
export const storageKeys = {
  all: ['storage'] as const,
  scoped: (scopeId?: string | null) =>
    [...storageKeys.all, 'scoped', scopeId || 'me'] as const,
  section: (
    scopeId: string | null | undefined,
    section: string,
    parentId: string | null,
    params?: unknown,
  ) =>
    [
      ...storageKeys.all,
      'section',
      scopeId ?? 'personal',
      section,
      parentId,
      params,
    ] as const,
  folderPath: (folderId: string | null) =>
    [...storageKeys.all, 'folder-path', folderId] as const,
  versions: (fileId: string | null) =>
    [...storageKeys.all, 'versions', fileId] as const,
  moveFolders: (scopeId: string | null, folderId: string | null) =>
    [...storageKeys.all, 'move-modal-folders', scopeId, folderId] as const,
};
