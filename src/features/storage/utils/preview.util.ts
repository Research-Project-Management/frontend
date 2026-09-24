import type { StorageItem } from '../types/storage.types';
import { formatFileSize, formatDate } from './file';

/**
 * Formats full byte count for Google Drive style details (e.g. "2.4 MB (2,541,200 bytes)").
 */
export function formatDetailedSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) {
    return '—';
  }
  const formatted = formatFileSize(bytes);
  const localeBytes = bytes.toLocaleString();
  return `${formatted} (${localeBytes} bytes)`;
}

/**
 * Resolves Google Drive style location string (e.g. "My Files / Datasets" or "Project Root").
 */
export function formatFileLocation(item?: StorageItem | null, projectName?: string): string {
  if (!item) return '—';
  if (projectName) {
    return `${projectName}${item.parent ? ` / ${item.parent}` : ''}`;
  }
  return item.parent ? `My Files / ${item.parent}` : 'My Files (Root)';
}

/**
 * Formats date and time in standard locale format for Google Drive file details.
 */
export function formatDetailedDate(dateString?: string | Date | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
