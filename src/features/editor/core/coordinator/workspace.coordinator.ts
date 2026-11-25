/**
 * workspace.coordinator.ts
 *
 * Workspace & File System Lifecycle Coordinator (Coordinators Layer).
 * Location: `features/editor/core/coordinator/workspace.coordinator.ts`
 */

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  normalizeVirtualPath,
  splitVirtualPath,
  joinVirtualPath,
  isUnderVirtualFolder,
  parseVirtualFolderId,
} from '@/features/editor/domain/document/document-naming';
import { clearYjsProviderPool } from '@/features/editor/sdk/realtime/provider';
import type {
  WorkspaceCoordinatorPorts,
  WorkspaceNotificationPort,
  WorkspaceServicePort,
  WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';
import { editorCommandBus } from '../bus/command-bus';
import { sessionCoordinator } from './session.coordinator';
import { usePageStore } from '../store/editor.store';
import { useSettingsStore } from '../store/settings.store';
import {
  defaultWorkspaceServicePort,
  defaultWorkspaceNotificationPort,
  defaultWorkspaceStorePort,
  findWorkspaceProjectItem,
  resolveWorkspaceDocId,
  indexDocumentInWorkspace,
  runInitProjectSymbols,
  mergeWorkspaceStructureItems,
  type CreatedFileNode,
  type WorkspaceProjectItem,
  type WorkspaceStructureSyncItem,
} from './workspace-file-index';
import {
  executeCascadePathChange,
  executeEvictDeletedFileResources,
  executeReconcileRemoteFileTreeEvent,
  isRootFileProtectedFromDelete,
} from './workspace-cascade';

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

export class WorkspaceCoordinator {
  private initialized = false;
  private projectFiles: WorkspaceProjectItem[] = [];
  private projectFilesByScope = new Map<string, WorkspaceProjectItem[]>();
  private servicePort: WorkspaceServicePort = defaultWorkspaceServicePort;
  private notificationPort: WorkspaceNotificationPort = defaultWorkspaceNotificationPort;
  private storePort: WorkspaceStorePort = defaultWorkspaceStorePort;
  private lastIndexedProjectKey = '';
  private lastIndexedFingerprint = '';

  constructor(ports?: WorkspaceCoordinatorPorts) {
    if (ports) this.setPorts(ports);
    this.initCommandSubscriptions();
  }

  public setPorts(ports: WorkspaceCoordinatorPorts): void {
    if (ports.service) this.servicePort = ports.service;
    if (ports.notification) this.notificationPort = ports.notification;
    if (ports.store) this.storePort = ports.store;
  }

  public resetPorts(): void {
    this.servicePort = defaultWorkspaceServicePort;
    this.notificationPort = defaultWorkspaceNotificationPort;
    this.storePort = defaultWorkspaceStorePort;
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

    editorCommandBus.registerExecutor('workspace:create-file', async (cmd) =>
      this.createFile({ name: cmd.name, folderId: cmd.folderId, content: cmd.content }),
    );
    editorCommandBus.registerExecutor('workspace:rename-file', async (cmd) =>
      this.renameItem({ itemId: cmd.fileId, oldName: cmd.oldPath, newName: cmd.newPath }),
    );
    editorCommandBus.registerExecutor('workspace:delete-file', async (cmd) =>
      this.deleteFile(cmd.fileId),
    );
    editorCommandBus.registerExecutor('workspace:restore-file', async (cmd) =>
      this.restoreFile(cmd.fileId, cmd.projectId),
    );
    editorCommandBus.registerExecutor('workspace:set-main-file', async (cmd) =>
      this.setMainFile(cmd.fileId, cmd.projectId),
    );
    editorCommandBus.registerExecutor('workspace:move-file', async (cmd) =>
      this.moveItem({ itemId: cmd.fileId, targetFolderId: cmd.targetFolderId }),
    );

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

    editorCommandBus.subscribe('filetree:updated', (cmd) => {
      this.reconcileRemoteFileTreeEvent(
        cmd.payload && typeof cmd.payload === 'object'
          ? (cmd.payload as Record<string, unknown>)
          : undefined,
      );
    });

    editorCommandBus.registerExecutor('editor:rename-citekey', async (cmd) =>
      this.refactorCitekey(cmd.oldKey, cmd.newKey),
    );
  }

  public reconcileRemoteFileTreeEvent(payload?: Record<string, unknown>): void {
    executeReconcileRemoteFileTreeEvent({
      payload,
      effectiveProjectId: this.getActiveProjectId() || '',
      findProjectItem: (id, scope) => this.findProjectItem(id, scope),
      evictDeletedFileResources: (id, pid) => this.evictDeletedFileResources(id, pid),
      cascadePathChange: (pid, id, oldP, newP) => this.cascadePathChange(pid, id, oldP, newP),
      setMainFileInStore: (p, rootDocId) => this.storePort.setMainFile(p, rootDocId),
    });
  }

  private findProjectItem(itemId: string, scopeKey?: string) {
    return findWorkspaceProjectItem(
      this.projectFiles,
      this.projectFilesByScope,
      itemId,
      scopeKey,
    );
  }

  public resolveDocId(itemIdOrPath: string, scopeKey?: string): string {
    return resolveWorkspaceDocId(
      this.projectFiles,
      this.projectFilesByScope,
      itemIdOrPath,
      scopeKey,
    );
  }

  public async createFile(options: CreateFileOptions): Promise<CreatedFileNode | null> {
    const {
      name,
      folderId = null,
      content = '',
      projectId: optProjectId,
      openAfterCreate = true,
    } = options;
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
        normalizeVirtualPath(newFile.path || newFile.title || '') || newFile.name || name;
      const resolvedContent = newFile.content || content;

      indexDocumentInWorkspace(
        effectiveProjectId,
        resolvedFileId,
        resolvedTitle,
        resolvedContent,
      );

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'create', file: newFile, local: true },
      });

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
      this.notificationPort.notifyError(
        (err as Error)?.message || `Failed to create "${name}"`,
        `create-file-${name}`,
      );
      return null;
    }
  }

  private cascadePathChange(
    effectiveProjectId: string,
    itemId: string,
    oldPath: string,
    newPath: string,
  ): void {
    this.projectFiles = executeCascadePathChange({
      effectiveProjectId,
      itemId,
      oldPath,
      newPath,
      projectFiles: this.projectFiles,
      projectFilesByScope: this.projectFilesByScope,
      updateTabTitleInStore: (pId, id, title) => this.updateTabTitleInStore(pId, id, title),
    });
  }

  public evictDeletedFileResources(fileId: string, optProjectId?: string): void {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    this.projectFiles = executeEvictDeletedFileResources({
      fileId,
      effectiveProjectId,
      projectFiles: this.projectFiles,
      projectFilesByScope: this.projectFilesByScope,
      closeTabInStore: (id) => this.closeTabInStore(id),
    });
  }

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
        name:
          newFolderPath && newFolderPath !== oldFolderPath
            ? resolvedFullNewPath
            : effectiveLeafName,
      });

      this.cascadePathChange(effectiveProjectId, itemId, oldName, resolvedFullNewPath);

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'rename', itemId, oldName, newName: resolvedFullNewPath, local: true },
      });

      this.notificationPort.notifySuccess(
        `Renamed to "${effectiveLeafName}"`,
        `rename-file-${itemId}`,
      );
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Rename error:', err);
      this.notificationPort.notifyError(
        (err as Error)?.message || `Failed to rename "${oldName}"`,
        `rename-file-${itemId}`,
      );
      return false;
    }
  }

  public async deleteFile(fileId: string, optProjectId?: string): Promise<boolean> {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    if (!effectiveProjectId) return false;

    const fileObj = this.findProjectItem(fileId);
    const { isRootProtected, folderPrefix } = isRootFileProtectedFromDelete(
      fileId,
      fileObj,
      this.projectFiles,
    );
    if (isRootProtected) {
      this.notificationPort.notifyError(
        'Cannot delete the main document. Set another .tex file as Main Document first.',
        `delete-file-${fileId}`,
      );
      return false;
    }

    const pausedTimerIds: string[] = [];
    const timerCandidates = new Set<string>([fileId]);
    if (fileObj?.docId) timerCandidates.add(fileObj.docId);
    if (folderPrefix) {
      for (const m of lruDocumentCache.getAllModels()) {
        if (isUnderVirtualFolder(m.filePath, folderPrefix)) {
          timerCandidates.add(m.fileId);
        }
      }
    }
    for (const cid of timerCandidates) {
      if (sessionCoordinator.cancelPendingAutoSave(cid)) {
        pausedTimerIds.push(cid);
      }
    }

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
      for (const cid of pausedTimerIds) {
        sessionCoordinator.resumeAutoSaveIfDirty(cid);
      }
      console.error('[WorkspaceCoordinator] Delete error:', err);
      this.notificationPort.notifyError(
        (err as Error)?.message || 'Failed to delete file',
        `delete-file-${fileId}`,
      );
      return false;
    }
  }

  public async ensureFolderHierarchyId(
    targetFolderId: string | null | undefined,
  ): Promise<{ id: string | null; path: string }> {
    if (!targetFolderId) return { id: null, path: '' };
    const virtualFolderPath = parseVirtualFolderId(targetFolderId);
    if (virtualFolderPath === null) {
      const folderObj = this.findProjectItem(targetFolderId);
      const path = normalizeVirtualPath(
        folderObj?.path || folderObj?.title || folderObj?.name || '',
      );
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
        returnedPath || (leafName ? joinVirtualPath(targetFolderPrefix, leafName) : '');

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
      this.notificationPort.notifyError(
        (err as Error)?.message || 'Failed to move item',
        `move-file-${itemId}`,
      );
      return false;
    }
  }

  public async restoreFile(fileId: string, optProjectId?: string): Promise<unknown> {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    try {
      const res = (await this.servicePort.restoreFile(
        fileId,
        effectiveProjectId || undefined,
      )) as {
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
        indexDocumentInWorkspace(
          page.projectId || effectiveProjectId || '',
          page.id || fileId,
          page.title || page.name || 'restored.tex',
          typeof page.content === 'string' ? page.content : '',
        );
      }

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'restore', fileId, page },
      });

      this.notificationPort.notifySuccess('File restored', `restore-file-${fileId}`);
      return res;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Restore error:', err);
      this.notificationPort.notifyError(
        (err as Error)?.message || 'Failed to restore file',
        `restore-file-${fileId}`,
      );
      throw err;
    }
  }

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
      const resolvedDocId = matchedProjectFile?.docId || matchedProjectFile?.id || fileId;
      this.storePort.setMainFile(resolvedFileName || fileId, resolvedDocId);

      const isMatchingRootItem = (pf: {
        id: string;
        nodeId?: string;
        docId?: string | null;
      }) =>
        pf.id === fileId ||
        pf.nodeId === fileId ||
        pf.docId === fileId ||
        pf.id === resolvedDocId ||
        pf.docId === resolvedDocId;

      if (this.projectFiles.length > 0) {
        this.projectFiles = this.projectFiles.map((pf) => ({
          ...pf,
          isRootDoc: isMatchingRootItem(pf),
        }));
      }
      const scopedFiles = this.projectFilesByScope.get(effectiveProjectId);
      if (scopedFiles && scopedFiles.length > 0) {
        this.projectFilesByScope.set(
          effectiveProjectId,
          scopedFiles.map((pf) => ({
            ...pf,
            isRootDoc: isMatchingRootItem(pf),
          })),
        );
      }

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'set-root', fileId, local: true },
      });

      this.notificationPort.notifySuccess('Set as main document', 'set-main-file');
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Set main document error:', err);
      this.notificationPort.notifyError(
        (err as Error)?.message || 'Failed to set main document',
        'set-main-file',
      );
      throw err;
    }
  }

  public initProjectSymbols(files: WorkspaceProjectItem[], workspaceId?: string): void {
    const projectKey = workspaceId || this.getActiveProjectId() || 'default';
    const result = runInitProjectSymbols({
      files,
      projectFiles: this.projectFiles,
      projectFilesByScope: this.projectFilesByScope,
      lastIndexedProjectKey: this.lastIndexedProjectKey,
      lastIndexedFingerprint: this.lastIndexedFingerprint,
      projectKey,
    });
    if (!result.skipped) {
      this.projectFiles = result.projectFiles;
      this.lastIndexedProjectKey = result.lastIndexedProjectKey;
      this.lastIndexedFingerprint = result.lastIndexedFingerprint;
    }
  }

  public syncStructureItems(items: WorkspaceStructureSyncItem[], workspaceId?: string): void {
    if (!Array.isArray(items) || items.length === 0) return;
    const activeScope = workspaceId || items[0]?.pageId || this.getActiveProjectId() || 'default';
    const next = mergeWorkspaceStructureItems({
      items,
      projectFiles: this.projectFiles,
      projectFilesByScope: this.projectFilesByScope,
      lastIndexedProjectKey: this.lastIndexedProjectKey,
      lastIndexedFingerprint: this.lastIndexedFingerprint,
      activeScope,
    });
    this.projectFiles = next.projectFiles;
    this.lastIndexedProjectKey = next.lastIndexedProjectKey;
    this.lastIndexedFingerprint = next.lastIndexedFingerprint;
  }

  public getProjectFiles(
    workspaceId?: string,
  ): Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> {
    if (workspaceId && this.projectFilesByScope.has(workspaceId)) {
      return this.projectFilesByScope.get(workspaceId)!;
    }
    return this.projectFiles;
  }

  public async refactorCitekey(
    _oldKey: string,
    _newKey: string,
    _optProjectId?: string,
  ): Promise<{ success: boolean; modifiedCount: number; replacedCount: number }> {
    return { success: false, modifiedCount: 0, replacedCount: 0 };
  }

  public resetAllState(options: { skipFlush?: boolean; scopeId?: string } = {}): void {
    this.projectFiles = [];
    this.projectFilesByScope.clear();
    this.lastIndexedProjectKey = '';
    this.lastIndexedFingerprint = '';
    sessionCoordinator.resetSession();
    clearYjsProviderPool({ skipFlush: options.skipFlush ?? true });
    lruDocumentCache.discardAll();
    if (typeof usePageStore?.getState === 'function') {
      usePageStore.getState().resetPageState();
    }
    editorCommandBus.dispatch({
      type: 'workspace:reset',
      ...(options.scopeId ? { scopeId: options.scopeId } : {}),
    });
  }
}

export const workspaceCoordinator = new WorkspaceCoordinator();
