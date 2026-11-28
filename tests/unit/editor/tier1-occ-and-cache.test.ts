import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  lruDocumentCache,
  measureUtf8Bytes,
} from '@/features/editor/domain/document/lru-document-cache';
import {
  SessionCoordinator,
  usePageStore,
  useWorkspaceStore,
} from '@/features/editor/core';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { hydrateEditorBootstrap } from '@/features/editor/core/queries/document.queries';
import { PageFileMapper } from '@/features/editor/sdk/pages/doc-mapper';
import type { EditorBootstrapResponseDto } from '@/features/editor/sdk/pages/types';

describe('Khối 2 / Tầng 1 — OCC & UTF-8 LRU Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lruDocumentCache.clear();
    useCompileStore.getState().clearAllDirty();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('computes UTF-8 bytes accurately for ASCII, Vietnamese diacritics, and astral emoji in LRUDocumentCache', () => {
    const sample = 'aéệ🚀'; // 1 + 2 + 3 + 4 = 10 UTF-8 bytes (UTF-16 .length === 5)
    expect(measureUtf8Bytes(sample)).toBe(10);

    lruDocumentCache.registerModel('utf8-doc', {
      content: sample,
      filePath: 'main.tex',
      spaceId: 'space-1',
      pageId: 'page-1',
    });

    expect(lruDocumentCache.getStats().totalBytes).toBe(10);

    lruDocumentCache.updateContent('utf8-doc', 'Tiếng Việt ệ', true);
    expect(lruDocumentCache.getStats().totalBytes).toBe(measureUtf8Bytes('Tiếng Việt ệ'));
  });

  it('seeds serverRev, spaceId, and pageId into lruDocumentCache from hydrateEditorBootstrap', () => {
    const queryClient = new QueryClient();
    const bootstrapPayload: EditorBootstrapResponseDto = {
      workspace: {
        spaceId: 'space-123',
        spaceType: 'project',
        pageId: 'page-456',
        rootDocId: 'doc-root',
        projectName: 'Research Project',
        title: 'Quantum Paper',
        mainFilePath: 'main.tex',
        permissions: { role: 'owner', canEdit: true, canCompile: true },
        githubLink: null,
      },
      tree: [
        {
          id: 'node-1',
          projectId: 'space-123',
          parentId: null,
          type: 'DOC',
          name: 'main.tex',
          path: '/main.tex',
          depth: 1,
          docId: 'doc-root',
          fileId: null,
          isRootDoc: true,
        },
      ],
      activeDoc: {
        id: 'doc-root',
        nodeId: 'node-1',
        page: {
          id: 'doc-root',
          title: 'main.tex',
          content: '\\documentclass{article}',
          path: '/main.tex',
          status: 'published',
          projectId: 'proj-789',
          mainFile: { id: 'doc-root', title: 'main.tex' },
          mainFileId: 'doc-root',
          rootPageId: 'doc-root',
          version: 3,
          rev: 7,
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-01T00:01:00Z',
        },
        lines: ['\\documentclass{article}'],
        version: 3,
        rev: 7,
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
      serverTimestamp: '2026-07-01T00:01:00Z',
    };

    hydrateEditorBootstrap(queryClient, bootstrapPayload, 'page-456');

    const cached = lruDocumentCache.getModel('doc-root');
    expect(cached).toBeDefined();
    expect(cached?.serverRev).toBe(7);
    expect(cached?.spaceId).toBe('space-123');
    expect(cached?.pageId).toBe('page-456');

    // Reset Zustand stores touched by hydrateEditorBootstrap cleanly
    expect(useWorkspaceStore.getState()).toBeDefined();
    expect(usePageStore.getState()).toBeDefined();
  });

  it('sends expectedRev, updates serverRev from nested page response, and resolves 409 conflict via details.currentRev & remoteContent', async () => {
    const updateContent = vi
      .fn()
      .mockResolvedValueOnce({
        page: { id: 'doc-occ', rev: 4, updatedAt: '2026-07-01T00:05:00Z' },
      })
      .mockRejectedValueOnce(
        Object.assign(new Error('Document has been modified by another session'), {
          status: 409,
          code: 'DOC_VERSION_CONFLICT',
          details: {
            docId: 'doc-occ',
            expectedRev: 4,
            currentRev: 9,
            currentVersion: 2, // intentionally != rev to verify currentRev takes precedence
            remoteContent: '% server rev 9 content',
          },
        }),
      );

    const coordinator = new SessionCoordinator({
      persistenceAdapter: { updateContent },
      autoSaveDelay: 500,
    });

    lruDocumentCache.registerModel('doc-occ', {
      content: 'initial v3',
      filePath: 'main.tex',
      serverRev: 3,
    });

    // Save 1: sends expectedRev: 3 and upgrades serverRev -> 4
    coordinator.notifyContentChange('doc-occ', 'edit v4');
    expect(await coordinator.flushFile('doc-occ')).toBe(true);
    expect(updateContent).toHaveBeenNthCalledWith(1, 'doc-occ', 'edit v4', {
      expectedRev: 3,
    });
    expect(lruDocumentCache.getModel('doc-occ')?.serverRev).toBe(4);

    // Save 2: sends expectedRev: 4, receives 409 with details.currentRev = 9
    coordinator.notifyContentChange('doc-occ', 'local conflicting edit');
    expect(await coordinator.flushFile('doc-occ')).toBe(false);
    expect(updateContent).toHaveBeenNthCalledWith(2, 'doc-occ', 'local conflicting edit', {
      expectedRev: 4,
    });

    const conflict = coordinator.getConflict('doc-occ');
    expect(conflict).toBeDefined();
    expect(conflict?.currentRev).toBe(9);
    expect(conflict?.remoteContent).toBe('% server rev 9 content');
    expect(lruDocumentCache.getModel('doc-occ')?.serverRev).toBe(9);

    coordinator.resolveConflict('doc-occ', 'take-remote');
    expect(lruDocumentCache.getModel('doc-occ')?.content).toBe('% server rev 9 content');
    expect(lruDocumentCache.getModel('doc-occ')?.isDirty).toBe(false);
  });

  it('falls back to getById when 409 lacks remoteContent and refuses empty overwrite if remote cannot be loaded', async () => {
    const updateContent = vi.fn().mockRejectedValue(
      Object.assign(new Error('Conflict 409'), {
        status: 409,
        code: 'DOC_VERSION_CONFLICT',
        details: { currentRev: 12 },
      }),
    );
    const getById = vi.fn().mockResolvedValue({
      content: 'fetched remote v12',
      rev: 12,
    });

    const coordinator = new SessionCoordinator({
      persistenceAdapter: { updateContent, getById },
    });

    lruDocumentCache.registerModel('doc-fallback', {
      content: 'v10',
      serverRev: 10,
    });
    coordinator.notifyContentChange('doc-fallback', 'local edit');
    await coordinator.flushFile('doc-fallback');

    expect(getById).toHaveBeenCalledWith('doc-fallback');
    expect(coordinator.getConflict('doc-fallback')?.remoteContent).toBe(
      'fetched remote v12',
    );

    // Subcase: getById also fails -> take-remote must NOT clobber non-empty local edits with ''
    const coordinatorNoRemote = new SessionCoordinator({
      persistenceAdapter: {
        updateContent: vi.fn().mockRejectedValue(
          Object.assign(new Error('409 Conflict'), {
            status: 409,
            details: { currentRev: 15 },
          }),
        ),
        getById: vi.fn().mockRejectedValue(new Error('Network down')),
      },
    });
    lruDocumentCache.registerModel('doc-guard', {
      content: 'base',
      serverRev: 14,
    });
    coordinatorNoRemote.notifyContentChange('doc-guard', 'precious local draft');
    await coordinatorNoRemote.flushFile('doc-guard');

    const conflict = coordinatorNoRemote.getConflict('doc-guard');
    expect(conflict?.hasAuthoritativeRemote).toBe(false);
    coordinatorNoRemote.resolveConflict('doc-guard', 'take-remote');
    expect(lruDocumentCache.getModel('doc-guard')?.content).toBe(
      'precious local draft',
    );
  });

  it('propagates rev, version, and spaceId in PageFileMapper without adding undefined keys', () => {
    const mapped = PageFileMapper.toDomain(
      {
        id: 'file-1',
        pageId: 'page-1',
        spaceId: 'space-1',
        title: 'main.tex',
        content: 'abc',
        rev: 4,
        version: 2,
      },
      { defaultPageId: 'page-1', defaultTitle: 'main.tex' },
    );

    expect(mapped.spaceId).toBe('space-1');
    expect(mapped.rev).toBe(4);
    expect(mapped.version).toBe(2);

    const legacyMapped = PageFileMapper.toDomain(
      { id: 'file-2', title: 'legacy.tex', content: 'xyz' },
      { defaultPageId: 'page-1', defaultTitle: 'legacy.tex' },
    );
    expect('rev' in legacyMapped).toBe(false);
    expect('spaceId' in legacyMapped).toBe(false);
  });
});
