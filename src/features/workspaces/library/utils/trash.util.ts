import type { Paper } from '../types/library.types';

const TRASH_RETENTION_DAYS = 30;

/**
 * Calculates remaining days before a trashed item is automatically purged.
 */
export function getDaysUntilPurge(deletedAt?: string | null): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const deletedTime = new Date(deletedAt).getTime();
  const now = Date.now();
  const elapsedDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, TRASH_RETENTION_DAYS - elapsedDays);
}

/**
 * Checks if a trashed paper has exceeded the 30-day retention window.
 */
export function isExpiredTrash(deletedAt?: string | null): boolean {
  return getDaysUntilPurge(deletedAt) === 0;
}

/**
 * Filters items marked as in trash.
 */
export function filterTrashPapers(papers: Paper[]): Paper[] {
  return papers.filter((p) => Boolean(p.deletedAt || (p as any).isTrash || (p as any).isInTrash));
}
