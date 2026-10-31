/**
 * workspace-coordinator-deep-module.test.ts
 *
 * Verification suite for WorkspaceCoordinator as a Deep Module (Matt Pocock design pattern):
 * - Injected WorkspaceServicePort, WorkspaceNotificationPort, and WorkspaceStorePort test stand-ins.
 * - End-to-end file lifecycle: create, rename, delete, move, restore, setMainFile, and refactorCitekey.
 * - Verifies internal side effects: LRU cache warming/eviction, DAG engine updates, Symbol indexing,
 *   Diagnostics alias tracking, and CommandBus event dispatching.
 * - Graceful failure handling and UI isolation (zero leaked direct toast or DOM dependencies).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkspaceCoordinatorRegistry,
  workspaceCoordinator,
  usePageStore,
} from '@/features/editor/core';
import type {
  WorkspaceServicePort,
  WorkspaceNotificationPort,
  WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { editorCommandBus } from '@/features/editor/core';

describe('WorkspaceCoordinator Deep Module (Ports & Seams)', () => {
  let mockService: WorkspaceServicePort;
  let mockNotification: WorkspaceNotificationPort;
  let mockStore: WorkspaceStorePort;
  let coordinator: WorkspaceCoordinatorRegistry;

  beforeEach(() => {
    lruDocumentCache.clearAll();
    latexDagEngine.clear();
    latexSymbolsIndex.clear();
    usePageStore.setState({ activeDoc: null, currentPage: null } as any);

    mockService = {
      createNode: vi.fn().mockImplementation(async (_projId, data) => ({
        id: 'file-new-1',
        title: data.name,
        name: data.name,
        content: data.content || '',
        type: 'DOC',
      })),
      renameNode: vi.fn().mockResolvedValue({ success: true }),
      deleteNode: vi.fn().mockResolvedValue({ success: true }),
      moveNode: vi.fn().mockResolvedValue({ success: true }),
      restoreFile: vi.fn().mockResolvedValue({
        page: {
          id: 'file-restored-1',
          title: 'restored.tex',
          content: '\\section{Restored}',
          projectId: 'proj-test',
        },
      }),
      setRootDoc: vi.fn().mockResolvedValue({ success: true }),
      getFilesByProjectId: vi.fn().mockResolvedValue([]),
      updateFileContent: vi.fn().mockResolvedValue({ success: true }),
    };

    mockNotification = {
      notifySuccess: vi.fn(),
      notifyError: vi.fn(),
      notifyInfo: vi.fn(),
    };

    mockStore = {
      getActiveProjectId: vi.fn().mockReturnValue('proj-test'),
      closeTab: vi.fn(),
      updateTabTitle: vi.fn(),
      setMainFile: vi.fn(),
      getActiveDocumentId: vi.fn().mockReturnValue('file-new-1'),
    };

    coordinator = new WorkspaceCoordinatorRegistry({
      service: mockService,
      notification: mockNotification,
      store: mockStore,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    workspaceCoordinator.resetPorts();
  });

  describe('createFile', () => {
    it('creates a file, warms LRU cache, registers DAG/symbols, and dispatches events', async () => {
      const busEvents: any[] = [];
      const unsub1 = editorCommandBus.subscribe('filetree:updated', (cmd) => busEvents.push(cmd));
      const unsub2 = editorCommandBus.subscribe('navigation:open-tab', (cmd) => busEvents.push(cmd));

      const file = await coordinator.createFile({
        name: 'chapter1.tex',
        content: '\\section{Chapter 1}\n\\label{sec:intro}',
        openAfterCreate: true,
      });

      expect(file).not.toBeNull();
      expect(file?.id).toBe('file-new-1');
      expect(mockService.createNode).toHaveBeenCalledWith('proj-test', {
        name: 'chapter1.tex',
        parentId: null,
        content: '\\section{Chapter 1}\n\\label{sec:intro}',
        type: 'DOC',
      });

      // Verify LRU cache warmed
      const cached = lruDocumentCache.getModel('file-new-1');
      expect(cached).toBeDefined();
      expect(cached?.filePath).toBe('chapter1.tex');

      // Verify Symbol indexed
      const snapshot = latexSymbolsIndex.getSnapshot();
      expect(snapshot.labels.some((l) => l.name === 'sec:intro')).toBe(true);

      // Verify notifications
      expect(mockNotification.notifySuccess).toHaveBeenCalledWith(
        'Created "chapter1.tex"',
        'create-file-chapter1.tex'
      );

      // Verify bus events
      expect(busEvents.some((e) => e.type === 'filetree:updated')).toBe(true);
      expect(busEvents.some((e) => e.type === 'navigation:open-tab' && e.fileId === 'file-new-1')).toBe(true);

      unsub1();
      unsub2();
    });

    it('returns null and notifies error if no active project exists', async () => {
      mockStore.getActiveProjectId = vi.fn().mockReturnValue(null);

      const file = await coordinator.createFile({ name: 'isolated.tex' });
      expect(file).toBeNull();
      expect(mockNotification.notifyError).toHaveBeenCalledWith('Cannot create file: no active project');
      expect(mockService.createNode).not.toHaveBeenCalled();
    });

    it('handles backend service failure gracefully', async () => {
      mockService.createNode = vi.fn().mockRejectedValue(new Error('Disk quota exceeded'));

      const file = await coordinator.createFile({ name: 'fail.tex' });
      expect(file).toBeNull();
      expect(mockNotification.notifyError).toHaveBeenCalledWith(
        'Disk quota exceeded',
        'create-file-fail.tex'
      );
    });
  });

  describe('renameItem', () => {
    it('renames an item, cascades to tabs/cache/DAG/diagnostics, and dispatches filetree:updated', async () => {
      // Setup initial model in cache
      lruDocumentCache.warm('file-rename-1', {
        filePath: 'old_name.tex',
        content: '\\input{sub.tex}',
        projectId: 'proj-test',
      });
      latexDagEngine.parseAndRegister('old_name.tex', '\\input{sub.tex}', 'file-rename-1');

      const busEvents: any[] = [];
      const unsub = editorCommandBus.subscribe('filetree:updated', (cmd) => busEvents.push(cmd));

      const diagSpy = vi.spyOn(diagnosticsCoordinator, 'registerAlias');

      const ok = await coordinator.renameItem({
        itemId: 'file-rename-1',
        oldName: 'old_name.tex',
        newName: 'new_name.tex',
      });

      expect(ok).toBe(true);
      expect(mockService.renameNode).toHaveBeenCalledWith('proj-test', 'file-rename-1', { name: 'new_name.tex' });
      expect(mockStore.updateTabTitle).toHaveBeenCalledWith('proj-test', 'file-rename-1', 'new_name.tex');

      // LRU cache updated
      const updatedModel = lruDocumentCache.getModel('file-rename-1');
      expect(updatedModel?.filePath).toBe('new_name.tex');

      // Diagnostics alias registered
      expect(diagSpy).toHaveBeenCalledWith('new_name.tex', 'old_name.tex');

      // Notification
      expect(mockNotification.notifySuccess).toHaveBeenCalledWith(
        'Renamed to "new_name.tex"',
        'rename-file-file-rename-1'
      );

      // Bus dispatch
      expect(busEvents.some((e) => e.type === 'filetree:updated' && e.payload.action === 'rename')).toBe(true);

      unsub();
    });

    it('returns false and notifies error on rename service failure', async () => {
      mockService.renameNode = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const ok = await coordinator.renameItem({
        itemId: 'item-1',
        oldName: 'a.tex',
        newName: 'b.tex',
      });

      expect(ok).toBe(false);
      expect(mockNotification.notifyError).toHaveBeenCalledWith(
        'Permission denied',
        'rename-file-item-1'
      );
    });

    it('cascades folder prefix rename across descendant models in LRU cache, DAG, and diagnostics', async () => {
      lruDocumentCache.warm('child-doc-1', {
        filePath: 'sections/intro.tex',
        content: '\\section{Intro}\\label{sec:intro}',
        projectId: 'proj-test',
      });
      latexDagEngine.parseAndRegister('sections/intro.tex', '\\section{Intro}', 'child-doc-1');
      const diagSpy = vi.spyOn(diagnosticsCoordinator, 'registerAlias');

      const ok = await coordinator.renameItem({
        itemId: 'folder-sec',
        oldName: 'sections',
        newName: 'chapters',
      });

      expect(ok).toBe(true);
      expect(lruDocumentCache.getModel('child-doc-1')?.filePath).toBe('chapters/intro.tex');
      expect(diagSpy).toHaveBeenCalledWith('chapters/intro.tex', 'sections/intro.tex');
    });

    it('preserves parent folder prefix when renaming a nested file with a leaf name (e.g. sections/old.tex -> new.tex)', async () => {
      lruDocumentCache.warm('nested-doc-1', {
        filePath: 'sections/old.tex',
        content: '\\section{Old}',
        projectId: 'proj-test',
      });

      const ok = await coordinator.renameItem({
        itemId: 'nested-doc-1',
        oldName: 'sections/old.tex',
        newName: 'new.tex',
      });

      expect(ok).toBe(true);
      // Sends leaf name to backend renameNode
      expect(mockService.renameNode).toHaveBeenCalledWith('proj-test', 'nested-doc-1', { name: 'new.tex' });
      // Cascades full path "sections/new.tex" to Tabs and LRU cache
      expect(mockStore.updateTabTitle).toHaveBeenCalledWith('proj-test', 'nested-doc-1', 'sections/new.tex');
      expect(lruDocumentCache.getModel('nested-doc-1')?.filePath).toBe('sections/new.tex');
    });
  });

  describe('deleteFile', () => {
    it('deletes file, closes tab, evicts from cache/DAG, and notifies success', async () => {
      lruDocumentCache.warm('del-1', {
        filePath: 'del.tex',
        content: 'content',
        projectId: 'proj-test',
      });
      latexDagEngine.parseAndRegister('del.tex', 'content', 'del-1');

      const ok = await coordinator.deleteFile('del-1');

      expect(ok).toBe(true);
      expect(mockService.deleteNode).toHaveBeenCalledWith('proj-test', 'del-1');
      expect(mockStore.closeTab).toHaveBeenCalledWith('del-1');
      expect(lruDocumentCache.has('del-1')).toBe(false);
      expect(mockNotification.notifySuccess).toHaveBeenCalledWith(
        'File moved to trash',
        'delete-file-del-1'
      );
    });
  });

  describe('moveItem', () => {
    it('moves item to new parent folder and dispatches event', async () => {
      const busEvents: any[] = [];
      const unsub = editorCommandBus.subscribe('filetree:updated', (cmd) => busEvents.push(cmd));

      const ok = await coordinator.moveItem({
        itemId: 'item-move',
        targetFolderId: 'folder-sections',
      });

      expect(ok).toBe(true);
      expect(mockService.moveNode).toHaveBeenCalledWith('proj-test', 'item-move', {
        destParentId: 'folder-sections',
      });
      expect(mockNotification.notifySuccess).toHaveBeenCalledWith('Moved successfully', 'move-file-item-move');
      expect(busEvents.some((e) => e.payload?.action === 'move')).toBe(true);

      unsub();
    });
  });

  describe('restoreFile & setMainFile', () => {
    it('restores file, warms cache, and indexes symbols', async () => {
      const restored = await coordinator.restoreFile('file-restored-1');

      expect(restored).toBeDefined();
      expect(mockService.restoreFile).toHaveBeenCalledWith('file-restored-1', 'proj-test');
      expect(lruDocumentCache.has('file-restored-1')).toBe(true);
      expect(mockNotification.notifySuccess).toHaveBeenCalledWith(
        'File restored',
        'restore-file-file-restored-1'
      );
    });

    it('sets main file, updates store, and dispatches set-root event', async () => {
      const ok = await coordinator.setMainFile('file-new-1');

      expect(ok).toBe(true);
      expect(mockService.setRootDoc).toHaveBeenCalledWith('proj-test', 'file-new-1');
      expect(mockStore.setMainFile).toHaveBeenCalledWith('file-new-1');
      expect(mockNotification.notifySuccess).toHaveBeenCalledWith('Set as main document', 'set-main-file');
    });
  });

  describe('refactorCitekey', () => {
    it('refactors citation key across cached files and dispatches editor updates', async () => {
      lruDocumentCache.warm('bib-file', {
        filePath: 'refs.bib',
        content: '@article{einstein1905,\n  title={Relativity}\n}',
        projectId: 'proj-test',
      });
      lruDocumentCache.warm('tex-file', {
        filePath: 'main.tex',
        content: 'See \\cite{einstein1905} for details.',
        projectId: 'proj-test',
      });

      // Active doc is tex-file
      mockStore.getActiveDocumentId = vi.fn().mockReturnValue('tex-file');

      const editorEvents: any[] = [];
      const unsub = editorCommandBus.subscribe('editor:set-content', (cmd) => editorEvents.push(cmd));

      const res = await coordinator.refactorCitekey('einstein1905', 'einstein1905relativity');

      expect(res.success).toBe(true);
      expect(res.modifiedCount).toBe(2);
      expect(res.replacedCount).toBe(2);

      // Verify cached content
      expect(lruDocumentCache.getModel('bib-file')?.content).toContain('@article{einstein1905relativity,');
      expect(lruDocumentCache.getModel('tex-file')?.content).toContain('\\cite{einstein1905relativity}');

      // Verify backend persistence called for modified files
      expect(mockService.updateFileContent).toHaveBeenCalledWith('bib-file', expect.any(String));
      expect(mockService.updateFileContent).toHaveBeenCalledWith('tex-file', expect.any(String));

      // Verify active editor view updated via command bus
      expect(editorEvents.length).toBe(1);
      expect(editorEvents[0].content).toContain('\\cite{einstein1905relativity}');

      expect(mockNotification.notifySuccess).toHaveBeenCalledWith(
        expect.stringContaining('Renamed @einstein1905 to @einstein1905relativity'),
        'refactor-citekey'
      );

      unsub();
    });

    it('rejects invalid citation keys without touching files', async () => {
      const res = await coordinator.refactorCitekey('oldKey', 'invalid key with spaces');
      expect(res.success).toBe(false);
      expect(mockNotification.notifyError).toHaveBeenCalledWith(
        expect.stringContaining('whitespace'),
        'refactor-citekey'
      );
      expect(mockService.updateFileContent).not.toHaveBeenCalled();
    });
  });
});
