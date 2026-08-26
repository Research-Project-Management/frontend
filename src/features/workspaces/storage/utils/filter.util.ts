import type { StorageItem } from '../types/storage.types';
import { getFileType } from './file';
import type { StorageFilterOptions, StorageTypeFilter } from '../types/filter.types';

function matchSingleType(item: StorageItem, type: StorageTypeFilter): boolean {
  if (type === 'all') return true;
  if (type === 'folder') return Boolean(item.isFolder);
  if (item.isFolder) return false;

  const ext = item.filename?.split('.').pop()?.toLowerCase() || '';
  const itemType = getFileType(item);

  switch (type) {
    case 'document':
      return (
        itemType === 'document' ||
        ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md'].includes(ext)
      );
    case 'spreadsheet':
      return ['xls', 'xlsx', 'csv', 'tsv', 'numbers'].includes(ext);
    case 'image':
      return itemType === 'image';
    case 'video':
      return itemType === 'video';
    case 'audio':
      return itemType === 'audio';
    case 'archive':
      return itemType === 'archive' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
    default:
      return true;
  }
}

function matchSingleProject(item: StorageItem, projectId: string): boolean {
  if (projectId === 'all') return true;
  if (projectId === 'workspace-only') {
    return (
      !item.linkedTo?.entityId &&
      item.linkedTo?.entityType !== 'Project' &&
      !item.project?.id &&
      !item.metaData?.projectId
    );
  }
  return (
    item.linkedTo?.entityId === projectId ||
    item.project?.id === projectId ||
    item.metaData?.projectId === projectId
  );
}

export function applyStorageFilters(
  items: StorageItem[] = [],
  options: StorageFilterOptions = {}
): StorageItem[] {
  let result = [...items];

  // 1. Search Query
  if (options.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter((item) =>
      item.filename?.toLowerCase().includes(q)
    );
  }

  // 2. Type Filter (Support multi-select or single-select)
  const types = options.selectedTypes && options.selectedTypes.length > 0
    ? options.selectedTypes
    : options.typeFilter && options.typeFilter !== 'all'
    ? [options.typeFilter]
    : [];

  if (types.length > 0) {
    result = result.filter((item) =>
      types.some((t) => matchSingleType(item, t))
    );
  }

  // 3. Project Filter (Support multi-select or single-select)
  const projects = options.selectedProjects && options.selectedProjects.length > 0
    ? options.selectedProjects
    : options.projectFilter && options.projectFilter !== 'all'
    ? [options.projectFilter]
    : [];

  if (projects.length > 0) {
    result = result.filter((item) =>
      projects.some((pId) => matchSingleProject(item, pId))
    );
  }

  // 4. Sorting
  const sortBy = options.sortBy || 'date-desc';
  result.sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return (a.filename || '').localeCompare(b.filename || '');
      case 'name-desc':
        return (b.filename || '').localeCompare(a.filename || '');
      case 'date-desc':
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      case 'date-asc':
        return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      case 'size-desc':
        return (b.size || 0) - (a.size || 0);
      case 'size-asc':
        return (a.size || 0) - (b.size || 0);
      default:
        return 0;
    }
  });

  return result;
}
