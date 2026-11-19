/**
 * storage.keys.ts
 * Query keys colocated with Storage domain.
 */
export const storageKeys = {
  all: ['storage'] as const,
  scoped: (spaceId?: string | null) =>
    [...storageKeys.all, 'scoped', spaceId || 'me'] as const,
  section: (
    spaceId: string | null | undefined,
    section: string,
    parentId: string | null,
    params?: unknown,
  ) =>
    [
      ...storageKeys.all,
      'section',
      spaceId ?? 'personal',
      section,
      parentId,
      params,
    ] as const,
  folderPath: (folderId: string | null) =>
    [...storageKeys.all, 'folder-path', folderId] as const,
  versions: (fileId: string | null) =>
    [...storageKeys.all, 'versions', fileId] as const,
  moveFolders: (spaceId: string | null, folderId: string | null) =>
    [...storageKeys.all, 'move-modal-folders', spaceId, folderId] as const,
};
