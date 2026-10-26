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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  buildFileTree,
  filterFileTree,
  type FileTreeNode,
  type BuildFileTreeParams,
} from '@/features/editor/subsystems/explorer/model/document-tree';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { EDITOR_STORAGE_KEYS } from '@/features/editor/domain/constants/editor.constants';

export interface UseFileTreeParams extends BuildFileTreeParams {
  fileFilter?: string;
}

const STORAGE_KEY_PREFIX = EDITOR_STORAGE_KEYS.EXPANDED_FOLDERS_PREFIX;

function loadExpandedFolders(key: string): Set<string> {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {}
  }
  return new Set(['sections', 'supplementary']);
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
  const mainFile = useSettingsStore((s) => s.mainFile);
  const mainBibFile = useSettingsStore((s) => s.mainBibFile);

  const storageKey = useMemo(() => {
    const scopeId = projectId || parentPageId || 'default';
    return `${STORAGE_KEY_PREFIX}${scopeId}`;
  }, [projectId, parentPageId]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() =>
    loadExpandedFolders(storageKey),
  );
  const prevStorageKeyRef = useRef(storageKey);

  // Re-hydrate when project/page scope changes, and persist when expandedFolders changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (prevStorageKeyRef.current !== storageKey) {
      prevStorageKeyRef.current = storageKey;
      setExpandedFolders(loadExpandedFolders(storageKey));
      return;
    }
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
      mainFile,
      mainBibFile,
    });
  }, [
    projectFiles,
    files,
    parentPage,
    projectId,
    parentPageId,
    mainFileId,
    configuredMainFile,
    mainFile,
    mainBibFile,
  ]);

  const displayTree = useMemo<FileTreeNode[]>(() => {
    return filterFileTree(treeItems, fileFilter);
  }, [treeItems, fileFilter]);

  const docMap = useMemo(() => {
    const map = new Map<string, { id: string; title: string; updatedAt?: string; isRootDoc?: boolean }>();
    if (parentPage?.id) {
      map.set(parentPage.id, {
        id: parentPage.id,
        title: parentPage.title || configuredMainFile || mainFile || 'main.tex',
        updatedAt: parentPage.updatedAt,
        isRootDoc: true,
      });
    }
    files?.forEach((f) => {
      if (f.id) {
        map.set(f.id, {
          id: f.id,
          title: f.title || '',
          updatedAt: f.updatedAt,
          isRootDoc: f.isRootDoc,
        });
      }
    });
    return map;
  }, [parentPage, files, configuredMainFile, mainFile]);

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
    docMap,
    expandedFolders,
    toggleFolder,
    expandAll,
    collapseAll,
    isFolderExpanded,
  };
}
