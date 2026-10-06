'use client';

/**
 * useFileTree.ts
 *
 * Dedicated stateful hook for hierarchical file tree computation & folder expansion:
 * - Memoized tree compilation avoiding re-runs during keystrokes
 * - Folder expansion toggle and search filter auto-expansion
 */

import { useState, useMemo, useCallback } from 'react';
import {
  buildFileTree,
  filterFileTree,
  type FileTreeNode,
  type BuildFileTreeParams,
} from './tree-builder.util';

export interface UseFileTreeParams extends BuildFileTreeParams {
  fileFilter?: string;
}

export function useFileTree({
  projectFiles,
  files,
  parentPage,
  projectId,
  parentPageId,
  mainFileId,
  configuredMainFile,
  fileFilter = '',
}: UseFileTreeParams) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    return new Set(['sections', 'supplementary']);
  });

  const treeItems = useMemo<FileTreeNode[]>(() => {
    return buildFileTree({
      projectFiles,
      files,
      parentPage,
      projectId,
      parentPageId,
      mainFileId,
      configuredMainFile,
    });
  }, [
    projectFiles,
    files,
    parentPage,
    projectId,
    parentPageId,
    mainFileId,
    configuredMainFile,
  ]);

  const displayTree = useMemo<FileTreeNode[]>(() => {
    return filterFileTree(treeItems, fileFilter);
  }, [treeItems, fileFilter]);

  const toggleFolder = useCallback((folderKey: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  }, []);

  const isFolderExpanded = useCallback(
    (node: { id: string; name: string }): boolean => {
      if (fileFilter.trim()) return true;
      return expandedFolders.has(node.name) || expandedFolders.has(node.id);
    },
    [fileFilter, expandedFolders],
  );

  return {
    treeItems,
    displayTree,
    expandedFolders,
    toggleFolder,
    isFolderExpanded,
  };
}
