/**
 * tree-builder.util.ts
 *
 * Pure, deterministic tree-building algorithms for Editor File Explorer:
 * - Smart LaTeX academic research folder categorization
 * - Priority-based sorting (Main document -> Preamble -> References -> Structured Folders)
 * - Deep recursive filtering by file/folder name
 */

import type { EditorStorageItem as StorageItem } from '@/features/editor/coordinators/services/storage.service';
import { displayName } from './TexFileRow';

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
  projectFiles?: any[] | null;
  files?: any[] | null;
  parentPage?: { id: string; title?: string; updatedAt?: string; mainFile?: any } | null;
  projectId?: string | null;
  parentPageId?: string | null;
  mainFileId?: string | null;
  configuredMainFile?: string | null;
}

/**
 * Intelligently categorizes flat research files into Overleaf standard academic folders
 */
export function inferResearchFolder(
  filename: string,
  configuredMainFile?: string | null,
  parentPageTitle?: string | null,
): string | null {
  const lower = filename.toLowerCase();

  // Root files should never be auto-categorized into subfolders
  if (
    (configuredMainFile && lower === configuredMainFile.toLowerCase()) ||
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
): number {
  const lower = item.displayLabel.toLowerCase();
  if (
    item.id === mainFileId ||
    (configuredMainFile && lower === configuredMainFile.toLowerCase()) ||
    item.id === parentPageId
  ) {
    return 1;
  }
  if (lower === 'preamble.tex') return 2;
  if (lower === 'references.bib') return 3;
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
  } = params;

  const rootFiles: FileTreeFileNode[] = [];
  const folderMap = new Map<string, FileTreeFolderNode>();

  // 1. Explicit storage folders from projectFiles
  projectFiles?.forEach((f: any) => {
    if (f.isFolder && f.id !== projectId && f.id !== parentPageId) {
      const name = (f.filename || '').trim();
      if (name && !folderMap.has(name)) {
        folderMap.set(name, {
          type: 'folder',
          id: f.id || `folder:${name}`,
          name,
          fullPath: name,
          children: [],
          storageData: f,
        });
      }
    }
  });

  const existingTexTitles = new Set<string>();

  // 2. Process TeX files
  files?.forEach((f: any) => {
    const rawPath = (f.title || '').trim().replace(/\\/g, '/');
    if (!rawPath) return;
    existingTexTitles.add(rawPath.toLowerCase());

    const parts = rawPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      const rawFileName = displayName(parts[0] || f.title);
      const inferredFolder = inferResearchFolder(
        rawFileName,
        configuredMainFile,
        parentPage?.title,
      );

      if (inferredFolder) {
        if (!folderMap.has(inferredFolder)) {
          folderMap.set(inferredFolder, {
            type: 'folder',
            id: `folder:${inferredFolder}`,
            name: inferredFolder,
            fullPath: inferredFolder,
            children: [],
          });
        }
        folderMap.get(inferredFolder)!.children.push({
          type: 'file',
          id: f.id,
          title: f.title,
          displayLabel: rawFileName,
          updatedAt: f.updatedAt,
          kind: 'tex',
          isRootDoc: Boolean(f.isRootDoc),
        });
      } else {
        rootFiles.push({
          type: 'file',
          id: f.id,
          title: f.title,
          displayLabel: rawFileName,
          updatedAt: f.updatedAt,
          kind: 'tex',
          isRootDoc: Boolean(f.isRootDoc),
        });
      }
    } else {
      const folderName = parts[0];
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, {
          type: 'folder',
          id: `folder:${folderName}`,
          name: folderName,
          fullPath: folderName,
          children: [],
        });
      }
      const leafName = parts.slice(1).join('/');
      folderMap.get(folderName)!.children.push({
        type: 'file',
        id: f.id,
        title: f.title,
        displayLabel: displayName(leafName),
        updatedAt: f.updatedAt,
        kind: 'tex',
        isRootDoc: Boolean(f.isRootDoc),
      });
    }
  });

  // 3. Root TeX document (canonical Overleaf entrypoint is always main.tex)
  const resolvedRootTitle = configuredMainFile || 'main.tex';

  const hasRootDocument =
    rootFiles.some(
      (rf) =>
        rf.type === 'file' &&
        (rf.id === parentPage?.id ||
          rf.id === mainFileId ||
          rf.displayLabel.toLowerCase() === resolvedRootTitle.toLowerCase() ||
          rf.displayLabel.toLowerCase() === 'main.tex'),
    ) ||
    existingTexTitles.has(resolvedRootTitle.toLowerCase()) ||
    existingTexTitles.has('main.tex');

  if (parentPage && !hasRootDocument) {
    rootFiles.unshift({
      type: 'file',
      id: parentPage.id,
      title: resolvedRootTitle,
      displayLabel: resolvedRootTitle,
      updatedAt: parentPage.updatedAt || new Date().toISOString(),
      kind: 'tex',
      isRootDoc: true,
    });
  }

  // 4. Storage assets / files
  projectFiles?.forEach((f: any) => {
    if (f.isFolder) return;
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
    if (existingTexTitles.has(fname.toLowerCase())) return;

    const rawPath = fname.replace(/\\/g, '/');
    const parts = rawPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      const inferredFolder = inferResearchFolder(
        parts[0],
        configuredMainFile,
        parentPage?.title,
      );
      if (inferredFolder) {
        if (!folderMap.has(inferredFolder)) {
          folderMap.set(inferredFolder, {
            type: 'folder',
            id: `folder:${inferredFolder}`,
            name: inferredFolder,
            fullPath: inferredFolder,
            children: [],
          });
        }
        folderMap.get(inferredFolder)!.children.push({
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
      const folderName = parts[0];
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, {
          type: 'folder',
          id: `folder:${folderName}`,
          name: folderName,
          fullPath: folderName,
          children: [],
        });
      }
      folderMap.get(folderName)!.children.push({
        type: 'file',
        id: f.id,
        title: f.filename,
        displayLabel: parts.slice(1).join('/'),
        kind: 'asset',
        storageData: f,
      });
    }
  });

  // Sort root files
  rootFiles.sort((a, b) => {
    const prioA = getRootFilePriority(a, mainFileId, configuredMainFile, parentPageId);
    const prioB = getRootFilePriority(b, mainFileId, configuredMainFile, parentPageId);
    if (prioA !== prioB) return prioA - prioB;
    return a.displayLabel.localeCompare(b.displayLabel, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  // Sort folders
  const sortedFolders = Array.from(folderMap.values()).sort((a, b) => {
    const prioA = getFolderPriority(a.name);
    const prioB = getFolderPriority(b.name);
    if (prioA !== prioB) return prioA - prioB;
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  // Sort children inside each folder naturally
  sortedFolders.forEach((folder) => {
    folder.children.sort((a, b) => {
      if (a.type === 'file' && b.type === 'file') {
        return a.displayLabel.localeCompare(b.displayLabel, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
      return 0;
    });
  });

  return [...rootFiles, ...sortedFolders];
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
