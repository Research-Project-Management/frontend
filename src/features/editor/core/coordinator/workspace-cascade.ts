/**
 * workspace-cascade.ts
 *
 * Workspace Path-Change Cascade, File/Folder Resource Eviction, and Root Delete Protection.
 */

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
} from '@/features/editor/domain/offline-storage';
import {
  normalizeVirtualPath,
  isUnderVirtualFolder,
  rewritePathPrefix,
} from '@/features/editor/domain/document/document-naming';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { evictYjsProviderByDocId } from '@/features/editor/sdk/realtime';
import { editorCommandBus } from '../bus/command-bus';
import { sessionCoordinator } from './session.coordinator';
import { useWorkspaceStore } from '../store/workspace.store';
import { usePageStore } from '../store/editor.store';
import { documentFacade } from './document.facade';
import {
  findWorkspaceProjectItem,
  type WorkspaceProjectItem,
} from './workspace-file-index';

export interface WorkspaceCascadeCallbacks {
  updateTabTitleInStore: (projectId: string, itemId: string, newTitle: string) => void;
  closeTabInStore: (fileId: string) => void;
  getActiveProjectId: () => string | null;
}

export function executeCascadePathChange(params: {
  effectiveProjectId: string;
  itemId: string;
  oldPath: string;
  newPath: string;
  projectFiles: WorkspaceProjectItem[];
  projectFilesByScope: Map<string, WorkspaceProjectItem[]>;
  updateTabTitleInStore: (projectId: string, itemId: string, newTitle: string) => void;
}): WorkspaceProjectItem[] {
  const {
    effectiveProjectId,
    itemId,
    oldPath,
    newPath,
    projectFiles,
    projectFilesByScope,
    updateTabTitleInStore,
  } = params;

  updateTabTitleInStore(effectiveProjectId, itemId, newPath);
  updateTabTitleInStore(effectiveProjectId, `asset:${itemId}`, newPath);

  const wsStore = useWorkspaceStore.getState();
  const oldPrefix = normalizeVirtualPath(oldPath);
  const newPrefix = normalizeVirtualPath(newPath);
  if (oldPrefix && oldPrefix !== newPrefix) {
    for (const [pId, tabs] of Object.entries(wsStore.tabsByProject)) {
      let changed = false;
      const nextTabs = tabs.map((t) => {
        let nextTab = t;
        if (t.id === itemId || t.id === `asset:${itemId}`) {
          changed = true;
          nextTab = { ...nextTab, title: newPath, path: newPath };
        } else {
          if (t.path) {
            const rewrittenPath = rewritePathPrefix(t.path, oldPrefix, newPrefix);
            if (rewrittenPath !== null) {
              changed = true;
              nextTab = { ...nextTab, path: rewrittenPath };
            }
          }
          if (t.title) {
            const rewrittenTitle = rewritePathPrefix(t.title, oldPrefix, newPrefix);
            if (rewrittenTitle !== null) {
              changed = true;
              nextTab = { ...nextTab, title: rewrittenTitle };
            }
          }
        }
        if (nextTab !== t) {
          Object.defineProperty(nextTab, 'isDirty', {
            get: () => lruDocumentCache.isDirty(t.id),
            enumerable: true,
            configurable: true,
          });
        }
        return nextTab;
      });
      if (changed) {
        useWorkspaceStore.setState((s) => ({
          tabsByProject: { ...s.tabsByProject, [pId]: nextTabs },
        }));
      }
    }
  }

  const pageStore = usePageStore.getState();
  if (pageStore.activeFilePage?.id === itemId) {
    pageStore.setActiveFilePage({
      ...pageStore.activeFilePage,
      title: newPath,
      path: newPath,
    });
  } else if (oldPrefix && (pageStore.activeFilePage?.path || pageStore.activeFilePage?.title)) {
    const activePath = pageStore.activeFilePage.path || pageStore.activeFilePage.title || '';
    const rewrittenActiveTitle = rewritePathPrefix(activePath, oldPrefix, newPrefix);
    if (rewrittenActiveTitle !== null) {
      pageStore.setActiveFilePage({
        ...pageStore.activeFilePage,
        title: rewrittenActiveTitle,
        path: rewrittenActiveTitle,
      });
    }
  }
  if (pageStore.currentPage?.id === itemId) {
    pageStore.setCurrentPage((prev) => (prev ? { ...prev, title: newPath, path: newPath } : prev));
  }
  const matchedRootItem = findWorkspaceProjectItem(
    projectFiles,
    projectFilesByScope,
    itemId,
    effectiveProjectId || undefined,
  );
  const currentMainPath = pageStore.mainFilePath ? normalizeVirtualPath(pageStore.mainFilePath) : '';
  const isRootItem =
    Boolean(pageStore.rootDocId && (pageStore.rootDocId === itemId || matchedRootItem?.docId === pageStore.rootDocId)) ||
    Boolean(oldPrefix && currentMainPath && currentMainPath === oldPrefix);
  if (isRootItem) {
    const nextMainPath = newPrefix || normalizeVirtualPath(newPath) || newPath;
    if (nextMainPath) {
      pageStore.setMainFilePath(nextMainPath);
      latexDependencyGraph.setServerRootDoc(nextMainPath, pageStore.rootDocId);
    }
  } else if (oldPrefix && currentMainPath) {
    const rewrittenMain = rewritePathPrefix(currentMainPath, oldPrefix, newPrefix);
    if (rewrittenMain !== null) {
      pageStore.setMainFilePath(rewrittenMain);
      latexDependencyGraph.setServerRootDoc(rewrittenMain, pageStore.rootDocId);
    }
  }
  if (pageStore.selectedAsset) {
    const asset = pageStore.selectedAsset;
    const rewrittenAssetPath = oldPrefix
      ? rewritePathPrefix(asset.filename || '', oldPrefix, newPrefix)
      : null;
    if (asset.id === itemId || rewrittenAssetPath !== null) {
      pageStore.setSelectedAsset({
        ...asset,
        filename: asset.id === itemId ? newPath : (rewrittenAssetPath ?? asset.filename),
      });
    }
  }

  const cachedModel = lruDocumentCache.getModel(itemId);
  lruDocumentCache.renameFile(itemId, newPath);
  void unsyncedEditsStore.renamePath(oldPath, newPath, itemId).catch(() => {});
  void syncedDocCacheStore.renamePath(oldPath, newPath, itemId).catch(() => {});
  const cascadedDescendants = oldPrefix
    ? lruDocumentCache.renameFolderPrefix(oldPrefix, newPrefix)
    : [];
  for (const desc of cascadedDescendants) {
    void unsyncedEditsStore.renamePath(desc.oldPath, desc.newPath, desc.fileId).catch(() => {});
    void syncedDocCacheStore.renamePath(desc.oldPath, desc.newPath, desc.fileId).catch(() => {});
  }
  const cascadedIds = new Set(cascadedDescendants.map((d) => d.fileId));
  const unopenedDescendants: Array<{
    ids: string[];
    oldPath: string;
    newPath: string;
    content: string;
  }> = [];

  let updatedProjectFiles = projectFiles;
  if (projectFiles.length > 0) {
    updatedProjectFiles = projectFiles.map((f) => {
      if (f.id === itemId || f.nodeId === itemId || f.docId === itemId) {
        return { ...f, title: newPath, path: newPath };
      }
      if (oldPrefix) {
        const oldFPath = f.path || f.title || f.name || '';
        const rewrittenFPath = rewritePathPrefix(oldFPath, oldPrefix, newPrefix);
        if (rewrittenFPath !== null) {
          const candidateIds = [f.id, f.nodeId, f.docId].filter(
            (x): x is string => typeof x === 'string' && x.length > 0,
          );
          if (!f.isFolder && !candidateIds.some((id) => cascadedIds.has(id))) {
            unopenedDescendants.push({
              ids: candidateIds,
              oldPath: oldFPath,
              newPath: rewrittenFPath,
              content: extractDocumentContentString(f.content),
            });
          }
          return { ...f, title: rewrittenFPath, path: rewrittenFPath };
        }
      }
      return f;
    });
    if (effectiveProjectId) {
      projectFilesByScope.set(effectiveProjectId, updatedProjectFiles);
    }
    documentFacade.hydrateServerProjectFiles(effectiveProjectId, updatedProjectFiles);
  }

  editorCommandBus.dispatch({ type: 'diagnostics:rename-path', oldPath, newPath });
  for (const desc of cascadedDescendants) {
    editorCommandBus.dispatch({
      type: 'diagnostics:rename-path',
      oldPath: desc.oldPath,
      newPath: desc.newPath,
    });
  }
  for (const desc of unopenedDescendants) {
    editorCommandBus.dispatch({
      type: 'diagnostics:rename-path',
      oldPath: desc.oldPath,
      newPath: desc.newPath,
    });
  }

  latexDependencyGraph.removeFileNode(oldPath);
  latexSymbolsIndex.removeFile(itemId, oldPath);
  const contentToIndex = cachedModel?.content || documentFacade.getDocumentContent(itemId);
  if (contentToIndex) {
    latexDependencyGraph.parseAndRegister(newPath, contentToIndex, itemId);
    latexSymbolsIndex.indexFile(itemId, newPath, contentToIndex);
  }
  for (const desc of cascadedDescendants) {
    latexDependencyGraph.removeFileNode(desc.oldPath);
    latexSymbolsIndex.removeFile(desc.fileId, desc.oldPath);
    if (desc.content) {
      latexDependencyGraph.parseAndRegister(desc.newPath, desc.content, desc.fileId);
      latexSymbolsIndex.indexFile(desc.fileId, desc.newPath, desc.content);
    }
  }
  for (const desc of unopenedDescendants) {
    latexDependencyGraph.removeFileNode(desc.oldPath);
    for (const fid of desc.ids) {
      latexSymbolsIndex.removeFile(fid, desc.oldPath);
    }
    if (desc.content && desc.ids[0]) {
      latexDependencyGraph.parseAndRegister(desc.newPath, desc.content, desc.ids[0]);
      latexSymbolsIndex.indexFile(desc.ids[0], desc.newPath, desc.content);
    }
  }

  return updatedProjectFiles;
}

export function executeEvictDeletedFileResources(params: {
  fileId: string;
  effectiveProjectId: string | null;
  projectFiles: WorkspaceProjectItem[];
  projectFilesByScope: Map<string, WorkspaceProjectItem[]>;
  closeTabInStore: (fileId: string) => void;
}): WorkspaceProjectItem[] {
  const { fileId, effectiveProjectId, projectFiles, projectFilesByScope, closeTabInStore } = params;

  const cachedModel = lruDocumentCache.getModel(fileId);
  const fileObj = findWorkspaceProjectItem(projectFiles, projectFilesByScope, fileId);
  const resolvedDocId = fileObj?.docId || fileId;
  const resolvedNodeId = fileObj?.nodeId || fileObj?.id || fileId;
  const filePath = cachedModel?.filePath || fileObj?.path || fileObj?.title || fileObj?.name;

  const candidateIds = new Set<string>([fileId]);
  if (resolvedDocId) candidateIds.add(resolvedDocId);
  if (resolvedNodeId) candidateIds.add(resolvedNodeId);

  for (const id of candidateIds) {
    evictYjsProviderByDocId(id, { skipFlush: true });
    sessionCoordinator.evictDeletedFile(id);
    lruDocumentCache.evictModel(id, { skipPersistence: true });
    editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId: id });
    editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId: `asset:${id}` });
    closeTabInStore(id);
    closeTabInStore(`asset:${id}`);
  }

  const wsStore = useWorkspaceStore.getState();
  if (wsStore.secondaryFileId && candidateIds.has(wsStore.secondaryFileId)) {
    wsStore.setSecondaryFileId(null);
  }
  const pageStore = usePageStore.getState();
  if (
    (pageStore.selectedAsset?.id && candidateIds.has(pageStore.selectedAsset.id)) ||
    (filePath &&
      normalizeVirtualPath(pageStore.selectedAsset?.filename) ===
        normalizeVirtualPath(filePath))
  ) {
    pageStore.setSelectedAsset(null);
  }

  const cleanFolderPrefix = normalizeVirtualPath(filePath);
  if (cleanFolderPrefix) {
    for (const model of lruDocumentCache.getAllModels()) {
      if (isUnderVirtualFolder(model.filePath, cleanFolderPrefix)) {
        sessionCoordinator.evictDeletedFile(model.fileId);
        lruDocumentCache.evictModel(model.fileId, { skipPersistence: true });
        closeTabInStore(model.fileId);
        latexDependencyGraph.removeFileNode(model.filePath);
        latexSymbolsIndex.removeFile(model.fileId, model.filePath);
      }
    }
    for (const f of projectFiles) {
      const fPath = f.path || f.title || f.name || '';
      if (isUnderVirtualFolder(fPath, cleanFolderPrefix)) {
        const descIds = [f.id, f.nodeId, f.docId, f.fileId].filter(
          (x): x is string => typeof x === 'string' && x.length > 0,
        );
        for (const dId of descIds) {
          evictYjsProviderByDocId(dId, { skipFlush: true });
          sessionCoordinator.evictDeletedFile(dId);
          lruDocumentCache.evictModel(dId, { skipPersistence: true });
          closeTabInStore(dId);
          closeTabInStore(`asset:${dId}`);
        }
        latexDependencyGraph.removeFileNode(fPath);
        for (const dId of descIds) {
          latexSymbolsIndex.removeFile(dId, fPath);
        }
      }
    }
    const latestWs = useWorkspaceStore.getState();
    for (const [pId, tabs] of Object.entries(latestWs.tabsByProject)) {
      for (const t of tabs) {
        const tabPath = t.path || t.title || '';
        if (isUnderVirtualFolder(tabPath, cleanFolderPrefix)) {
          latestWs.closeTab(pId, t.id);
        }
      }
    }
    if (
      pageStore.selectedAsset?.filename &&
      isUnderVirtualFolder(pageStore.selectedAsset.filename, cleanFolderPrefix)
    ) {
      pageStore.setSelectedAsset(null);
    }
  }

  if (filePath) {
    editorCommandBus.dispatch({ type: 'diagnostics:remove-path', filePath });
  }
  latexDependencyGraph.removeFileNode(filePath || fileId);
  for (const id of candidateIds) {
    latexSymbolsIndex.removeFile(id, filePath);
  }

  let nextProjectFiles = projectFiles;
  if (projectFiles.length > 0 && effectiveProjectId) {
    nextProjectFiles = projectFiles.filter((f) => {
      if (f.id === fileId || f.nodeId === fileId || f.docId === fileId) return false;
      if (cleanFolderPrefix && isUnderVirtualFolder(f.path || f.title || f.name || '', cleanFolderPrefix)) {
        return false;
      }
      return true;
    });
    projectFilesByScope.set(effectiveProjectId, nextProjectFiles);
    documentFacade.hydrateServerProjectFiles(effectiveProjectId, nextProjectFiles);
  }

  return nextProjectFiles;
}

export function isRootFileProtectedFromDelete(
  fileId: string,
  fileObj: WorkspaceProjectItem | undefined,
  projectFiles: WorkspaceProjectItem[],
): { isRootProtected: boolean; folderPrefix: string } {
  const storeRootDocId =
    typeof usePageStore?.getState === 'function' ? usePageStore.getState().rootDocId : null;
  const folderPrefix = fileObj?.isFolder
    ? normalizeVirtualPath(fileObj.path || fileObj.title || fileObj.name || '')
    : '';
  const isRootProtected =
    Boolean(fileObj?.isRootDoc) ||
    Boolean(
      storeRootDocId &&
        (fileId === storeRootDocId || fileObj?.docId === storeRootDocId),
    ) ||
    Boolean(
      fileObj?.isFolder &&
        folderPrefix &&
        projectFiles.some((pf) => {
          const p = pf.path || pf.title || pf.name || '';
          const matchesRoot =
            Boolean(pf.isRootDoc) ||
            Boolean(storeRootDocId && (pf.id === storeRootDocId || pf.docId === storeRootDocId));
          return matchesRoot && isUnderVirtualFolder(p, folderPrefix);
        }),
    );

  return { isRootProtected, folderPrefix };
}

export function executeReconcileRemoteFileTreeEvent(params: {
  payload?: Record<string, unknown>;
  effectiveProjectId: string;
  findProjectItem: (itemId: string, scopeKey?: string) => WorkspaceProjectItem | undefined;
  evictDeletedFileResources: (fileId: string, optProjectId?: string) => void;
  cascadePathChange: (effectiveProjectId: string, itemId: string, oldPath: string, newPath: string) => void;
  setMainFileInStore: (filePath: string, rootDocId?: string | null) => void;
}): void {
  const {
    payload,
    effectiveProjectId,
    findProjectItem,
    evictDeletedFileResources,
    cascadePathChange,
    setMainFileInStore,
  } = params;
  if (!payload || typeof payload !== 'object') return;
  const action = typeof payload.action === 'string' ? payload.action : '';
  const node = (payload.node || payload.file) as
    | {
        id?: string;
        nodeId?: string;
        docId?: string | null;
        fileId?: string | null;
        name?: string;
        title?: string;
        path?: string;
        isRootDoc?: boolean;
      }
    | undefined;

  if (action === 'delete') {
    if (payload.local === true) return;
    const targetId =
      (typeof payload.fileId === 'string' ? payload.fileId : '') ||
      node?.docId ||
      node?.id ||
      '';
    if (targetId) evictDeletedFileResources(targetId, effectiveProjectId || undefined);
    if (node?.id && node.id !== targetId) {
      evictDeletedFileResources(node.id, effectiveProjectId || undefined);
    }
    return;
  }

  if ((action === 'rename' || action === 'move') && node) {
    if (payload.local === true) return;
    const targetId = node.docId || node.id || '';
    const newPath = normalizeVirtualPath(node.path || node.title || node.name || '');
    if (targetId && newPath) {
      const existing =
        findProjectItem(targetId) || (node.id ? findProjectItem(node.id) : undefined);
      const cached = lruDocumentCache.getModel(targetId);
      const oldPath = normalizeVirtualPath(
        cached?.filePath || existing?.path || existing?.title || existing?.name || '',
      );
      if (oldPath && oldPath !== newPath) {
        cascadePathChange(effectiveProjectId, targetId, oldPath, newPath);
      }
    }
    return;
  }

  if (action === 'set-root' && node) {
    const rootPath = normalizeVirtualPath(node.path || node.title || node.name || '');
    const rootDocId = node.docId || node.id || null;
    if (rootPath) setMainFileInStore(rootPath, rootDocId);
  }
}
