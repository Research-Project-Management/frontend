import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LRUDocumentCache,
  lruDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
  defaultDocumentSpillSink,
  clearAllOfflineMemory,
} from '@/features/editor/domain/offline-storage';
import { sessionCoordinator } from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { useConnectivityStore } from '@/features/editor/core';
import { usePageStore } from '@/features/editor/core';

describe('LRU Document Cache & Local-First Offline Draft Sync (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConnectivityStore.setState({ isOnline: true, syncStatus: 'synced', pendingSaveCount: 0 });
    try {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    } catch {}
    lruDocumentCache.clear();
    lruDocumentCache.setCapacity(25);
    lruDocumentCache.setActiveFileId(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    clearAllOfflineMemory();
    try {
      localStorage.clear();
    } catch {}
  });

  describe('1. LRUDocumentCache Core Governance (Doubly Linked List + Map)', () => {
    it('registers documents and accesses them with 0ms latency', () => {
      const cache = new LRUDocumentCache();
      cache.registerModel('doc-1', {
        content: '\\section{First Document}',
        filePath: 'chapters/intro.tex',
        projectId: 'proj-1',
      });

      const model = cache.getModel('doc-1');
      expect(model).toBeDefined();
      expect(model?.content).toBe('\\section{First Document}');
      expect(model?.filePath).toBe('chapters/intro.tex');
      expect(model?.isDirty).toBe(false);

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.mruFileId).toBe('doc-1');
      expect(stats.lruFileId).toBe('doc-1');
    });

    it('promotes touched documents to MRU (head) and maintains correct LRU order', () => {
      const cache = new LRUDocumentCache();
      cache.registerModel('doc-1', { content: 'Content 1' });
      cache.registerModel('doc-2', { content: 'Content 2' });
      cache.registerModel('doc-3', { content: 'Content 3' });

      // Initially doc-3 is MRU, doc-1 is LRU
      let stats = cache.getStats();
      expect(stats.mruFileId).toBe('doc-3');
      expect(stats.lruFileId).toBe('doc-1');

      // Accessing doc-1 should promote it to MRU
      cache.getModel('doc-1');
      stats = cache.getStats();
      expect(stats.mruFileId).toBe('doc-1');
      expect(stats.lruFileId).toBe('doc-2');

      // Updating content of doc-2 should promote doc-2 to MRU
      cache.updateContent('doc-2', 'Updated Content 2', true);
      stats = cache.getStats();
      expect(stats.mruFileId).toBe('doc-2');
      expect(stats.lruFileId).toBe('doc-3');
    });

    it('enforces capacity bound and evicts the least recently used document', () => {
      const cache = new LRUDocumentCache();
      cache.setCapacity(3);

      cache.registerModel('doc-1', { content: 'Doc 1' });
      cache.registerModel('doc-2', { content: 'Doc 2' });
      cache.registerModel('doc-3', { content: 'Doc 3' });

      expect(cache.getStats().size).toBe(3);

      // Adding 4th document should evict doc-1 (which was LRU)
      cache.registerModel('doc-4', { content: 'Doc 4' });

      expect(cache.getStats().size).toBe(3);
      expect(cache.has('doc-1')).toBe(false);
      expect(cache.has('doc-2')).toBe(true);
      expect(cache.has('doc-3')).toBe(true);
      expect(cache.has('doc-4')).toBe(true);
      expect(cache.getStats().lruFileId).toBe('doc-2');
    });

    it('protects active document from eviction even if it is the oldest', () => {
      const cache = new LRUDocumentCache();
      cache.setCapacity(2);

      cache.registerModel('doc-active', { content: 'Active Document' });
      cache.setActiveFileId('doc-active');

      cache.registerModel('doc-2', { content: 'Doc 2' });

      // doc-active is now older than doc-2, but it is activeFileId!
      // When doc-3 arrives, doc-2 should be evicted instead of doc-active
      cache.registerModel('doc-3', { content: 'Doc 3' });

      expect(cache.has('doc-active')).toBe(true);
      expect(cache.has('doc-3')).toBe(true);
      expect(cache.has('doc-2')).toBe(false);
    });

    it('automatically persists dirty documents to UnsyncedEditsStore upon eviction', async () => {
      const saveUnsyncedSpy = vi.spyOn(unsyncedEditsStore, 'save').mockResolvedValue(undefined);

      const cache = new LRUDocumentCache();
      cache.setCapacity(2);

      cache.registerModel('doc-dirty', {
        content: '\\section{Unsaved Draft Changes}',
        filePath: 'main.tex',
        projectId: 'proj-123',
      });
      cache.markDirty('doc-dirty');

      cache.registerModel('doc-clean', { content: 'Clean Doc' });

      // Pushing doc-3 should evict doc-dirty and trigger unsyncedEditsStore.save
      cache.registerModel('doc-3', { content: 'Doc 3' });

      expect(cache.has('doc-dirty')).toBe(false);
      expect(saveUnsyncedSpy).toHaveBeenCalledWith(
        'doc-dirty',
        '\\section{Unsaved Draft Changes}',
        'proj-123',
        'main.tex'
      );
      saveUnsyncedSpy.mockRestore();
    });

    it('notifies eviction listeners when documents are removed', () => {
      const cache = new LRUDocumentCache();
      cache.setCapacity(1);

      const evictedRecords: Array<{ fileId: string; model: DocumentModelState }> = [];
      cache.onEviction((fileId, model) => {
        evictedRecords.push({ fileId, model });
      });

      cache.registerModel('doc-1', { content: 'Content 1' });
      cache.registerModel('doc-2', { content: 'Content 2' });

      expect(evictedRecords.length).toBe(1);
      expect(evictedRecords[0].fileId).toBe('doc-1');
      expect(evictedRecords[0].model.content).toBe('Content 1');
    });
  });

  describe('2. UnsyncedEditsStore Resilience & Recovery', () => {
    it('saves and retrieves document unsynced edits across storage tiers', async () => {
      await unsyncedEditsStore.save(
        'file-draft-1',
        '\\begin{equation} E = mc^2 \\end{equation}',
        'project-abc',
        'math.tex'
      );

      const edit = await unsyncedEditsStore.get('file-draft-1');
      expect(edit).not.toBeNull();
      expect(edit?.fileId).toBe('file-draft-1');
      expect(edit?.content).toBe('\\begin{equation} E = mc^2 \\end{equation}');
      expect(edit?.projectId).toBe('project-abc');
      expect(edit?.title).toBe('math.tex');
      expect(edit?.savedAt).toBeGreaterThan(0);
    });

    it('clears unsynced edit after successful server synchronization', async () => {
      await unsyncedEditsStore.save('file-to-clear', 'Some Unsynced Content');
      expect(await unsyncedEditsStore.get('file-to-clear')).not.toBeNull();

      await unsyncedEditsStore.clear('file-to-clear');
      expect(await unsyncedEditsStore.get('file-to-clear')).toBeNull();
    });

    it('retrieves all recent unsynced edits for a specific project', async () => {
      await unsyncedEditsStore.save('doc-p1-a', 'P1 Content A', 'proj-target');
      await unsyncedEditsStore.save('doc-p1-b', 'P1 Content B', 'proj-target');
      await unsyncedEditsStore.save('doc-p2-c', 'P2 Content C', 'proj-other');

      const projectEdits = await unsyncedEditsStore.getAllByScope('proj-target');
      expect(projectEdits.length).toBe(2);
      expect(projectEdits.map((d) => d.fileId).sort()).toEqual(['doc-p1-a', 'doc-p1-b']);
    });
  });

  describe('3. SessionCoordinator Offline Resilience & Reconnection Sync', () => {
    it('notifies content changes, updates RAM cache, marks compile dirty, and saves unsynced edit', () => {
      const saveUnsyncedSpy = vi.spyOn(sessionCoordinator, 'saveUnsyncedEdit');
      usePageStore.setState({ projectId: 'proj-sync' });

      lruDocumentCache.registerModel('doc-editing', { content: 'Initial' });

      sessionCoordinator.notifyContentChange('doc-editing', 'New Edited Content', {
        skipAutoCompile: true,
      });

      // 1. RAM cache must have new content
      expect(lruDocumentCache.getContent('doc-editing')).toBe('New Edited Content');
      expect(lruDocumentCache.isDirty('doc-editing')).toBe(true);

      // 2. Compile store must be dirty
      expect(useCompileStore.getState().dirtyContentMap.get('doc-editing')).toBe('New Edited Content');

      // 3. Unsynced edit save must have been requested
      expect(saveUnsyncedSpy).toHaveBeenCalledWith('doc-editing', 'New Edited Content', 'proj-sync');
    });

    it('detects recoverable local edits when local unsaved content differs from server', async () => {
      lruDocumentCache.registerModel('file-conflict', {
        content: 'Local unsaved edit text',
        filePath: 'intro.tex',
        projectId: 'p1',
      });
      lruDocumentCache.markDirty('file-conflict');

      const recovery = sessionCoordinator.checkUnsyncedEditRecovery(
        'file-conflict',
        'Stale server text'
      );

      expect(recovery.hasRecoverableEdit).toBe(true);
      expect(recovery.edit?.content).toBe('Local unsaved edit text');

      // If server matches local dirty content, no conflict recovery needed
      const noRecovery = sessionCoordinator.checkUnsyncedEditRecovery(
        'file-conflict',
        'Local unsaved edit text'
      );
      expect(noRecovery.hasRecoverableEdit).toBe(false);
    });

    it('persists outgoing unsynced edit and switches active file when switching tabs', () => {
      const saveUnsyncedSpy = vi.spyOn(sessionCoordinator, 'saveUnsyncedEdit');

      lruDocumentCache.registerModel('tab-1', { content: 'Tab 1 dirty content' });
      lruDocumentCache.markDirty('tab-1');

      lruDocumentCache.registerModel('tab-2', { content: 'Tab 2 content' });

      sessionCoordinator.switchTab('tab-1', 'tab-2');

      expect(saveUnsyncedSpy).toHaveBeenCalledWith('tab-1', 'Tab 1 dirty content', undefined);
      expect(lruDocumentCache.getStats().mruFileId).toBe('tab-2');
    });

    it('flushes all pending dirty documents and clears unsynced edits upon network reconnection', async () => {
      const updateContentSpy = vi.spyOn(pagesService.docs, 'updateContent').mockResolvedValue({} as any);
      const clearUnsyncedSpy = vi.spyOn(sessionCoordinator, 'clearUnsyncedEdit');

      lruDocumentCache.registerModel('pending-1', { content: 'Pending Content 1' });
      lruDocumentCache.markDirty('pending-1');

      lruDocumentCache.registerModel('pending-2', { content: 'Pending Content 2' });
      lruDocumentCache.markDirty('pending-2');

      const flushResult = await sessionCoordinator.flushAllPending();

      expect(flushResult.total).toBe(2);
      expect(flushResult.succeeded).toBe(2);
      expect(flushResult.failed).toBe(0);

      expect(updateContentSpy).toHaveBeenCalledTimes(2);
      expect(clearUnsyncedSpy).toHaveBeenCalledWith('pending-1');
      expect(clearUnsyncedSpy).toHaveBeenCalledWith('pending-2');

      // All models should now be marked clean
      expect(lruDocumentCache.getDirtyModels().length).toBe(0);
    });

    it('hydrateModelAsync marks model dirty when restoring from unsynced edit and skips persistence when evictModel uses skipPersistence', async () => {
      const now = Date.now();
      await syncedDocCacheStore.put({
        id: 'doc-hyd-draft',
        projectId: 'proj-hyd',
        title: 'drafted.tex',
        content: 'Older server content',
        filePath: 'drafted.tex',
        updatedAt: now - 5000,
      });
      await unsyncedEditsStore.save(
        'doc-hyd-draft',
        'Newer local unsynced edits',
        'proj-hyd',
        'drafted.tex',
      );

      const cache = new LRUDocumentCache(defaultDocumentSpillSink);
      const hydrated = await cache.hydrateModelAsync(
        'doc-hyd-draft',
        'fallback',
        'drafted.tex',
        'proj-hyd',
      );
      expect(hydrated.content).toBe('Newer local unsynced edits');
      expect(hydrated.isDirty).toBe(true);
      expect(cache.isDirty('doc-hyd-draft')).toBe(true);

      const saveUnsyncedSpy = vi.spyOn(defaultDocumentSpillSink, 'saveUnsyncedEdit');
      const putSyncedSpy = vi.spyOn(defaultDocumentSpillSink, 'putSyncedDoc');

      cache.evictModel('doc-hyd-draft', { skipPersistence: true });
      expect(cache.has('doc-hyd-draft')).toBe(false);
      expect(saveUnsyncedSpy).not.toHaveBeenCalled();
      expect(putSyncedSpy).not.toHaveBeenCalled();

      // evictDeletedFile should also purge the cached synced doc
      sessionCoordinator.evictDeletedFile('doc-hyd-draft');
      expect(await syncedDocCacheStore.get('doc-hyd-draft')).toBeNull();
    });
  });
});
