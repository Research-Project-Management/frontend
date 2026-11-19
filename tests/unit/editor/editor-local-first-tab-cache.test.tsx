import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { manuscriptService, type EditorBootstrapResponseDto } from '@/features/editor/sdk/pages.service';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator, useConnectivityStore } from '@/features/editor/core';
import {
  pageQuery,
  hydrateEditorBootstrap,
  resolveDocumentLocalFirst,
} from '@/features/editor/ui/hooks/document.queries';
import type { Page } from '@/features/editor/domain/types/core.types';

function makeBootstrapDto(overrides?: Partial<EditorBootstrapResponseDto>): EditorBootstrapResponseDto {
  const spaceId = 'space-lf-1';
  const pageId = 'page-lf-1';
  const rootDocId = 'doc-main';
  return {
    workspace: {
      spaceId,
      spaceType: 'project',
      pageId,
      rootDocId,
      projectName: 'Local-First Paper',
      title: 'Local-First Paper',
      mainFilePath: 'main.tex',
      permissions: { role: 'owner', canEdit: true, canCompile: true },
      githubLink: null,
    },
    tree: [
      {
        id: 'node-main',
        spaceId,
        projectId: spaceId,
        pageId,
        parentId: null,
        type: 'DOC',
        name: 'main.tex',
        path: '/main.tex',
        docId: rootDocId,
        isRootDoc: true,
        sizeBytes: 120,
        hash: 'sha-main-v1',
        rev: 1,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'node-ch1',
        spaceId,
        projectId: spaceId,
        pageId,
        parentId: null,
        type: 'DOC',
        name: 'ch1.tex',
        path: '/chapters/ch1.tex',
        docId: 'ch1',
        isRootDoc: false,
        sizeBytes: 64,
        hash: 'sha-ch1-v1',
        rev: 1,
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'node-ch2',
        spaceId,
        projectId: spaceId,
        pageId,
        parentId: null,
        type: 'DOC',
        name: 'ch2.tex',
        path: '/chapters/ch2.tex',
        docId: 'ch2',
        isRootDoc: false,
        sizeBytes: 96,
        hash: 'sha-ch2-v2',
        rev: 2,
        sortOrder: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    activeDoc: {
      id: rootDocId,
      nodeId: 'node-main',
      page: {
        id: rootDocId,
        title: 'main.tex',
        content: '\\section{Main}',
        path: '/main.tex',
        status: 'published',
        spaceId,
        pageId,
        projectId: spaceId,
        mainFile: { id: rootDocId, title: 'main.tex' },
        mainFileId: rootDocId,
        rootPageId: pageId,
        version: 1,
        rev: 1,
        hash: 'sha-main-v1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      lines: ['\\section{Main}'],
      version: 1,
      rev: 1,
      hash: 'sha-main-v1',
      ranges: {},
      fallbackToRoot: false,
    },
    symbols: null,
    lastBuild: {
      status: 'uncompiled',
      pdfArtifactUrl: null,
      synctexAvailable: false,
      lastCompiledAt: null,
      diagnostics: [],
    },
    degraded: false,
    degradedBranches: [],
    serverTimestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const TEST_DOC_IDS = [
  'doc-main',
  'ch1',
  'ch2',
  'file-1',
  'file-2',
  'file-3',
  'file-4',
  'file-5',
  'd1',
  'd2',
  'd3',
];

async function clearTestDraftStorage(): Promise<void> {
  await Promise.all(
    TEST_DOC_IDS.flatMap((id) => [
      draftStorageService.clearDraft(id).catch(() => {}),
      draftStorageService.deleteProjectFileSnapshot(id).catch(() => {}),
    ]),
  );
}

describe('Single-User Local-First Tab Cache (RAM -> OfflineDB -> Server) & O(1) Dirty Subscription', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    lruDocumentCache.resetLimits();
    lruDocumentCache.clear();
    sessionCoordinator.resetSession();
    useConnectivityStore.getState().setIsOnline(true);
    await clearTestDraftStorage();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    lruDocumentCache.resetLimits();
    lruDocumentCache.clear();
    sessionCoordinator.resetSession();
    await clearTestDraftStorage();
  });

  it('hits RAM with staleTime=Infinity and triggers 0 extra GET /docs/:id calls when switching tabs even after >60s', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const boot = makeBootstrapDto();
    hydrateEditorBootstrap(queryClient, boot);

    const getByIdSpy = vi
      .spyOn(manuscriptService.docs, 'getById')
      .mockResolvedValue({
        id: 'ch1',
        title: 'ch1.tex',
        path: '/chapters/ch1.tex',
        content: '\\section{Chapter 1}',
        projectId: 'space-lf-1',
        rev: 1,
        hash: 'sha-ch1-v1',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Page);

    // First click on ch1 (miss -> fetches server once and caches in RAM + OfflineDB)
    const ch1First = await queryClient.fetchQuery(pageQuery('ch1'));
    expect(ch1First.content).toBe('\\section{Chapter 1}');
    expect(getByIdSpy).toHaveBeenCalledTimes(1);

    // Advance 60s (> old 30s staleTime) and switch back to main -> ch1 -> main -> ch1
    vi.advanceTimersByTime(60_000);
    const mainAgain = await queryClient.fetchQuery(pageQuery('doc-main'));
    const ch1Again = await queryClient.fetchQuery(pageQuery('ch1'));
    const ch1Direct = await resolveDocumentLocalFirst('ch1');

    expect(mainAgain.content).toBe('\\section{Main}');
    expect(ch1Again.content).toBe('\\section{Chapter 1}');
    expect(ch1Direct.content).toBe('\\section{Chapter 1}');
    // Zero repeat server fetches
    expect(getByIdSpy).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it('hydrates clean spilled tabs (>40 tabs / LRU eviction) from OfflineDB with 0 HTTP calls', async () => {
    lruDocumentCache.setCapacity(3);
    const getByIdSpy = vi
      .spyOn(manuscriptService.docs, 'getById')
      .mockImplementation(async (docId: string) => ({
        id: docId,
        title: `${docId}.tex`,
        path: `/${docId}.tex`,
        content: `content-for-${docId}`,
        projectId: 'space-lf-1',
        rev: 1,
        hash: `hash-${docId}`,
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Page));

    for (const id of ['file-1', 'file-2', 'file-3', 'file-4', 'file-5']) {
      await resolveDocumentLocalFirst(id);
    }
    expect(getByIdSpy).toHaveBeenCalledTimes(5);
    expect(lruDocumentCache.hasModel('file-1')).toBe(false);
    expect(lruDocumentCache.hasModel('file-2')).toBe(false);

    // Switch back to spilled file-1 & file-2: resolved strictly from OfflineDB (0 HTTP)
    getByIdSpy.mockClear();
    const restored1 = await resolveDocumentLocalFirst('file-1');
    const restored2 = await resolveDocumentLocalFirst('file-2');

    expect(restored1.content).toBe('content-for-file-1');
    expect(restored2.content).toBe('content-for-file-2');
    expect(getByIdSpy).toHaveBeenCalledTimes(0);
    expect(lruDocumentCache.hasModel('file-1')).toBe(true);
    expect(lruDocumentCache.hasModel('file-2')).toBe(true);
  });

  it('validates OfflineDB snapshots after F5 reload via tree (hash, rev) manifest: 0 HTTP on match, 1 HTTP on mismatch', async () => {
    // Seed OfflineDB snapshots before simulated reload
    await draftStorageService.saveProjectFileSnapshot({
      id: 'ch1',
      projectId: 'space-lf-1',
      title: 'ch1.tex',
      filePath: '/chapters/ch1.tex',
      content: 'ch1-from-idb-v1',
      rev: 1,
      hash: 'sha-ch1-v1',
      updatedAt: Date.now() - 10_000,
    });
    await draftStorageService.saveProjectFileSnapshot({
      id: 'ch2',
      projectId: 'space-lf-1',
      title: 'ch2.tex',
      filePath: '/chapters/ch2.tex',
      content: 'ch2-stale-v1',
      rev: 1,
      hash: 'sha-ch2-v1',
      updatedAt: Date.now() - 10_000,
    });

    // F5 wipe of RAM cache followed by bootstrap carrying authoritative manifest (ch1=v1, ch2=v2)
    lruDocumentCache.clear();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrateEditorBootstrap(queryClient, makeBootstrapDto());

    const getByIdSpy = vi
      .spyOn(manuscriptService.docs, 'getById')
      .mockResolvedValue({
        id: 'ch2',
        title: 'ch2.tex',
        path: '/chapters/ch2.tex',
        content: 'ch2-fresh-server-v2',
        projectId: 'space-lf-1',
        rev: 2,
        hash: 'sha-ch2-v2',
        updatedAt: '2026-01-01T00:01:00.000Z',
      } as Page);

    // ch1 matches manifest (sha-ch1-v1, rev 1) -> served from OfflineDB with 0 HTTP calls
    const resolvedCh1 = await resolveDocumentLocalFirst('ch1');
    expect(resolvedCh1.content).toBe('ch1-from-idb-v1');
    expect(getByIdSpy).toHaveBeenCalledTimes(0);

    // ch2 mismatches manifest (idb v1 vs tree v2) -> fetches server once and updates RAM + OfflineDB
    const resolvedCh2 = await resolveDocumentLocalFirst('ch2');
    expect(resolvedCh2.content).toBe('ch2-fresh-server-v2');
    expect(getByIdSpy).toHaveBeenCalledTimes(1);

    // Subsequent resolution hits RAM with 0 further HTTP calls
    const resolvedCh2Again = await resolveDocumentLocalFirst('ch2');
    expect(resolvedCh2Again.content).toBe('ch2-fresh-server-v2');
    expect(getByIdSpy).toHaveBeenCalledTimes(1);

    const updatedSnap = await draftStorageService.getProjectFileSnapshot('ch2');
    expect(updatedSnap?.rev).toBe(2);
    expect(updatedSnap?.hash).toBe('sha-ch2-v2');
    expect(updatedSnap?.content).toBe('ch2-fresh-server-v2');
    queryClient.clear();
  });

  it('closes autosave write-through loop ({ rev, hash } -> RAM + Manifest + OfflineDB) and detects stale offline draft OCC conflict', async () => {
    lruDocumentCache.registerModel('ch1', {
      content: 'initial v1',
      filePath: '/chapters/ch1.tex',
      projectId: 'space-lf-1',
      serverRev: 1,
      hash: 'sha-ch1-v1',
    });

    const updateSpy = vi
      .spyOn(manuscriptService.docs, 'updateContent')
      .mockResolvedValue({
        id: 'ch1',
        title: 'ch1.tex',
        content: 'edited v2',
        projectId: 'space-lf-1',
        rev: 2,
        hash: 'sha-ch1-v2',
        updatedAt: '2026-01-01T00:02:00.000Z',
      } as Page);

    sessionCoordinator.notifyContentChange('ch1', 'edited v2', { skipAutoCompile: true });
    const flushed = await sessionCoordinator.flushFile('ch1');
    expect(flushed).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith('ch1', 'edited v2', { expectedRev: 1 });

    expect(lruDocumentCache.isDirty('ch1')).toBe(false);
    expect(lruDocumentCache.getModel('ch1')?.serverRev).toBe(2);
    expect(lruDocumentCache.getModel('ch1')?.hash).toBe('sha-ch1-v2');
    expect(lruDocumentCache.getManifestEntry('ch1')).toMatchObject({ rev: 2, hash: 'sha-ch1-v2' });

    const persistedSnap = await draftStorageService.getProjectFileSnapshot('ch1');
    expect(persistedSnap?.content).toBe('edited v2');
    expect(persistedSnap?.rev).toBe(2);
    expect(persistedSnap?.hash).toBe('sha-ch1-v2');

    // Simulate reload where user had uncommitted draft at expectedRev=1 while server moved to rev=3
    lruDocumentCache.clear();
    await draftStorageService.saveDraft('ch1', 'offline edit based on v1', 'space-lf-1', 'ch1.tex', 1);
    lruDocumentCache.setManifestEntry('ch1', { rev: 3, hash: 'sha-ch1-v3', sessionValidated: true });

    vi.spyOn(manuscriptService.docs, 'getById').mockResolvedValue({
      id: 'ch1',
      title: 'ch1.tex',
      path: '/chapters/ch1.tex',
      content: 'remote collaborator v3',
      projectId: 'space-lf-1',
      rev: 3,
      hash: 'sha-ch1-v3',
    } as Page);

    const resolvedOnConflict = await resolveDocumentLocalFirst('ch1');
    expect(resolvedOnConflict.content).toBe('offline edit based on v1');
    expect(lruDocumentCache.isDirty('ch1')).toBe(true);

    const conflict = sessionCoordinator.getConflict('ch1');
    expect(conflict).toBeDefined();
    expect(conflict?.localContent).toBe('offline edit based on v1');
    expect(conflict?.remoteContent).toBe('remote collaborator v3');
    expect(conflict?.currentRev).toBe(3);
  });

  it('notifies subscribers in O(1) via subscribeFile and preserves dirty state across >capacity RAM eviction', () => {
    const spies = Array.from({ length: 50 }, (_, idx) => {
      const fn = vi.fn();
      const unsub = lruDocumentCache.subscribeFile(`tab-${idx}`, fn);
      return { fn, unsub };
    });

    try {
      lruDocumentCache.registerModel('tab-17', { content: 'base' });
      spies.forEach((s) => s.fn.mockClear());

      lruDocumentCache.updateContent('tab-17', 'edited line', true);
      expect(spies[17].fn).toHaveBeenCalledTimes(1);
      spies.forEach((s, idx) => {
        if (idx !== 17) {
          expect(s.fn).toHaveBeenCalledTimes(0);
        }
      });
    } finally {
      spies.forEach((s) => s.unsub());
    }

    // Dirty set survives LRU eviction out of RAM
    lruDocumentCache.clear();
    lruDocumentCache.setCapacity(2);
    lruDocumentCache.registerModel('d1', { content: 'dirty one' });
    lruDocumentCache.updateContent('d1', 'dirty one modified', true);
    lruDocumentCache.registerModel('d2', { content: 'clean two' });
    lruDocumentCache.registerModel('d3', { content: 'clean three' });

    expect(lruDocumentCache.hasModel('d1')).toBe(false);
    expect(lruDocumentCache.isDirty('d1')).toBe(true);
    expect(lruDocumentCache.getDirtyFileIds()).toContain('d1');

    lruDocumentCache.markClean('d1');
    expect(lruDocumentCache.isDirty('d1')).toBe(false);
    expect(lruDocumentCache.getDirtyFileIds()).not.toContain('d1');
  });
});
