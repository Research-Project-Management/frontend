import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  LRUDocumentCache,
  lruDocumentCache,
} from '@/features/editor/domain/document/lru-document-cache';
import {
  DraftStorageService,
  draftStorageService,
  calculateAdaptiveEditorQuota,
} from '@/features/editor/domain/document/draft-storage';
import {
  EDITOR_LIMITS,
  EDITOR_STORAGE_KEYS,
} from '@/features/editor/domain/constants/editor.constants';
import {
  useCompileStore,
} from '@/features/editor/subsystems/compiler';
import {
  calculateAdaptiveReaderQuota,
} from '@/features/library/domain/reader-document-storage.domain';
import { manuscriptService } from '@/features/editor/sdk/pages.service';
import { pageQuery } from '@/features/editor/ui/hooks/document.queries';

describe('Editor RAM Dual-Bound Budget & Adaptive Offline Quota Hardening', () => {
  beforeEach(() => {
    lruDocumentCache.clearAll();
    lruDocumentCache.resetLimits();
    useCompileStore.getState().clearAllDirty();
    draftStorageService.clearMemory();
    try {
      localStorage.clear();
    } catch {}
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lruDocumentCache.clearAll();
    lruDocumentCache.resetLimits();
    draftStorageService.clearMemory();
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
      const saveDraftSpy = vi.fn().mockResolvedValue(undefined);
      const saveSnapshotSpy = vi.fn().mockResolvedValue(undefined);
      const cache = new LRUDocumentCache({
        saveDraft: saveDraftSpy,
        getDraft: vi.fn().mockResolvedValue(null),
        clearDraft: vi.fn().mockResolvedValue(undefined),
        saveProjectFileSnapshot: saveSnapshotSpy,
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
      expect(saveSnapshotSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'clean-old',
          content: 'B'.repeat(40),
          filePath: 'chapters/ch1.tex',
        }),
      );

      // Growing active-doc should evict dirty-mid and spill it to saveDraft
      cache.updateContent('active-doc', 'A'.repeat(70), true);
      expect(cache.has('active-doc')).toBe(true);
      expect(cache.has('dirty-mid')).toBe(false);
      expect(cache.getStats().totalBytes).toBe(70);
      expect(saveDraftSpy).toHaveBeenCalledWith(
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
      expect(mobilePolicy.maxDraftsBytes).toBe(6 * 1024 * 1024);
      expect(mobilePolicy.maxProjectFilesBytes).toBe(Math.floor(24 * 1024 * 1024 * 0.6));
      expect(mobilePolicy.maxMutationsBytes).toBe(Math.floor(24 * 1024 * 1024 * 0.15));

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

  describe('4. DraftStorageService Zero Periodic LocalStorage, Emergency Unload, & TTL/Quota Cleanup', () => {
    it('does not write periodic saveDraft payloads to localStorage and enforces 512 KB ceiling on saveEmergencyUnloadDraft', async () => {
      const storage = new DraftStorageService();
      await storage.saveDraft('doc-no-ls', 'Draft content only in storage', 'proj-ls', 'main.tex');

      expect(localStorage.getItem(`${EDITOR_STORAGE_KEYS.DRAFT_PREFIX}doc-no-ls`)).toBeNull();
      const fetched = await storage.getDraft('doc-no-ls');
      expect(fetched?.content).toBe('Draft content only in storage');

      // Emergency unload draft succeeds <= 512 KB
      const smallOk = storage.saveEmergencyUnloadDraft('doc-small', 'X'.repeat(1024), 'proj-ls');
      expect(smallOk).toBe(true);
      expect(localStorage.getItem(`${EDITOR_STORAGE_KEYS.DRAFT_PREFIX}doc-small`)).not.toBeNull();

      // Emergency unload draft refuses > 512 KB to protect 5 MB localStorage budget
      const oversizedContent = 'Y'.repeat(EDITOR_LIMITS.EMERGENCY_UNLOAD_MAX_BYTES + 1);
      const largeOk = storage.saveEmergencyUnloadDraft('doc-huge', oversizedContent, 'proj-ls');
      expect(largeOk).toBe(false);
      expect(localStorage.getItem(`${EDITOR_STORAGE_KEYS.DRAFT_PREFIX}doc-huge`)).toBeNull();
    });

    it('enforces 30-day draft TTL, LRU project_files eviction, and exhausted failed mutation pruning', async () => {
      const storage = new DraftStorageService();
      const now = 1_800_000_000_000;

      // Save two drafts, age one past 30 days
      await storage.saveDraft('stale-draft', 'Old work', 'p1');
      await storage.saveDraft('fresh-draft', 'Recent work', 'p1');
      const stale = await storage.getDraft('stale-draft');
      const fresh = await storage.getDraft('fresh-draft');
      expect(stale).not.toBeNull();
      expect(fresh).not.toBeNull();
      stale!.savedAt = now - EDITOR_LIMITS.STALE_DRAFT_TTL_MS - 10_000;
      fresh!.savedAt = now - 1_000;

      // Seed project_files exceeding tiny custom limit
      storage.setQuotaPolicy({
        maxProjectFilesCount: 2,
        maxProjectFilesBytes: 20,
        maxMutationsBytes: 25,
      });

      await storage.saveProjectFileSnapshot({
        id: 'pf-1',
        projectId: 'p1',
        title: 'old.tex',
        content: '1234567890', // 10B
        updatedAt: 100,
      });
      await storage.saveProjectFileSnapshot({
        id: 'pf-2',
        projectId: 'p1',
        title: 'mid.tex',
        content: '1234567890', // 10B
        updatedAt: 200,
      });
      await storage.saveProjectFileSnapshot({
        id: 'pf-3',
        projectId: 'p1',
        title: 'new.tex',
        content: '1234567890', // 10B -> total 30B > 20B & 3 > 2
        updatedAt: 300,
      });

      // Seed completed and exhausted failed mutations
      const mCompleted = await storage.enqueueMutation({
        fileId: 'f1',
        type: 'update_content',
        payload: { content: 'done' },
      });
      await storage.updateMutationStatus(mCompleted.id!, 'completed');

      const mFailed = await storage.enqueueMutation({
        fileId: 'f2',
        type: 'update_content',
        payload: { content: 'X'.repeat(40) },
      });
      await storage.updateMutationStatus(mFailed.id!, 'failed', 'err1');
      await storage.updateMutationStatus(mFailed.id!, 'failed', 'err2');
      await storage.updateMutationStatus(mFailed.id!, 'failed', 'err3');

      const report = await storage.enforceDiskQuota({ now });

      expect(report.prunedDrafts).toBe(1);
      expect(await storage.getDraft('stale-draft')).toBeNull();
      expect(await storage.getDraft('fresh-draft')).not.toBeNull();

      expect(report.evictedFiles).toBe(1);
      expect(await storage.getProjectFileSnapshot('pf-1')).toBeNull();
      expect(await storage.getProjectFileSnapshot('pf-2')).not.toBeNull();
      expect(await storage.getProjectFileSnapshot('pf-3')).not.toBeNull();

      expect(report.prunedMutations).toBe(2);
      expect(await storage.getPendingMutations()).toHaveLength(0);
    });
  });

  describe('5. pageQuery Online Write-Through & Offline Hydration Fallback', () => {
    it('caches clean server document on fetch and restores from Offline DB via hydrateModelAsync on network failure', async () => {
      const qc1 = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const getByIdSpy = vi.spyOn(manuscriptService.docs, 'getById').mockResolvedValue({
        id: 'doc-wt-1',
        title: 'chapter1.tex',
        path: 'chapters/chapter1.tex',
        content: '\\section{Online Content}',
        projectId: 'proj-wt',
      } as any);

      const onlinePage = await qc1.fetchQuery(pageQuery('doc-wt-1'));
      expect(onlinePage.content).toBe('\\section{Online Content}');

      // Give fire-and-forget saveProjectFileSnapshot a microtask turn
      await Promise.resolve();
      const storedSnap = await draftStorageService.getProjectFileSnapshot('doc-wt-1');
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
