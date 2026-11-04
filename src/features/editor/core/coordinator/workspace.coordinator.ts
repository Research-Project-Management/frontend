/**
 * workspace.coordinator.ts
 *
 * Workspace & File System Lifecycle Coordinator (Coordinators Layer).
 * Location: `features/editor/core/coordinator/workspace.coordinator.ts`
 *
 * Single Source of Truth for File / Folder Mutations:
 * - Creates files & folders and registers them in the DAG engine.
 * - Renames files: cascades updates across Tabs, LRU Cache, DAG relations, and Diagnostics.
 * - Deletes files: closes open tabs, evicts from cache, and cleans diagnostics.
 * - Moves files: recalculates relative include paths.
 * - Dispatches typed notifications on `editorCommandBus`.
 * - Deep Module architecture with ports for Service, Notification, and Store isolation.
 */

import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { type LinkedFileDto } from '@/features/editor/sdk/manuscript/types';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  normalizeVirtualPath,
  splitVirtualPath,
  joinVirtualPath,
  isUnderVirtualFolder,
  rewritePathPrefix,
  parseVirtualFolderId,
} from '@/features/editor/domain/document/document-naming';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import type {
  WorkspaceCoordinatorPorts,
  WorkspaceNotificationPort,
  WorkspaceServicePort,
  WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';
import { editorCommandBus, getEditorEngineForFile } from '../bus/command-bus';
import { sessionCoordinator } from './session.coordinator';
import { useWorkspaceStore } from '../store/workspace.store';
import { usePageStore } from '../store/editor.store';
import { useSettingsStore } from '../store/settings.store';
import { documentFacade } from './document.facade';
import { toast } from 'sonner';

export interface CreateFileOptions {
  name: string;
  folderId?: string | null;
  content?: string;
  projectId?: string;
  openAfterCreate?: boolean;
}

export interface RenameItemOptions {
  itemId: string;
  oldName: string;
  newName: string;
  projectId?: string;
}

export interface MoveItemOptions {
  itemId: string;
  targetFolderId: string | null;
  projectId?: string;
}

type CreatedFileNode = LinkedFileDto & { title?: string; content?: string; path?: string };

const defaultServicePort: WorkspaceServicePort = {
  createNode: (projectId, data) => manuscriptService.structure.createNode(projectId, data),
  renameNode: (projectId, itemId, data) => manuscriptService.structure.renameNode(projectId, itemId, data),
  deleteNode: (projectId, fileId) => manuscriptService.structure.deleteNode(projectId, fileId),
  moveNode: (projectId, itemId, data) => manuscriptService.structure.moveNode(projectId, itemId, data),
  restoreFile: (fileId) => manuscriptService.docs.restore(fileId),
  setRootDoc: (projectId, fileId) => manuscriptService.structure.setRootDoc(projectId, fileId),
  getFilesByProjectId: (projectId) => manuscriptService.docs.getFiles(projectId),
  updateFileContent: (fileId, content) => manuscriptService.docs.updateContent(fileId, content),
};

const defaultNotificationPort: WorkspaceNotificationPort = {
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

const defaultStorePort: WorkspaceStorePort = {
  getActiveProjectId: () => {
    const state = usePageStore.getState();
    return (
      state.rootPageId ||
      state.parentPageId ||
      state.projectId ||
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

export class WorkspaceCoordinator {
  private initialized = false;
  private projectFiles: Array<{
    id: string;
    nodeId?: string;
    docId?: string | null;
    fileId?: string | null;
    pageId?: string | null;
    projectId?: string | null;
    isFolder?: boolean;
    title?: string;
    name?: string;
    path?: string;
    content?: unknown;
  }> = [];
  private projectFilesByScope = new Map<
    string,
    Array<{
      id: string;
      nodeId?: string;
      docId?: string | null;
      fileId?: string | null;
      pageId?: string | null;
      projectId?: string | null;
      isFolder?: boolean;
      title?: string;
      name?: string;
      path?: string;
      content?: unknown;
    }>
  >();
  private servicePort: WorkspaceServicePort = defaultServicePort;
  private notificationPort: WorkspaceNotificationPort = defaultNotificationPort;
  private storePort: WorkspaceStorePort = defaultStorePort;

  constructor(ports?: WorkspaceCoordinatorPorts) {
    if (ports) {
      this.setPorts(ports);
    }
    this.initCommandSubscriptions();
  }

  public setPorts(ports: WorkspaceCoordinatorPorts): void {
    if (ports.service) this.servicePort = ports.service;
    if (ports.notification) this.notificationPort = ports.notification;
    if (ports.store) this.storePort = ports.store;
  }

  public resetPorts(): void {
    this.servicePort = defaultServicePort;
    this.notificationPort = defaultNotificationPort;
    this.storePort = defaultStorePort;
  }

  private getActiveProjectId(): string | null {
    return this.storePort.getActiveProjectId();
  }

  private closeTabInStore(fileId: string): void {
    this.storePort.closeTab(fileId);
  }

  private updateTabTitleInStore(projectId: string, itemId: string, newTitle: string): void {
    this.storePort.updateTabTitle(projectId, itemId, newTitle);
  }

  private initCommandSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    editorCommandBus.registerExecutor('workspace:create-file', async (cmd) => {
      return this.createFile({
        name: cmd.name,
        folderId: cmd.folderId,
        content: cmd.content,
      });
    });

    editorCommandBus.registerExecutor('workspace:rename-file', async (cmd) => {
      return this.renameItem({
        itemId: cmd.fileId,
        oldName: cmd.oldPath,
        newName: cmd.newPath,
      });
    });

    editorCommandBus.registerExecutor('workspace:delete-file', async (cmd) => {
      return this.deleteFile(cmd.fileId);
    });

    editorCommandBus.registerExecutor('workspace:restore-file', async (cmd) => {
      return this.restoreFile(cmd.fileId, cmd.projectId);
    });

    editorCommandBus.registerExecutor('workspace:set-main-file', async (cmd) => {
      return this.setMainFile(cmd.fileId, cmd.projectId);
    });

    editorCommandBus.registerExecutor('workspace:move-file', async (cmd) => {
      return this.moveItem({
        itemId: cmd.fileId,
        targetFolderId: cmd.targetFolderId,
      });
    });

    editorCommandBus.subscribe('workspace:open-file', (cmd) => {
      editorCommandBus.dispatch({
        type: 'navigation:open-tab',
        fileId: cmd.fileId,
        title: cmd.filePath || cmd.fileId,
        path: cmd.filePath,
      });
    });

    editorCommandBus.subscribe('history:open-modal', () => {
      useSettingsStore.getState().setIsHistoryOpen(true);
    });

    editorCommandBus.subscribe('history:open', () => {
      useSettingsStore.getState().setIsHistoryOpen(true);
    });

    editorCommandBus.subscribe('citation:open-picker', (cmd) => {
      editorCommandBus.dispatch({
        type: 'dialog:open',
        dialog: 'citation-picker',
        payload: cmd.initialQuery ? { initialQuery: cmd.initialQuery } : undefined,
      });
    });

    editorCommandBus.subscribe('citation:insert', (cmd) => {
      editorCommandBus.dispatch({
        type: 'editor:insert-citation',
        bibKey: cmd.bibKey,
        entry: cmd.entry,
      });
    });

    editorCommandBus.subscribe('diagnostics:clear', () => {
      diagnosticsCoordinator.clearDiagnostics();
    });

    editorCommandBus.subscribe('filetree:updated', (cmd) => {
      this.reconcileRemoteFileTreeEvent(
        cmd.payload && typeof cmd.payload === 'object'
          ? (cmd.payload as Record<string, unknown>)
          : undefined,
      );
    });

    editorCommandBus.registerExecutor('editor:rename-citekey', async (cmd) => {
      return this.refactorCitekey(cmd.oldKey, cmd.newKey);
    });
  }

  /**
   * Reconciles remote WebSocket `fileTree:update` payloads (create, rename, move, delete, set-root)
   * against open tabs, active document, LRU cache, and settings store even when `FilesTab` is unmounted.
   */
  public reconcileRemoteFileTreeEvent(payload?: Record<string, unknown>): void {
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

    const effectiveProjectId = this.getActiveProjectId() || '';

    if (action === 'delete') {
      if (payload.local === true) return;
      const targetId =
        (typeof payload.fileId === 'string' ? payload.fileId : '') ||
        node?.docId ||
        node?.id ||
        '';
      if (targetId) {
        this.evictDeletedFileResources(targetId, effectiveProjectId || undefined);
      }
      if (node?.id && node.id !== targetId) {
        this.evictDeletedFileResources(node.id, effectiveProjectId || undefined);
      }
      return;
    }

    if ((action === 'rename' || action === 'move') && node) {
      if (payload.local === true) return;
      const targetId = node.docId || node.id || '';
      const newPath = normalizeVirtualPath(node.path || node.title || node.name || '');
      if (targetId && newPath) {
        const existing = this.findProjectItem(targetId) || (node.id ? this.findProjectItem(node.id) : undefined);
        const cached = lruDocumentCache.getModel(targetId);
        const oldPath = normalizeVirtualPath(
          cached?.filePath || existing?.path || existing?.title || existing?.name || '',
        );
        if (oldPath && oldPath !== newPath) {
          this.cascadePathChange(effectiveProjectId, targetId, oldPath, newPath);
        }
      }
      return;
    }

    if (action === 'set-root' && node) {
      const rootPath = normalizeVirtualPath(node.path || node.title || node.name || '');
      if (rootPath) {
        this.storePort.setMainFile(rootPath);
      }
    }
  }

  private findProjectItem(itemId: string, scopeKey?: string) {
    const list =
      (scopeKey ? this.projectFilesByScope.get(scopeKey) : undefined) || this.projectFiles;
    return list.find(
      (f) => f.id === itemId || f.nodeId === itemId || f.docId === itemId || f.fileId === itemId,
    );
  }

  /**
   * Resolves the canonical document ID (`docId`) for a virtual tree item ID, nodeId, or path.
   */
  public resolveDocId(itemIdOrPath: string, scopeKey?: string): string {
    const cleanTarget = normalizeVirtualPath(itemIdOrPath);
    const list =
      (scopeKey ? this.projectFilesByScope.get(scopeKey) : undefined) || this.projectFiles;
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

  /**
   * Creates a new LaTeX or asset file in the workspace
   */
  public async createFile(options: CreateFileOptions): Promise<LinkedFileDto | null> {
    const { name, folderId = null, content = '', projectId: optProjectId, openAfterCreate = true } = options;
    const effectiveProjectId = optProjectId || this.getActiveProjectId();

    if (!effectiveProjectId) {
      this.notificationPort.notifyError('Cannot create file: no active project');
      return null;
    }

    try {
      const { folderPath, leafName } = splitVirtualPath(name);
      const effectiveLeafName = leafName || name;
      const explicitPath = !folderId && folderPath ? `/${normalizeVirtualPath(name)}` : undefined;

      const res = (await this.servicePort.createNode(effectiveProjectId, {
        name: explicitPath ? effectiveLeafName : name,
        ...(explicitPath ? { path: explicitPath } : {}),
        parentId: folderId,
        content,
        type: 'DOC',
      })) as ({ data?: CreatedFileNode } & CreatedFileNode & { path?: string }) | null;
      const newFile = res?.data || res;

      if (!newFile) return null;

      const resolvedFileId = newFile.docId || newFile.id;
      const resolvedTitle =
        normalizeVirtualPath(newFile.path || newFile.title || '') ||
        newFile.name ||
        name;
      const resolvedContent = newFile.content || content;

      // 1 & 2. Warm LRU cache + Register in LaTeX DAG Engine & Symbol Index
      this.indexDocumentInWorkspace(
        effectiveProjectId,
        resolvedFileId,
        resolvedTitle,
        resolvedContent,
      );

      // 3. Notify FileTree & CommandBus
      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'create', file: newFile, local: true },
      });

      // 4. Auto-open in tab if requested
      if (openAfterCreate) {
        editorCommandBus.dispatch({
          type: 'navigation:open-tab',
          fileId: resolvedFileId,
          title: resolvedTitle,
          path: resolvedTitle,
        });
      }

      this.notificationPort.notifySuccess(`Created "${name}"`, `create-file-${name}`);
      return newFile;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Create file error:', err);
      this.notificationPort.notifyError((err as Error)?.message || `Failed to create "${name}"`, `create-file-${name}`);
      return null;
    }
  }

  /**
   * Shared path-change cascade across Tabs, PageStore, LRU Cache, ProjectFiles,
   * Diagnostics aliases, LaTeX DAG, and Symbol Index for both file and folder renames/moves.
   */
  private cascadePathChange(
    effectiveProjectId: string,
    itemId: string,
    oldPath: string,
    newPath: string,
  ): void {
    // 1. Cascade path/title change to Tabs Store across all project/page scopes
    this.updateTabTitleInStore(effectiveProjectId, itemId, newPath);

    const wsStore = useWorkspaceStore.getState();
    const oldPrefix = normalizeVirtualPath(oldPath);
    const newPrefix = normalizeVirtualPath(newPath);
    if (oldPrefix && oldPrefix !== newPrefix) {
      for (const [pId, tabs] of Object.entries(wsStore.tabsByProject)) {
        let changed = false;
        const nextTabs = tabs.map((t) => {
          let nextTab = t;
          if (t.path) {
            const rewrittenPath = rewritePathPrefix(t.path, oldPrefix, newPrefix, true);
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

    // 2. Cascade to PageStore if active or current page matches (or is under renamed/moved folder)
    const pageStore = usePageStore.getState();
    if (pageStore.activeFilePage?.id === itemId) {
      pageStore.setActiveFilePage({
        ...pageStore.activeFilePage,
        title: newPath,
      });
    } else if (oldPrefix && pageStore.activeFilePage?.title) {
      const rewrittenActiveTitle = rewritePathPrefix(pageStore.activeFilePage.title, oldPrefix, newPrefix);
      if (rewrittenActiveTitle !== null) {
        pageStore.setActiveFilePage({
          ...pageStore.activeFilePage,
          title: rewrittenActiveTitle,
        });
      }
    }
    if (pageStore.currentPage?.id === itemId) {
      pageStore.setCurrentPage((prev) => (prev ? { ...prev, title: newPath } : prev));
    }

    // 3. Cascade to LRU Cache & Project Files cache (including folder prefix descendants)
    const cachedModel = lruDocumentCache.getModel(itemId);
    lruDocumentCache.renameFile(itemId, newPath);
    const cascadedDescendants = oldPrefix
      ? lruDocumentCache.renameFolderPrefix(oldPrefix, newPrefix)
      : [];
    if (this.projectFiles.length > 0) {
      this.projectFiles = this.projectFiles.map((f) => {
        if (f.id === itemId || f.nodeId === itemId || f.docId === itemId) {
          return { ...f, title: newPath, path: newPath };
        }
        if (oldPrefix) {
          const rewrittenFPath = rewritePathPrefix(f.path || f.title || f.name || '', oldPrefix, newPrefix);
          if (rewrittenFPath !== null) {
            return { ...f, title: rewrittenFPath, path: rewrittenFPath };
          }
        }
        return f;
      });
      if (effectiveProjectId) {
        this.projectFilesByScope.set(effectiveProjectId, this.projectFiles);
      }
      documentFacade.hydrateServerProjectFiles(effectiveProjectId, this.projectFiles);
    }

    // 4. Cascade to Diagnostics Coordinator (alias old path to new path)
    diagnosticsCoordinator.registerAlias(newPath, oldPath);
    for (const desc of cascadedDescendants) {
      diagnosticsCoordinator.registerAlias(desc.newPath, desc.oldPath);
    }

    // 5. Re-index in LaTeX DAG & Symbols
    latexDependencyGraph.removeFileNode(oldPath);
    const contentToIndex = cachedModel?.content || documentFacade.getDocumentContent(itemId);
    if (contentToIndex) {
      latexDependencyGraph.parseAndRegister(newPath, contentToIndex, itemId);
      latexSymbolsIndex.indexFile(itemId, newPath, contentToIndex);
    }
    for (const desc of cascadedDescendants) {
      latexDependencyGraph.removeFileNode(desc.oldPath);
      if (desc.content) {
        latexDependencyGraph.parseAndRegister(desc.newPath, desc.content, desc.fileId);
        latexSymbolsIndex.indexFile(desc.fileId, desc.newPath, desc.content);
      }
    }
  }

  /**
   * Canonical cleanup of all client-side workspace caches, tabs, split panes,
   * DAG nodes, and symbol index entries when a file or folder is deleted.
   */
  public evictDeletedFileResources(fileId: string, optProjectId?: string): void {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    const cachedModel = lruDocumentCache.getModel(fileId);
    const fileObj = this.findProjectItem(fileId);
    const resolvedDocId = fileObj?.docId || fileId;
    const resolvedNodeId = fileObj?.nodeId || fileObj?.id || fileId;
    const filePath = cachedModel?.filePath || fileObj?.path || fileObj?.title || fileObj?.name;

    const candidateIds = new Set<string>([fileId]);
    if (resolvedDocId) candidateIds.add(resolvedDocId);
    if (resolvedNodeId) candidateIds.add(resolvedNodeId);

    for (const id of candidateIds) {
      sessionCoordinator.evictDeletedFile(id);
      lruDocumentCache.evictModel(id);
      editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId: id });
      editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId: `asset:${id}` });
      this.closeTabInStore(id);
      this.closeTabInStore(`asset:${id}`);
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
          lruDocumentCache.evictModel(model.fileId);
          this.closeTabInStore(model.fileId);
          latexDependencyGraph.removeFileNode(model.filePath);
          latexSymbolsIndex.removeFile(model.fileId, model.filePath);
        }
      }
      for (const f of this.projectFiles) {
        const fPath = f.path || f.title || f.name || '';
        if (isUnderVirtualFolder(fPath, cleanFolderPrefix)) {
          const descIds = [f.id, f.nodeId, f.docId, f.fileId].filter(
            (x): x is string => typeof x === 'string' && x.length > 0,
          );
          for (const dId of descIds) {
            sessionCoordinator.evictDeletedFile(dId);
            lruDocumentCache.evictModel(dId);
            this.closeTabInStore(dId);
            this.closeTabInStore(`asset:${dId}`);
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

    latexDependencyGraph.removeFileNode(filePath || fileId);
    latexSymbolsIndex.removeFile(fileId, filePath);
    if (this.projectFiles.length > 0 && effectiveProjectId) {
      this.projectFiles = this.projectFiles.filter((f) => {
        if (f.id === fileId || f.nodeId === fileId || f.docId === fileId) return false;
        if (cleanFolderPrefix && isUnderVirtualFolder(f.path || f.title || f.name || '', cleanFolderPrefix)) {
          return false;
        }
        return true;
      });
      this.projectFilesByScope.set(effectiveProjectId, this.projectFiles);
      documentFacade.hydrateServerProjectFiles(effectiveProjectId, this.projectFiles);
    }
  }

  /**
   * Renames a file or folder and cascades updates across IDE systems
   */
  public async renameItem(options: RenameItemOptions): Promise<boolean> {
    const { itemId, oldName, newName, projectId: optProjectId } = options;
    const effectiveProjectId = optProjectId || this.getActiveProjectId();

    if (!effectiveProjectId) return false;

    try {
      const { folderPath: oldFolderPath } = splitVirtualPath(oldName);
      const { folderPath: newFolderPath, leafName: newLeafName } = splitVirtualPath(newName);
      const effectiveLeafName = newLeafName || newName;
      const resolvedFullNewPath =
        newFolderPath
          ? normalizeVirtualPath(newName)
          : oldFolderPath
            ? joinVirtualPath(oldFolderPath, effectiveLeafName)
            : effectiveLeafName;

      await this.servicePort.renameNode(effectiveProjectId, itemId, {
        name: newFolderPath && newFolderPath !== oldFolderPath ? resolvedFullNewPath : effectiveLeafName,
      });

      this.cascadePathChange(effectiveProjectId, itemId, oldName, resolvedFullNewPath);

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'rename', itemId, oldName, newName: resolvedFullNewPath, local: true },
      });

      this.notificationPort.notifySuccess(`Renamed to "${effectiveLeafName}"`, `rename-file-${itemId}`);
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Rename error:', err);
      this.notificationPort.notifyError(
        (err as Error)?.message || `Failed to rename "${oldName}"`,
        `rename-file-${itemId}`
      );
      return false;
    }
  }

  /**
   * Deletes a file and cleans up IDE resources
   */
  public async deleteFile(fileId: string, optProjectId?: string): Promise<boolean> {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    if (!effectiveProjectId) return false;

    try {
      await this.servicePort.deleteNode(effectiveProjectId, fileId);
      this.evictDeletedFileResources(fileId, effectiveProjectId);

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'delete', fileId, local: true },
      });

      this.notificationPort.notifySuccess('File moved to trash', `delete-file-${fileId}`);
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Delete error:', err);
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to delete file', `delete-file-${fileId}`);
      return false;
    }
  }

  /**
   * Resolves a folder ID or path when given a virtual `folder:<path>` ID
   * or a real backend folder UUID.
   */
  public async ensureFolderHierarchyId(
    targetFolderId: string | null | undefined,
  ): Promise<{ id: string | null; path: string }> {
    if (!targetFolderId) {
      return { id: null, path: '' };
    }
    const virtualFolderPath = parseVirtualFolderId(targetFolderId);
    if (virtualFolderPath === null) {
      const folderObj = this.findProjectItem(targetFolderId);
      const path = normalizeVirtualPath(folderObj?.path || folderObj?.title || folderObj?.name || '');
      return { id: targetFolderId, path };
    }

    const existingFolder = this.projectFiles.find((pf) => {
      const pfPath = normalizeVirtualPath(pf.path || pf.title || pf.name || '');
      return pfPath === virtualFolderPath && !pf.id.startsWith('folder:');
    });
    if (existingFolder?.id) {
      return { id: existingFolder.nodeId || existingFolder.id, path: virtualFolderPath };
    }

    return { id: null, path: virtualFolderPath };
  }

  /**
   * Moves a file/folder to a new parent folder
   */
  public async moveItem(options: MoveItemOptions): Promise<boolean> {
    const { itemId, targetFolderId, projectId: optProjectId } = options;
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    if (!effectiveProjectId) return false;

    try {
      const cachedModel = lruDocumentCache.getModel(itemId);
      const fileObj = this.findProjectItem(itemId);
      const oldPath = cachedModel?.filePath || fileObj?.path || fileObj?.title || fileObj?.name || '';

      const { id: resolvedTargetFolderId, path: targetFolderPrefix } =
        await this.ensureFolderHierarchyId(targetFolderId);

      const { leafName } = splitVirtualPath(oldPath);
      const computedDestPath =
        !resolvedTargetFolderId && targetFolderPrefix && leafName
          ? `/${joinVirtualPath(targetFolderPrefix, leafName)}`
          : undefined;

      const moveRes = (await this.servicePort.moveNode(effectiveProjectId, itemId, {
        destParentId: resolvedTargetFolderId,
        ...(computedDestPath ? { destPath: computedDestPath } : {}),
      })) as { path?: string; data?: { path?: string } } | null;

      const returnedPath = normalizeVirtualPath(moveRes?.data?.path || moveRes?.path || '');
      const nextPath =
        returnedPath ||
        (leafName ? joinVirtualPath(targetFolderPrefix, leafName) : '');

      if (nextPath && oldPath && nextPath !== normalizeVirtualPath(oldPath)) {
        this.cascadePathChange(effectiveProjectId, itemId, oldPath, nextPath);
      }

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: {
          action: 'move',
          itemId,
          targetFolderId: resolvedTargetFolderId,
          oldName: oldPath,
          newName: nextPath,
          local: true,
        },
      });

      this.notificationPort.notifySuccess('Moved successfully', `move-file-${itemId}`);
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Move error:', err);
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to move item', `move-file-${itemId}`);
      return false;
    }
  }

  /**
   * Restores a deleted file from trash, warms cache, re-indexes symbols and DAG
   */
  public async restoreFile(fileId: string, optProjectId?: string): Promise<unknown> {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    try {
      const res = (await this.servicePort.restoreFile(fileId, effectiveProjectId || undefined)) as {
        page?: { id: string; title?: string; name?: string; content?: unknown; projectId?: string };
        data?: { id: string; title?: string; name?: string; content?: unknown; projectId?: string };
        id?: string;
        title?: string;
        name?: string;
        content?: unknown;
        projectId?: string;
      } | null;
      const page = res?.page || res?.data || res;

      if (page) {
        const docId = page.id || fileId;
        const docTitle = page.title || page.name || 'restored.tex';
        const docContent = typeof page.content === 'string' ? page.content : '';
        this.indexDocumentInWorkspace(
          page.projectId || effectiveProjectId || '',
          docId,
          docTitle,
          docContent,
        );
      }

      // 3. Notify CommandBus & filetree
      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'restore', fileId, page },
      });

      this.notificationPort.notifySuccess('File restored', `restore-file-${fileId}`);
      return res;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Restore error:', err);
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to restore file', `restore-file-${fileId}`);
      throw err;
    }
  }

  /**
   * Sets a document as the primary LaTeX entry point (Main Document)
   */
  public async setMainFile(fileId: string, optProjectId?: string): Promise<boolean> {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    if (!effectiveProjectId) return false;

    try {
      await this.servicePort.setRootDoc(effectiveProjectId, fileId);
      const cached = lruDocumentCache.getModel(fileId);
      const matchedProjectFile = this.findProjectItem(fileId);
      const resolvedFileName = normalizeVirtualPath(
        cached?.filePath ||
          matchedProjectFile?.path ||
          matchedProjectFile?.title ||
          matchedProjectFile?.name ||
          fileId,
      );
      this.storePort.setMainFile(resolvedFileName || fileId);

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'set-root', fileId, local: true },
      });

      this.notificationPort.notifySuccess('Set as main document', 'set-main-file');
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Set main document error:', err);
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to set main document', 'set-main-file');
      throw err;
    }
  }

  /**
   * Shared indexing pipeline step: warms the LRU document model cache and
   * registers the document in the LaTeX DAG and Symbol Index.
   */
  private indexDocumentInWorkspace(
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

  private lastIndexedProjectKey = '';
  private lastIndexedFingerprint = '';

  /**
   * High-speed initial bulk indexing of all project files for cross-referencing and DAG
   */
  public initProjectSymbols(
    files: Array<{
      id: string;
      nodeId?: string;
      docId?: string | null;
      fileId?: string | null;
      pageId?: string | null;
      projectId?: string | null;
      isFolder?: boolean;
      title?: string;
      name?: string;
      path?: string;
      content?: unknown;
    }>,
    scopeId?: string,
  ): void {
    const projectKey = scopeId || this.getActiveProjectId() || 'default';
    const fingerprint = `${projectKey}::${files
      .map((f) => {
        const path = f.path || f.title || f.name || f.id;
        const contentLen = extractDocumentContentString(f.content).length;
        return `${f.id}:${path}:${contentLen}`;
      })
      .join('|')}`;

    if (fingerprint === this.lastIndexedFingerprint && this.projectFiles.length >= files.length) {
      return;
    }

    const projectChanged = this.lastIndexedProjectKey !== '' && this.lastIndexedProjectKey !== projectKey;
    this.lastIndexedProjectKey = projectKey;
    this.lastIndexedFingerprint = fingerprint;

    // Preserve structure-synced folder/asset/nodeId records scoped to this specific manuscript workspace
    const scopedExisting = this.projectFilesByScope.get(projectKey) ?? (projectChanged ? [] : this.projectFiles);
    const preservedStructureRecords = scopedExisting.filter(
      (pf) =>
        (pf.isFolder || pf.fileId) &&
        (!pf.pageId || pf.pageId === projectKey),
    );
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
    this.projectFiles = [
      ...mergedDocs,
      ...preservedStructureRecords.filter((r) => !mergedDocIds.has(r.id)),
    ];
    this.projectFilesByScope.set(projectKey, this.projectFiles);

    latexSymbolsIndex.clear();
    latexDependencyGraph.clear();
    if (projectChanged) {
      diagnosticsCoordinator.clearDiagnostics();
    }
    documentFacade.hydrateServerProjectFiles(projectKey, this.projectFiles);
  }

  /**
   * Syncs structure nodes (including FOLDER, DOC, and FILE nodes) into `this.projectFiles`
   * so folder move/rename/delete operations always know every folder's path and descendants.
   */
  public syncStructureItems(
    items: Array<{
      id: string;
      nodeId?: string;
      pageId?: string | null;
      projectId?: string | null;
      docId?: string | null;
      fileId?: string | null;
      filename?: string;
      path?: string;
      isFolder?: boolean;
    }>,
    scopeId?: string,
  ): void {
    if (!Array.isArray(items) || items.length === 0) return;
    const activeScope =
      scopeId ||
      items[0]?.pageId ||
      this.getActiveProjectId() ||
      'default';
    const scopeSwitched =
      this.lastIndexedProjectKey !== '' &&
      activeScope !== 'default' &&
      this.lastIndexedProjectKey !== activeScope;
    if (scopeSwitched) {
      this.lastIndexedProjectKey = activeScope;
      this.lastIndexedFingerprint = '';
    }

    const baseList = scopeSwitched
      ? (this.projectFilesByScope.get(activeScope) ?? [])
      : this.projectFiles.filter((pf) => !pf.pageId || pf.pageId === activeScope);

    const byId = new Map<
      string,
      {
        id: string;
        nodeId?: string;
        docId?: string | null;
        fileId?: string | null;
        pageId?: string | null;
        projectId?: string | null;
        isFolder?: boolean;
        title?: string;
        name?: string;
        path?: string;
        content?: unknown;
      }
    >();
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
    this.projectFiles = Array.from(byId.values());
    if (activeScope) {
      this.projectFilesByScope.set(activeScope, this.projectFiles);
    }
  }

  /**
   * Returns all known project files from the most recent workspace load or indexing.
   */
  public getProjectFiles(
    scopeId?: string,
  ): Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> {
    if (scopeId && this.projectFilesByScope.has(scopeId)) {
      return this.projectFilesByScope.get(scopeId)!;
    }
    return this.projectFiles;
  }

  /**
   * Refactors a citation key across all files in the project without breaking references
   */
  public async refactorCitekey(
    oldKey: string,
    newKey: string,
    optProjectId?: string
  ): Promise<{ success: boolean; modifiedCount: number; replacedCount: number }> {
    const { executeProjectCitekeyRefactor } = await import(
      '@/features/editor/subsystems/citation/model/citation-refactor'
    );
    const activeDocId = this.storePort.getActiveDocumentId();
    const unsubFilter = editorCommandBus.use({
      onDispatch: (cmd, next) => {
        if (
          cmd.type === 'editor:set-content' &&
          cmd.fileId &&
          activeDocId &&
          cmd.fileId !== activeDocId &&
          !getEditorEngineForFile(cmd.fileId)
        ) {
          return;
        }
        next(cmd);
      },
    });
    try {
      return await executeProjectCitekeyRefactor(oldKey, newKey, optProjectId || this.getActiveProjectId() || undefined, {
        service: this.servicePort,
        notification: this.notificationPort,
        store: this.storePort,
        projectFiles: this.projectFiles,
      });
    } finally {
      unsubFilter();
    }
  }
}

export { WorkspaceCoordinator as WorkspaceCoordinatorRegistry };
export const workspaceCoordinator = new WorkspaceCoordinator();
