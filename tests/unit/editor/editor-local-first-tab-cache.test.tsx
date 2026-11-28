import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { pagesService, type EditorBootstrapResponseDto } from '@/features/editor/sdk/pages.service';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core';
import {
  pageQuery,
  hydrateEditorBootstrap,
  resolveDocumentLocalFirst,
} from '@/features/editor/core/queries/document.queries';
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

describe('Hot RAM LRU Tab Cache (RAM -> Server) & O(1) Dirty Subscription', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lruDocumentCache.resetLimits();
    lruDocumentCache.clear();
    sessionCoordinator.resetSession();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    lruDocumentCache.resetLimits();
    lruDocumentCache.clear();
    sessionCoordinator.resetSession();
  });

  it('hits RAM with staleTime=Infinity and triggers 0 extra GET /docs/:id calls when switching tabs even after >60s', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const boot = makeBootstrapDto();
    hydrateEditorBootstrap(queryClient, boot);

    const getByIdSpy = vi
      .spyOn(pagesService.docs, 'getById')
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

  it('evicts oldest clean tabs beyond LRU capacity and re-hydrates from authoritative server on revisit', async () => {
    lruDocumentCache.setCapacity(3);
    const getByIdSpy = vi
      .spyOn(pagesService.docs, 'getById')
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

    getByIdSpy.mockClear();
    const restored1 = await resolveDocumentLocalFirst('file-1');
    const restored2 = await resolveDocumentLocalFirst('file-2');

    expect(restored1.content).toBe('content-for-file-1');
    expect(restored2.content).toBe('content-for-file-2');
    expect(getByIdSpy).toHaveBeenCalledTimes(2);
    expect(lruDocumentCache.hasModel('file-1')).toBe(true);
    expect(lruDocumentCache.hasModel('file-2')).toBe(true);
  });

  it('closes autosave write-through loop ({ rev, hash } -> RAM + Manifest)', async () => {
    lruDocumentCache.registerModel('ch1', {
      content: 'initial v1',
      filePath: '/chapters/ch1.tex',
      projectId: 'space-lf-1',
      serverRev: 1,
      hash: 'sha-ch1-v1',
    });

    const updateSpy = vi
      .spyOn(pagesService.docs, 'updateContent')
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
