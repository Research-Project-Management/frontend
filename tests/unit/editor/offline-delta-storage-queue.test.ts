import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
  pendingOutboxStore,
  defaultDocumentSpillSink,
  clearAllOfflineMemory,
  type SyncedDocCacheEntry,
} from '@/features/editor/domain/offline-storage';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { useConnectivityStore } from '@/features/editor/core';
import { useCompileStore } from '@/features/editor/core';

describe('Direction 3: Offline-First Persistence (Synced Doc Cache & Pending Outbox)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllOfflineMemory();
    lruDocumentCache.clear();
    lruDocumentCache.setPersistenceSink(defaultDocumentSpillSink);
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
    clearAllOfflineMemory();
  });

  describe('1. Synced Doc Cache (Server-Authoritative Offline Cache)', () => {
    it('persists and retrieves single synced doc cache entries', async () => {
      const entry: SyncedDocCacheEntry = {
        id: 'file-chap1',
        projectId: 'proj-thesis',
        title: 'Chapter 1',
        content: '\\chapter{Introduction}\nThis is offline cached.',
        filePath: 'chapters/chap1.tex',
        updatedAt: Date.now(),
      };

      await syncedDocCacheStore.put(entry);

      const retrieved = await syncedDocCacheStore.get('file-chap1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('file-chap1');
      expect(retrieved?.projectId).toBe('proj-thesis');
      expect(retrieved?.content).toContain('\\chapter{Introduction}');
      expect(retrieved?.filePath).toBe('chapters/chap1.tex');
    });

    it('batch saves and queries all cached entries belonging to a project', async () => {
      const files: SyncedDocCacheEntry[] = [
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

      await syncedDocCacheStore.putMany(files);

      const mlFiles = await syncedDocCacheStore.getByScope('proj-ml');
      expect(mlFiles.length).toBe(2);
      expect(mlFiles.map((f) => f.id).sort()).toEqual(['file-main', 'file-ref']);

      const otherFiles = await syncedDocCacheStore.getByScope('proj-other-proj');
      expect(otherFiles.length).toBe(1);
      expect(otherFiles[0].id).toBe('file-other');
    });

    it('hydrates model from synced doc cache when no unsynced edit exists and RAM is cold', async () => {
      // Warm clean server cache in persistence
      await syncedDocCacheStore.put({
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

  describe('2. Pending Outbox Queue & Write Coalescing', () => {
    it('enqueues mutations and preserves FIFO ordering', async () => {
      await pendingOutboxStore.enqueue({
        fileId: 'file-1',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Rev 1' },
      });

      await pendingOutboxStore.enqueue({
        fileId: 'file-2',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'File 2 Content' },
      });

      const queue = await pendingOutboxStore.getPending();
      expect(queue.length).toBe(2);
      expect(queue[0].fileId).toBe('file-1');
      expect(queue[0].payload.content).toBe('Rev 1');
      expect(queue[1].fileId).toBe('file-2');
      expect(queue[1].payload.content).toBe('File 2 Content');
    });

    it('coalesces multiple consecutive update_content mutations on the same file into a single entry', async () => {
      // User types revision 1 offline
      await pendingOutboxStore.enqueue({
        fileId: 'file-fast-typing',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Typed word 1' },
      });

      // User continues typing revision 2 offline
      await pendingOutboxStore.enqueue({
        fileId: 'file-fast-typing',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Typed word 1 and word 2' },
      });

      // User finishes sentence revision 3 offline
      await pendingOutboxStore.enqueue({
        fileId: 'file-fast-typing',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Typed word 1 and word 2 finished.' },
      });

      const queue = await pendingOutboxStore.getPending();
      // Should have coalesced into exactly 1 mutation with latest payload!
      expect(queue.length).toBe(1);
      expect(queue[0].fileId).toBe('file-fast-typing');
      expect(queue[0].payload.content).toBe('Typed word 1 and word 2 finished.');
      expect(queue[0].status).toBe('pending');
    });

    it('updates mutation status and allows removing processed mutations', async () => {
      const mut = await pendingOutboxStore.enqueue({
        fileId: 'file-status-check',
        type: 'update_content',
        payload: { content: 'Checking status flow' },
      });

      expect(mut.id).toBeDefined();

      await pendingOutboxStore.updateStatus(mut.id!, 'processing');
      let queue = await pendingOutboxStore.getPending();
      // 'processing' is not returned in pending queue
      expect(queue.length).toBe(0);

      await pendingOutboxStore.updateStatus(mut.id!, 'failed', 'Timeout error');
      queue = await pendingOutboxStore.getPending();
      expect(queue.length).toBe(1);
      expect(queue[0].status).toBe('failed');
      expect(queue[0].retryCount).toBe(1);
      expect(queue[0].error).toBe('Timeout error');

      await pendingOutboxStore.remove(mut.id!);
      queue = await pendingOutboxStore.getPending();
      expect(queue.length).toBe(0);
    });
  });

  describe('3. Session Coordinator Offline Integration & Replay Engine', () => {
    it('enqueues outbox mutations and saves unsynced edits without polluting syncedDocCacheStore when offline', async () => {
      useConnectivityStore.getState().recordOffline();

      lruDocumentCache.registerModel('doc-off-save', {
        content: '\\section{Offline Edits Here}',
        filePath: 'main.tex',
        projectId: 'p-offline',
      });
      lruDocumentCache.markDirty('doc-off-save');

      const success = await sessionCoordinator.flushFile('doc-off-save');
      expect(success).toBe(false);

      // Verify outbox queue has received the mutation
      const pending = await pendingOutboxStore.getPending();
      expect(pending.length).toBe(1);
      expect(pending[0].fileId).toBe('doc-off-save');
      expect(pending[0].payload.content).toBe('\\section{Offline Edits Here}');

      // Verify unsynced edit store holds the uncommitted edit
      const unsynced = await unsyncedEditsStore.get('doc-off-save');
      expect(unsynced).not.toBeNull();
      expect(unsynced?.content).toBe('\\section{Offline Edits Here}');

      // Verify clean server cache was NOT polluted with dirty offline edits
      expect(await syncedDocCacheStore.get('doc-off-save')).toBeNull();
    });

    it('replays all queued mutations sequentially and syncs to backend on reconnection', async () => {
      const updateContentSpy = vi
        .spyOn(pagesService.docs, 'updateContent')
        .mockResolvedValue({} as any);

      // Enqueue 2 offline mutations
      await pendingOutboxStore.enqueue({
        fileId: 'file-replay-1',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Offline Content 1' },
      });
      await pendingOutboxStore.enqueue({
        fileId: 'file-replay-2',
        projectId: 'p1',
        type: 'update_content',
        payload: { content: 'Offline Content 2' },
      });

      // Save corresponding local unsynced edits
      await unsyncedEditsStore.save('file-replay-1', 'Offline Content 1');
      await unsyncedEditsStore.save('file-replay-2', 'Offline Content 2');

      expect((await pendingOutboxStore.getPending()).length).toBe(2);

      // Trigger online recovery
      const replayResult = await sessionCoordinator.replayPendingMutations();

      expect(replayResult.total).toBe(2);
      expect(replayResult.succeeded).toBe(2);
      expect(replayResult.failed).toBe(0);

      // Verify remote updates were sent
      expect(updateContentSpy).toHaveBeenCalledWith('file-replay-1', 'Offline Content 1');
      expect(updateContentSpy).toHaveBeenCalledWith('file-replay-2', 'Offline Content 2');

      // Mutation queue must now be drained
      const remainingQueue = await pendingOutboxStore.getPending();
      expect(remainingQueue.length).toBe(0);

      // Unsynced edits should be cleaned
      expect(await unsyncedEditsStore.get('file-replay-1')).toBeNull();
      expect(await unsyncedEditsStore.get('file-replay-2')).toBeNull();

      // Connectivity state should reflect synced
      expect(useConnectivityStore.getState().syncStatus).toBe('synced');
      expect(useConnectivityStore.getState().lastSavedAt).not.toBeNull();
    });

    it('isolates failures: successfully synced files drain while failed mutations remain queued with retryCount', async () => {
      vi.spyOn(pagesService.docs, 'updateContent').mockImplementation(async (fileId) => {
        if (fileId === 'file-fail') {
          throw new Error('500 Internal Server Error');
        }
        return {} as any;
      });

      await pendingOutboxStore.enqueue({
        fileId: 'file-success',
        type: 'update_content',
        payload: { content: 'Good content' },
      });
      await pendingOutboxStore.enqueue({
        fileId: 'file-fail',
        type: 'update_content',
        payload: { content: 'Content with server crash' },
      });

      const replayResult = await sessionCoordinator.replayPendingMutations();

      expect(replayResult.total).toBe(2);
      expect(replayResult.succeeded).toBe(1);
      expect(replayResult.failed).toBe(1);

      const remaining = await pendingOutboxStore.getPending();
      expect(remaining.length).toBe(1);
      expect(remaining[0].fileId).toBe('file-fail');
      expect(remaining[0].status).toBe('failed');
      expect(remaining[0].retryCount).toBe(1);
      expect(remaining[0].error).toContain('500 Internal Server Error');
    });
  });
});
