import type { StorageItem } from '../types/storage.types';

/**
 * Returns all storage items (including folders and files) for the Home view,
 * sorting folders first then by most recently updated.
 */
export function filterHomeFiles(files: StorageItem[] = []): StorageItem[] {
  return [...files].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  });
}

/**
 * Returns recently added or accessed storage items sorted by date descending.
 */
export function getRecentHomeFiles(files: StorageItem[] = [], limit: number = 20): StorageItem[] {
  return [...files]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
}
