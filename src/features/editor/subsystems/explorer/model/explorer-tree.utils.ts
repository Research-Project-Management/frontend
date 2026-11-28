/**
 * explorer-tree.utils.ts
 *
 * Pure title sanitization, item lookup, and tree sorting utilities for the File Explorer.
 */

import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import type { FileTreeNode } from './document-tree';

export const FILE_EXTENSION_REGEX = /\.[a-z]+$/i;
export const VALID_MAIN_TEX_EXT_REGEX = /\.(tex|ltx|rtex|rnw)$/i;
const TRAILING_DOT_REGEX = /\.$/;

export type FileSortBy = 'name' | 'type';
export type FileSortDirection = 'asc' | 'desc';

export function sanitizeTitle(raw: string): string {
  const trimmed = raw.trim();
  if (FILE_EXTENSION_REGEX.test(trimmed)) return trimmed;
  return trimmed.replace(TRAILING_DOT_REGEX, '');
}

export function resolveExplorerItemById(
  fileId: string,
  files?: Array<{ id: string; title: string }> | null,
  projectFiles?: StorageItem[] | null,
  parentPage?: { id: string; title?: string } | null,
  parentPageId?: string | null,
  mainFileId?: string | null,
): { id: string; title: string; isFolder?: boolean } | null {
  const matchedDoc = files?.find((f) => f.id === fileId);
  if (matchedDoc) {
    return { id: matchedDoc.id, title: matchedDoc.title };
  }
  const matchedStorage = projectFiles?.find(
    (pf) => pf.id === fileId || pf.docId === fileId || pf.fileId === fileId,
  );
  if (matchedStorage) {
    return {
      id: matchedStorage.id,
      title: matchedStorage.path || matchedStorage.filename,
      isFolder: matchedStorage.isFolder,
    };
  }
  if (fileId === parentPageId || fileId === mainFileId) {
    return {
      id: fileId,
      title: parentPage?.title || 'main.tex',
    };
  }
  return null;
}

export function sortTreeNodes(
  nodes: FileTreeNode[],
  by: FileSortBy,
  dir: FileSortDirection,
): FileTreeNode[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const mult = dir === 'asc' ? 1 : -1;

  const sortItems = (items: FileTreeNode[]): FileTreeNode[] => {
    const cloned = [...items];
    cloned.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      if (a.type === 'folder' && b.type === 'folder') {
        return mult * collator.compare(a.name, b.name);
      }
      if (a.type === 'file' && b.type === 'file') {
        if (by === 'type') {
          const extA = a.displayLabel.split('.').pop()?.toLowerCase() ?? '';
          const extB = b.displayLabel.split('.').pop()?.toLowerCase() ?? '';
          if (extA !== extB) {
            return mult * collator.compare(extA, extB);
          }
        }
        return mult * collator.compare(a.displayLabel, b.displayLabel);
      }
      return 0;
    });

    return cloned.map((node) => {
      if (node.type === 'folder') {
        return {
          ...node,
          children: sortItems(node.children),
        };
      }
      return node;
    });
  };

  return sortItems(nodes);
}
