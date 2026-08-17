import type { StorageItem } from '../types/storage.types';

/**
 * Filters out folders for the Project Home view to show only primary files.
 */
export function filterHomeFiles(files: StorageItem[] = []): StorageItem[] {
  return files.filter((item) => !item.isFolder);
}

/**
 * Returns recently added project storage items sorted by date descending.
 */
export function getRecentHomeFiles(files: StorageItem[] = [], limit: number = 20): StorageItem[] {
  return [...files]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
}
