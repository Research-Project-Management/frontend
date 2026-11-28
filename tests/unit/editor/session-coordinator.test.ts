import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SessionCoordinator,
  sessionCoordinator,
  shouldUseRealtimePersistence,
  editorCommandBus,
  usePageStore,
  useWorkspaceStore,
  setActiveEditorEngine,
  type DocumentPersistencePort,
  type DocumentConflict,
  type IEditorEngine,
} from '@/features/editor/core';
import {
  createInitialSessionContext,
  sessionFsmTransition,
} from '@/features/editor/domain/document/session-fsm';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { pagesService } from '@/features/editor/sdk/pages.service';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${seq++}`;

describe('SessionCoordinator, Pure Session FSM, Tab Switching & Conflict Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lruDocumentCache.clear();
    useCompileStore.getState().clearAllDirty();
  });

  afterEach(() => {
    setActiveEditorEngine(null);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('1. Pure Domain Session FSM (sessionFsmTransition)', () => {
    it('transitions idle <-> active -> dirty -> saving -> idle and preserves dirty flag on mid-flight edits or save failures', () => {
      let ctx = createInitialSessionContext('doc-1', 1);
      expect(ctx.state).toBe('idle');
      expect(ctx.lastSavedVersion).toBe(1);

      ctx = sessionFsmTransition(ctx, { type: 'ACTIVATE' });
      expect(ctx.state).toBe('active');
      ctx = sessionFsmTransition(ctx, { type: 'DEACTIVATE' });
      expect(ctx.state).toBe('idle');

      ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
      expect(ctx.state).toBe('dirty');

      ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });
      expect(ctx.state).toBe('saving');
      expect(ctx.pendingSaveVersion).toBe(2);

      // Mid-flight edit bumps version to 3 while save of v2 is running
      ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 3 });
      ctx = sessionFsmTransition(ctx, {
        type: 'SAVE_SUCCESS',
        savedVersion: 2,
        currentVersion: 3,
      });
      expect(ctx.state).toBe('dirty');
      expect(ctx.lastSavedVersion).toBe(2);

      // Next save succeeds cleanly without concurrent edits
      ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });
      ctx = sessionFsmTransition(ctx, {
        type: 'SAVE_SUCCESS',
        savedVersion: 3,
        currentVersion: 3,
      });
      expect(ctx.state).toBe('idle');
      expect(ctx.lastSavedVersion).toBe(3);

      // Save failure reverts to dirty
      ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 4 });
      ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });
      ctx = sessionFsmTransition(ctx, { type: 'SAVE_FAILURE', error: new Error('Network error') });
      expect(ctx.state).toBe('dirty');
      expect(ctx.error).toBeDefined();
    });

    it('transitions through CONFLICT_DETECTED, CONFLICT_RESOLVED, and EVICT', () => {
      let ctx = createInitialSessionContext('doc-1', 1);
      ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
      ctx = sessionFsmTransition(ctx, { type: 'CONFLICT_DETECTED' });
      expect(ctx.state).toBe('conflict');

      expect(
        sessionFsmTransition(ctx, { type: 'CONFLICT_RESOLVED', resolution: 'take-remote' }).state,
      ).toBe('idle');
      expect(
        sessionFsmTransition(ctx, { type: 'CONFLICT_RESOLVED', resolution: 'keep-local' }).state,
      ).toBe('dirty');
      expect(
        sessionFsmTransition(ctx, { type: 'CONFLICT_RESOLVED', resolution: 'custom-merge' }).state,
      ).toBe('dirty');

      const evicted = sessionFsmTransition(ctx, { type: 'EVICT' });
      expect(evicted.state).toBe('evicted');
      expect(sessionFsmTransition(evicted, { type: 'LOCAL_EDIT', version: 99 }).state).toBe(
        'evicted',
      );
    });
  });

  describe('2. SessionCoordinator Persistence Adapter & Mid-Flight Flush Guards', () => {
    it('flushes through injected DocumentPersistencePort and manages tab FSM transitions', async () => {
      const savedDocs = new Map<string, string>();
      const inMemoryAdapter: DocumentPersistencePort = {
        updateContent: async (fileId: string, content: string) => {
          savedDocs.set(fileId, content);
        },
      };

      const session = new SessionCoordinator({
        persistenceAdapter: inMemoryAdapter,
        autoSaveDelay: 200,
      });

      lruDocumentCache.registerModel('paper.tex', { content: '\\section{Original}' });
      lruDocumentCache.registerModel('tab2.tex', { content: 'Doc 2' });

      session.switchTab(null, 'paper.tex');
      expect(session.getFsmState('paper.tex')).toBe('active');

      session.switchTab('paper.tex', 'tab2.tex');
      expect(session.getFsmState('paper.tex')).toBe('idle');
      expect(session.getFsmState('tab2.tex')).toBe('active');

      session.notifyContentChange('paper.tex', '\\section{Edited}', { isRealtimeActive: false });
      expect(session.getFsmState('paper.tex')).toBe('dirty');

      const clean = await session.flushFile('paper.tex');
      expect(clean).toBe(true);
      expect(session.getFsmState('paper.tex')).toBe('idle');
      expect(savedDocs.get('paper.tex')).toBe('\\section{Edited}');

      session.closeTab('tab2.tex');
      expect(session.getFsmState('tab2.tex')).toBe('evicted');
    });

    it('keeps files dirty in flushFile and flushAllPending when edits arrive mid-flight', async () => {
      const id = nextId('race');
      lruDocumentCache.registerModel(id, { content: 'v0' });
      lruDocumentCache.updateContent(id, 'v1', true);

      let release!: () => void;
      vi.spyOn(pagesService.docs, 'updateContent').mockImplementation(
        () => new Promise((r) => (release = () => r(undefined as never))),
      );

      const flushPromise = sessionCoordinator.flushFile(id);
      await Promise.resolve();
      lruDocumentCache.updateContent(id, 'v2 typed during save', true);
      release();

      expect(await flushPromise).toBe(false);
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
      expect(lruDocumentCache.getModel(id)?.content).toBe('v2 typed during save');

      const idAll = nextId('all');
      lruDocumentCache.registerModel(idAll, { content: 'v0' });
      lruDocumentCache.updateContent(idAll, 'v1', true);
      const releases: Array<() => void> = [];
      vi.spyOn(pagesService.docs, 'updateContent').mockImplementation(
        () => new Promise((r) => releases.push(() => r(undefined as never))),
      );
      const allPromise = sessionCoordinator.flushAllPending();
      await Promise.resolve();
      lruDocumentCache.updateContent(idAll, 'v2', true);
      releases.forEach((fn) => fn());
      await allPromise;
      expect(lruDocumentCache.getModel(idAll)?.isDirty).toBe(true);
    });
  });

  describe('3. Realtime Persistence Policy & Remote-Origin Edits', () => {
    it('requires yText, online network, and connected provider before suppressing HTTP autosave', async () => {
      expect(
        shouldUseRealtimePersistence({ hasYText: true, isOnline: true, isProviderConnected: true }),
      ).toBe(true);
      expect(
        shouldUseRealtimePersistence({ hasYText: true, isOnline: true, isProviderConnected: false }),
      ).toBe(false);
      expect(
        shouldUseRealtimePersistence({ hasYText: true, isOnline: false, isProviderConnected: true }),
      ).toBe(false);
      expect(
        shouldUseRealtimePersistence({ hasYText: false, isOnline: true, isProviderConnected: true }),
      ).toBe(false);

      vi.useFakeTimers();
      const id = nextId('rt');
      const spy = vi.spyOn(pagesService.docs, 'updateContent').mockResolvedValue(undefined as never);
      lruDocumentCache.registerModel(id, { content: 'base' });
      sessionCoordinator.setRealtimeConnected(id, true);
      sessionCoordinator.notifyContentChange(id, 'typed while connected', {
        isRealtimeActive: true,
        skipAutoCompile: true,
      });
      await vi.advanceTimersByTimeAsync(2000);
      expect(spy).not.toHaveBeenCalled();

      sessionCoordinator.setRealtimeConnected(id, false);
      await vi.advanceTimersByTimeAsync(2500);
      expect(spy).toHaveBeenCalledWith(id, 'typed while connected');
      sessionCoordinator.closeTab(id);
    });

    it('preserves clean/dirty flags accurately on remote-origin content notifications', () => {
      const cleanId = nextId('remote-clean');
      lruDocumentCache.registerModel(cleanId, { content: 'a' });
      sessionCoordinator.notifyContentChange(cleanId, 'a + remote', { origin: 'remote' });
      expect(lruDocumentCache.getModel(cleanId)?.isDirty).toBe(false);
      expect(lruDocumentCache.getModel(cleanId)?.content).toBe('a + remote');

      const dirtyId = nextId('remote-dirty');
      lruDocumentCache.registerModel(dirtyId, { content: 'a' });
      lruDocumentCache.updateContent(dirtyId, 'a local', true);
      sessionCoordinator.notifyContentChange(dirtyId, 'a local + remote', { origin: 'remote' });
      expect(lruDocumentCache.getModel(dirtyId)?.isDirty).toBe(true);
    });
  });

  describe('4. Conflict Detection & 3-Way Resolution (keep-local, take-remote, custom-merge)', () => {
    it('applies remote updates directly when clean, and surfaces conflicts when local is dirty', () => {
      const cleanId = nextId('clean');
      lruDocumentCache.registerModel(cleanId, { content: 'v1' });
      const listener = vi.fn();
      const unsubClean = sessionCoordinator.onConflict(listener);
      sessionCoordinator.handleRemoteContentUpdated(cleanId, 'v2');
      expect(lruDocumentCache.getModel(cleanId)?.content).toBe('v2');
      expect(listener).not.toHaveBeenCalled();
      unsubClean();

      const conflictId = nextId('conflict');
      lruDocumentCache.registerModel(conflictId, { content: 'base v1', filePath: 'main.tex' });
      lruDocumentCache.updateContent(conflictId, 'local unsaved edit', true);

      const received: DocumentConflict[] = [];
      const unsub = sessionCoordinator.onConflict((c) => received.push(c));
      sessionCoordinator.handleRemoteContentUpdated(conflictId, 'remote concurrent edit');

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        fileId: conflictId,
        localContent: 'local unsaved edit',
        remoteContent: 'remote concurrent edit',
      });
      expect(sessionCoordinator.getConflict(conflictId)?.localContent).toBe('local unsaved edit');
      expect(sessionCoordinator.getConflicts().some((c) => c.fileId === conflictId)).toBe(true);
      unsub();
    });

    it('resolves conflicts via keep-local, take-remote, and custom-merge with autosave and bus sync', async () => {
      vi.useFakeTimers();
      const updateSpy = vi
        .spyOn(pagesService.docs, 'updateContent')
        .mockResolvedValue(undefined as never);
      const busSpy = vi.fn();
      const unsubBus = editorCommandBus.subscribe('editor:set-content', busSpy);

      try {
        // 1. keep-local
        const keepId = nextId('keep-local');
        lruDocumentCache.registerModel(keepId, { content: 'base', filePath: 'main.tex' });
        lruDocumentCache.updateContent(keepId, 'local master edit', true);
        sessionCoordinator.handleRemoteContentUpdated(keepId, 'server edit');
        sessionCoordinator.resolveConflict(keepId, 'keep-local');

        expect(sessionCoordinator.getConflict(keepId)).toBeUndefined();
        expect(lruDocumentCache.getModel(keepId)?.content).toBe('local master edit');
        expect(lruDocumentCache.getModel(keepId)?.isDirty).toBe(true);
        await vi.advanceTimersByTimeAsync(1200);
        expect(updateSpy).toHaveBeenCalledWith(keepId, 'local master edit');

        // 2. take-remote
        const remoteId = nextId('take-remote');
        lruDocumentCache.registerModel(remoteId, {
          content: 'base',
          filePath: 'main.tex',
          projectId: 'test-proj',
        });
        lruDocumentCache.updateContent(remoteId, 'my local ideas', true);
        sessionCoordinator.handleRemoteContentUpdated(remoteId, 'authoritative remote text');
        sessionCoordinator.resolveConflict(remoteId, 'take-remote');

        expect(sessionCoordinator.getConflict(remoteId)).toBeUndefined();
        expect(lruDocumentCache.getModel(remoteId)?.content).toBe('authoritative remote text');
        expect(lruDocumentCache.getModel(remoteId)?.isDirty).toBe(false);
        expect(sessionCoordinator.getFsmState(remoteId)).toBe('idle');
        expect(busSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'editor:set-content',
            content: 'authoritative remote text',
          }),
        );

        // 3. custom-merge
        const mergeId = nextId('custom-merge');
        lruDocumentCache.registerModel(mergeId, {
          content: 'base',
          filePath: 'main.tex',
          projectId: 'test-proj',
        });
        lruDocumentCache.updateContent(mergeId, 'Section 1 (Local)', true);
        sessionCoordinator.handleRemoteContentUpdated(mergeId, 'Section 2 (Remote)');
        const merged = 'Section 1 (Local)\nSection 2 (Remote)';
        sessionCoordinator.resolveConflict(mergeId, 'custom-merge', merged);

        expect(sessionCoordinator.getConflict(mergeId)).toBeUndefined();
        expect(lruDocumentCache.getModel(mergeId)?.content).toBe(merged);
        expect(lruDocumentCache.getModel(mergeId)?.isDirty).toBe(true);
        expect(sessionCoordinator.getFsmState(mergeId)).toBe('dirty');
        await vi.advanceTimersByTimeAsync(1200);
        expect(updateSpy).toHaveBeenCalledWith(mergeId, merged);
      } finally {
        unsubBus();
      }
    });
  });

  describe('5. Atomic Document Session & Tab Lifecycle (navigationCoordinator)', () => {
    const projectId = 'proj-atomic-123';
    const rootPageId = 'doc-root-main';

    beforeEach(() => {
      useWorkspaceStore.getState().closeAllTabsForProject(projectId);
      usePageStore.setState({
        projectId,
        currentPage: { id: rootPageId, title: 'main.tex' } as never,
        activeFilePage: { id: rootPageId, title: 'main.tex' } as never,
      });
    });

    it('captures uncommitted editor buffer on tab switch, auto-registers models, and evicts on closeDocument', () => {
      lruDocumentCache.registerModel('file-a', {
        content: 'Original content of File A',
        filePath: 'chapter1.tex',
        projectId,
      });
      navigationCoordinator.openDocument({
        fileId: 'file-a',
        title: 'chapter1.tex',
        path: 'chapter1.tex',
      });
      expect(sessionCoordinator.getFsmState('file-a')).toBe('active');

      setActiveEditorEngine({
        getContent: () => 'Uncommitted live keystrokes in File A',
        focus: vi.fn(),
      } as Partial<IEditorEngine> as IEditorEngine);

      navigationCoordinator.openDocument({
        fileId: 'file-b',
        title: 'chapter2.tex',
        path: 'chapter2.tex',
      });

      expect(lruDocumentCache.getModel('file-a')?.content).toBe(
        'Uncommitted live keystrokes in File A',
      );
      expect(lruDocumentCache.getModel('file-a')?.isDirty).toBe(true);
      expect(lruDocumentCache.getModel('file-b')?.filePath).toBe('chapter2.tex');
      expect(sessionCoordinator.getFsmState('file-b')).toBe('active');
      expect(useWorkspaceStore.getState().activeByProject[projectId]).toBe('file-b');

      navigationCoordinator.closeDocument('file-b');
      expect(lruDocumentCache.getModel('file-b')).toBeUndefined();
      expect(useWorkspaceStore.getState().activeByProject[projectId]).toBe('file-a');
    });
  });
});
