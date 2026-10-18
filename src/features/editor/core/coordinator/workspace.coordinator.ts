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

import { manuscriptService, fileService } from '@/features/editor/sdk/manuscript.service';
import { type LinkedFileDto } from '@/features/editor/sdk/manuscript/types';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  validateCitationKey,
  refactorCitationKeyAcrossFiles,
} from '@/features/editor/subsystems/citation';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import {
  editorCommandBus,
  useTabsStore,
  usePageStore,
  useSettingsStore,
} from '@/features/editor/core';
import { toast } from 'sonner';
import {
  type WorkspaceServicePort,
  type WorkspaceNotificationPort,
  type WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';
import {
  setDefaultSpellingService,
  setDefaultSpellingNotifier,
} from '@/features/editor/core/engine/adapters/editor-spelling-port';
import { setDefaultFileUploader } from '@/features/editor/core/engine/adapters/editor-filestore-port';
import { filestore } from '@/features/editor/sdk/manuscript.service';

// Bridge CodeMirror file upload default port with filestore
setDefaultFileUploader((projectId, file, name) => filestore.upload(projectId, file, name));

// Bridge CodeMirror spelling extension default ports with manuscriptService and sonner toast
setDefaultSpellingService({
  getProjectDictionary: (pid) => manuscriptService.spelling.getProjectDictionary(pid),
  getUserDictionary: () => manuscriptService.spelling.getUserDictionary(),
  learnProjectWord: (pid, word) => manuscriptService.spelling.learnProjectWord(pid, word),
  checkSpelling: (pid, payload) => manuscriptService.spelling.checkSpelling(pid, payload),
});

setDefaultSpellingNotifier({
  success: (msg, opts) => toast.success(msg, opts),
  error: (msg, opts) => toast.error(msg, opts),
});

export const defaultWorkspaceServicePort: WorkspaceServicePort = {
  createNode: (projectId, data) => manuscriptService.structure.createNode(projectId, data),
  renameNode: (projectId, itemId, data) => manuscriptService.structure.renameNode(projectId, itemId, data),
  deleteNode: (projectId, itemId) => manuscriptService.structure.deleteNode(projectId, itemId),
  moveNode: (projectId, itemId, data) => manuscriptService.structure.moveNode(projectId, itemId, data),
  restoreFile: (fileId) => manuscriptService.docs.restore(fileId),
  setRootDoc: (projectId, fileId) => manuscriptService.structure.setRootDoc(projectId, fileId),
  getFilesByProjectId: async (projectId) => {
    const files = await fileService.getByPageId(projectId);
    return files.map((f: { id: string; title?: string; name?: string; content?: string }) => ({
      id: f.id,
      title: f.title || f.name || '',
      content: f.content || '',
    }));
  },
  updateFileContent: (fileId, content) => manuscriptService.docs.updateContent(fileId, content),
};

export const defaultWorkspaceNotificationPort: WorkspaceNotificationPort = {
  notifySuccess: (message, id) => toast.success(message, id ? { id } : undefined),
  notifyError: (message, id) => toast.error(message, id ? { id } : undefined),
  notifyInfo: (message, id) => toast.info(message, id ? { id } : undefined),
};

export const noopWorkspaceNotificationPort: WorkspaceNotificationPort = {
  notifySuccess: () => {},
  notifyError: () => {},
  notifyInfo: () => {},
};

export const defaultWorkspaceStorePort: WorkspaceStorePort = {
  getActiveProjectId: () =>
    usePageStore.getState().projectId ||
    usePageStore.getState().parentPageId ||
    usePageStore.getState().currentPage?.id ||
    null,
  closeTab: (fileId) => {
    const tabsStore = useTabsStore.getState();
    for (const projId of Object.keys(tabsStore.tabsByProject)) {
      tabsStore.closeTab(projId, fileId);
    }
    const pageStore = usePageStore.getState();
    if (pageStore.activeFilePage?.id === fileId) {
      const parentPage = pageStore.currentPage;
      pageStore.setActiveFilePage(parentPage && parentPage.id !== fileId ? parentPage : null);
    }
  },
  updateTabTitle: (projectId, itemId, newTitle) => {
    const tabsStore = useTabsStore.getState();
    for (const projId of Object.keys(tabsStore.tabsByProject)) {
      tabsStore.updateTabTitle(projId, itemId, newTitle);
    }
    if (projectId && !tabsStore.tabsByProject[projectId]) {
      tabsStore.updateTabTitle(projectId, itemId, newTitle);
    }
  },
  setMainFile: (fileId) => useSettingsStore.getState().setMainFile(fileId),
  getActiveDocumentId: () => usePageStore.getState().getActiveDocument()?.id ?? null,
};

export const noopWorkspaceStorePort: WorkspaceStorePort = {
  getActiveProjectId: () => null,
  closeTab: () => {},
  updateTabTitle: () => {},
  setMainFile: () => {},
  getActiveDocumentId: () => null,
};

export interface WorkspaceCoordinatorPorts {
  service?: WorkspaceServicePort;
  notification?: WorkspaceNotificationPort;
  store?: WorkspaceStorePort;
}

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

type CreatedFileNode = LinkedFileDto & { title?: string; content?: string };

export class WorkspaceCoordinatorRegistry {
  private initialized = false;
  private projectFiles: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> = [];
  private servicePort: WorkspaceServicePort;
  private notificationPort: WorkspaceNotificationPort;
  private storePort: WorkspaceStorePort;

  constructor(ports?: WorkspaceCoordinatorPorts) {
    this.servicePort = ports?.service ?? defaultWorkspaceServicePort;
    this.notificationPort = ports?.notification ?? defaultWorkspaceNotificationPort;
    this.storePort = ports?.store ?? defaultWorkspaceStorePort;
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

  private dispatchFileTreeRefresh(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
    }
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

    editorCommandBus.registerExecutor('editor:rename-citekey', async (cmd) => {
      return this.refactorCitekey(cmd.oldKey, cmd.newKey);
    });
  }

  /**
   * Creates a new LaTeX or asset file in the workspace
   */
  public async createFile(options: CreateFileOptions): Promise<LinkedFileDto | null> {
    const { name, folderId = null, content = '', projectId: optProjectId, openAfterCreate = true } = options;
    const effectiveProjectId = optProjectId || this.storePort.getActiveProjectId();

    if (!effectiveProjectId) {
      this.notificationPort.notifyError('Cannot create file: no active project');
      return null;
    }

    try {
      const res = (await this.servicePort.createNode(effectiveProjectId, {
        name,
        parentId: folderId,
        content,
        type: 'DOC',
      })) as ({ data?: CreatedFileNode } & CreatedFileNode) | null;
      const newFile = res?.data || res;

      if (!newFile) return null;

      const resolvedTitle = newFile.title || newFile.name || name;
      const resolvedContent = newFile.content || content;

      // 1. Warm LRU cache
      lruDocumentCache.warm(newFile.id, {
        filePath: resolvedTitle,
        content: resolvedContent,
        projectId: effectiveProjectId,
      });

      // 2. Register in LaTeX DAG Engine & Symbol Index
      latexDagEngine.parseAndRegister(resolvedTitle, resolvedContent, newFile.id);
      latexSymbolsIndex.indexFile(newFile.id, resolvedTitle, resolvedContent);

      // 3. Notify FileTree & CommandBus
      editorCommandBus.dispatch({ type: 'filetree:updated', payload: { action: 'create', file: newFile } });
      this.dispatchFileTreeRefresh();

      // 4. Auto-open in tab if requested
      if (openAfterCreate) {
        editorCommandBus.dispatch({
          type: 'navigation:open-tab',
          fileId: newFile.id,
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
   * Renames a file or folder and cascades updates across IDE systems
   */
  public async renameItem(options: RenameItemOptions): Promise<boolean> {
    const { itemId, oldName, newName, projectId: optProjectId } = options;
    const effectiveProjectId = optProjectId || this.storePort.getActiveProjectId();

    if (!effectiveProjectId) return false;

    try {
      await this.servicePort.renameNode(effectiveProjectId, itemId, { name: newName });

      // 1. Cascade rename to Tabs Store across all project/page scopes
      this.storePort.updateTabTitle(effectiveProjectId, itemId, newName);

      // 1b. Cascade rename to PageStore if active or current page matches
      const pageStore = usePageStore.getState();
      if (pageStore.activeFilePage?.id === itemId) {
        pageStore.setActiveFilePage({
          ...pageStore.activeFilePage,
          title: newName,
        });
      }
      if (pageStore.currentPage?.id === itemId) {
        pageStore.setCurrentPage((prev) => (prev ? { ...prev, title: newName } : prev));
      }

      // 2. Cascade rename to LRU Cache
      const model = lruDocumentCache.getModel(itemId);
      if (model) {
        model.filePath = newName;
      }

      // 3. Cascade rename to Diagnostics Coordinator (alias old path to new path)
      diagnosticsCoordinator.registerAlias(newName, oldName);

      // 4. Re-index in LaTeX DAG & Symbols
      latexDagEngine.removeFileNode(oldName);
      if (model?.content) {
        latexDagEngine.parseAndRegister(newName, model.content, itemId);
        latexSymbolsIndex.indexFile(itemId, newName, model.content);
      }

      // 5. Notify FileTree
      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'rename', itemId, oldName, newName },
      });
      this.dispatchFileTreeRefresh();

      this.notificationPort.notifySuccess(`Renamed to "${newName}"`, `rename-file-${itemId}`);
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Rename error:', err);
      this.notificationPort.notifyError((err as Error)?.message || `Failed to rename "${oldName}"`, `rename-file-${itemId}`);
      return false;
    }
  }

  /**
   * Deletes a file and cleans up IDE resources
   */
  public async deleteFile(fileId: string, optProjectId?: string): Promise<boolean> {
    const effectiveProjectId = optProjectId || this.storePort.getActiveProjectId();
    if (!effectiveProjectId) return false;

    try {
      await this.servicePort.deleteNode(effectiveProjectId, fileId);

      // 1. Close open tab if present
      this.storePort.closeTab(fileId);
      editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId });

      // 2. Evict from LRU Cache, DAG, & Symbol Index
      lruDocumentCache.evictModel(fileId);
      latexDagEngine.removeFileNode(fileId);
      latexSymbolsIndex.removeFile(fileId);

      // 3. Notify CommandBus
      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'delete', fileId },
      });
      this.dispatchFileTreeRefresh();

      this.notificationPort.notifySuccess('File moved to trash', `delete-file-${fileId}`);
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Delete error:', err);
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to delete file', `delete-file-${fileId}`);
      return false;
    }
  }

  /**
   * Moves a file/folder to a new parent folder
   */
  public async moveItem(options: MoveItemOptions): Promise<boolean> {
    const { itemId, targetFolderId, projectId: optProjectId } = options;
    const effectiveProjectId = optProjectId || this.storePort.getActiveProjectId();
    if (!effectiveProjectId) return false;

    try {
      await this.servicePort.moveNode(effectiveProjectId, itemId, {
        destParentId: targetFolderId,
      });

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'move', itemId, targetFolderId },
      });
      this.dispatchFileTreeRefresh();

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
    const effectiveProjectId = optProjectId || this.storePort.getActiveProjectId();
    try {
      const res = (await this.servicePort.restoreFile(fileId, effectiveProjectId ?? undefined)) as {
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
        // 1. Warm LRU cache
        lruDocumentCache.warm(docId, {
          filePath: page.title || page.name || 'restored.tex',
          content: typeof page.content === 'string' ? page.content : '',
          projectId: page.projectId || effectiveProjectId || '',
        });

        // 2. Re-index in DAG & Symbols
        const docTitle = page.title || page.name || 'restored.tex';
        if (typeof page.content === 'string') {
          latexDagEngine.parseAndRegister(docTitle, page.content, docId);
          latexSymbolsIndex.indexFile(docId, docTitle, page.content);
        }
      }

      // 3. Notify CommandBus & filetree
      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'restore', fileId, page },
      });
      this.dispatchFileTreeRefresh();

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
    const effectiveProjectId = optProjectId || this.storePort.getActiveProjectId();
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
      this.dispatchFileTreeRefresh();

      this.notificationPort.notifySuccess('Set as main document', 'set-main-file');
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Set main document error:', err);
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to set main document', 'set-main-file');
      throw err;
    }
  }

  /**
   * High-speed initial bulk indexing of all project files for cross-referencing and DAG
   */
  public initProjectSymbols(files: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }>): void {
    this.projectFiles = [...files];
    latexSymbolsIndex.clear();
    for (const file of files) {
      const path = file.path || file.title || file.name || file.id;
      const content = extractDocumentContentString(file.content);
      latexSymbolsIndex.indexFile(file.id, path, content);
      latexDagEngine.parseAndRegister(path, content, file.id);
    }
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
    const validation = validateCitationKey(newKey, oldKey);
    if (!validation.isValid) {
      this.notificationPort.notifyError(validation.error || 'Invalid citation key', 'refactor-citekey');
      return { success: false, modifiedCount: 0, replacedCount: 0 };
    }

    const activeDoc = usePageStore.getState().getActiveDocument();
    const activeDocId = this.storePort.getActiveDocumentId() || activeDoc?.id || null;
    const effectiveProjectId =
      optProjectId ||
      this.storePort.getActiveProjectId() ||
      activeDoc?.id ||
      '';
    if (!effectiveProjectId) {
      this.notificationPort.notifyError('No active project found', 'refactor-citekey');
      return { success: false, modifiedCount: 0, replacedCount: 0 };
    }

    // 1. Collect all project files (merging backend files, LRU cache, and live active editor buffer)
    const fileMap = new Map<string, { id: string; path: string; content: string }>();

    try {
      const files = await this.servicePort.getFilesByProjectId(effectiveProjectId);
      for (const f of files) {
        if (f.id) {
          fileMap.set(f.id, {
            id: f.id,
            path: f.title,
            content: f.content || '',
          });
        }
      }
    } catch {
      // Non-blocking fallback to cache and active doc
    }

    if (fileMap.size === 0 && activeDoc?.id && activeDoc.id !== effectiveProjectId) {
      try {
        const pageFiles = await this.servicePort.getFilesByProjectId(activeDoc.id);
        for (const f of pageFiles) {
          if (f.id) {
            fileMap.set(f.id, {
              id: f.id,
              path: f.title,
              content: f.content || '',
            });
          }
        }
      } catch {
        // Ignore fallback error
      }
    }

    const cachedModels = lruDocumentCache.getAllModels();
    for (const m of cachedModels) {
      if (m.fileId) {
        fileMap.set(m.fileId, {
          id: m.fileId,
          path: m.filePath,
          content: m.content,
        });
      }
    }

    const { getActiveEditorEngine } = await import('@/features/editor/core');
    const liveEngine = getActiveEditorEngine();
    if (activeDocId) {
      const activeDocMatches = activeDoc?.id === activeDocId;
      const liveContent =
        liveEngine?.getContent?.() ||
        (activeDocMatches ? extractDocumentContentString(activeDoc) : '') ||
        fileMap.get(activeDocId)?.content ||
        '';
      const activePath =
        (activeDocMatches
          ? (activeDoc as { title?: string; name?: string })?.title ||
            (activeDoc as { title?: string; name?: string })?.name
          : null) ||
        fileMap.get(activeDocId)?.path ||
        'main.tex';
      if (liveContent) {
        fileMap.set(activeDocId, {
          id: activeDocId,
          path: activePath,
          content: liveContent,
        });
      }
    }

    const projectFiles = Array.from(fileMap.values());

    // 2. Perform safe domain refactoring across all files
    const { modifiedFiles, totalCount } = refactorCitationKeyAcrossFiles(projectFiles, oldKey, newKey);

    if (modifiedFiles.length === 0) {
      this.notificationPort.notifyInfo?.(`No citations found referencing @${oldKey}`, 'refactor-citekey');
      return { success: true, modifiedCount: 0, replacedCount: 0 };
    }

    // 3. Apply updates to LRU cache, backend, symbol index, and active editor
    for (const mod of modifiedFiles) {
      lruDocumentCache.updateContent(mod.id, mod.newContent, true);

      // Re-index in Symbol Index & DAG
      latexSymbolsIndex.indexFile(mod.id, mod.path, mod.newContent, true);
      latexDagEngine.parseAndRegister(mod.path, mod.newContent, mod.id);

      // Persist to backend
      try {
        await this.servicePort.updateFileContent(mod.id, mod.newContent);
      } catch (err) {
        console.warn(`[WorkspaceCoordinator] Failed to save updated file ${mod.path} to backend:`, err);
      }

      // If this file is currently open in the active editor, notify store and command bus
      if (activeDocId && activeDocId === mod.id) {
        const pageStore = usePageStore.getState();
        if (pageStore.activeFilePage?.id === mod.id) {
          pageStore.setActiveFilePage({
            ...pageStore.activeFilePage,
            content: mod.newContent,
          });
        }
        pageStore.setCurrentPage((prev) =>
          prev && prev.id === mod.id ? { ...prev, content: mod.newContent, docContent: mod.newContent } : prev
        );
        editorCommandBus.dispatch({ type: 'editor:set-content', content: mod.newContent });
      }
    }

    // 4. Notify UI & filetree
    editorCommandBus.dispatch({
      type: 'filetree:updated',
      payload: { action: 'refactor-citekey', oldKey, newKey, totalCount },
    });
    this.dispatchFileTreeRefresh();

    this.notificationPort.notifySuccess(
      `Renamed @${oldKey} to @${newKey} (${totalCount} occurrences in ${modifiedFiles.length} files)!`,
      'refactor-citekey'
    );
    return { success: true, modifiedCount: modifiedFiles.length, replacedCount: totalCount };
  }
}

export const workspaceCoordinator = new WorkspaceCoordinatorRegistry();
