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
import { extractProjectId } from '@/features/editor/domain/types/core.types';
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
  path?: string;
  pageId?: string | null;
  projectId?: string | null;
  children: FileTreeNode[];
  storageData?: StorageItem;
};

export type FileTreeFileNode = {
  type: 'file';
  id: string;
  nodeId?: string;
  docId?: string | null;
  fileId?: string | null;
  pageId?: string | null;
  projectId?: string | null;
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
  files?: Array<{
    id: string;
    nodeId?: string;
    docId?: string | null;
    fileId?: string | null;
    pageId?: string | null;
    projectId?: unknown;
    title?: string;
    path?: string;
    updatedAt?: string;
    isRootDoc?: boolean;
  }> | null;
  parentPage?: { id: string; title?: string; updatedAt?: string; mainFile?: unknown; projectId?: unknown } | null;
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

function matchesFileTarget(node: FileTreeFileNode, rawTarget?: string | null): boolean {
  if (!rawTarget) return false;
  const cleanTarget = normalizeVirtualPath(rawTarget).toLowerCase();
  if (!cleanTarget) return false;
  const fullLower = normalizeVirtualPath(node.title || node.displayLabel).toLowerCase();
  if (fullLower === cleanTarget) return true;
  return !cleanTarget.includes('/') && node.displayLabel.toLowerCase() === cleanTarget;
}

function mergeStorageMetadataIntoFileNode(node: FileTreeFileNode, item: StorageItem): void {
  if (!node.nodeId || node.nodeId === node.id) {
    node.nodeId = item.nodeId || item.id;
  }
  if (!node.docId && item.docId) node.docId = item.docId;
  if (!node.fileId && item.fileId) node.fileId = item.fileId;
  if (!node.pageId && item.pageId) node.pageId = item.pageId;
  if (!node.projectId && item.projectId) node.projectId = item.projectId;
  if (item.isRootDoc) node.isRootDoc = true;
  if (!node.storageData) node.storageData = item;
}

function sortFolderRecursively(folder: FileTreeFolderNode): void {
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
}

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
  const fullLower = normalizeVirtualPath(item.title || item.displayLabel).toLowerCase();

  if (item.isRootDoc) return 1;
  if (mainFileId) {
    if (item.id === mainFileId || item.docId === mainFileId || item.nodeId === mainFileId) return 1;
  } else if (configuredMainFile) {
    if (matchesFileTarget(item, configuredMainFile)) return 1;
  } else {
    if (matchesFileTarget(item, mainFile)) return 1;
    if ((parentPageId && item.id === parentPageId) || fullLower === 'main.tex') return 1;
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

  const resolvedPageId = parentPageId || parentPage?.id || projectId || null;
  const resolvedProjectId =
    projectId ||
    (parentPage?.projectId && typeof parentPage.projectId === 'string'
      ? parentPage.projectId
      : parentPage?.projectId && typeof parentPage.projectId === 'object' && 'id' in parentPage.projectId
        ? String((parentPage.projectId as { id?: unknown }).id ?? '')
        : null) ||
    resolvedPageId;

  const isWorkspaceRootId = (id?: string | null): boolean => {
    if (!id) return true;
    return (
      id === 'root' ||
      id === 'null' ||
      id === projectId ||
      id === parentPageId ||
      id === parentPage?.id ||
      id === resolvedPageId ||
      id === resolvedProjectId
    );
  };

  const rootFiles: FileTreeFileNode[] = [];
  const topFolders = new Map<string, FileTreeFolderNode>();
  const allFoldersByPath = new Map<string, FileTreeFolderNode>();
  const allFileNodes: FileTreeFileNode[] = [];
  const fileNodeById = new Map<string, FileTreeFileNode>();
  const fileNodeByPath = new Map<string, FileTreeFileNode>();

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
      const isLeaf = i === segments.length - 1;
      let folder = allFoldersByPath.get(currentPath);

      if (!folder) {
        folder = {
          type: 'folder',
          id: isLeaf && explicitId ? explicitId : `folder:${currentPath}`,
          name: segment,
          fullPath: currentPath,
          path: currentPath,
          pageId: (isLeaf && storageData?.pageId) || resolvedPageId,
          projectId: (isLeaf && storageData?.projectId) || resolvedProjectId,
          children: [],
          ...(isLeaf && storageData ? { storageData } : {}),
        };
        allFoldersByPath.set(currentPath, folder);
        if (parentFolder) {
          parentFolder.children.push(folder);
        } else {
          topFolders.set(currentPath, folder);
        }
      } else if (isLeaf) {
        if (explicitId && folder.id.startsWith('folder:')) {
          folder.id = explicitId;
        }
        if (storageData && !folder.storageData) {
          folder.storageData = storageData;
        }
        if (!folder.pageId && (storageData?.pageId || resolvedPageId)) {
          folder.pageId = storageData?.pageId || resolvedPageId;
        }
        if (!folder.projectId && (storageData?.projectId || resolvedProjectId)) {
          folder.projectId = storageData?.projectId || resolvedProjectId;
        }
      }
      parentFolder = folder;
    }

    return parentFolder;
  };

  // Index explicit folder items and binary FILE assets in a single pass
  const folderItemById = new Map<string, StorageItem>();
  const assetIds = new Set<string>();
  const assetPaths = new Set<string>();

  const resolveStoragePath = (item: StorageItem, visited = new Set<string>()): string => {
    if (typeof item.path === 'string' && item.path.trim()) {
      return normalizeVirtualPath(item.path);
    }
    const baseName = normalizeVirtualPath(item.filename);
    if (isWorkspaceRootId(item.parentId) || baseName.includes('/')) {
      return baseName;
    }
    if (item.parentId && !visited.has(item.parentId)) {
      visited.add(item.parentId);
      const parentFolder = folderItemById.get(item.parentId);
      const parentPath = parentFolder ? resolveStoragePath(parentFolder, visited) : '';
      return parentPath ? `${parentPath}/${baseName}` : baseName;
    }
    return baseName;
  };

  if (projectFiles) {
    for (const f of projectFiles) {
      if (f.isFolder && f.id && !isWorkspaceRootId(f.id)) {
        folderItemById.set(f.id, f);
      }
    }
    for (const f of projectFiles) {
      if (f.isFolder && !isWorkspaceRootId(f.id)) {
        const folderPath = resolveStoragePath(f);
        if (folderPath) {
          ensureFolder(folderPath, f.id, f);
        }
      } else if (!f.isFolder && f.nodeType !== 'DOC') {
        if (f.id) assetIds.add(f.id);
        if (f.fileId) assetIds.add(f.fileId);
        const p = resolveStoragePath(f) || normalizeVirtualPath(f.filename);
        if (p) assetPaths.add(p);
      }
    }
  }

  const insertFileNode = (folderPath: string | null, rawPath: string, node: FileTreeFileNode): void => {
    allFileNodes.push(node);
    if (rawPath) fileNodeByPath.set(rawPath, node);
    if (node.id) fileNodeById.set(node.id, node);
    if (node.nodeId) fileNodeById.set(node.nodeId, node);
    if (node.docId) fileNodeById.set(node.docId, node);
    if (folderPath) {
      ensureFolder(folderPath)?.children.push(node);
    } else {
      rootFiles.push(node);
    }
  };

  // 1. Materialize TeX / text documents from `files`
  if (files) {
    for (const f of files) {
      const rawPath = normalizeVirtualPath(f.path || f.title);
      if (!rawPath) continue;
      if (
        (f.id && assetIds.has(f.id)) ||
        (f.nodeId && assetIds.has(f.nodeId)) ||
        assetPaths.has(rawPath)
      ) {
        continue;
      }
      if ((f.id && fileNodeById.has(f.id)) || fileNodeByPath.has(rawPath)) continue;

      const { folderPath, leafName } = splitVirtualPath(rawPath);
      const resolvedTitle = f.title ? normalizeVirtualPath(f.title) || rawPath : rawPath;
      insertFileNode(folderPath, rawPath, {
        type: 'file',
        id: f.id,
        nodeId: f.nodeId || f.id,
        docId: f.docId ?? f.id,
        fileId: f.fileId ?? null,
        pageId: f.pageId ?? resolvedPageId,
        projectId: extractProjectId(f.projectId as any) ?? resolvedProjectId ?? null,
        title: resolvedTitle,
        displayLabel: displayName(leafName || resolvedTitle),
        updatedAt: f.updatedAt,
        kind: 'tex',
        isRootDoc: Boolean(f.isRootDoc),
      });
    }
  }

  // 2. Materialize remaining nodes from `projectFiles` (both binary FILE assets and unified DOC nodes)
  if (projectFiles) {
    for (const f of projectFiles) {
      if (f.isFolder) continue;
      const nodeId = f.docId || f.id;
      const existingById = (nodeId ? fileNodeById.get(nodeId) : undefined) || (f.id ? fileNodeById.get(f.id) : undefined);
      if (existingById) {
        mergeStorageMetadataIntoFileNode(existingById, f);
        continue;
      }

      const fname = (f.filename || '').trim();
      if (!fname || isWorkspaceRootId(f.id) || fname === '.keep' || fname.startsWith('.')) {
        continue;
      }

      const isDocNode = f.nodeType === 'DOC';
      if (!isDocNode && !fname.includes('.') && (!f.size || f.size === 0) && !f.url) {
        continue;
      }

      const rawPath = resolveStoragePath(f) || normalizeVirtualPath(fname);
      const existingByPath = fileNodeByPath.get(rawPath);
      if (existingByPath) {
        mergeStorageMetadataIntoFileNode(existingByPath, f);
        continue;
      }

      const { folderPath, leafName } = splitVirtualPath(rawPath);
      const normalizedStorageData =
        f.filename === leafName && f.path === rawPath
          ? f
          : { ...f, filename: leafName, path: rawPath };

      insertFileNode(folderPath, rawPath, {
        type: 'file',
        id: nodeId,
        nodeId: f.nodeId || f.id,
        docId: f.docId ?? (isDocNode ? nodeId : null),
        fileId: f.fileId ?? (!isDocNode ? f.id : null),
        pageId: f.pageId ?? resolvedPageId,
        projectId: extractProjectId(f.projectId as any) ?? resolvedProjectId ?? null,
        title: folderPath ? rawPath : f.filename,
        displayLabel: isDocNode ? displayName(leafName) : leafName,
        updatedAt: f.updatedAt,
        kind: isDocNode ? 'tex' : 'asset',
        isRootDoc: Boolean(f.isRootDoc),
        storageData: normalizedStorageData,
      });
    }
  }

  // 3. Ensure root document fallback when parentPage is supplied without matching child doc
  const resolvedRootTitle = normalizeVirtualPath(configuredMainFile || mainFile || 'main.tex') || 'main.tex';
  const resolvedRootTitleLower = resolvedRootTitle.toLowerCase();
  const storeMainFileLower = mainFile ? normalizeVirtualPath(mainFile).toLowerCase() : null;

  const hasRootDocument = allFileNodes.some((rf) => {
    const rfFullLower = normalizeVirtualPath(rf.title || rf.displayLabel).toLowerCase();
    return (
      rf.id === parentPage?.id ||
      rf.id === mainFileId ||
      Boolean(rf.isRootDoc) ||
      rfFullLower === resolvedRootTitleLower ||
      (storeMainFileLower !== null && rfFullLower === storeMainFileLower) ||
      rfFullLower === 'main.tex'
    );
  });

  if (parentPage && !hasRootDocument && !fileNodeById.has(parentPage.id)) {
    const rootNode: FileTreeFileNode = {
      type: 'file',
      id: parentPage.id,
      nodeId: parentPage.id,
      docId: parentPage.id,
      pageId: resolvedPageId,
      projectId: resolvedProjectId,
      title: resolvedRootTitle,
      displayLabel: splitVirtualPath(resolvedRootTitle).leafName || resolvedRootTitle,
      updatedAt: parentPage.updatedAt || new Date().toISOString(),
      kind: 'tex',
      isRootDoc: true,
    };
    rootFiles.unshift(rootNode);
    allFileNodes.unshift(rootNode);
    fileNodeById.set(parentPage.id, rootNode);
    fileNodeByPath.set(resolvedRootTitle, rootNode);
  }

  // 4. Enforce single isRootDoc invariant across the tree
  const primaryRootNode =
    allFileNodes.find((n) => Boolean(n.isRootDoc)) ||
    (mainFileId ? allFileNodes.find((n) => n.id === mainFileId || n.nodeId === mainFileId) : undefined) ||
    (configuredMainFile ? allFileNodes.find((n) => matchesFileTarget(n, configuredMainFile)) : undefined) ||
    (mainFile ? allFileNodes.find((n) => matchesFileTarget(n, mainFile)) : undefined) ||
    (parentPage?.id ? allFileNodes.find((n) => n.id === parentPage.id) : undefined) ||
    allFileNodes.find((n) => matchesFileTarget(n, 'main.tex'));

  for (const node of allFileNodes) {
    if (node.kind === 'tex') {
      node.isRootDoc = primaryRootNode ? node.id === primaryRootNode.id : false;
    }
  }

  // 5. Sort root files and folder hierarchy naturally
  rootFiles.sort((a, b) => {
    const prioA = getRootFilePriority(a, mainFileId, configuredMainFile, parentPageId, mainFile || 'main.tex', mainBibFile || 'references.bib');
    const prioB = getRootFilePriority(b, mainFileId, configuredMainFile, parentPageId, mainFile || 'main.tex', mainBibFile || 'references.bib');
    if (prioA !== prioB) return prioA - prioB;
    return NATURAL_COLLATOR.compare(a.displayLabel, b.displayLabel);
  });

  const sortedFolders = Array.from(topFolders.values()).sort((a, b) =>
    NATURAL_COLLATOR.compare(a.name, b.name),
  );
  sortedFolders.forEach(sortFolderRecursively);

  return [...rootFiles, ...sortedFolders];
}

export const buildUnifiedTree = buildFileTree;

/**
 * Flattens a hierarchical file tree into a depth-first ordered list of nodes.
 */
export function flattenFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  const flat: FileTreeNode[] = [];
  const walk = (items: FileTreeNode[]) => {
    for (const node of items) {
      flat.push(node);
      if (node.type === 'folder' && node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return flat;
}

/**
 * Finds a file or folder node in the tree by its virtual path or ID.
 */
export function findNodeByPath(nodes: FileTreeNode[], targetPathOrId: string): FileTreeNode | undefined {
  const cleanTarget = normalizeVirtualPath(targetPathOrId).toLowerCase();
  if (!cleanTarget) return undefined;

  for (const node of nodes) {
    if (node.type === 'file') {
      const nodePath = normalizeVirtualPath(node.title || node.displayLabel).toLowerCase();
      if (
        node.id === targetPathOrId ||
        node.nodeId === targetPathOrId ||
        node.docId === targetPathOrId ||
        nodePath === cleanTarget ||
        (!cleanTarget.includes('/') && node.displayLabel.toLowerCase() === cleanTarget)
      ) {
        return node;
      }
    } else {
      const folderPath = normalizeVirtualPath(node.fullPath || node.path || node.name).toLowerCase();
      if (node.id === targetPathOrId || folderPath === cleanTarget) {
        return node;
      }
      const foundInChildren = findNodeByPath(node.children, targetPathOrId);
      if (foundInChildren) return foundInChildren;
    }
  }
  return undefined;
}

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
