'use client';

/**
 * useFileTree.ts
 *
 * Dedicated stateful hook for hierarchical file tree computation & folder expansion:
 * - Memoized tree compilation avoiding re-runs during keystrokes
 * - Folder expansion toggle and search filter auto-expansion
 * - Crash-resilient persistence via localStorage per project
 * - expandAll / collapseAll support
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  buildFileTree,
  filterFileTree,
  type FileTreeNode,
  type BuildFileTreeParams,
} from './tree-builder.util';

export interface UseFileTreeParams extends BuildFileTreeParams {
  fileFilter?: string;
}

const STORAGE_KEY_PREFIX = 'flux:expanded-folders:';

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
  const storageKey = useMemo(() => {
    const scopeId = projectId || parentPageId || 'default';
    return `${STORAGE_KEY_PREFIX}${scopeId}`;
  }, [projectId, parentPageId]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return new Set(parsed);
          }
        }
      } catch {}
    }
    return new Set(['sections', 'supplementary']);
  });

  // Keep localStorage synced whenever expandedFolders or storageKey changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(expandedFolders)));
    } catch {}
  }, [storageKey, expandedFolders]);

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

  const expandAll = useCallback((keys?: string[]) => {
    if (keys && keys.length > 0) {
      setExpandedFolders(new Set(keys));
    } else {
      const allFolders = new Set<string>();
      const walk = (nodes: FileTreeNode[]) => {
        for (const n of nodes) {
          if (n.type === 'folder') {
            allFolders.add(n.id);
            allFolders.add(n.name);
            if (n.children) walk(n.children);
          }
        }
      };
      walk(treeItems);
      setExpandedFolders(allFolders);
    }
  }, [treeItems]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
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
    expandAll,
    collapseAll,
    isFolderExpanded,
  };
}
