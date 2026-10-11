import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useConnectivityStore } from '@/features/editor/store/connectivity.store';
import { useCompileStore } from '@/features/editor/store/compiler.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { compilerCoordinator } from '@/features/editor/coordinators/compiler.coordinator';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';
import { manuscriptService } from '@/features/editor/sdk';
import { LatexCompilerEngine } from '@/features/editor/coordinators/compilation-pipeline';

describe('Phase 8: Offline Durability & Network Disconnect Recovery (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConnectivityStore.setState({
      isOnline: true,
      syncStatus: 'synced',
      lastSavedAt: null,
      offlineSince: null,
      pendingSaveCount: 0,
      offlinePendingCompile: false,
    });
    useCompileStore.setState({
      compileStatus: 'idle',
      compileLog: '',
      compileErrors: [],
      pdfUrl: null,
    });
    lruDocumentCache.clear();
    draftStorageService.clearMemory();
    try {
      localStorage.clear();
    } catch {}
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. Connectivity Store & Offline Queue State Machine', () => {
    it('transitions between online and offline states and records timestamps', () => {
      const store = useConnectivityStore.getState();
      expect(store.isOnline).toBe(true);
      expect(store.syncStatus).toBe('synced');
      expect(store.offlineSince).toBeNull();

      // Go offline
      store.recordOffline();
      const offlineState = useConnectivityStore.getState();
      expect(offlineState.isOnline).toBe(false);
      expect(offlineState.syncStatus).toBe('offline');
      expect(offlineState.offlineSince).toBeInstanceOf(Date);

      // Try setting status while offline (must preserve offline status)
      offlineState.setSyncStatus('saving');
      expect(useConnectivityStore.getState().syncStatus).toBe('offline');

      // Go back online
      useConnectivityStore.getState().recordOnline();
      const onlineState = useConnectivityStore.getState();
      expect(onlineState.isOnline).toBe(true);
      expect(onlineState.syncStatus).toBe('synced');
      expect(onlineState.offlineSince).toBeNull();
    });

    it('manages offlinePendingCompile flag during network disconnection', () => {
      expect(useConnectivityStore.getState().offlinePendingCompile).toBe(false);

      useConnectivityStore.getState().setOfflinePendingCompile(true);
      expect(useConnectivityStore.getState().offlinePendingCompile).toBe(true);

      useConnectivityStore.getState().setOfflinePendingCompile(false);
      expect(useConnectivityStore.getState().offlinePendingCompile).toBe(false);
    });

    it('preserves offline status during pending count changes when offline', () => {
      useConnectivityStore.getState().recordOffline();

      useConnectivityStore.getState().incrementPending();
      expect(useConnectivityStore.getState().syncStatus).toBe('offline');
      expect(useConnectivityStore.getState().pendingSaveCount).toBe(1);

      useConnectivityStore.getState().decrementPending();
      expect(useConnectivityStore.getState().syncStatus).toBe('offline');
      expect(useConnectivityStore.getState().pendingSaveCount).toBe(0);
    });
  });

  describe('2. Session Coordinator Offline Flush Protection', () => {
    it('aborts remote HTTP calls when offline and safely persists local draft snapshot', async () => {
      const updateContentSpy = vi.spyOn(manuscriptService.docs, 'updateContent');
      const saveDraftSpy = vi.spyOn(sessionCoordinator, 'saveDraftSnapshot');

      lruDocumentCache.registerModel('doc-offline-1', {
        content: '\\section{Offline Work}',
        filePath: 'main.tex',
        projectId: 'proj-offline',
      });
      lruDocumentCache.markDirty('doc-offline-1');

      // Set offline
      useConnectivityStore.getState().recordOffline();

      const flushOk = await sessionCoordinator.flushFile('doc-offline-1');

      expect(flushOk).toBe(false);
      expect(updateContentSpy).not.toHaveBeenCalled();
      expect(saveDraftSpy).toHaveBeenCalledWith('doc-offline-1', '\\section{Offline Work}', 'proj-offline');
      expect(lruDocumentCache.isDirty('doc-offline-1')).toBe(true);
    });

    it('catches network fetch failure during flush and auto-transitions to offline state', async () => {
      vi.spyOn(manuscriptService.docs, 'updateContent').mockRejectedValue(
        new TypeError('Failed to fetch')
      );
      const saveDraftSpy = vi.spyOn(sessionCoordinator, 'saveDraftSnapshot');

      lruDocumentCache.registerModel('doc-drop', {
        content: 'Content before network dropped',
        filePath: 'main.tex',
        projectId: 'proj-drop',
      });
      lruDocumentCache.markDirty('doc-drop');

      const flushOk = await sessionCoordinator.flushFile('doc-drop');

      expect(flushOk).toBe(false);
      expect(useConnectivityStore.getState().isOnline).toBe(false);
      expect(useConnectivityStore.getState().syncStatus).toBe('offline');
      expect(saveDraftSpy).toHaveBeenCalledWith('doc-drop', 'Content before network dropped', 'proj-drop');
    });
  });

  describe('3. Compiler Coordinator Offline Graceful Queueing', () => {
    it('queues compilation and displays friendly offline notice without making network calls', async () => {
      const compileEngineSpy = vi.spyOn(LatexCompilerEngine, 'compile');
      usePageStore.setState({
        projectId: 'proj-offline-compile',
        currentPage: { id: 'doc-main', title: 'main.tex', content: '\\documentclass{article}' } as any,
      });

      // Set state to offline
      useConnectivityStore.getState().recordOffline();

      const compileResult = await compilerCoordinator.compile();

      expect(compileResult).toBe(false);
      expect(compileEngineSpy).not.toHaveBeenCalled();
      expect(useConnectivityStore.getState().offlinePendingCompile).toBe(true);
      expect(useCompileStore.getState().compileStatus).toBe('idle');
      expect(useCompileStore.getState().compileLog).toContain('[Offline Mode]');
    });

    it('catches unexpected network disconnect during compilation and queues auto-retry', async () => {
      usePageStore.setState({
        projectId: 'proj-mid-disconnect',
        currentPage: { id: 'doc-main', title: 'main.tex', content: '\\documentclass{article}' } as any,
      });

      // Emulate remote compile failing due to network drop
      vi.spyOn(LatexCompilerEngine, 'compile').mockRejectedValue(
        new Error('NetworkError when attempting to fetch resource.')
      );

      const compileResult = await compilerCoordinator.compile();

      expect(compileResult).toBe(false);
      expect(useConnectivityStore.getState().isOnline).toBe(false);
      expect(useConnectivityStore.getState().offlinePendingCompile).toBe(true);
      expect(useCompileStore.getState().compileStatus).toBe('idle');
      expect(useCompileStore.getState().compileLog).toContain('[Offline Mode]');
    });
  });

  describe('4. Reconnection & Auto-Recovery Workflow', () => {
    it('executes queued offline compilation automatically when connectivity is restored', async () => {
      const updateContentSpy = vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue({} as any);
      vi.spyOn(LatexCompilerEngine, 'compile').mockResolvedValue({
        success: true,
        pdfUrl: 'blob:mock-pdf',
        logs: '',
      } as any);
      const commandBusSpy = vi.spyOn(editorCommandBus, 'dispatch');

      // Set dirty doc and offline compile queue
      lruDocumentCache.registerModel('doc-recover', {
        content: '\\section{Saved while offline}',
        filePath: 'main.tex',
        projectId: 'proj-rec',
      });
      lruDocumentCache.markDirty('doc-recover');

      useConnectivityStore.getState().recordOffline();
      useConnectivityStore.getState().setOfflinePendingCompile(true);

      // Trigger online recovery handler
      await sessionCoordinator.handleOnline();

      expect(useConnectivityStore.getState().isOnline).toBe(true);
      expect(updateContentSpy).toHaveBeenCalled();
      expect(commandBusSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'compiler:trigger' })
      );
      expect(useConnectivityStore.getState().offlinePendingCompile).toBe(false);
    });
  });
});
