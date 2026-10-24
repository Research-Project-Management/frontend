/**
 * document-tree.ts
 *
 * Pure, deterministic tree-building algorithms for Editor File Explorer:
 * - Smart LaTeX academic research folder categorization
 * - Priority-based sorting (Main document -> Preamble -> References -> Structured Folders)
 * - Deep recursive filtering by file/folder name
 *
 * Domain: Layer 1 (Pure Domain Model & Document Hierarchy).
 */

import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import { displayName } from '@/features/editor/domain/document/document-naming';

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

/**
 * Intelligently categorizes flat research files into Overleaf standard academic folders
 */
export function inferResearchFolder(
  filename: string,
  configuredMainFile?: string | null,
  parentPageTitle?: string | null,
  mainFile = 'main.tex',
  mainBibFile = 'references.bib',
): string | null {
  const lower = filename.toLowerCase();

  // Root files should never be auto-categorized into subfolders
  if (
    (configuredMainFile && lower === configuredMainFile.toLowerCase()) ||
    (mainFile && lower === mainFile.toLowerCase()) ||
    (mainBibFile && mainBibFile !== 'auto' && lower === mainBibFile.toLowerCase()) ||
    (parentPageTitle && lower === parentPageTitle.toLowerCase()) ||
    lower === 'main.tex' ||
    lower === 'preamble.tex' ||
    lower === 'references.bib'
  ) {
    return null;
  }

  if (
    /^\d\d_/.test(lower) ||
    lower.includes('abstract') ||
    lower.includes('intro') ||
    lower.includes('related') ||
    lower.includes('prelim') ||
    lower.includes('method') ||
    lower.includes('theoret') ||
    lower.includes('experiment') ||
    lower.includes('ablation') ||
    lower.includes('discuss') ||
    lower.includes('conclu')
  ) {
    return 'sections';
  }

  if (lower.startsWith('table') || lower.includes('benchmark')) {
    return 'tables';
  }

  if (lower.startsWith('alg') || lower.includes('algorithm')) {
    return 'algorithms';
  }

  if (lower.startsWith('appendix') || lower.startsWith('app_')) {
    return 'appendices';
  }

  if (lower.startsWith('math_') || lower.startsWith('notation_') || lower.includes('macro')) {
    return 'macros';
  }

  if (lower.endsWith('.sty') || lower.endsWith('.cls') || lower.includes('style')) {
    return 'styles';
  }

  if (lower.startsWith('fig') || /\.(png|jpe?g|svg|webp|eps)$/i.test(lower)) {
    return 'figures';
  }

  if (lower.includes('slide') || lower.includes('defense') || lower.includes('beamer')) {
    return 'supplementary';
  }

  return null;
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

  // 1. If explicit mainFileId is supplied, it is the sole authority on what item is main
  if (mainFileId) {
    if (item.id === mainFileId) return 1;
  } else if (configuredMainFile) {
    if (lower === configuredMainFile.toLowerCase()) return 1;
  } else {
    // No explicit mainFileId or configuredMainFile
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
 * Standard Overleaf academic folder sequence priority
 */
export function getFolderPriority(folderName: string): number {
  const f = folderName.toLowerCase();
  if (f === 'sections' || f === 'chapters' || f === 'src') return 10;
  if (f === 'figures' || f === 'images' || f === 'plots') return 20;
  if (f === 'tables') return 30;
  if (f === 'algorithms') return 40;
  if (f.startsWith('appendi')) return 50;
  if (f === 'macros') return 60;
  if (f === 'styles') return 70;
  if (f === 'supplementary') return 80;
  return 90;
}

const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/**
 * Builds the complete unified hierarchical tree from backend database documents and storage items
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

  const ensureFolderHierarchy = (
    rawFolderPath: string,
    explicitId?: string,
    storageData?: StorageItem
  ): FileTreeFolderNode | null => {
    const segments = rawFolderPath.replace(/\\/g, '/').split('/').map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) return null;

    let currentPath = '';
    let parentFolder: FileTreeFolderNode | null = null;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const key = currentPath.toLowerCase();
      let folder = allFoldersByPath.get(key);

      if (!folder) {
        const isLeaf = i === segments.length - 1;
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
      } else if (i === segments.length - 1) {
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

  // 1. Explicit storage folders from projectFiles
  projectFiles?.forEach((f) => {
    if (f.isFolder && f.id !== projectId && f.id !== parentPageId) {
      const name = (f.filename || '').trim();
      if (name) {
        ensureFolderHierarchy(name, f.id, f);
      }
    }
  });

  const existingTexTitles = new Set<string>();
  const seenFileIds = new Set<string>();

  // 2. Process TeX files
  files?.forEach((f) => {
    const rawPath = (f.title || '').trim().replace(/\\/g, '/');
    if (!rawPath) return;
    if (f.id && seenFileIds.has(f.id)) return;
    const normPathLower = rawPath.replace(/^\/+/, '').toLowerCase();
    if (existingTexTitles.has(normPathLower)) return;

    const resolvedTitle = f.title || rawPath;
    existingTexTitles.add(normPathLower);
    if (f.id) seenFileIds.add(f.id);

    const parts = rawPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      const rawFileName = displayName(parts[0] || resolvedTitle);
      const isExplicitRoot = Boolean(f.isRootDoc || (mainFileId && f.id === mainFileId));
      const inferredFolder = isExplicitRoot
        ? null
        : inferResearchFolder(
            rawFileName,
            configuredMainFile,
            parentPage?.title,
            mainFile || 'main.tex',
            mainBibFile || 'references.bib',
          );

      if (inferredFolder) {
        const folder = ensureFolderHierarchy(inferredFolder);
        folder?.children.push({
          type: 'file',
          id: f.id,
          title: resolvedTitle,
          displayLabel: rawFileName,
          updatedAt: f.updatedAt,
          kind: 'tex',
          isRootDoc: Boolean(f.isRootDoc),
        });
      } else {
        rootFiles.push({
          type: 'file',
          id: f.id,
          title: resolvedTitle,
          displayLabel: rawFileName,
          updatedAt: f.updatedAt,
          kind: 'tex',
          isRootDoc: Boolean(f.isRootDoc),
        });
      }
    } else {
      const folderPath = parts.slice(0, -1).join('/');
      const leafName = parts[parts.length - 1];
      const folder = ensureFolderHierarchy(folderPath);
      folder?.children.push({
        type: 'file',
        id: f.id,
        title: resolvedTitle,
        displayLabel: displayName(leafName),
        updatedAt: f.updatedAt,
        kind: 'tex',
        isRootDoc: Boolean(f.isRootDoc),
      });
    }
  });

  // 3. Root TeX document
  const resolvedRootTitle = configuredMainFile || mainFile || 'main.tex';
  const resolvedRootTitleLower = resolvedRootTitle.toLowerCase();
  const storeMainFileLower = mainFile ? mainFile.toLowerCase() : null;

  const hasRootDocument =
    rootFiles.some((rf) => {
      if (rf.type !== 'file') return false;
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
    existingTexTitles.has(resolvedRootTitleLower) ||
    Boolean(storeMainFileLower && existingTexTitles.has(storeMainFileLower)) ||
    existingTexTitles.has('main.tex');

  if (parentPage && !hasRootDocument && !seenFileIds.has(parentPage.id)) {
    rootFiles.unshift({
      type: 'file',
      id: parentPage.id,
      title: resolvedRootTitle,
      displayLabel: resolvedRootTitle,
      updatedAt: parentPage.updatedAt || new Date().toISOString(),
      kind: 'tex',
      isRootDoc: true,
    });
    seenFileIds.add(parentPage.id);
    existingTexTitles.add(resolvedRootTitleLower);
  }

  // 4. Storage assets / files
  const seenAssetPaths = new Set<string>();
  projectFiles?.forEach((f) => {
    if (f.isFolder) return;
    if (f.id && seenFileIds.has(f.id)) return;
    const fname = (f.filename || '').trim();
    if (
      !fname ||
      f.id === projectId ||
      f.id === parentPageId ||
      fname.toLowerCase() === 'flux' ||
      fname === '.keep' ||
      fname.startsWith('.')
    ) {
      return;
    }
    if (!fname.includes('.') && (!f.size || f.size === 0) && !f.url) {
      return;
    }
    const rawPath = fname.replace(/\\/g, '/');
    const normAssetLower = rawPath.replace(/^\/+/, '').toLowerCase();
    if (existingTexTitles.has(normAssetLower) || seenAssetPaths.has(normAssetLower)) return;
    seenAssetPaths.add(normAssetLower);
    if (f.id) seenFileIds.add(f.id);

    const parts = rawPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      const inferredFolder = inferResearchFolder(
        parts[0],
        configuredMainFile,
        parentPage?.title,
        mainFile || 'main.tex',
        mainBibFile || 'references.bib',
      );
      if (inferredFolder) {
        const folder = ensureFolderHierarchy(inferredFolder);
        folder?.children.push({
          type: 'file',
          id: f.id,
          title: f.filename,
          displayLabel: parts[0],
          kind: 'asset',
          storageData: f,
        });
      } else {
        rootFiles.push({
          type: 'file',
          id: f.id,
          title: f.filename,
          displayLabel: parts[0],
          kind: 'asset',
          storageData: f,
        });
      }
    } else {
      const folderPath = parts.slice(0, -1).join('/');
      const leafName = parts[parts.length - 1];
      const folder = ensureFolderHierarchy(folderPath);
      folder?.children.push({
        type: 'file',
        id: f.id,
        title: f.filename,
        displayLabel: leafName,
        kind: 'asset',
        storageData: f,
      });
    }
  });

  // 5. Enforce single isRootDoc invariant across the entire tree
  const allFileNodes: FileTreeFileNode[] = [...rootFiles];
  const collectFileNodes = (nodes: FileTreeNode[]) => {
    for (const n of nodes) {
      if (n.type === 'file') {
        allFileNodes.push(n);
      } else {
        collectFileNodes(n.children);
      }
    }
  };
  for (const folder of topFolders.values()) {
    collectFileNodes(folder.children);
  }

  let primaryRootNode: FileTreeFileNode | undefined;
  if (mainFileId) {
    primaryRootNode = allFileNodes.find((n) => n.id === mainFileId);
  }
  if (!primaryRootNode && configuredMainFile) {
    const cfgLower = configuredMainFile.toLowerCase();
    primaryRootNode = allFileNodes.find(
      (n) => n.title.toLowerCase() === cfgLower || n.displayLabel.toLowerCase() === cfgLower
    );
  }
  if (!primaryRootNode) {
    primaryRootNode = allFileNodes.find((n) => Boolean(n.isRootDoc));
  }
  if (!primaryRootNode && storeMainFileLower) {
    primaryRootNode = allFileNodes.find(
      (n) => n.title.toLowerCase() === storeMainFileLower || n.displayLabel.toLowerCase() === storeMainFileLower
    );
  }
  if (!primaryRootNode && parentPage?.id) {
    primaryRootNode = allFileNodes.find((n) => n.id === parentPage.id);
  }
  if (!primaryRootNode) {
    primaryRootNode = allFileNodes.find((n) => n.displayLabel.toLowerCase() === 'main.tex');
  }
  for (const node of allFileNodes) {
    if (node.kind === 'tex') {
      node.isRootDoc = primaryRootNode ? node.id === primaryRootNode.id : false;
    }
  }

  // Sort root files
  rootFiles.sort((a, b) => {
    const prioA = getRootFilePriority(a, mainFileId, configuredMainFile, parentPageId, mainFile || 'main.tex', mainBibFile || 'references.bib');
    const prioB = getRootFilePriority(b, mainFileId, configuredMainFile, parentPageId, mainFile || 'main.tex', mainBibFile || 'references.bib');
    if (prioA !== prioB) return prioA - prioB;
    return NATURAL_COLLATOR.compare(a.displayLabel, b.displayLabel);
  });

  // Sort folders and their nested children recursively
  const sortFolderChildrenRecursively = (folder: FileTreeFolderNode) => {
    for (const child of folder.children) {
      if (child.type === 'folder') {
        sortFolderChildrenRecursively(child);
      }
    }
    folder.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      if (a.type === 'folder' && b.type === 'folder') {
        const prioA = getFolderPriority(a.name);
        const prioB = getFolderPriority(b.name);
        if (prioA !== prioB) return prioA - prioB;
        return NATURAL_COLLATOR.compare(a.name, b.name);
      }
      if (a.type === 'file' && b.type === 'file') {
        return NATURAL_COLLATOR.compare(a.displayLabel, b.displayLabel);
      }
      return 0;
    });
  };

  const sortedFolders = Array.from(topFolders.values()).sort((a, b) => {
    const prioA = getFolderPriority(a.name);
    const prioB = getFolderPriority(b.name);
    if (prioA !== prioB) return prioA - prioB;
    return NATURAL_COLLATOR.compare(a.name, b.name);
  });

  sortedFolders.forEach(sortFolderChildrenRecursively);

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
