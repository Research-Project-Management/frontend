import React from 'react';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Video,
  Music,
  Archive,
  Image as ImageIcon,
  File as FileIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatBytes } from '@/shared/utils/format';
import type { FileType, StorageItem } from '../types/storage.types';

const SCIENTIFIC_TEXT_EXTENSIONS = new Set([
  'csv',
  'tsv',
  'json',
  'jsonl',
  'md',
  'markdown',
  'ipynb',
  'tex',
  'bib',
  'py',
  'r',
  'sql',
  'yaml',
  'yml',
  'txt',
  'log',
]);

export function isScientificTextFile(filename?: string): boolean {
  if (!filename) return false;
  const parts = filename.split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop()?.toLowerCase() || '';
  return SCIENTIFIC_TEXT_EXTENSIONS.has(ext);
}

export function getFileType(item: Pick<StorageItem, 'filename' | 'mimeType' | 'isFolder'>): FileType {
  if (item.isFolder) return 'folder';

  const mimeType = item.mimeType || '';
  if (mimeType.startsWith('image/')) return 'image';

  const ext = item.filename?.split('.').pop()?.toLowerCase() || '';
  if (
    [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'svg',
      'bmp',
      'ico',
      'heic',
      'heif',
      'avif',
    ].includes(ext)
  ) {
    return 'image';
  }
  if (['csv', 'tsv', 'xls', 'xlsx', 'ods'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return 'spreadsheet';
  }
  if (
    [
      'pdf',
      'doc',
      'docx',
      'txt',
      'rtf',
      'odt',
      'tex',
      'bib',
      'cls',
      'sty',
    ].includes(ext)
  ) {
    return 'document';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext)) {
    return 'audio';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(ext)) {
    return 'archive';
  }

  return 'other';
}

const ICON_SIZE_CLASSES: Record<number, string> = {
  3.5: 'size-3.5',
  4: 'size-4',
  5: 'size-5',
  6: 'size-6',
  8: 'size-8',
  10: 'size-10',
  12: 'size-12',
};

export function getFileIcon(type: FileType, size: number = 4) {
  const className = ICON_SIZE_CLASSES[size] || 'size-4';
  switch (type) {
    case 'folder':
      return <Folder className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
    case 'document':
      return <FileText className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
    case 'image':
      return <ImageIcon className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
    case 'video':
      return <Video className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
    case 'audio':
      return <Music className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
    case 'archive':
      return <Archive className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
    default:
      return <FileIcon className={cn('shrink-0 text-foreground', className)} strokeWidth={1.5} />;
  }
}

export function getFileColor(_type: FileType): string {
  return 'currentColor';
}

export function getFileColorClass(_type: FileType): string {
  return 'text-foreground';
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '-';
  return formatBytes(bytes);
}

export function formatMimeType(item: StorageItem): string {
  if (item.isFolder) return 'Folder';
  const ext = item.filename?.split('.').pop()?.toUpperCase();
  if (ext) {
    if (ext === 'PDF') return 'PDF Document';
    if (ext === 'DOCX' || ext === 'DOC') return 'Word Document';
    if (ext === 'XLSX' || ext === 'XLS') return 'Excel Spreadsheet';
    if (ext === 'CSV' || ext === 'TSV' || ext === 'ODS') return 'Spreadsheet';
    if (ext === 'PPTX' || ext === 'PPT') return 'PowerPoint Presentation';
    if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(ext)) return `${ext} Image`;
    if (['MP4', 'MOV', 'AVI', 'MKV'].includes(ext)) return `${ext} Video`;
    if (['MP3', 'WAV', 'OGG'].includes(ext)) return `${ext} Audio`;
    if (['ZIP', 'RAR', 'TAR', 'GZ', '7Z'].includes(ext)) return `${ext} Archive`;
    return `${ext} File`;
  }
  return item.mimeType || 'Unknown';
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return date.toLocaleDateString('en-US');

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString('en-US');
}

// ============================================================================
// PREVIEW FORMATTING UTILITIES
// ============================================================================

export function formatDetailedSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) {
    return '-';
  }
  const formatted = formatFileSize(bytes);
  const localeBytes = bytes.toLocaleString('en-US');
  return `${formatted} (${localeBytes} bytes)`;
}

export function formatFileLocation(
  item?: StorageItem | null,
  projectName?: string,
  parentName?: string,
): string {
  if (!item) return '-';
  if (projectName) {
    return `${projectName}${parentName ? ` / ${parentName}` : ''}`;
  }
  return parentName ? `My Files / ${parentName}` : 'My Files (Root)';
}

export function formatDetailedDate(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

// ============================================================================
// DRAG-AND-DROP UTILITIES
// ============================================================================

export function createFolderDropHandlers(
  folder: StorageItem,
  isReadOnly?: boolean,
  onDropOnFolder?: (folder: StorageItem, e: React.DragEvent) => void,
  setDragOverFolderId?: (id: string | null) => void,
) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!isReadOnly && folder.isFolder && onDropOnFolder) {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId?.(folder.id);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (isReadOnly) return;
      e.stopPropagation();
      setDragOverFolderId?.(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!isReadOnly && folder.isFolder && onDropOnFolder) {
        setDragOverFolderId?.(null);
        onDropOnFolder(folder, e);
      }
    },
  };
}

export function canDropIntoFolder(
  draggedItem: StorageItem | null,
  targetFolder: StorageItem,
): boolean {
  if (!draggedItem || !targetFolder.isFolder) return false;
  if (draggedItem.id === targetFolder.id) return false;
  return true;
}
