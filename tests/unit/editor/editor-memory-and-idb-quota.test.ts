import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  LRUDocumentCache,
  lruDocumentCache,
} from '@/features/editor/domain/document/lru-document-cache';
import {
  calculateAdaptiveEditorQuota,
  clearAllOfflineMemory,
  createEditorOfflineStorage,
  syncedDocCacheStore,
} from '@/features/editor/domain/offline-storage';
import {
  EDITOR_LIMITS,
  EDITOR_STORAGE_KEYS,
} from '@/features/editor/domain/constants/editor.constants';
import {
  useCompileStore,
} from '@/features/editor/subsystems/compiler';
import {
  calculateAdaptiveReaderQuota,
} from '@/features/library/core/adapters/reader-storage.adapter';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { pageQuery } from '@/features/editor/core/queries/document.queries';

describe('Editor RAM Dual-Bound Budget & Adaptive Offline Quota Hardening', () => {
  beforeEach(() => {
    lruDocumentCache.clearAll();
    lruDocumentCache.resetLimits();
    useCompileStore.getState().clearAllDirty();
    clearAllOfflineMemory();
    try {
      localStorage.clear();
    } catch {}
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lruDocumentCache.clearAll();
    lruDocumentCache.resetLimits();
    clearAllOfflineMemory();
    try {
      localStorage.clear();
    } catch {}
  });

  describe('1. Dual-Bound LRUDocumentCache (40 Files & 16 MB Byte Ceiling)', () => {
    it('enforces dual defaults of 40 files and 16 MB UTF-8 text budget', () => {
      const fresh = new LRUDocumentCache(null);
      const stats = fresh.getStats();
      expect(stats.capacity).toBe(40);
      expect(stats.maxBytes).toBe(16 * 1024 * 1024);
      expect(stats.totalBytes).toBe(0);
    });

    it('evicts oldest inactive models on byte budget breach, protects activeFileId, and spills clean/dirty models appropriately', () => {
      const saveUnsyncedSpy = vi.fn().mockResolvedValue(undefined);
      const putSyncedSpy = vi.fn().mockResolvedValue(undefined);
      const cache = new LRUDocumentCache({
        saveUnsyncedEdit: saveUnsyncedSpy,
        getUnsyncedEdit: vi.fn().mockResolvedValue(null),
        clearUnsyncedEdit: vi.fn().mockResolvedValue(undefined),
        putSyncedDoc: putSyncedSpy,
      });

      cache.setCapacity(40);
      cache.setMaxBytes(100);

      // Register active file (40B) + clean older file (40B) + dirty file (40B => total 120B > 100B)
      cache.registerModel('active-doc', {
        content: 'A'.repeat(40),
        filePath: 'main.tex',
        projectId: 'proj-1',
      });
      cache.setActiveFileId('active-doc');

      cache.registerModel('clean-old', {
        content: 'B'.repeat(40),
        filePath: 'chapters/ch1.tex',
        projectId: 'proj-1',
      });

      // Adding a 3rd 40B file breaches 100B ceiling and must evict 'clean-old' (active-doc stays immune)
      cache.registerModel('dirty-mid', {
        content: 'C'.repeat(40),
        filePath: 'chapters/ch2.tex',
        projectId: 'proj-1',
      });
      cache.markDirty('dirty-mid');

      expect(cache.has('active-doc')).toBe(true);
      expect(cache.has('clean-old')).toBe(false);
      expect(cache.has('dirty-mid')).toBe(true);
      expect(cache.getStats().totalBytes).toBe(80);
      expect(putSyncedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'clean-old',
          content: 'B'.repeat(40),
          filePath: 'chapters/ch1.tex',
        }),
      );

      // Growing active-doc should evict dirty-mid and spill it to saveUnsyncedEdit
      cache.updateContent('active-doc', 'A'.repeat(70), true);
      expect(cache.has('active-doc')).toBe(true);
      expect(cache.has('dirty-mid')).toBe(false);
      expect(cache.getStats().totalBytes).toBe(70);
      expect(saveUnsyncedSpy).toHaveBeenCalledWith(
        'dirty-mid',
        'C'.repeat(40),
        'proj-1',
        'chapters/ch2.tex',
      );

      cache.clearAll();
      expect(cache.getStats().totalBytes).toBe(0);
    });
  });

  describe('2. Adaptive Origin Quota Coordination with Library Reader', () => {
    it('clamps 8% of available origin quota to [24 MB, 100 MB] and coexists under Firefox 2 GB limit', () => {
      // Constrained mobile storage (100 MB quota) -> hits 24 MB floor
      const mobilePolicy = calculateAdaptiveEditorQuota(100 * 1024 * 1024, 0);
      expect(mobilePolicy.maxTotalDiskBytes).toBe(24 * 1024 * 1024);
      expect(mobilePolicy.maxUnsyncedEditsBytes).toBe(6 * 1024 * 1024);
      expect(mobilePolicy.maxSyncedDocCacheBytes).toBe(Math.floor(24 * 1024 * 1024 * 0.6));
      expect(mobilePolicy.maxPendingOutboxBytes).toBe(Math.floor(24 * 1024 * 1024 * 0.15));

      // Desktop storage (10 GB quota, 0 used) -> hits 100 MB ceiling
      const desktopEditor = calculateAdaptiveEditorQuota(10 * 1024 * 1024 * 1024, 0);
      const desktopReader = calculateAdaptiveReaderQuota(10 * 1024 * 1024 * 1024, 0);
      expect(desktopEditor.maxTotalDiskBytes).toBe(100 * 1024 * 1024);
      expect(desktopReader.maxDiskBytes).toBe(300 * 1024 * 1024);

      const firefoxGroupLimitBytes = 2 * 1024 * 1024 * 1024; // 2 GB
      expect(desktopEditor.maxTotalDiskBytes + desktopReader.maxDiskBytes).toBeLessThanOrEqual(
        400 * 1024 * 1024,
      );
      expect(desktopEditor.maxTotalDiskBytes + desktopReader.maxDiskBytes).toBeLessThan(
        firefoxGroupLimitBytes * 0.25,
      );
    });
  });

  describe('3. Zero-Copy Compile Store Dirty Map & Keystroke Churn Elimination', () => {
    it('serves live edits via DirtyContentReadThroughMap without mutating dirtyFileIds Set reference on repeat edits', () => {
      lruDocumentCache.registerModel('doc-zero-copy', {
        content: 'Initial text',
        filePath: 'main.tex',
        projectId: 'proj-zc',
      });

      // First dirty edit updates dirtyFileIds
      lruDocumentCache.updateContent('doc-zero-copy', 'Edit #1', true);
      const firstDirtyIdsRef = useCompileStore.getState().dirtyFileIds;
      const firstMapRef = useCompileStore.getState().dirtyContentMap;
      expect(firstDirtyIdsRef.has('doc-zero-copy')).toBe(true);
      expect(firstMapRef.get('doc-zero-copy')).toBe('Edit #1');

      // Subsequent edits on the same already-dirty file must NOT allocate/swap dirtyFileIds Set
      lruDocumentCache.updateContent('doc-zero-copy', 'Edit #2 longer text', true);
      expect(useCompileStore.getState().dirtyFileIds).toBe(firstDirtyIdsRef);
      expect(useCompileStore.getState().dirtyContentMap).toBe(firstMapRef);
      expect(useCompileStore.getState().dirtyContentMap.get('doc-zero-copy')).toBe(
        'Edit #2 longer text',
      );
      expect(useCompileStore.getState().dirtyContentMap.size).toBe(1);
    });
  });

  describe('4. UnsyncedEditsStore Zero Periodic LocalStorage, Emergency Unload, & OfflineQuotaGovernor', () => {
    it('does not write periodic save payloads to localStorage and enforces 512 KB ceiling on saveEmergencyUnload', async () => {
      const { unsyncedEdits } = createEditorOfflineStorage();
      await unsyncedEdits.save('doc-no-ls', 'Unsynced edit content only in storage', 'proj-ls', 'main.tex');

      expect(localStorage.getItem(`${EDITOR_STORAGE_KEYS.EMERGENCY_UNSYNCED_EDIT_PREFIX}doc-no-ls`)).toBeNull();
      const fetched = await unsyncedEdits.get('doc-no-ls');
      expect(fetched?.content).toBe('Unsynced edit content only in storage');

      // Emergency unload save succeeds <= 512 KB
      const smallOk = unsyncedEdits.saveEmergencyUnload('doc-small', 'X'.repeat(1024), 'proj-ls');
      expect(smallOk).toBe(true);
      expect(localStorage.getItem(`${EDITOR_STORAGE_KEYS.EMERGENCY_UNSYNCED_EDIT_PREFIX}doc-small`)).not.toBeNull();

      // Emergency unload save refuses > 512 KB to protect 5 MB localStorage budget
      const oversizedContent = 'Y'.repeat(EDITOR_LIMITS.EMERGENCY_UNLOAD_MAX_BYTES + 1);
      const largeOk = unsyncedEdits.saveEmergencyUnload('doc-huge', oversizedContent, 'proj-ls');
      expect(largeOk).toBe(false);
      expect(localStorage.getItem(`${EDITOR_STORAGE_KEYS.EMERGENCY_UNSYNCED_EDIT_PREFIX}doc-huge`)).toBeNull();
    });

    it('enforces 30-day unsynced-edit TTL, LRU synced_doc_cache eviction, and exhausted outbox pruning', async () => {
      const { connection, unsyncedEdits, syncedDocCache, pendingOutbox, quotaGovernor } =
        createEditorOfflineStorage();
      const now = 1_800_000_000_000;

      // Save two unsynced edits, age one past 30 days
      await unsyncedEdits.save('stale-edit', 'Old work', 'p1');
      await unsyncedEdits.save('fresh-edit', 'Recent work', 'p1');
      const stale = await unsyncedEdits.get('stale-edit');
      const fresh = await unsyncedEdits.get('fresh-edit');
      expect(stale).not.toBeNull();
      expect(fresh).not.toBeNull();
      stale!.savedAt = now - EDITOR_LIMITS.STALE_UNSYNCED_EDIT_TTL_MS - 10_000;
      fresh!.savedAt = now - 1_000;

      // Seed synced_doc_cache exceeding tiny custom limit
      connection.setQuotaPolicy({
        maxSyncedDocCacheCount: 2,
        maxSyncedDocCacheBytes: 20,
        maxPendingOutboxBytes: 25,
      });

      await syncedDocCache.put({
        id: 'pf-1',
        projectId: 'p1',
        title: 'old.tex',
        content: '1234567890', // 10B
        updatedAt: 100,
      });
      await syncedDocCache.put({
        id: 'pf-2',
        projectId: 'p1',
        title: 'mid.tex',
        content: '1234567890', // 10B
        updatedAt: 200,
      });
      await syncedDocCache.put({
        id: 'pf-3',
        projectId: 'p1',
        title: 'new.tex',
        content: '1234567890', // 10B -> total 30B > 20B & 3 > 2
        updatedAt: 300,
      });

      // Seed completed and exhausted failed outbox mutations
      const mCompleted = await pendingOutbox.enqueue({
        fileId: 'f1',
        type: 'update_content',
        payload: { content: 'done' },
      });
      await pendingOutbox.updateStatus(mCompleted.id!, 'completed');

      const mFailed = await pendingOutbox.enqueue({
        fileId: 'f2',
        type: 'update_content',
        payload: { content: 'X'.repeat(40) },
      });
      await pendingOutbox.updateStatus(mFailed.id!, 'failed', 'err1');
      await pendingOutbox.updateStatus(mFailed.id!, 'failed', 'err2');
      await pendingOutbox.updateStatus(mFailed.id!, 'failed', 'err3');

      const report = await quotaGovernor.enforceDiskQuota({ now });

      expect(report.prunedUnsyncedEdits).toBe(1);
      expect(await unsyncedEdits.get('stale-edit')).toBeNull();
      expect(await unsyncedEdits.get('fresh-edit')).not.toBeNull();

      expect(report.evictedCachedDocs).toBe(1);
      expect(await syncedDocCache.get('pf-1')).toBeNull();
      expect(await syncedDocCache.get('pf-2')).not.toBeNull();
      expect(await syncedDocCache.get('pf-3')).not.toBeNull();

      expect(report.prunedOutboxMutations).toBe(2);
      expect(await pendingOutbox.getPending()).toHaveLength(0);
    });
  });

  describe('5. pageQuery Online Write-Through & Offline Hydration Fallback', () => {
    it('caches clean server document on fetch and restores from Offline DB via hydrateModelAsync on network failure', async () => {
      const qc1 = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const getByIdSpy = vi.spyOn(pagesService.docs, 'getById').mockResolvedValue({
        id: 'doc-wt-1',
        title: 'chapter1.tex',
        path: 'chapters/chapter1.tex',
        content: '\\section{Online Content}',
        projectId: 'proj-wt',
      } as any);

      const onlinePage = await qc1.fetchQuery(pageQuery('doc-wt-1'));
      expect(onlinePage.content).toBe('\\section{Online Content}');

      // Give fire-and-forget syncedDocCacheStore.put a microtask turn
      await Promise.resolve();
      const storedSnap = await syncedDocCacheStore.get('doc-wt-1');
      expect(storedSnap?.content).toBe('\\section{Online Content}');

      // Simulate browser reload (RAM empty) + offline network failure
      lruDocumentCache.clearAll();
      getByIdSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const qc2 = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const offlinePage = await qc2.fetchQuery(pageQuery('doc-wt-1'));
      expect(offlinePage.content).toBe('\\section{Online Content}');
      expect(lruDocumentCache.has('doc-wt-1')).toBe(true);
      expect(lruDocumentCache.isDirty('doc-wt-1')).toBe(false);
    });
  });
});
