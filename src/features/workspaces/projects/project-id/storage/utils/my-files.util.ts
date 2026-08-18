import type { StorageItem, BreadcrumbSegment } from '../types/storage.types';

/**
 * Appends or navigates breadcrumb hierarchy in project files.
 */
export function navigateBreadcrumbPath(
  segments: BreadcrumbSegment[],
  targetIndex: number
): BreadcrumbSegment[] {
  return segments.slice(0, targetIndex + 1);
}

/**
 * Pushes a new folder segment into project breadcrumb hierarchy.
 */
export function pushBreadcrumbFolder(
  segments: BreadcrumbSegment[],
  folder: { id: string; name: string }
): BreadcrumbSegment[] {
  return [...segments, { id: folder.id, name: folder.name }];
}

/**
 * Validates whether an item can be dropped/moved into a target folder.
 */
export function canDropIntoFolder(draggedItem: StorageItem | null, targetFolder: StorageItem): boolean {
  if (!draggedItem || !targetFolder.isFolder) return false;
  if (draggedItem.id === targetFolder.id) return false;
  return true;
}
