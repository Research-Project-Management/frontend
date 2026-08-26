import type { StorageItem } from '../types/storage.types';
import { getFileType } from './file';
import type { StorageTypeFilter, StorageSortBy, StorageProjectFilter } from '../store/use-filter-store';

export function applyStorageFilters(
  items: StorageItem[] = [],
  options: {
    typeFilter?: StorageTypeFilter;
    projectFilter?: StorageProjectFilter;
    sortBy?: StorageSortBy;
    searchQuery?: string;
  } = {}
): StorageItem[] {
  let result = [...items];

  // 1. Search Query
  if (options.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter((item) =>
      item.filename?.toLowerCase().includes(q)
    );
  }

  // 2. Type Filter
  if (options.typeFilter && options.typeFilter !== 'all') {
    result = result.filter((item) => {
      if (options.typeFilter === 'folder') return item.isFolder;
      if (item.isFolder) return false;

      const ext = item.filename?.split('.').pop()?.toLowerCase() || '';
      const type = getFileType(item);

      switch (options.typeFilter) {
        case 'document':
          return (
            type === 'document' ||
            ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md'].includes(ext)
          );
        case 'spreadsheet':
          return ['xls', 'xlsx', 'csv', 'tsv', 'numbers'].includes(ext);
        case 'image':
          return type === 'image';
        case 'video':
          return type === 'video';
        case 'audio':
          return type === 'audio';
        case 'archive':
          return type === 'archive' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
        default:
          return true;
      }
    });
  }

  // 3. Project Filter
  if (options.projectFilter && options.projectFilter !== 'all') {
    if (options.projectFilter === 'workspace-only') {
      result = result.filter(
        (item) =>
          !item.linkedTo?.entityId &&
          item.linkedTo?.entityType !== 'Project' &&
          !item.project?.id &&
          !item.metaData?.projectId
      );
    } else {
      const pId = options.projectFilter;
      result = result.filter(
        (item) =>
          item.linkedTo?.entityId === pId ||
          item.project?.id === pId ||
          item.metaData?.projectId === pId
      );
    }
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
