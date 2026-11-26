import {
  BookOpen,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { AttachedSourcePayload } from '../types/context';
import type { MessageAttachment } from '../types/message';

export type { AttachedSourcePayload };

export type SourceType = 'upload' | 'library' | 'paper';
export type ContextTab = 'library' | 'uploaded';
export type LibraryReadiness = 'indexed' | 'pdf' | 'metadata';

export interface SourceEntry {
  id: string;
  name: string;
  enabled: boolean;
  size?: number;
  sourceType: SourceType;
  itemId?: string;
  fileId?: string;
  ragDocId?: string;
  hasPdf?: boolean;
  indexed?: boolean;
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

import { formatBytes as formatBytesGlobal } from '@/shared/utils/format';

export const ACCEPTED_FILE_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

export function formatBytes(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) return '';
  return formatBytesGlobal(bytes);
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

export interface FileCategoryMetaInput {
  name: string;
  sourceType?: string;
  size?: number;
  hasPdf?: boolean;
  type?: string;
  itemId?: string;
  fileId?: string;
}

export function getFileCategoryMeta(
  input: string | MessageAttachment | SourceEntry | FileCategoryMetaInput,
  sourceTypeArg?: string,
  sizeArg?: number,
  extra?: { hasPdf?: boolean; type?: string; itemId?: string; fileId?: string },
): FileCategoryMeta {
  const isObj = typeof input === 'object' && input !== null;
  const name = (isObj ? input.name : input) || '';
  const sourceType =
    (isObj ? (input as FileCategoryMetaInput).sourceType : sourceTypeArg) ??
    sourceTypeArg;
  const size =
    (isObj ? (input as FileCategoryMetaInput).size : sizeArg) ?? sizeArg;
  const hasPdfProp =
    isObj && 'hasPdf' in (input as unknown as Record<string, unknown>)
      ? (input as unknown as Record<string, unknown>).hasPdf
      : extra?.hasPdf;
  const hasPdf = typeof hasPdfProp === 'boolean' ? hasPdfProp : undefined;

  const rawType = (
    (isObj ? (input as FileCategoryMetaInput).type : extra?.type) ??
    extra?.type ??
    ''
  ).trim();
  const hasItemId = Boolean(
    (isObj
      ? (input as unknown as Record<string, unknown>).itemId
      : extra?.itemId) ?? extra?.itemId,
  );

  const parts = name.split('.');
  let ext = (parts.length > 1 ? parts.pop() || '' : '').toLowerCase().trim();
  // If rawType is a short format token (e.g. "pdf", "docx", "tex"), use it when filename lacks extension
  if (!ext && rawType && rawType.length <= 10 && !rawType.includes(' ')) {
    ext = rawType.toLowerCase().replace(/^\./, '');
  }

  const isLibraryOrPaper =
    sourceType === 'library' ||
    sourceType === 'paper' ||
    hasItemId ||
    rawType === 'paper';

  const sizeText = size ? formatBytes(size) : '';

  // 1. PDF Documents (explicit .pdf extension or explicit hasPdf === true)
  if (ext === 'pdf' || hasPdf === true) {
    return {
      typeLabel: 'PDF',
      sizeText,
      icon: FileText,
      iconClassName: 'text-red-600 dark:text-red-400',
      badgeClassName:
        'text-red-600 bg-red-500/10 border-red-500/20 dark:text-red-400 dark:bg-red-500/15',
    };
  }

  // 2. Research Papers / Library items
  if (isLibraryOrPaper) {
    // If hasPdf is not explicitly false, treat as PDF paper; if hasPdf === false, treat as metadata-only Paper
    if (hasPdf !== false && (!ext || ext === 'pdf')) {
      return {
        typeLabel: 'PDF',
        sizeText,
        icon: FileText,
        iconClassName: 'text-red-600 dark:text-red-400',
        badgeClassName:
          'text-red-600 bg-red-500/10 border-red-500/20 dark:text-red-400 dark:bg-red-500/15',
      };
    }
    return {
      typeLabel: 'Paper',
      sizeText,
      icon: BookOpen,
      iconClassName: 'text-sky-600 dark:text-sky-400',
      badgeClassName:
        'text-sky-600 bg-sky-500/10 border-sky-500/20 dark:text-sky-400 dark:bg-sky-500/15',
    };
  }

  // 3. Word Documents
  if (ext === 'doc' || ext === 'docx') {
    return {
      typeLabel: 'DOCX',
      sizeText,
      icon: FileText,
      iconClassName: 'text-blue-600 dark:text-blue-400',
      badgeClassName:
        'text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-400 dark:bg-blue-500/15',
    };
  }

  // 4. LaTeX / TeX / BibTeX
  if (ext === 'tex' || ext === 'latex' || ext === 'sty' || ext === 'cls') {
    return {
      typeLabel: 'LaTeX',
      sizeText,
      icon: FileCode,
      iconClassName: 'text-teal-600 dark:text-teal-400',
      badgeClassName:
        'text-teal-600 bg-teal-500/10 border-teal-500/20 dark:text-teal-400 dark:bg-teal-500/15',
    };
  }
  if (ext === 'bib') {
    return {
      typeLabel: 'BibTeX',
      sizeText,
      icon: FileText,
      iconClassName: 'text-teal-600 dark:text-teal-400',
      badgeClassName:
        'text-teal-600 bg-teal-500/10 border-teal-500/20 dark:text-teal-400 dark:bg-teal-500/15',
    };
  }

  // 5. Spreadsheets / Tables
  if (SHEET_EXTS.has(ext)) {
    const sheetLabel =
      ext === 'csv' ? 'CSV' : ext === 'tsv' ? 'TSV' : 'Excel';
    return {
      typeLabel: sheetLabel,
      sizeText,
      icon: FileSpreadsheet,
      iconClassName: 'text-emerald-600 dark:text-emerald-400',
      badgeClassName:
        'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/15',
    };
  }

  // 6. Images
  if (IMAGE_EXTS.has(ext)) {
    return {
      typeLabel: ext ? ext.toUpperCase() : 'Image',
      sizeText,
      icon: FileImage,
      iconClassName: 'text-purple-600 dark:text-purple-400',
      badgeClassName:
        'text-purple-600 bg-purple-500/10 border-purple-500/20 dark:text-purple-400 dark:bg-purple-500/15',
    };
  }

  // 7. Markdown & Text
  if (ext === 'md' || ext === 'markdown') {
    return {
      typeLabel: 'Markdown',
      sizeText,
      icon: FileText,
      iconClassName: 'text-indigo-600 dark:text-indigo-400',
      badgeClassName:
        'text-indigo-600 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-400 dark:bg-indigo-500/15',
    };
  }
  if (ext === 'txt') {
    return {
      typeLabel: 'TXT',
      sizeText,
      icon: FileText,
      iconClassName: 'text-muted-foreground',
      badgeClassName: 'text-muted-foreground bg-muted border-border',
    };
  }

  // 8. Code & Data
  if (CODE_EXTS.has(ext)) {
    const codeLabel =
      ext === 'ts' || ext === 'tsx'
        ? 'TypeScript'
        : ext === 'js' || ext === 'jsx'
          ? 'JavaScript'
          : ext === 'py'
            ? 'Python'
            : ext === 'json'
              ? 'JSON'
              : ext.toUpperCase();
    return {
      typeLabel: codeLabel,
      sizeText,
      icon: FileCode,
      iconClassName: 'text-amber-600 dark:text-amber-400',
      badgeClassName:
        'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/15',
    };
  }

  // 9. Known other extension
  if (ext) {
    return {
      typeLabel: ext.toUpperCase(),
      sizeText,
      icon: FileText,
      iconClassName: 'text-muted-foreground',
      badgeClassName: 'text-muted-foreground bg-muted border-border',
    };
  }

  // 10. Fallback with no extension: clean "Document" (never "FILE"!)
  return {
    typeLabel: 'Document',
    sizeText,
    icon: FileText,
    iconClassName: 'text-muted-foreground',
    badgeClassName: 'text-muted-foreground bg-muted border-border',
  };
}

export function getRagDocumentId(src: SourceEntry): string | null {
  if (src.sourceType === 'upload') {
    return src.id?.trim() || null;
  }
  const ragId = src.ragDocId?.trim();
  if (ragId) return ragId;
  const fileId = src.fileId?.trim();
  if (src.hasPdf && fileId) return fileId;
  return null;
}

export function getLibraryReadiness(src: SourceEntry): LibraryReadiness | null {
  if (src.sourceType === 'upload') return null;
  if (src.indexed || Boolean(src.ragDocId?.trim())) return 'indexed';
  if (src.hasPdf || Boolean(src.fileId?.trim())) return 'pdf';
  return 'metadata';
}

export function sourceEntryToAttachedPayload(
  src: SourceEntry,
): AttachedSourcePayload {
  if (src.sourceType === 'upload') {
    return {
      kind: 'upload',
      title: src.name,
      source_id: src.id || null,
      source_type: 'upload',
      indexed: true,
    };
  }
  const itemId = (src.itemId || src.id || '').trim() || null;
  const fileId = src.fileId?.trim() || null;
  const hasPdf = Boolean(src.hasPdf || fileId);
  const indexed = Boolean(src.indexed || src.ragDocId?.trim());
  const sourceId = getRagDocumentId(src);
  return {
    kind: src.sourceType === 'paper' ? 'paper' : 'library',
    title: src.name,
    source_id: sourceId,
    source_type: sourceId ? 'file' : null,
    item_id: itemId,
    file_id: fileId,
    has_pdf: hasPdf,
    indexed,
  };
}

export function sourcesToAttachments(
  sources: readonly SourceEntry[],
): MessageAttachment[] {
  return sources
    .filter((s) => s.enabled)
    .map((s) => {
      const parts = s.name.split('.');
      const ext = parts.length > 1 ? parts.pop() || '' : '';
      const fallbackType =
        s.hasPdf === true ||
        (s.hasPdf !== false &&
          (s.sourceType === 'library' || s.sourceType === 'paper'))
          ? 'pdf'
          : '';
      return {
        id: s.id,
        name: s.name,
        size: s.size,
        type: ext || fallbackType,
        sourceType: s.sourceType,
        ...(s.itemId ? { itemId: s.itemId } : {}),
        ...(s.fileId ? { fileId: s.fileId } : {}),
        ...(s.hasPdf !== undefined ? { hasPdf: s.hasPdf } : {}),
        ...(s.indexed !== undefined ? { indexed: s.indexed } : {}),
      };
    });
}
