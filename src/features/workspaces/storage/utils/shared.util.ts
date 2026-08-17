import type { StorageItem, SharedPermission } from '../types/storage.types';

/**
 * Filters items that are explicitly shared with other team members or with the current user.
 */
export function filterSharedFiles(files: StorageItem[] = []): StorageItem[] {
  return files.filter((item) => Boolean(item.sharedWith && item.sharedWith.length > 0));
}

/**
 * Returns permission level for a given user on a storage item.
 */
export function getSharedPermission(item: StorageItem, userId?: string): SharedPermission | null {
  if (!userId || !item.sharedWith) return null;
  const match = item.sharedWith.find((s) => s.user === userId);
  return match?.permission ?? null;
}

/**
 * Returns formatted string representing number of shared collaborators.
 */
export function formatSharedCollaboratorsCount(item: StorageItem): string {
  const count = item.sharedWith?.length ?? 0;
  if (count === 0) return 'Private';
  if (count === 1) return 'Shared with 1 person';
  return `Shared with ${count} people`;
}
