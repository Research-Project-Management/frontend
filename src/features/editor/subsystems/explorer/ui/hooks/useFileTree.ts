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
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { rewritePathPrefix, normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { EDITOR_STORAGE_KEYS } from '@/features/editor/domain/constants/editor.constants';

export interface UseFileTreeParams extends BuildFileTreeParams {
  fileFilter?: string;
}

const STORAGE_KEY_PREFIX = EDITOR_STORAGE_KEYS.EXPANDED_FOLDERS_PREFIX;

export function isFolderOpen(
  openFolders: ReadonlySet<string>,
  node: { id: string; name: string; fullPath?: string; path?: string },
): boolean {
  const folderKey = node.fullPath || node.path || node.name;
  return (
    openFolders.has(folderKey) ||
    openFolders.has(`folder:${folderKey}`) ||
    openFolders.has(node.name) ||
    openFolders.has(node.id)
  );
}

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
  return new Set<string>();
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
    const scopeId = parentPageId || parentPage?.id || projectId || 'default';
    return `${STORAGE_KEY_PREFIX}${scopeId}`;
  }, [parentPageId, parentPage?.id, projectId]);

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

  // Keep expanded folder paths in sync when a folder is renamed or moved (locally or via remote Socket.IO)
  useEffect(() => {
    return editorCommandBus.subscribe('filetree:updated', (cmd) => {
      const payload = cmd.payload as
        | {
            action?: string;
            oldName?: string;
            newName?: string;
            node?: { id?: string; docId?: string | null; path?: string; name?: string };
          }
        | undefined;
      if (payload?.action !== 'rename' && payload?.action !== 'move') return;

      let rawOld = payload.oldName || '';
      let rawNew = payload.newName || payload.node?.path || payload.node?.name || '';
      if (!rawOld && payload.node?.id) {
        const matched = projectFiles?.find(
          (pf) => pf.id === payload.node?.id || pf.docId === payload.node?.id,
        );
        rawOld = matched?.path || matched?.filename || '';
      }
      const oldClean = normalizeVirtualPath(rawOld);
      const newClean = normalizeVirtualPath(rawNew);
      if (!oldClean || !newClean || oldClean === newClean) return;
      setExpandedFolders((prev) => {
        let mutated = false;
        const next = new Set<string>();
        for (const key of prev) {
          if (key === oldClean) {
            next.add(newClean);
            mutated = true;
          } else {
            const rewritten = rewritePathPrefix(key, oldClean, newClean);
            if (rewritten !== null) {
              next.add(rewritten);
              mutated = true;
            } else {
              next.add(key);
            }
          }
        }
        return mutated ? next : prev;
      });
    });
  }, [projectFiles]);

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

  const toggleFolder = useCallback((folderKey: string) => {
    const cleanKey =
      normalizeVirtualPath(
        folderKey.startsWith('folder:')
          ? folderKey.slice('folder:'.length)
          : folderKey,
      ) || folderKey;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      const syntheticKey = `folder:${cleanKey}`;
      if (next.has(cleanKey) || next.has(folderKey) || next.has(syntheticKey)) {
        next.delete(cleanKey);
        next.delete(folderKey);
        next.delete(syntheticKey);
      } else {
        next.add(cleanKey);
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
            allFolders.add(n.fullPath || n.name);
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
    (node: { id: string; name: string; fullPath?: string; path?: string }): boolean => {
      if (fileFilter.trim()) return true;
      return isFolderOpen(expandedFolders, node);
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
