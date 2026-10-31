/**
 * document-tree.ts
 *
 * Simple, deterministic 1:1 Path-Trie tree builder for the Editor File Explorer
 * following community-standard IDE patterns (Overleaf / VS Code):
 * - Zero synthetic folder hallucination: files appear at their exact virtual path
 * - Single-pass path-to-Trie assembly supporting both unified ManuscriptNode items
 *   and explicit document/asset arrays
 * - Deterministic natural sorting (Root: Main doc -> Preamble -> Bib -> Natural;
 *   Containers: Folders first -> Files natural)
 *
 * Domain: Layer 1 (Pure Domain Model & Document Hierarchy).
 */

import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import {
  displayName,
  normalizeVirtualPath,
  splitVirtualPath,
  splitVirtualPathSegments,
} from '@/features/editor/domain/document/document-naming';

export type FileTreeFolderNode = {
  type: 'folder';
  id: string;
  name: string;
  fullPath: string;
  children: FileTreeNode[];
  storageData?: StorageItem;
};

export type FileTreeFileNode = {
  type: 'file';
  id: string;
  title: string;
  displayLabel: string;
  updatedAt?: string;
  kind: 'tex' | 'asset';
  isRootDoc?: boolean;
  storageData?: StorageItem;
};

export type FileTreeNode = FileTreeFolderNode | FileTreeFileNode;

export interface BuildFileTreeParams {
  projectFiles?: StorageItem[] | null;
  files?: Array<{ id: string; title?: string; updatedAt?: string; isRootDoc?: boolean }> | null;
  parentPage?: { id: string; title?: string; updatedAt?: string; mainFile?: unknown } | null;
  projectId?: string | null;
  parentPageId?: string | null;
  mainFileId?: string | null;
  configuredMainFile?: string | null;
  mainFile?: string | null;
  mainBibFile?: string | null;
}

const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/**
 * Assigns sorting priority to root files (Main document: 1, Preamble: 2, Bib: 3, Others: 10)
 */
export function getRootFilePriority(
  item: FileTreeFileNode,
  mainFileId?: string | null,
  configuredMainFile?: string | null,
  parentPageId?: string | null,
  mainFile = 'main.tex',
  mainBibFile = 'references.bib',
): number {
  const lower = item.displayLabel.toLowerCase();

  if (mainFileId) {
    if (item.id === mainFileId) return 1;
  } else if (configuredMainFile) {
    if (lower === configuredMainFile.toLowerCase()) return 1;
  } else {
    if (mainFile && lower === mainFile.toLowerCase()) return 1;
    if (item.isRootDoc || (parentPageId && item.id === parentPageId) || lower === 'main.tex') return 1;
  }

  if (lower === 'preamble.tex') return 2;
  if (
    lower === 'references.bib' ||
    (mainBibFile && mainBibFile !== 'auto' && lower === mainBibFile.toLowerCase())
  ) {
    return 3;
  }
  return 10;
}

/**
 * Builds the 1:1 hierarchical file tree from virtual paths and storage nodes.
 */
export function buildFileTree(params: BuildFileTreeParams): FileTreeNode[] {
  const {
    projectFiles,
    files,
    parentPage,
    projectId,
    parentPageId,
    mainFileId,
    configuredMainFile,
    mainFile = 'main.tex',
    mainBibFile = 'references.bib',
  } = params;

  const rootFiles: FileTreeFileNode[] = [];
  const topFolders = new Map<string, FileTreeFolderNode>();
  const allFoldersByPath = new Map<string, FileTreeFolderNode>();
  const allFileNodes: FileTreeFileNode[] = [];

  const ensureFolder = (
    rawFolderPath: string,
    explicitId?: string,
    storageData?: StorageItem,
  ): FileTreeFolderNode | null => {
    const segments = splitVirtualPathSegments(rawFolderPath);
    if (segments.length === 0) return null;

    let currentPath = '';
    let parentFolder: FileTreeFolderNode | null = null;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const key = currentPath.toLowerCase();
      let folder = allFoldersByPath.get(key);
      const isLeaf = i === segments.length - 1;

      if (!folder) {
        folder = {
          type: 'folder',
          id: isLeaf && explicitId ? explicitId : `folder:${currentPath}`,
          name: segment,
          fullPath: currentPath,
          children: [],
          ...(isLeaf && storageData ? { storageData } : {}),
        };
        allFoldersByPath.set(key, folder);
        if (parentFolder) {
          parentFolder.children.push(folder);
        } else {
          topFolders.set(key, folder);
        }
      } else if (isLeaf) {
        if (explicitId && folder.id.startsWith('folder:')) {
          folder.id = explicitId;
        }
        if (storageData && !folder.storageData) {
          folder.storageData = storageData;
        }
      }
      parentFolder = folder;
    }

    return parentFolder;
  };

  // Index explicit folder items for parentId fallback resolution when f.path is omitted
  const folderItemById = new Map<string, StorageItem>();
  projectFiles?.forEach((f) => {
    if (f.isFolder && f.id && f.id !== projectId && f.id !== parentPageId) {
      folderItemById.set(f.id, f);
    }
  });

  const resolveStoragePath = (item: StorageItem): string => {
    if (typeof item.path === 'string' && item.path.trim()) {
      return normalizeVirtualPath(item.path);
    }
    const baseName = normalizeVirtualPath(item.filename);
    if (!item.parentId || item.parentId === projectId || item.parentId === parentPageId || baseName.includes('/')) {
      return baseName;
    }
    const segments: string[] = [baseName];
    const visited = new Set<string>([item.id]);
    let currParentId: string | null | undefined = item.parentId;
    while (currParentId && !visited.has(currParentId)) {
      visited.add(currParentId);
      const parentFolder = folderItemById.get(currParentId);
      if (!parentFolder) break;
      if (typeof parentFolder.path === 'string' && parentFolder.path.trim()) {
        const pPath = normalizeVirtualPath(parentFolder.path);
        if (pPath) segments.unshift(pPath);
        break;
      }
      const pName = normalizeVirtualPath(parentFolder.filename);
      if (pName) segments.unshift(pName);
      currParentId = parentFolder.parentId;
    }
    return segments.filter(Boolean).join('/');
  };

  const insertFileNode = (folderPath: string | null, node: FileTreeFileNode): void => {
    allFileNodes.push(node);
    if (folderPath) {
      ensureFolder(folderPath)?.children.push(node);
    } else {
      rootFiles.push(node);
    }
  };

  // 1. Materialize explicit folders
  projectFiles?.forEach((f) => {
    if (f.isFolder && f.id !== projectId && f.id !== parentPageId) {
      const folderPath = resolveStoragePath(f);
      if (folderPath) {
        ensureFolder(folderPath, f.id, f);
      }
    }
  });

  const seenPaths = new Set<string>();
  const seenFileIds = new Set<string>();

  // 2. Materialize TeX / text documents from `files`
  files?.forEach((f) => {
    const rawPath = normalizeVirtualPath(f.title);
    if (!rawPath) return;
    const lowerPath = rawPath.toLowerCase();
    if ((f.id && seenFileIds.has(f.id)) || seenPaths.has(lowerPath)) return;

    seenPaths.add(lowerPath);
    if (f.id) seenFileIds.add(f.id);

    const { folderPath, leafName } = splitVirtualPath(rawPath);
    const resolvedTitle = f.title || rawPath;
    insertFileNode(folderPath, {
      type: 'file',
      id: f.id,
      title: resolvedTitle,
      displayLabel: displayName(leafName || resolvedTitle),
      updatedAt: f.updatedAt,
      kind: 'tex',
      isRootDoc: Boolean(f.isRootDoc),
    });
  });

  // 3. Materialize remaining nodes from `projectFiles` (both binary FILE assets and unified DOC nodes)
  projectFiles?.forEach((f) => {
    if (f.isFolder) return;
    const nodeId = f.docId || f.id;
    if (nodeId && seenFileIds.has(nodeId)) return;
    if (f.id && seenFileIds.has(f.id)) return;

    const fname = (f.filename || '').trim();
    if (!fname || f.id === projectId || f.id === parentPageId || fname === '.keep' || fname.startsWith('.')) {
      return;
    }

    const isDocNode = f.nodeType === 'DOC';
    if (!isDocNode && !fname.includes('.') && (!f.size || f.size === 0) && !f.url) {
      return;
    }

    const rawPath = resolveStoragePath(f) || normalizeVirtualPath(fname);
    const lowerPath = rawPath.toLowerCase();
    if (seenPaths.has(lowerPath)) return;

    seenPaths.add(lowerPath);
    if (nodeId) seenFileIds.add(nodeId);
    if (f.id) seenFileIds.add(f.id);

    const { folderPath, leafName } = splitVirtualPath(rawPath);
    const normalizedStorageData =
      f.filename === leafName && f.path === rawPath
        ? f
        : { ...f, filename: leafName, path: rawPath };

    insertFileNode(folderPath, {
      type: 'file',
      id: nodeId,
      title: folderPath ? rawPath : f.filename,
      displayLabel: isDocNode ? displayName(leafName) : leafName,
      updatedAt: f.updatedAt,
      kind: isDocNode ? 'tex' : 'asset',
      isRootDoc: Boolean(f.isRootDoc),
      storageData: normalizedStorageData,
    });
  });

  // 4. Ensure root document fallback when parentPage is supplied without matching child doc
  const resolvedRootTitle = configuredMainFile || mainFile || 'main.tex';
  const resolvedRootTitleLower = resolvedRootTitle.toLowerCase();
  const storeMainFileLower = mainFile ? mainFile.toLowerCase() : null;

  const hasRootDocument =
    allFileNodes.some((rf) => {
      const rfLower = rf.displayLabel.toLowerCase();
      return (
        rf.id === parentPage?.id ||
        rf.id === mainFileId ||
        Boolean(rf.isRootDoc) ||
        rfLower === resolvedRootTitleLower ||
        (storeMainFileLower !== null && rfLower === storeMainFileLower) ||
        rfLower === 'main.tex'
      );
    }) ||
    seenPaths.has(resolvedRootTitleLower) ||
    Boolean(storeMainFileLower && seenPaths.has(storeMainFileLower)) ||
    seenPaths.has('main.tex');

  if (parentPage && !hasRootDocument && !seenFileIds.has(parentPage.id)) {
    const rootNode: FileTreeFileNode = {
      type: 'file',
      id: parentPage.id,
      title: resolvedRootTitle,
      displayLabel: resolvedRootTitle,
      updatedAt: parentPage.updatedAt || new Date().toISOString(),
      kind: 'tex',
      isRootDoc: true,
    };
    rootFiles.unshift(rootNode);
    allFileNodes.unshift(rootNode);
    seenFileIds.add(parentPage.id);
    seenPaths.add(resolvedRootTitleLower);
  }

  // 5. Enforce single isRootDoc invariant across the tree
  const cfgLower = configuredMainFile?.toLowerCase();
  const primaryRootNode =
    (mainFileId ? allFileNodes.find((n) => n.id === mainFileId) : undefined) ||
    (cfgLower
      ? allFileNodes.find((n) => n.title.toLowerCase() === cfgLower || n.displayLabel.toLowerCase() === cfgLower)
      : undefined) ||
    allFileNodes.find((n) => Boolean(n.isRootDoc)) ||
    (storeMainFileLower
      ? allFileNodes.find(
          (n) => n.title.toLowerCase() === storeMainFileLower || n.displayLabel.toLowerCase() === storeMainFileLower,
        )
      : undefined) ||
    (parentPage?.id ? allFileNodes.find((n) => n.id === parentPage.id) : undefined) ||
    allFileNodes.find((n) => n.displayLabel.toLowerCase() === 'main.tex');

  for (const node of allFileNodes) {
    if (node.kind === 'tex') {
      node.isRootDoc = primaryRootNode ? node.id === primaryRootNode.id : false;
    }
  }

  // 6. Sort root files and folder hierarchy naturally
  rootFiles.sort((a, b) => {
    const prioA = getRootFilePriority(a, mainFileId, configuredMainFile, parentPageId, mainFile || 'main.tex', mainBibFile || 'references.bib');
    const prioB = getRootFilePriority(b, mainFileId, configuredMainFile, parentPageId, mainFile || 'main.tex', mainBibFile || 'references.bib');
    if (prioA !== prioB) return prioA - prioB;
    return NATURAL_COLLATOR.compare(a.displayLabel, b.displayLabel);
  });

  const sortFolderRecursively = (folder: FileTreeFolderNode): void => {
    for (const child of folder.children) {
      if (child.type === 'folder') {
        sortFolderRecursively(child);
      }
    }
    folder.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      if (a.type === 'folder' && b.type === 'folder') {
        return NATURAL_COLLATOR.compare(a.name, b.name);
      }
      if (a.type === 'file' && b.type === 'file') {
        return NATURAL_COLLATOR.compare(a.displayLabel, b.displayLabel);
      }
      return 0;
    });
  };

  const sortedFolders = Array.from(topFolders.values()).sort((a, b) =>
    NATURAL_COLLATOR.compare(a.name, b.name),
  );
  sortedFolders.forEach(sortFolderRecursively);

  return [...rootFiles, ...sortedFolders];
}

export const buildUnifiedTree = buildFileTree;

/**
 * Filter tree items recursively by query
 */
export function filterFileTree(nodes: FileTreeNode[], filter: string): FileTreeNode[] {
  const trimmed = filter.trim().toLowerCase();
  if (!trimmed) return nodes;

  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === 'file') {
      if (
        node.displayLabel.toLowerCase().includes(trimmed) ||
        node.title.toLowerCase().includes(trimmed)
      ) {
        result.push(node);
      }
    } else {
      const matchingChildren = filterFileTree(node.children, trimmed);
      if (node.name.toLowerCase().includes(trimmed) || matchingChildren.length > 0) {
        result.push({
          ...node,
          children: matchingChildren.length > 0 ? matchingChildren : node.children,
        });
      }
    }
  }
  return result;
}
