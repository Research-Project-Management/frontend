/**
 * workspace.coordinator.ts
 *
 * Workspace & File System Lifecycle Coordinator (Coordinators Layer).
 * Location: `features/editor/coordinators/workspace.coordinator.ts`
 *
 * Single Source of Truth for File / Folder Mutations:
 * - Creates files & folders and registers them in the DAG engine.
 * - Renames files: cascades updates across Tabs, LRU Cache, DAG relations, and Diagnostics.
 * - Deletes files: closes open tabs, evicts from cache, and cleans diagnostics.
 * - Moves files: recalculates relative include paths.
 * - Dispatches typed notifications on `editorCommandBus`.
 */

import { manuscriptService, type LinkedFileDto } from './services/manuscript.service';
import { lruDocumentCache } from '../domain/lru-document-cache';
import { latexDagEngine, normalizeLatexPath } from '../domain/latex-dag-engine';
import { latexSymbolsIndex } from '../domain/latex-symbols-index';
import { diagnosticsCoordinator } from './diagnostics.coordinator';
import { editorCommandBus } from './command-bus';
import { useTabsStore } from '../store/tabs.store';
import { usePageStore } from '../store/editor.store';
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

export class WorkspaceCoordinatorRegistry {
  private initialized = false;

  constructor() {
    this.initCommandSubscriptions();
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
  }

  /**
   * Creates a new LaTeX or asset file in the workspace
   */
  public async createFile(options: CreateFileOptions): Promise<LinkedFileDto | null> {
    const { name, folderId = null, content = '', projectId: optProjectId, openAfterCreate = true } = options;
    const effectiveProjectId = optProjectId || usePageStore.getState().projectId;

    if (!effectiveProjectId) {
      toast.error('Cannot create file: no active project');
      return null;
    }

    try {
      const res: any = await manuscriptService.structure.createNode(effectiveProjectId, {
        name,
        parentId: folderId,
        content,
        type: 'DOC',
      });
      const newFile = res?.data || res;

      if (!newFile) return null;

      // 1. Warm LRU cache
      lruDocumentCache.warm(newFile.id, {
        filePath: newFile.title || newFile.name || name,
        content: newFile.content || content,
        projectId: effectiveProjectId,
      });

      // 2. Register in LaTeX DAG Engine & Symbol Index
      latexDagEngine.parseAndRegister(newFile.title || newFile.name || name, newFile.content || content);
      latexSymbolsIndex.indexFile(newFile.id, newFile.title || newFile.name || name, newFile.content || content);

      // 3. Notify FileTree & CommandBus
      editorCommandBus.dispatch({ type: 'filetree:updated', payload: { action: 'create', file: newFile } });

      // 4. Auto-open in tab if requested
      if (openAfterCreate) {
        editorCommandBus.dispatch({
          type: 'navigation:open-tab',
          fileId: newFile.id,
          title: newFile.title || newFile.name || name,
          path: newFile.title || newFile.name || name,
        });
      }

      toast.success(`Created "${name}"`);
      return newFile;
    } catch (err: any) {
      console.error('[WorkspaceCoordinator] Create file error:', err);
      toast.error(err?.message || `Failed to create "${name}"`);
      return null;
    }
  }

  /**
   * Renames a file or folder and cascades updates across IDE systems
   */
  public async renameItem(options: RenameItemOptions): Promise<boolean> {
    const { itemId, oldName, newName, projectId: optProjectId } = options;
    const effectiveProjectId = optProjectId || usePageStore.getState().projectId;

    if (!effectiveProjectId) return false;

    try {
      await manuscriptService.structure.renameNode(effectiveProjectId, itemId, { name: newName });

      // 1. Cascade rename to Tabs Store
      const tabsStore = useTabsStore.getState();
      const allTabs = Object.values(tabsStore.tabsByProject).flat();
      const existingTab = allTabs.find((t: any) => t.id === itemId);
      if (existingTab) {
        tabsStore.updateTabTitle(effectiveProjectId, itemId, newName);
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

      toast.success(`Renamed to "${newName}"`);
      return true;
    } catch (err: any) {
      console.error('[WorkspaceCoordinator] Rename error:', err);
      toast.error(err?.message || `Failed to rename "${oldName}"`);
      return false;
    }
  }

  /**
   * Deletes a file and cleans up IDE resources
   */
  public async deleteFile(fileId: string, optProjectId?: string): Promise<boolean> {
    const effectiveProjectId = optProjectId || usePageStore.getState().projectId;
    if (!effectiveProjectId) return false;

    try {
      await manuscriptService.structure.deleteNode(effectiveProjectId, fileId);

      // 1. Close open tab if present
      useTabsStore.getState().closeTab(fileId);

      // 2. Evict from LRU Cache, DAG, & Symbol Index
      lruDocumentCache.evictModel(fileId);
      latexDagEngine.removeFileNode(fileId);
      latexSymbolsIndex.removeFile(fileId);

      // 3. Notify CommandBus
      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'delete', fileId },
      });

      toast.success('File moved to trash');
      return true;
    } catch (err: any) {
      console.error('[WorkspaceCoordinator] Delete error:', err);
      toast.error(err?.message || 'Failed to delete file');
      return false;
    }
  }

  /**
   * Moves a file/folder to a new parent folder
   */
  public async moveItem(options: MoveItemOptions): Promise<boolean> {
    const { itemId, targetFolderId, projectId: optProjectId } = options;
    const effectiveProjectId = optProjectId || usePageStore.getState().projectId;
    if (!effectiveProjectId) return false;

    try {
      await manuscriptService.structure.moveNode(effectiveProjectId, itemId, {
        destParentId: targetFolderId,
      });

      editorCommandBus.dispatch({
        type: 'filetree:updated',
        payload: { action: 'move', itemId, targetFolderId },
      });

      toast.success('Moved successfully');
      return true;
    } catch (err: any) {
      console.error('[WorkspaceCoordinator] Move error:', err);
      toast.error(err?.message || 'Failed to move item');
      return false;
    }
  }

  /**
   * High-speed initial bulk indexing of all project files for cross-referencing and DAG
   */
  public initProjectSymbols(files: Array<{ id: string; title?: string; name?: string; path?: string; content?: string }>): void {
    latexSymbolsIndex.clear();
    for (const file of files) {
      const path = file.path || file.title || file.name || file.id;
      const content = file.content || '';
      latexSymbolsIndex.indexFile(file.id, path, content);
      latexDagEngine.parseAndRegister(path, content, file.id);
    }
  }
}

export const workspaceCoordinator = new WorkspaceCoordinatorRegistry();
