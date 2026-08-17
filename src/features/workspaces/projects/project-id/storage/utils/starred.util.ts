import type { StorageItem, StarredSortBy } from '../types/storage.types';

/**
 * Filters items that have been starred by the user within the project.
 */
export function filterStarredFiles(files: StorageItem[] = []): StorageItem[] {
  return files.filter((item) => Boolean(item.starred));
}

/**
 * Sorts starred project items by selected criterion.
 */
export function sortStarredFiles(
  files: StorageItem[] = [],
  sortBy: StarredSortBy = 'name'
): StorageItem[] {
  const cloned = [...files];
  switch (sortBy) {
    case 'date':
      return cloned.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    case 'size':
      return cloned.sort((a, b) => (b.size || 0) - (a.size || 0));
    case 'type':
      return cloned.sort((a, b) => (a.mimeType || '').localeCompare(b.mimeType || ''));
    case 'name':
    default:
      return cloned.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
  }
}
