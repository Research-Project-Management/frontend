import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LRUDocumentCache,
  lruDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/document/lru-document-cache';
import { draftStorageService } from '@/features/editor/coordinators/services/draft-storage.service';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { useCompileStore, useConnectivityStore, usePageStore } from '@/features/editor/store';

describe('LRU Document Cache & Local-First Offline Draft Sync (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lruDocumentCache.clear();
    lruDocumentCache.setCapacity(25);
    lruDocumentCache.setActiveFileId(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    draftStorageService.clearMemory();
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
      cache.touch('doc-1');
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

    it('automatically persists dirty documents to DraftStorageService upon eviction', async () => {
      const saveDraftSpy = vi.spyOn(draftStorageService, 'saveDraft').mockResolvedValue(undefined);

      const cache = new LRUDocumentCache();
      cache.setCapacity(2);

      cache.registerModel('doc-dirty', {
        content: '\\section{Unsaved Draft Changes}',
        filePath: 'main.tex',
        projectId: 'proj-123',
      });
      cache.markDirty('doc-dirty');

      cache.registerModel('doc-clean', { content: 'Clean Doc' });

      // Pushing doc-3 should evict doc-dirty and trigger saveDraft
      cache.registerModel('doc-3', { content: 'Doc 3' });

      expect(cache.has('doc-dirty')).toBe(false);
      expect(saveDraftSpy).toHaveBeenCalledWith(
        'doc-dirty',
        '\\section{Unsaved Draft Changes}',
        'proj-123',
        'main.tex'
      );
      saveDraftSpy.mockRestore();
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

  describe('2. DraftStorageService Resilience & Recovery', () => {
    it('saves and retrieves document snapshots across storage tiers', async () => {
      await draftStorageService.saveDraft(
        'file-draft-1',
        '\\begin{equation} E = mc^2 \\end{equation}',
        'project-abc',
        'math.tex'
      );

      const draft = await draftStorageService.getDraft('file-draft-1');
      expect(draft).not.toBeNull();
      expect(draft?.fileId).toBe('file-draft-1');
      expect(draft?.content).toBe('\\begin{equation} E = mc^2 \\end{equation}');
      expect(draft?.projectId).toBe('project-abc');
      expect(draft?.title).toBe('math.tex');
      expect(draft?.savedAt).toBeGreaterThan(0);
    });

    it('clears draft after successful server synchronization', async () => {
      await draftStorageService.saveDraft('file-to-clear', 'Some Draft Content');
      expect(await draftStorageService.getDraft('file-to-clear')).not.toBeNull();

      await draftStorageService.clearDraft('file-to-clear');
      expect(await draftStorageService.getDraft('file-to-clear')).toBeNull();
    });

    it('retrieves all recent drafts for a specific project', async () => {
      await draftStorageService.saveDraft('doc-p1-a', 'P1 Content A', 'proj-target');
      await draftStorageService.saveDraft('doc-p1-b', 'P1 Content B', 'proj-target');
      await draftStorageService.saveDraft('doc-p2-c', 'P2 Content C', 'proj-other');

      const projectDrafts = await draftStorageService.getRecentDraftsForProject('proj-target');
      expect(projectDrafts.length).toBe(2);
      expect(projectDrafts.map((d) => d.fileId).sort()).toEqual(['doc-p1-a', 'doc-p1-b']);
    });
  });

  describe('3. SessionCoordinator Offline Resilience & Reconnection Sync', () => {
    it('notifies content changes, updates RAM cache, marks compile dirty, and saves draft snapshot', () => {
      const saveDraftSpy = vi.spyOn(sessionCoordinator, 'saveDraftSnapshot');
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

      // 3. Draft snapshot must have been requested
      expect(saveDraftSpy).toHaveBeenCalledWith('doc-editing', 'New Edited Content', 'proj-sync');
    });

    it('detects recoverable local drafts when local unsaved content differs from server', async () => {
      lruDocumentCache.registerModel('file-conflict', {
        content: 'Local unsaved draft text',
        filePath: 'intro.tex',
        projectId: 'p1',
      });
      lruDocumentCache.markDirty('file-conflict');

      const recovery = sessionCoordinator.checkDraftRecovery(
        'file-conflict',
        'Stale server text'
      );

      expect(recovery.hasRecoverableDraft).toBe(true);
      expect(recovery.draft?.content).toBe('Local unsaved draft text');

      // If server matches local dirty content, no conflict recovery needed
      const noRecovery = sessionCoordinator.checkDraftRecovery(
        'file-conflict',
        'Local unsaved draft text'
      );
      expect(noRecovery.hasRecoverableDraft).toBe(false);
    });

    it('persists outgoing draft and switches active file when switching tabs', () => {
      const saveDraftSpy = vi.spyOn(sessionCoordinator, 'saveDraftSnapshot');

      lruDocumentCache.registerModel('tab-1', { content: 'Tab 1 dirty content' });
      lruDocumentCache.markDirty('tab-1');

      lruDocumentCache.registerModel('tab-2', { content: 'Tab 2 content' });

      sessionCoordinator.switchTab('tab-1', 'tab-2');

      expect(saveDraftSpy).toHaveBeenCalledWith('tab-1', 'Tab 1 dirty content', undefined);
      expect(lruDocumentCache.getStats().mruFileId).toBe('tab-2');
    });

    it('flushes all pending dirty documents and clears drafts upon network reconnection', async () => {
      const updateContentSpy = vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue({} as any);
      const clearDraftSpy = vi.spyOn(sessionCoordinator, 'clearDraftSnapshot');

      lruDocumentCache.registerModel('pending-1', { content: 'Pending Content 1' });
      lruDocumentCache.markDirty('pending-1');

      lruDocumentCache.registerModel('pending-2', { content: 'Pending Content 2' });
      lruDocumentCache.markDirty('pending-2');

      const flushResult = await sessionCoordinator.flushAllPending();

      expect(flushResult.total).toBe(2);
      expect(flushResult.succeeded).toBe(2);
      expect(flushResult.failed).toBe(0);

      expect(updateContentSpy).toHaveBeenCalledTimes(2);
      expect(clearDraftSpy).toHaveBeenCalledWith('pending-1');
      expect(clearDraftSpy).toHaveBeenCalledWith('pending-2');

      // All models should now be marked clean
      expect(lruDocumentCache.getDirtyModels().length).toBe(0);
    });
  });
});
