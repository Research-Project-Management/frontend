import type { StorageItem } from '../types/storage.types';

const DEFAULT_PURGE_DAYS = 30;

/**
 * Filters items that are in trash.
 */
export function filterTrashFiles(files: StorageItem[] = []): StorageItem[] {
  return files;
}

/**
 * Calculates remaining days before an item in trash is permanently purged.
 */
export function getDaysUntilPurge(dateString: string, maxDays: number = DEFAULT_PURGE_DAYS): number {
  if (!dateString) return maxDays;
  const deleted = new Date(dateString).getTime();
  const now = Date.now();
  const elapsedDays = (now - deleted) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(maxDays - elapsedDays));
}

/**
 * Returns whether an item in trash has exceeded the purge window.
 */
export function isTrashItemExpired(dateString: string, maxDays: number = DEFAULT_PURGE_DAYS): boolean {
  return getDaysUntilPurge(dateString, maxDays) <= 0;
}
