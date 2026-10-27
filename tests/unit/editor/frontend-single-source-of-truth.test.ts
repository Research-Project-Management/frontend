import { describe, it, expect, beforeEach } from 'vitest';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { editorInvariantMonitor } from '@/features/editor/core/coordinator/editor-invariant-monitor';

describe('Frontend Single Source of Truth & Clean Hierarchy', () => {
  const projectId = 'proj-ssot-1';
  const rootPageId = 'page-root-1';

  beforeEach(() => {
    lruDocumentCache.clear();
    useCompileStore.getState().clearAllDirty();
    useWorkspaceStore.getState().closeAllTabsForProject(projectId);
    useWorkspaceStore.getState().closeAllTabsForProject(rootPageId);
    usePageStore.getState().resetPageState();
  });

  describe('1. LRUDocumentCache Single Authority & Reactive Subscriptions', () => {
    it('supports reactive zero-argument subscription compatible with useSyncExternalStore', () => {
      let notifyCount = 0;
      const initialSnapshot = lruDocumentCache.getSnapshot();

      const unsubscribe = lruDocumentCache.subscribe(() => {
        notifyCount++;
      });

      // Register model triggers notification and snapshot bump
      lruDocumentCache.registerModel('file-1', { content: 'Initial', filePath: 'main.tex', projectId });
      expect(notifyCount).toBe(1);
      expect(lruDocumentCache.getSnapshot()).toBeGreaterThan(initialSnapshot);

      // Mutate content triggers notification
      lruDocumentCache.updateContent('file-1', 'Updated content', true);
      expect(notifyCount).toBe(2);

      // markClean triggers notification
      lruDocumentCache.markClean('file-1');
      expect(notifyCount).toBe(3);

      // Unsubscribe ceases callbacks
      unsubscribe();
      lruDocumentCache.updateContent('file-1', 'Another edit', true);
      expect(notifyCount).toBe(3);
    });

    it('acts as single authority for isDirty, getDirtyFileIds, and getDirtyModels', () => {
      lruDocumentCache.registerModel('file-a', { content: 'Doc A', filePath: 'a.tex', projectId });
      lruDocumentCache.registerModel('file-b', { content: 'Doc B', filePath: 'b.tex', projectId });

      expect(lruDocumentCache.isDirty('file-a')).toBe(false);
      expect(lruDocumentCache.isDirty('file-b')).toBe(false);
      expect(lruDocumentCache.getDirtyFileIds()).toEqual([]);
      expect(lruDocumentCache.getDirtyModels()).toEqual([]);

      // Mark dirty
      lruDocumentCache.updateContent('file-a', 'Doc A edited', true);
      expect(lruDocumentCache.isDirty('file-a')).toBe(true);
      expect(lruDocumentCache.getDirtyFileIds()).toEqual(['file-a']);
      expect(lruDocumentCache.getDirtyModels().map((m) => m.fileId)).toEqual(['file-a']);

      // Mark clean
      lruDocumentCache.markClean('file-a');
      expect(lruDocumentCache.isDirty('file-a')).toBe(false);
      expect(lruDocumentCache.getDirtyFileIds()).toEqual([]);

      // Mark multiple dirty and clearAllDirty
      lruDocumentCache.updateContent('file-a', 'Doc A edit 2', true);
      lruDocumentCache.updateContent('file-b', 'Doc B edit 1', true);
      expect(lruDocumentCache.getDirtyFileIds()).toEqual(['file-a', 'file-b']);

      lruDocumentCache.clearAllDirty();
      expect(lruDocumentCache.isDirty('file-a')).toBe(false);
      expect(lruDocumentCache.isDirty('file-b')).toBe(false);
      expect(lruDocumentCache.getDirtyFileIds()).toEqual([]);
    });
  });

  describe('2. useCompileStore derivation from LRUDocumentCache', () => {
    it('automatically reflects dirty state from lruDocumentCache without independent store drift', () => {
      lruDocumentCache.registerModel('file-x', { content: 'Content X', filePath: 'x.tex', projectId });

      // Initially clean in both
      expect(lruDocumentCache.isDirty('file-x')).toBe(false);
      expect(useCompileStore.getState().isDirtyFile('file-x')).toBe(false);
      expect(useCompileStore.getState().getDirtyFiles()).toEqual([]);

      // LRU content mutation updates compile store reactively
      lruDocumentCache.updateContent('file-x', 'Dirty X', true);
      expect(useCompileStore.getState().isDirtyFile('file-x')).toBe(true);
      expect(useCompileStore.getState().dirtyFileIds.has('file-x')).toBe(true);
      expect(useCompileStore.getState().getDirtyFiles()).toEqual([
        { fileId: 'file-x', content: 'Dirty X' },
      ]);

      // Compile store markDirty delegates to LRU
      useCompileStore.getState().markDirty('file-x', 'Dirty X via compiler');
      expect(lruDocumentCache.getContent('file-x')).toBe('Dirty X via compiler');
      expect(lruDocumentCache.isDirty('file-x')).toBe(true);

      // Compile store clearDirty delegates to LRU
      useCompileStore.getState().clearDirty('file-x');
      expect(lruDocumentCache.isDirty('file-x')).toBe(false);
      expect(useCompileStore.getState().isDirtyFile('file-x')).toBe(false);
      expect(useCompileStore.getState().getDirtyFiles()).toEqual([]);
    });
  });

  describe('3. WorkspaceTab isDirty dynamic getter', () => {
    it('WorkspaceTab.isDirty dynamically reads from lruDocumentCache', () => {
      lruDocumentCache.registerModel('tab-doc-1', { content: 'Doc 1', filePath: 'doc1.tex', projectId });

      useWorkspaceStore.getState().openTab(projectId, {
        id: 'tab-doc-1',
        title: 'doc1.tex',
        path: 'doc1.tex',
      });

      const tabs = useWorkspaceStore.getState().tabsByProject[projectId];
      expect(tabs).toHaveLength(1);
      const tab = tabs[0];

      // Initially clean
      expect(tab.isDirty).toBe(false);

      // Mutate in LRU cache
      lruDocumentCache.updateContent('tab-doc-1', 'Mutated in cache', true);
      // Tab dynamically reflects dirty flag without store duplication
      expect(tab.isDirty).toBe(true);

      // Mark clean in LRU cache
      lruDocumentCache.markClean('tab-doc-1');
      expect(tab.isDirty).toBe(false);
    });

    it('markTabDirty delegates directly to lruDocumentCache', () => {
      lruDocumentCache.registerModel('tab-doc-2', { content: 'Doc 2', filePath: 'doc2.tex', projectId });

      useWorkspaceStore.getState().openTab(projectId, {
        id: 'tab-doc-2',
        title: 'doc2.tex',
        path: 'doc2.tex',
      });

      useWorkspaceStore.getState().markTabDirty(projectId, 'tab-doc-2', true);
      expect(lruDocumentCache.isDirty('tab-doc-2')).toBe(true);

      useWorkspaceStore.getState().markTabDirty(projectId, 'tab-doc-2', false);
      expect(lruDocumentCache.isDirty('tab-doc-2')).toBe(false);
    });
  });

  describe('4. Clean Hierarchy: projectId -> pageId (rootPageId) -> activeDocId', () => {
    it('usePageStore maintains clean hierarchy with synced aliases', () => {
      const pageStore = usePageStore.getState();

      pageStore.setHierarchy({
        projectId: 'proj-omega',
        rootPageId: 'page-main-entry',
        activeDocId: 'file-sub-section',
      });

      const state = usePageStore.getState();
      expect(state.projectId).toBe('proj-omega');
      expect(state.rootPageId).toBe('page-main-entry');
      expect(state.parentPageId).toBe('page-main-entry');
      expect(state.activeDocId).toBe('file-sub-section');
      expect(state.activePageId).toBe('file-sub-section');

      expect(state.getProjectId()).toBe('proj-omega');
      expect(state.getRootPageId()).toBe('page-main-entry');
      expect(state.getActiveDocId()).toBe('file-sub-section');
    });

    it('useWorkspaceStore provides hierarchy-aware accessors', () => {
      const ws = useWorkspaceStore.getState();

      ws.openTab(projectId, {
        id: 'main-doc',
        title: 'main.tex',
        path: 'main.tex',
      });

      ws.setActiveDocId(projectId, 'main-doc', rootPageId);

      expect(ws.getActiveDocId(projectId)).toBe('main-doc');
      expect(ws.getActiveDocId(projectId, rootPageId)).toBe('main-doc');
      expect(ws.getTabsForHierarchy(projectId)).toHaveLength(1);
    });
  });

  describe('5. EditorStateInvariantMonitor no-op pass-through', () => {
    it('always reports valid and no violations since single source of truth eliminates drift', () => {
      const report = editorInvariantMonitor.checkInvariants();
      expect(report.valid).toBe(true);
      expect(report.violations).toEqual([]);

      const reconcileReport = editorInvariantMonitor.reconcileInvariants();
      expect(reconcileReport.valid).toBe(true);
      expect(reconcileReport.violations).toEqual([]);
    });
  });
});
