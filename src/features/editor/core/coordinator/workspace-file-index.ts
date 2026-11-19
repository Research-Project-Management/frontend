/**
 * workspace-file-index.ts
 *
 * Workspace Project File Index, Lookup, Structure Sync & Symbol Indexing Helpers.
 */

import type { StructureNodeDto } from '@/features/editor/sdk/pages/types';
import { pagesService } from '@/features/editor/sdk/pages.service';
import type {
  WorkspaceNotificationPort,
  WorkspaceServicePort,
  WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';
import { toast } from 'sonner';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { usePageStore } from '../store/editor.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useSettingsStore } from '../store/settings.store';
import { documentFacade } from './document.facade';

export const defaultWorkspaceServicePort: WorkspaceServicePort = {
  createNode: (projectId, data) => pagesService.structure.createNode(projectId, data),
  renameNode: (projectId, itemId, data) => pagesService.structure.renameNode(projectId, itemId, data),
  deleteNode: (projectId, fileId) => pagesService.structure.deleteNode(projectId, fileId),
  moveNode: (projectId, itemId, data) => pagesService.structure.moveNode(projectId, itemId, data),
  restoreFile: (fileId) => pagesService.docs.restore(fileId),
  setRootDoc: (projectId, fileId) => pagesService.structure.setRootDoc(projectId, fileId),
  getFilesByProjectId: (projectId) => pagesService.docs.getFiles(projectId),
  updateFileContent: (fileId, content) => pagesService.docs.updateContent(fileId, content),
};

export const defaultWorkspaceNotificationPort: WorkspaceNotificationPort = {
  notifySuccess: (message, id) => {
    toast.success(message, id ? { id } : undefined);
  },
  notifyError: (message, id) => {
    toast.error(message, id ? { id } : undefined);
  },
  notifyInfo: (message, id) => {
    toast.info(message, id ? { id } : undefined);
  },
};

export const defaultWorkspaceStorePort: WorkspaceStorePort = {
  getActiveProjectId: () => {
    const state = usePageStore.getState();
    return (
      state.rootPageId ||
      state.parentPageId ||
      state.projectId ||
      state.spaceId ||
      state.currentPage?.id ||
      null
    );
  },
  closeTab: (fileId: string) => {
    const wsStore = useWorkspaceStore.getState();
    if (wsStore.secondaryFileId === fileId) {
      wsStore.setSecondaryFileId(null);
    }
    for (const projId of Object.keys(wsStore.tabsByProject)) {
      wsStore.closeTab(projId, fileId);
    }
    const pageStore = usePageStore.getState();
    if (pageStore.activeFilePage?.id === fileId) {
      const parentPage = pageStore.currentPage;
      pageStore.setActiveFilePage(parentPage && parentPage.id !== fileId ? parentPage : null);
    }
  },
  updateTabTitle: (projectId: string, itemId: string, newTitle: string) => {
    const wsStore = useWorkspaceStore.getState();
    for (const projId of Object.keys(wsStore.tabsByProject)) {
      wsStore.updateTabTitle(projId, itemId, newTitle);
    }
    if (projectId && !wsStore.tabsByProject[projectId]) {
      wsStore.updateTabTitle(projectId, itemId, newTitle);
    }
  },
  setMainFile: (fileNameOrId: string) => {
    useSettingsStore.getState().setMainFile(fileNameOrId);
  },
  getActiveDocumentId: () => usePageStore.getState().getActiveDocument()?.id ?? null,
};

export type CreatedFileNode = Partial<StructureNodeDto> & {
  id: string;
  name?: string;
  docId?: string | null;
  fileId?: string | null;
  title?: string;
  content?: string;
  path?: string;
};

export type WorkspaceProjectItem = {
  id: string;
  nodeId?: string;
  docId?: string | null;
  fileId?: string | null;
  pageId?: string | null;
  projectId?: string | null;
  isFolder?: boolean;
  isRootDoc?: boolean;
  nodeType?: 'FOLDER' | 'DOC' | 'FILE';
  title?: string;
  name?: string;
  path?: string;
  content?: unknown;
};

export interface WorkspaceStructureSyncItem {
  id: string;
  nodeId?: string;
  pageId?: string | null;
  projectId?: string | null;
  docId?: string | null;
  fileId?: string | null;
  filename?: string;
  path?: string;
  isFolder?: boolean;
}

export function findWorkspaceProjectItem(
  projectFiles: WorkspaceProjectItem[],
  projectFilesByScope: Map<string, WorkspaceProjectItem[]>,
  itemId: string,
  scopeKey?: string,
): WorkspaceProjectItem | undefined {
  const list =
    (scopeKey ? projectFilesByScope.get(scopeKey) : undefined) || projectFiles;
  return list.find(
    (f) => f.id === itemId || f.nodeId === itemId || f.docId === itemId || f.fileId === itemId,
  );
}

export function resolveWorkspaceDocId(
  projectFiles: WorkspaceProjectItem[],
  projectFilesByScope: Map<string, WorkspaceProjectItem[]>,
  itemIdOrPath: string,
  scopeKey?: string,
): string {
  const cleanTarget = normalizeVirtualPath(itemIdOrPath);
  const list =
    (scopeKey ? projectFilesByScope.get(scopeKey) : undefined) || projectFiles;
  const matched = list.find(
    (f) =>
      f.id === itemIdOrPath ||
      f.nodeId === itemIdOrPath ||
      f.docId === itemIdOrPath ||
      f.fileId === itemIdOrPath ||
      (cleanTarget &&
        normalizeVirtualPath(f.path || f.title || f.name || '') === cleanTarget),
  );
  return matched?.docId || matched?.id || itemIdOrPath;
}

export function indexDocumentInWorkspace(
  projectId: string,
  fileId: string,
  filePath: string,
  content: string,
): void {
  lruDocumentCache.warm(fileId, {
    filePath,
    content,
    projectId,
  });
  if (content) {
    latexDependencyGraph.parseAndRegister(filePath, content, fileId);
    latexSymbolsIndex.indexFile(fileId, filePath, content);
  }
}

export function runInitProjectSymbols(state: {
  files: WorkspaceProjectItem[];
  projectFiles: WorkspaceProjectItem[];
  projectFilesByScope: Map<string, WorkspaceProjectItem[]>;
  lastIndexedProjectKey: string;
  lastIndexedFingerprint: string;
  projectKey: string;
}): {
  skipped: boolean;
  projectFiles: WorkspaceProjectItem[];
  lastIndexedProjectKey: string;
  lastIndexedFingerprint: string;
} {
  const { files, projectFiles, projectFilesByScope, lastIndexedProjectKey, lastIndexedFingerprint, projectKey } =
    state;
  const fingerprint = `${projectKey}::${files
    .map((f) => {
      const path = f.path || f.title || f.name || f.id;
      const contentLen = extractDocumentContentString(f.content).length;
      return `${f.id}:${path}:${contentLen}`;
    })
    .join('|')}`;

  if (fingerprint === lastIndexedFingerprint && projectFiles.length >= files.length) {
    return {
      skipped: true,
      projectFiles,
      lastIndexedProjectKey,
      lastIndexedFingerprint,
    };
  }

  const projectChanged = lastIndexedProjectKey !== '' && lastIndexedProjectKey !== projectKey;
  const activePageScopeId =
    (typeof usePageStore?.getState === 'function'
      ? usePageStore.getState().rootPageId || usePageStore.getState().parentPageId
      : null) || '';
  const candidatePools = [
    ...(projectFilesByScope.get(projectKey) ?? []),
    ...(activePageScopeId && activePageScopeId !== projectKey
      ? (projectFilesByScope.get(activePageScopeId) ?? [])
      : []),
    ...(projectChanged ? [] : projectFiles),
  ];
  const preservedMap = new Map<string, WorkspaceProjectItem>();
  for (const pf of candidatePools) {
    if (!(pf.isFolder || pf.fileId || pf.nodeType === 'FOLDER' || pf.nodeType === 'FILE')) continue;
    if (
      !pf.pageId ||
      pf.pageId === projectKey ||
      (activePageScopeId && pf.pageId === activePageScopeId)
    ) {
      preservedMap.set(pf.id, pf);
    }
  }
  const preservedStructureRecords = Array.from(preservedMap.values());
  const scopedExisting =
    projectFilesByScope.get(projectKey) ?? (projectChanged ? [] : projectFiles);
  const existingById = new Map(scopedExisting.map((pf) => [pf.id, pf]));
  const mergedDocs = files.map((f) => {
    const prior = existingById.get(f.id);
    return prior
      ? {
          ...prior,
          ...f,
          pageId: f.pageId ?? prior.pageId ?? projectKey,
          nodeId: f.nodeId ?? prior.nodeId,
          docId: f.docId ?? prior.docId ?? f.id,
        }
      : {
          ...f,
          pageId: f.pageId ?? projectKey,
        };
  });
  const mergedDocIds = new Set(mergedDocs.map((d) => d.id));
  const nextProjectFiles = [
    ...mergedDocs,
    ...preservedStructureRecords.filter((r) => !mergedDocIds.has(r.id)),
  ];
  projectFilesByScope.set(projectKey, nextProjectFiles);

  latexSymbolsIndex.clear();
  latexDependencyGraph.clear();
  if (projectChanged) {
    diagnosticsCoordinator.clearDiagnostics();
  }
  documentFacade.hydrateServerProjectFiles(projectKey, nextProjectFiles);

  return {
    skipped: false,
    projectFiles: nextProjectFiles,
    lastIndexedProjectKey: projectKey,
    lastIndexedFingerprint: fingerprint,
  };
}

export function mergeWorkspaceStructureItems(state: {
  items: WorkspaceStructureSyncItem[];
  projectFiles: WorkspaceProjectItem[];
  projectFilesByScope: Map<string, WorkspaceProjectItem[]>;
  lastIndexedProjectKey: string;
  lastIndexedFingerprint: string;
  activeScope: string;
}): {
  projectFiles: WorkspaceProjectItem[];
  lastIndexedProjectKey: string;
  lastIndexedFingerprint: string;
} {
  const { items, projectFiles, projectFilesByScope, lastIndexedProjectKey, lastIndexedFingerprint, activeScope } =
    state;
  const scopeSwitched =
    lastIndexedProjectKey !== '' &&
    activeScope !== 'default' &&
    lastIndexedProjectKey !== activeScope;

  const nextLastIndexedProjectKey = scopeSwitched ? activeScope : lastIndexedProjectKey;
  const nextLastIndexedFingerprint = scopeSwitched ? '' : lastIndexedFingerprint;

  const baseList = scopeSwitched
    ? (projectFilesByScope.get(activeScope) ?? [])
    : projectFiles.filter((pf) => !pf.pageId || pf.pageId === activeScope);

  const byId = new Map<string, WorkspaceProjectItem>();
  for (const existing of baseList) {
    byId.set(existing.id, existing);
  }
  for (const item of items) {
    const cleanPath = normalizeVirtualPath(item.path || item.filename || '');
    const primaryId = item.docId || item.id;
    const existing = byId.get(primaryId) || byId.get(item.id);
    byId.set(primaryId, {
      ...existing,
      id: primaryId,
      nodeId: item.nodeId || item.id,
      pageId: item.pageId ?? existing?.pageId ?? activeScope,
      projectId: item.projectId ?? existing?.projectId ?? null,
      docId: item.docId ?? existing?.docId ?? null,
      fileId: item.fileId ?? existing?.fileId ?? null,
      isFolder: Boolean(item.isFolder),
      name: item.filename || existing?.name || cleanPath,
      title: cleanPath || existing?.title || item.filename,
      path: cleanPath || existing?.path || item.filename,
    });
  }
  const nextProjectFiles = Array.from(byId.values());
  if (activeScope) {
    projectFilesByScope.set(activeScope, nextProjectFiles);
  }
  return {
    projectFiles: nextProjectFiles,
    lastIndexedProjectKey: nextLastIndexedProjectKey,
    lastIndexedFingerprint: nextLastIndexedFingerprint,
  };
}
