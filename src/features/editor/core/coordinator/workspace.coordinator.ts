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
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import {
  editorCommandBus,
  useWorkspaceStore,
  usePageStore,
  useSettingsStore,
} from '@/features/editor/core';
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

type CreatedFileNode = LinkedFileDto & { title?: string; content?: string };

export class WorkspaceCoordinatorRegistry {
  private initialized = false;
  private projectFiles: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> = [];

  constructor() {
    this.initCommandSubscriptions();
  }

  private getActiveProjectId(): string | null {
    return (
      usePageStore.getState().projectId ||
      usePageStore.getState().parentPageId ||
      usePageStore.getState().currentPage?.id ||
      null
    );
  }

  private closeTabInStore(fileId: string): void {
    const wsStore = useWorkspaceStore.getState();
    for (const projId of Object.keys(wsStore.tabsByProject)) {
      wsStore.closeTab(projId, fileId);
    }
    const pageStore = usePageStore.getState();
    if (pageStore.activeFilePage?.id === fileId) {
      const parentPage = pageStore.currentPage;
      pageStore.setActiveFilePage(parentPage && parentPage.id !== fileId ? parentPage : null);
    }
  }

  private updateTabTitleInStore(projectId: string, itemId: string, newTitle: string): void {
    const wsStore = useWorkspaceStore.getState();
    for (const projId of Object.keys(wsStore.tabsByProject)) {
      wsStore.updateTabTitle(projId, itemId, newTitle);
    }
    if (projectId && !wsStore.tabsByProject[projectId]) {
      wsStore.updateTabTitle(projectId, itemId, newTitle);
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
    const effectiveProjectId = optProjectId || this.getActiveProjectId();

    if (!effectiveProjectId) {
      toast.error('Cannot create file: no active project');
      return null;
    }

    try {
      const res = (await manuscriptService.structure.createNode(effectiveProjectId, {
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

      // 4. Auto-open in tab if requested
      if (openAfterCreate) {
        editorCommandBus.dispatch({
          type: 'navigation:open-tab',
          fileId: newFile.id,
          title: resolvedTitle,
          path: resolvedTitle,
        });
      }

      toast.success(`Created "${name}"`, { id: `create-file-${name}` });
      return newFile;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Create file error:', err);
      toast.error((err as Error)?.message || `Failed to create "${name}"`, { id: `create-file-${name}` });
      return null;
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
      await manuscriptService.structure.renameNode(effectiveProjectId, itemId, { name: newName });

      // 1. Cascade rename to Tabs Store across all project/page scopes
      this.updateTabTitleInStore(effectiveProjectId, itemId, newName);

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

      toast.success(`Renamed to "${newName}"`, { id: `rename-file-${itemId}` });
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Rename error:', err);
      toast.error((err as Error)?.message || `Failed to rename "${oldName}"`, { id: `rename-file-${itemId}` });
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
      await manuscriptService.structure.deleteNode(effectiveProjectId, fileId);

      // 1. Close open tab if present
      this.closeTabInStore(fileId);
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

      toast.success('File moved to trash', { id: `delete-file-${fileId}` });
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Delete error:', err);
      toast.error((err as Error)?.message || 'Failed to delete file', { id: `delete-file-${fileId}` });
      return false;
    }
  }

  /**
   * Moves a file/folder to a new parent folder
   */
  public async moveItem(options: MoveItemOptions): Promise<boolean> {
    const { itemId, targetFolderId, projectId: optProjectId } = options;
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    if (!effectiveProjectId) return false;

    try {
      await manuscriptService.structure.moveNode(effectiveProjectId, itemId, {
        destParentId: targetFolderId,
      });

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'move', itemId, targetFolderId },
      });

      toast.success('Moved successfully', { id: `move-file-${itemId}` });
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Move error:', err);
      toast.error((err as Error)?.message || 'Failed to move item', { id: `move-file-${itemId}` });
      return false;
    }
  }

  /**
   * Restores a deleted file from trash, warms cache, re-indexes symbols and DAG
   */
  public async restoreFile(fileId: string, optProjectId?: string): Promise<unknown> {
    const effectiveProjectId = optProjectId || this.getActiveProjectId();
    try {
      const res = (await manuscriptService.docs.restore(fileId)) as {
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

      toast.success('File restored', { id: `restore-file-${fileId}` });
      return res;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Restore error:', err);
      toast.error((err as Error)?.message || 'Failed to restore file', { id: `restore-file-${fileId}` });
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
      await manuscriptService.structure.setRootDoc(effectiveProjectId, fileId);
      const cached = lruDocumentCache.getModel(fileId);
      const matchedProjectFile = this.projectFiles.find((f) => f.id === fileId);
      const resolvedFileName = cached?.filePath || matchedProjectFile?.title || matchedProjectFile?.name || fileId;
      useSettingsStore.getState().setMainFile(resolvedFileName);

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'set-root', fileId },
      });

      toast.success('Set as main document', { id: 'set-main-file' });
      return true;
    } catch (err: unknown) {
      console.error('[WorkspaceCoordinator] Set main document error:', err);
      toast.error((err as Error)?.message || 'Failed to set main document', { id: 'set-main-file' });
      throw err;
    }
  }

  /**
   * High-speed initial bulk indexing of all project files for cross-referencing and DAG
   */
  public initProjectSymbols(files: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }>): void {
    this.projectFiles = [...files];
    latexSymbolsIndex.clear();
    latexDagEngine.clear();
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
    const { executeProjectCitekeyRefactor } = await import(
      '@/features/editor/subsystems/citation/model/citation-refactor'
    );
    return executeProjectCitekeyRefactor(oldKey, newKey, optProjectId || this.getActiveProjectId() || undefined);
  }
}

export const workspaceCoordinator = new WorkspaceCoordinatorRegistry();
