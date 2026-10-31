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
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
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
import { documentAuthority } from './document-authority.facade';
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
  getActiveProjectId: () =>
    usePageStore.getState().projectId ||
    usePageStore.getState().parentPageId ||
    usePageStore.getState().currentPage?.id ||
    null,
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

export class WorkspaceCoordinatorRegistry {
  private initialized = false;
  private projectFiles: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> = [];
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

    editorCommandBus.registerExecutor('editor:rename-citekey', async (cmd) => {
      return this.refactorCitekey(cmd.oldKey, cmd.newKey);
    });
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
      editorCommandBus.dispatch({ type: 'filetree:updated', payload: { action: 'create', file: newFile } });

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
            const hasLeadingSlash = t.path.startsWith('/');
            const rewrittenPath = rewritePathPrefix(t.path, oldPrefix, newPrefix);
            if (rewrittenPath !== null) {
              changed = true;
              nextTab = { ...nextTab, path: hasLeadingSlash ? `/${rewrittenPath}` : rewrittenPath };
            }
          }
          if (t.title) {
            const rewrittenTitle = rewritePathPrefix(t.title, oldPrefix, newPrefix);
            if (rewrittenTitle !== null) {
              changed = true;
              nextTab = { ...nextTab, title: rewrittenTitle };
            }
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
        if (f.id === itemId) {
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
      documentAuthority.hydrateServerProjectFiles(effectiveProjectId, this.projectFiles);
    }

    // 4. Cascade to Diagnostics Coordinator (alias old path to new path)
    diagnosticsCoordinator.registerAlias(newPath, oldPath);
    for (const desc of cascadedDescendants) {
      diagnosticsCoordinator.registerAlias(desc.newPath, desc.oldPath);
    }

    // 5. Re-index in LaTeX DAG & Symbols
    latexDagEngine.removeFileNode(oldPath);
    const contentToIndex = cachedModel?.content || documentAuthority.getDocumentContent(itemId);
    if (contentToIndex) {
      latexDagEngine.parseAndRegister(newPath, contentToIndex, itemId);
      latexSymbolsIndex.indexFile(itemId, newPath, contentToIndex);
    }
    for (const desc of cascadedDescendants) {
      latexDagEngine.removeFileNode(desc.oldPath);
      if (desc.content) {
        latexDagEngine.parseAndRegister(desc.newPath, desc.content, desc.fileId);
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
    const fileObj = this.projectFiles.find((f) => f.id === fileId);
    const filePath = cachedModel?.filePath || fileObj?.path || fileObj?.title || fileObj?.name;

    sessionCoordinator.evictDeletedFile(fileId);
    lruDocumentCache.evictModel(fileId);
    this.closeTabInStore(fileId);
    this.closeTabInStore(`asset:${fileId}`);
    const wsStore = useWorkspaceStore.getState();
    if (wsStore.secondaryFileId === fileId) {
      wsStore.setSecondaryFileId(null);
    }
    const pageStore = usePageStore.getState();
    if (pageStore.selectedAsset?.id === fileId) {
      pageStore.setSelectedAsset(null);
    }
    editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId });
    editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId: `asset:${fileId}` });

    const cleanFolderPrefix = normalizeVirtualPath(filePath);
    if (cleanFolderPrefix) {
      for (const model of lruDocumentCache.getAllModels()) {
        if (isUnderVirtualFolder(model.filePath, cleanFolderPrefix)) {
          sessionCoordinator.evictDeletedFile(model.fileId);
          lruDocumentCache.evictModel(model.fileId);
          this.closeTabInStore(model.fileId);
          latexDagEngine.removeFileNode(model.filePath);
          latexSymbolsIndex.removeFile(model.fileId, model.filePath);
        }
      }
    }

    latexDagEngine.removeFileNode(filePath || fileId);
    latexSymbolsIndex.removeFile(fileId, filePath);
    if (this.projectFiles.length > 0 && effectiveProjectId) {
      this.projectFiles = this.projectFiles.filter((f) => {
        if (f.id === fileId) return false;
        if (cleanFolderPrefix && isUnderVirtualFolder(f.path || f.title || f.name || '', cleanFolderPrefix)) {
          return false;
        }
        return true;
      });
      documentAuthority.hydrateServerProjectFiles(effectiveProjectId, this.projectFiles);
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
        payload: { action: 'rename', itemId, oldName, newName: resolvedFullNewPath },
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
        payload: { action: 'delete', fileId },
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
      const folderObj = this.projectFiles.find((f) => f.id === targetFolderId);
      const path = normalizeVirtualPath(folderObj?.path || folderObj?.title || folderObj?.name || '');
      return { id: targetFolderId, path };
    }

    const existingFolder = this.projectFiles.find((pf) => {
      const pfPath = normalizeVirtualPath(pf.path || pf.title || pf.name || '');
      return pfPath.toLowerCase() === virtualFolderPath.toLowerCase() && !pf.id.startsWith('folder:');
    });
    if (existingFolder?.id) {
      return { id: existingFolder.id, path: virtualFolderPath };
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
      const fileObj = this.projectFiles.find((f) => f.id === itemId);
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
        payload: { action: 'move', itemId, targetFolderId: resolvedTargetFolderId },
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
      const matchedProjectFile = this.projectFiles.find((f) => f.id === fileId);
      const resolvedFileName = cached?.filePath || matchedProjectFile?.title || matchedProjectFile?.name || fileId;
      this.storePort.setMainFile(resolvedFileName);

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'set-root', fileId },
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
      latexDagEngine.parseAndRegister(filePath, content, fileId);
      latexSymbolsIndex.indexFile(fileId, filePath, content);
    }
  }

  private lastIndexedProjectKey = '';
  private lastIndexedFingerprint = '';

  /**
   * High-speed initial bulk indexing of all project files for cross-referencing and DAG
   */
  public initProjectSymbols(files: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }>): void {
    const projectKey = this.getActiveProjectId() || 'default';
    const fingerprint = `${projectKey}::${files
      .map((f) => {
        const path = f.path || f.title || f.name || f.id;
        const contentLen = extractDocumentContentString(f.content).length;
        return `${f.id}:${path}:${contentLen}`;
      })
      .join('|')}`;

    if (fingerprint === this.lastIndexedFingerprint && this.projectFiles.length === files.length) {
      return;
    }

    const projectChanged = this.lastIndexedProjectKey !== '' && this.lastIndexedProjectKey !== projectKey;
    this.lastIndexedProjectKey = projectKey;
    this.lastIndexedFingerprint = fingerprint;
    this.projectFiles = [...files];

    latexSymbolsIndex.clear();
    latexDagEngine.clear();
    if (projectChanged) {
      diagnosticsCoordinator.clearDiagnostics();
    }
    documentAuthority.hydrateServerProjectFiles(projectKey, files);
  }

  /**
   * Returns all known project files from the most recent workspace load or indexing.
   */
  public getProjectFiles(): Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> {
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

export const workspaceCoordinator = new WorkspaceCoordinatorRegistry();
