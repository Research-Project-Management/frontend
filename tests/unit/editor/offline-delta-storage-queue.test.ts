import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  draftStorageService,
  lruDocumentCache,
  documentStore,
  type ProjectFileSnapshot,
  type OfflineMutation,
} from '@/features/editor/domain/document';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { manuscriptService } from '@/features/editor/sdk';
import { useConnectivityStore, useCompileStore } from '@/features/editor/store';

describe('Direction 3: Offline-First Persistence (Project Snapshot Cache & Mutation Queue)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    draftStorageService.clearMemory();
    lruDocumentCache.clear();
    lruDocumentCache.setPersistenceSink(draftStorageService);
    useConnectivityStore.setState({
      isOnline: true,
      syncStatus: 'synced',
      lastSavedAt: null,
      offlineSince: null,
      pendingSaveCount: 0,
      offlinePendingCompile: false,
    });
    try {
      localStorage.clear();
    } catch {}
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    draftStorageService.clearMemory();
  });

  describe('1. Project Files Offline Snapshot Cache', () => {
    it('persists and retrieves single project file snapshots', async () => {
      const fileSnapshot: ProjectFileSnapshot = {
        id: 'file-chap1',
        projectId: 'proj-thesis',
        title: 'Chapter 1',
        content: '\\chapter{Introduction}\nThis is offline cached.',
        filePath: 'chapters/chap1.tex',
        updatedAt: Date.now(),
      };

      await draftStorageService.saveProjectFileSnapshot(fileSnapshot);

      const retrieved = await draftStorageService.getProjectFileSnapshot('file-chap1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('file-chap1');
      expect(retrieved?.projectId).toBe('proj-thesis');
      expect(retrieved?.content).toContain('\\chapter{Introduction}');
      expect(retrieved?.filePath).toBe('chapters/chap1.tex');
    });

    it('batch saves and queries all file snapshots belonging to a project', async () => {
      const files: ProjectFileSnapshot[] = [
        {
          id: 'file-main',
          projectId: 'proj-ml',
          title: 'main.tex',
          content: '\\documentclass{article}',
          updatedAt: 100,
        },
        {
          id: 'file-ref',
          projectId: 'proj-ml',
          title: 'ref.bib',
          content: '@article{einstein, ...}',
          updatedAt: 105,
        },
        {
          id: 'file-other',
          projectId: 'proj-other-proj',
          title: 'notes.tex',
          content: 'Other project notes',
          updatedAt: 110,
        },
      ];

      await draftStorageService.saveProjectFilesSnapshot(files);

      const mlFiles = await draftStorageService.getProjectFilesSnapshot('proj-ml');
      expect(mlFiles.length).toBe(2);
      expect(mlFiles.map((f) => f.id).sort()).toEqual(['file-main', 'file-ref']);

      const otherFiles = await draftStorageService.getProjectFilesSnapshot('proj-other-proj');
      expect(otherFiles.length).toBe(1);
      expect(otherFiles[0].id).toBe('file-other');
    });

    it('hydrates model from project file snapshot when no draft exists and RAM is cold', async () => {
      // Warm snapshot in persistence
      await draftStorageService.saveProjectFileSnapshot({
        id: 'file-offline-hydrate',
        projectId: 'p-hyd',
        title: 'offline-preview.tex',
        content: '\\section{Offline Restored Content}',
        filePath: 'offline-preview.tex',
        updatedAt: Date.now(),
      });

      // Hydrate via lruDocumentCache with empty fallback
      const model = await lruDocumentCache.hydrateModelAsync(
        'file-offline-hydrate',
        'Fallback text if not found',
        'offline-preview.tex',
        'p-hyd'
      );

      expect(model.content).toBe('\\section{Offline Restored Content}');
      expect(model.fileId).toBe('file-offline-hydrate');
      expect(model.filePath).toBe('offline-preview.tex');
    });
  });

  describe('2. Offline Mutation Queue & Write Coalescing', () => {
    it('enqueues mutations and preserves FIFO ordering', async () => {
      await draftStorageService.enqueueMutation({
        fileId: 'file-1',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Rev 1' },
      });

      await draftStorageService.enqueueMutation({
        fileId: 'file-2',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'File 2 Content' },
      });

      const queue = await draftStorageService.getPendingMutations();
      expect(queue.length).toBe(2);
      expect(queue[0].fileId).toBe('file-1');
      expect(queue[0].payload.content).toBe('Rev 1');
      expect(queue[1].fileId).toBe('file-2');
      expect(queue[1].payload.content).toBe('File 2 Content');
    });

    it('coalesces multiple consecutive update_content mutations on the same file into a single entry', async () => {
      // User types revision 1 offline
      await draftStorageService.enqueueMutation({
        fileId: 'file-fast-typing',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Typed word 1' },
      });

      // User continues typing revision 2 offline
      await draftStorageService.enqueueMutation({
        fileId: 'file-fast-typing',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Typed word 1 and word 2' },
      });

      // User finishes sentence revision 3 offline
      await draftStorageService.enqueueMutation({
        fileId: 'file-fast-typing',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Typed word 1 and word 2 finished.' },
      });

      const queue = await draftStorageService.getPendingMutations();
      // Should have coalesced into exactly 1 mutation with latest payload!
      expect(queue.length).toBe(1);
      expect(queue[0].fileId).toBe('file-fast-typing');
      expect(queue[0].payload.content).toBe('Typed word 1 and word 2 finished.');
      expect(queue[0].status).toBe('pending');
    });

    it('updates mutation status and allows removing processed mutations', async () => {
      const mut = await draftStorageService.enqueueMutation({
        fileId: 'file-status-check',
        type: 'update_content',
        payload: { content: 'Checking status flow' },
      });

      expect(mut.id).toBeDefined();

      await draftStorageService.updateMutationStatus(mut.id!, 'processing');
      let queue = await draftStorageService.getPendingMutations();
      // 'processing' is not returned in pending queue
      expect(queue.length).toBe(0);

      await draftStorageService.updateMutationStatus(mut.id!, 'failed', 'Timeout error');
      queue = await draftStorageService.getPendingMutations();
      expect(queue.length).toBe(1);
      expect(queue[0].status).toBe('failed');
      expect(queue[0].retryCount).toBe(1);
      expect(queue[0].error).toBe('Timeout error');

      await draftStorageService.removeMutation(mut.id!);
      queue = await draftStorageService.getPendingMutations();
      expect(queue.length).toBe(0);
    });
  });

  describe('3. Session Coordinator Offline Integration & Replay Engine', () => {
    it('enqueues mutations and writes snapshots automatically when flushFile is attempted while offline', async () => {
      useConnectivityStore.getState().recordOffline();

      lruDocumentCache.registerModel('doc-off-save', {
        content: '\\section{Offline Edits Here}',
        filePath: 'main.tex',
        projectId: 'p-offline',
      });
      lruDocumentCache.markDirty('doc-off-save');

      const success = await sessionCoordinator.flushFile('doc-off-save');
      expect(success).toBe(false);

      // Verify mutation queue has received the item
      const pending = await draftStorageService.getPendingMutations();
      expect(pending.length).toBe(1);
      expect(pending[0].fileId).toBe('doc-off-save');
      expect(pending[0].payload.content).toBe('\\section{Offline Edits Here}');

      // Verify snapshot cache has been updated
      const snapshot = await draftStorageService.getProjectFileSnapshot('doc-off-save');
      expect(snapshot).not.toBeNull();
      expect(snapshot?.content).toBe('\\section{Offline Edits Here}');
    });

    it('replays all queued mutations sequentially and syncs to backend on reconnection', async () => {
      const updateContentSpy = vi
        .spyOn(manuscriptService.docs, 'updateContent')
        .mockResolvedValue({} as any);

      // Enqueue 2 offline mutations
      await draftStorageService.enqueueMutation({
        fileId: 'file-replay-1',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Offline Content 1' },
      });
      await draftStorageService.enqueueMutation({
        fileId: 'file-replay-2',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Offline Content 2' },
      });

      // Save corresponding local drafts
      await draftStorageService.saveDraft('file-replay-1', 'Offline Content 1');
      await draftStorageService.saveDraft('file-replay-2', 'Offline Content 2');

      expect((await draftStorageService.getPendingMutations()).length).toBe(2);

      // Trigger online recovery
      const replayResult = await sessionCoordinator.replayPendingMutations();

      expect(replayResult.total).toBe(2);
      expect(replayResult.succeeded).toBe(2);
      expect(replayResult.failed).toBe(0);

      // Verify remote updates were sent
      expect(updateContentSpy).toHaveBeenCalledWith('file-replay-1', 'Offline Content 1');
      expect(updateContentSpy).toHaveBeenCalledWith('file-replay-2', 'Offline Content 2');

      // Mutation queue must now be drained
      const remainingQueue = await draftStorageService.getPendingMutations();
      expect(remainingQueue.length).toBe(0);

      // Drafts should be cleaned
      expect(await draftStorageService.getDraft('file-replay-1')).toBeNull();
      expect(await draftStorageService.getDraft('file-replay-2')).toBeNull();

      // Connectivity state should reflect synced
      expect(useConnectivityStore.getState().syncStatus).toBe('synced');
      expect(useConnectivityStore.getState().lastSavedAt).not.toBeNull();
    });

    it('isolates failures: successfully synced files drain while failed mutations remain queued with retryCount', async () => {
      vi.spyOn(manuscriptService.docs, 'updateContent').mockImplementation(async (fileId) => {
        if (fileId === 'file-fail') {
          throw new Error('500 Internal Server Error');
        }
        return {} as any;
      });

      await draftStorageService.enqueueMutation({
        fileId: 'file-success',
        type: 'update_content',
        payload: { content: 'Good content' },
      });
      await draftStorageService.enqueueMutation({
        fileId: 'file-fail',
        type: 'update_content',
        payload: { content: 'Content with server crash' },
      });

      const replayResult = await sessionCoordinator.replayPendingMutations();

      expect(replayResult.total).toBe(2);
      expect(replayResult.succeeded).toBe(1);
      expect(replayResult.failed).toBe(1);

      const remaining = await draftStorageService.getPendingMutations();
      expect(remaining.length).toBe(1);
      expect(remaining[0].fileId).toBe('file-fail');
      expect(remaining[0].status).toBe('failed');
      expect(remaining[0].retryCount).toBe(1);
      expect(remaining[0].error).toContain('500 Internal Server Error');
    });
  });
});
