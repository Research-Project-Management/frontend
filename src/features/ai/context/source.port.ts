import {
  File,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { MessageAttachment } from '../types/message';

export type SourceType = 'upload' | 'library' | 'storage' | 'paper';
export type ContextTab = 'library' | 'storage' | 'uploaded';

export interface SourceEntry {
  id: string;
  name: string;
  enabled: boolean;
  size?: number;
  sourceType: SourceType;
}

export interface UploadingFile {
  id: string;
  name: string;
  size?: number;
  progress: number;
  stage: 'uploading' | 'processing';
}

export interface SourceAdapter<TItem = unknown> {
  readonly type: SourceType;
  toSourceEntry(item: TItem): SourceEntry | null;
}

export const ACCEPTED_FILE_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

export function formatBytes(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const SHEET_EXTS = new Set(['xls', 'xlsx', 'csv', 'tsv']);
const CODE_EXTS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'py',
  'java',
  'cpp',
  'c',
  'go',
  'rs',
  'md',
  'txt',
]);

export interface FileCategoryMeta {
  typeLabel: string;
  sizeText: string;
  icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
}

export function getFileCategoryMeta(
  name: string,
  sourceType?: string,
  size?: number,
): FileCategoryMeta {
  const parts = (name || '').split('.');
  const ext = (parts.length > 1 ? parts.pop() || '' : '').toLowerCase();
  const extLabel = ext ? ext.toUpperCase() : 'FILE';
  const sizeText = size ? formatBytes(size) : '';

  if (ext === 'pdf') {
    return {
      typeLabel: 'PDF',
      sizeText,
      icon: FileText,
      iconClassName: 'text-destructive',
      badgeClassName: 'text-destructive bg-destructive/10 border-destructive/20',
    };
  }
  if (IMAGE_EXTS.has(ext)) {
    return {
      typeLabel: extLabel,
      sizeText,
      icon: FileImage,
      iconClassName: 'text-primary',
      badgeClassName: 'text-primary bg-primary/10 border-primary/20',
    };
  }
  if (SHEET_EXTS.has(ext)) {
    return {
      typeLabel: 'Spreadsheet',
      sizeText,
      icon: FileSpreadsheet,
      iconClassName: 'text-success',
      badgeClassName: 'text-success bg-success/10 border-success/20',
    };
  }
  if (CODE_EXTS.has(ext)) {
    return {
      typeLabel: extLabel,
      sizeText,
      icon: FileCode,
      iconClassName: 'text-warning',
      badgeClassName: 'text-warning bg-warning/10 border-warning/20',
    };
  }
  if (sourceType === 'library') {
    return {
      typeLabel: 'Library Paper',
      sizeText,
      icon: FileText,
      iconClassName: 'text-primary',
      badgeClassName: 'text-primary bg-primary/10 border-primary/20',
    };
  }

  return {
    typeLabel: extLabel,
    sizeText,
    icon: File,
    iconClassName: 'text-muted-foreground',
    badgeClassName: 'text-muted-foreground bg-muted border-border',
  };
}

export function sourcesToAttachments(
  sources: readonly SourceEntry[],
): MessageAttachment[] {
  return sources
    .filter((s) => s.enabled)
    .map((s) => ({
      id: s.id,
      name: s.name,
      size: s.size,
      type: s.name.split('.').pop() || '',
      sourceType: s.sourceType,
    }));
}
