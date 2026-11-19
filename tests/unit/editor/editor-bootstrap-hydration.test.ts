import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  editorBootstrapQuery,
  hydrateEditorBootstrap,
  pageKeys,
  pageQuery,
  filesQuery,
  storageKeys,
} from '@/features/editor/core/queries/document.queries';
import {
  PAGES_API_BASE,
  pagesService,
  type EditorBootstrapResponseDto,
} from '@/features/editor/sdk/pages.service';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
  clearAllOfflineMemory,
} from '@/features/editor/domain/offline-storage';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';

function createSampleBootstrapPayload(
  overrides?: Partial<EditorBootstrapResponseDto>,
): EditorBootstrapResponseDto {
  const rootDocId = '22222222-2222-4222-8222-222222222222';
  const projectId = '11111111-1111-4111-8111-111111111111';
  const childDocId = '33333333-3333-4333-8333-333333333333';

  return {
    workspace: {
      spaceId: projectId,
      spaceType: 'project',
      pageId: rootDocId,
      rootDocId,
      projectName: 'Quantum Project',
      title: 'Quantum LaTeX Paper',
      mainFilePath: 'main.tex',
      permissions: {
        role: 'contributor',
        canEdit: true,
        canCompile: true,
      },
      githubLink: {
        id: 'gh-link-1',
        repoFullName: 'flux-org/quantum-paper',
        branch: 'main',
        lastSyncedAt: '2026-01-02T10:00:00.000Z',
      },
      ...overrides?.workspace,
    },
    tree: overrides?.tree ?? [
      {
        id: 'node-root',
        projectId,
        pageId: rootDocId,
        parentId: null,
        type: 'DOC',
        name: 'main.tex',
        path: '/main.tex',
        docId: rootDocId,
        fileId: null,
        isRootDoc: true,
        sizeBytes: 200,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'node-folder-chapters',
        projectId,
        pageId: rootDocId,
        parentId: null,
        type: 'FOLDER',
        name: 'chapters',
        path: '/chapters',
        docId: null,
        fileId: null,
        isRootDoc: false,
        sizeBytes: 0,
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'node-child-intro',
        projectId,
        pageId: rootDocId,
        parentId: 'node-folder-chapters',
        type: 'DOC',
        name: 'intro.tex',
        path: '/chapters/intro.tex',
        docId: childDocId,
        fileId: null,
        isRootDoc: false,
        sizeBytes: 340,
        sortOrder: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'node-asset-fig',
        projectId,
        pageId: rootDocId,
        parentId: null,
        type: 'FILE',
        name: 'diagram.png',
        path: '/figures/diagram.png',
        docId: null,
        fileId: '55555555-5555-4555-8555-555555555555',
        isRootDoc: false,
        sizeBytes: 4096,
        sortOrder: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    activeDoc: overrides?.activeDoc ?? {
      id: rootDocId,
      nodeId: 'node-root',
      page: {
        id: rootDocId,
        title: 'main.tex',
        content: '\\documentclass{article}\n\\begin{document}\nHello Bootstrapped World\n\\end{document}',
        path: '/main.tex',
        status: 'published',
        projectId,
        mainFile: { id: rootDocId, title: 'main.tex' },
        mainFileId: rootDocId,
        rootPageId: rootDocId,
        version: 2,
        rev: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      lines: [
        '\\documentclass{article}',
        '\\begin{document}',
        'Hello Bootstrapped World',
        '\\end{document}',
      ],
      version: 2,
      rev: 5,
      ranges: {},
      fallbackToRoot: false,
    },
    symbols:
      overrides && 'symbols' in overrides
        ? (overrides.symbols ?? null)
        : {
            rootDocPath: '/main.tex',
            labels: [{ key: 'sec:overview', file: '/main.tex', line: 3 }],
            citations: [
              {
                key: 'knuth1984',
                type: 'book',
                title: 'The TeXbook',
                author: 'Donald Knuth',
                year: '1984',
                file: '/refs.bib',
                line: 1,
              },
            ],
            customCommands: [],
            customEnvironments: [],
            packages: [{ name: 'graphicx', file: '/main.tex', line: 1 }],
            bibliographies: ['/refs.bib'],
            includedFiles: ['/chapters/intro.tex'],
            imageFiles: ['/figures/diagram.png'],
            files: ['/main.tex', '/chapters/intro.tex'],
            images: ['/figures/diagram.png'],
            outline: [
              {
                title: 'Overview',
                level: 1,
                levelName: 'section',
                file: '/main.tex',
                line: 3,
                from: 30,
              },
            ],
          },
    lastBuild: overrides?.lastBuild ?? {
      status: 'ready',
      pdfArtifactUrl: `/api/v1/pages/spaces/${projectId}/artifacts/output.pdf`,
      synctexAvailable: true,
      lastCompiledAt: '2026-01-02T12:00:00.000Z',
      diagnostics: [
        {
          file: 'main.tex',
          line: 3,
          message: 'Underfull \\hbox',
          context: 'Hello Bootstrapped World',
          severity: 'badbox',
        },
      ],
    },
    degraded: overrides?.degraded ?? false,
    degradedBranches: overrides?.degradedBranches ?? [],
    serverTimestamp: '2026-01-02T12:00:01.000Z',
  };
}

describe('Editor Bootstrap Single-Flight Hydration Seam', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    lruDocumentCache.clear();
    latexSymbolsIndex.clear();
    usePageStore.getState().resetPageState();
    useCompileStore.getState().resetCompiler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
    clearAllOfflineMemory();
  });

  it('hydrates all 3 Editor blocks in 1 HTTP call and seeds QueryClient, LRU RAM, Symbols, PageStore, and CompilerStore with 0 extra fetches', async () => {
    const payload = createSampleBootstrapPayload();
    const bootSpy = vi
      .spyOn(pagesService.bootstrap, 'getEditorBootstrap')
      .mockResolvedValue(payload);
    const getByIdSpy = vi.spyOn(pagesService.docs, 'getById');
    const getFilesSpy = vi.spyOn(pagesService.docs, 'getFiles');
    const getAllNodesSpy = vi.spyOn(pagesService.structure, 'getAllNodes');
    const getSymbolsSpy = vi.spyOn(pagesService.structure, 'getSymbols');
    const artifactSpy = vi
      .spyOn(pagesService.compiler, 'fetchArtifactBlobUrl')
      .mockResolvedValue('blob:mock-pdf-url');
    const snapshotSpy = vi
      .spyOn(syncedDocCacheStore, 'put')
      .mockResolvedValue();

    const bootOptions = editorBootstrapQuery(queryClient, payload.workspace.rootDocId);
    const result = await queryClient.fetchQuery(bootOptions);

    expect(result).toEqual(payload);
    expect(bootSpy).toHaveBeenCalledTimes(1);
    expect(getByIdSpy).not.toHaveBeenCalled();
    expect(getFilesSpy).not.toHaveBeenCalled();
    expect(getAllNodesSpy).not.toHaveBeenCalled();
    expect(getSymbolsSpy).not.toHaveBeenCalled();

    // Verify Block 1: TanStack Query tree + files + Symbol catalog
    const cachedFiles = queryClient.getQueryData(
      pageKeys.files(payload.workspace.rootDocId),
    ) as Array<{ id: string; title: string }>;
    expect(cachedFiles.map((f) => f.title)).toEqual(['main.tex', 'chapters/intro.tex']);
    const cachedStorage = queryClient.getQueryData(
      storageKeys.files(payload.workspace.spaceId, payload.workspace.rootDocId),
    ) as Array<{ id: string; isFolder: boolean }>;
    expect(cachedStorage).toHaveLength(4);
    expect(latexSymbolsIndex.getLabels('overview')).toHaveLength(1);
    expect(latexSymbolsIndex.hasHydratedProject(payload.workspace.pageId)).toBe(true);

    // Verify Block 2: Pure (spaceId, pageId, projectId) in QueryClient + LRU RAM + PageStore + IndexedDB
    const cachedPage = queryClient.getQueryData(
      pageKeys.detail(payload.workspace.rootDocId),
    ) as { content: string };
    expect(cachedPage.content).toContain('Hello Bootstrapped World');
    expect(lruDocumentCache.getContent(payload.workspace.rootDocId)).toContain(
      'Hello Bootstrapped World',
    );
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
    expect('scope' in payload.workspace).toBe(false);
    expect(usePageStore.getState().spaceId).toBe(payload.workspace.spaceId);
    expect(usePageStore.getState().projectId).toBe(payload.workspace.spaceId);
    expect(usePageStore.getState().workspaceTitle).toBe('Quantum LaTeX Paper');
    expect(usePageStore.getState().projectName).toBe('Quantum Project');
    expect(usePageStore.getState().githubLink?.repoFullName).toBe(
      'flux-org/quantum-paper',
    );
    expect(
      queryClient.getQueryData(['github-link', payload.workspace.spaceId]),
    ).toEqual({
      isConnected: true,
      link: payload.workspace.githubLink,
    });
    expect(usePageStore.getState().permissions).toEqual({
      role: 'contributor',
      canEdit: true,
      canCompile: true,
    });

    // Verify Block 3: Diagnostics + non-blocking page-scoped PDF blob URL hydration
    expect(useCompileStore.getState().compileDiagnostics).toHaveLength(1);
    expect(useCompileStore.getState().lastCompiledAt?.toISOString()).toBe(
      '2026-01-02T12:00:00.000Z',
    );
    await vi.waitFor(() => {
      expect(artifactSpy).toHaveBeenCalledWith(
        payload.workspace.pageId,
        'output.pdf',
        { isPageScoped: true },
      );
      expect(useCompileStore.getState().pdfUrl).toBe('blob:mock-pdf-url');
    });
  });

  it('coalesces concurrent pageQuery and filesQuery waiters onto in-flight bootstrap without firing duplicate API requests', async () => {
    const payload = createSampleBootstrapPayload();
    let resolveBoot!: (val: EditorBootstrapResponseDto) => void;
    vi.spyOn(pagesService.bootstrap, 'getEditorBootstrap').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBoot = resolve;
        }),
    );
    vi.spyOn(pagesService.compiler, 'fetchArtifactBlobUrl').mockResolvedValue(null);
    vi.spyOn(syncedDocCacheStore, 'put').mockResolvedValue();
    const getByIdSpy = vi.spyOn(pagesService.docs, 'getById');
    const getFilesSpy = vi.spyOn(pagesService.docs, 'getFiles');

    const rootId = payload.workspace.rootDocId;
    const bootPromise = queryClient.fetchQuery(editorBootstrapQuery(queryClient, rootId));
    const concurrentPagePromise = queryClient.fetchQuery(pageQuery(rootId));
    const concurrentFilesPromise = queryClient.fetchQuery(filesQuery(rootId));

    resolveBoot(payload);

    const [bootRes, pageRes, filesRes] = await Promise.all([
      bootPromise,
      concurrentPagePromise,
      concurrentFilesPromise,
    ]);

    expect(bootRes?.workspace.rootDocId).toBe(rootId);
    expect(pageRes.id).toBe(rootId);
    expect(filesRes).toHaveLength(2);
    expect(getByIdSpy).not.toHaveBeenCalled();
    expect(getFilesSpy).not.toHaveBeenCalled();
  });

  it('never overwrites an unsaved dirty local buffer in LRUDocumentCache during bootstrap hydration', async () => {
    const payload = createSampleBootstrapPayload();
    const docId = payload.activeDoc.page.id;

    lruDocumentCache.registerModel(docId, {
      content: 'Unsaved local draft edits',
      filePath: 'main.tex',
      projectId: payload.workspace.spaceId,
    });
    lruDocumentCache.updateContent(docId, 'Unsaved local draft edits v2', true);

    vi.spyOn(pagesService.compiler, 'fetchArtifactBlobUrl').mockResolvedValue(null);
    const snapshotSpy = vi.spyOn(syncedDocCacheStore, 'put');

    hydrateEditorBootstrap(queryClient, payload);

    expect(lruDocumentCache.isDirty(docId)).toBe(true);
    expect(lruDocumentCache.getContent(docId)).toBe('Unsaved local draft edits v2');
    expect(snapshotSpy).not.toHaveBeenCalled();
  });

  it('isolates personal spaceId cleanly without leaking into projectId when degraded soft branches occur', () => {
    const rootDocId = '22222222-2222-4222-8222-222222222222';
    const userSpaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const basePayload = createSampleBootstrapPayload();
    const payload = createSampleBootstrapPayload({
      workspace: {
        spaceId: userSpaceId,
        spaceType: 'personal',
        pageId: rootDocId,
        rootDocId,
        projectName: null,
        title: 'Personal Draft',
        mainFilePath: 'main.tex',
        permissions: {
          role: 'owner',
          canEdit: true,
          canCompile: true,
        },
        githubLink: null,
      },
      activeDoc: {
        ...basePayload.activeDoc,
        page: {
          ...basePayload.activeDoc.page,
          projectId: userSpaceId,
        },
      },
      symbols: null,
      lastBuild: {
        status: 'uncompiled',
        pdfArtifactUrl: null,
        synctexAvailable: false,
        lastCompiledAt: null,
        diagnostics: [],
      },
      degraded: true,
      degradedBranches: ['symbols', 'lastBuild'],
    });

    vi.spyOn(syncedDocCacheStore, 'put').mockResolvedValue();

    hydrateEditorBootstrap(queryClient, payload);

    const cachedPersonalPage = queryClient.getQueryData(
      pageKeys.detail(rootDocId),
    ) as { projectId: string };
    expect(cachedPersonalPage.projectId).toBe('');
    expect(usePageStore.getState().spaceId).toBe(userSpaceId);
    expect(usePageStore.getState().projectId).toBe('');
    expect(usePageStore.getState().permissions?.role).toBe('owner');
    expect(useCompileStore.getState().compileDiagnostics).toEqual([]);
    expect(useCompileStore.getState().pdfUrl).toBeNull();
  });

  it('uses page-scoped /pages/:pageId/... endpoints by default for artifacts and server symbol hydration', async () => {
    const pageId = '44444444-4444-4444-8444-444444444444';
    const payload = createSampleBootstrapPayload();

    expect(pagesService.compiler.downloadAuxFileUrl(pageId, 'output.log')).toBe(
      `${PAGES_API_BASE}/pages/${pageId}/artifacts/output.log`,
    );
    expect(pagesService.compiler.downloadAllArtifactsZipUrl(pageId)).toBe(
      `${PAGES_API_BASE}/pages/${pageId}/artifacts-zip`,
    );

    const getSymbolsSpy = vi
      .spyOn(pagesService.structure, 'getSymbols')
      .mockResolvedValue(payload.symbols);

    const snapshot = await latexSymbolsIndex.hydrateFromServer(pageId);

    expect(getSymbolsSpy).toHaveBeenCalledTimes(1);
    expect(getSymbolsSpy).toHaveBeenCalledWith(pageId);
    expect(snapshot).not.toBeNull();
    expect(latexSymbolsIndex.hasHydratedProject(pageId)).toBe(true);
    expect(latexSymbolsIndex.getLabels('overview')).toHaveLength(1);
  });

  it('synthesizes an offline bootstrap payload from IndexedDB snapshots and newer dirty drafts on network failure', async () => {
    const pageId = '55555555-5555-4555-8555-555555555551';
    const spaceId = '55555555-5555-4555-8555-555555555550';

    await syncedDocCacheStore.put({
      id: pageId,
      projectId: spaceId,
      title: 'Offline Paper Title',
      content: 'Server baseline content',
      filePath: 'main.tex',
      updatedAt: Date.now() - 5000,
    });
    await unsyncedEditsStore.save(
      pageId,
      'Offline edited LaTeX body',
      spaceId,
      'Offline Paper Title',
    );

    vi.spyOn(pagesService.bootstrap, 'getEditorBootstrap').mockRejectedValue(
      new Error('Failed to fetch'),
    );

    const result = await queryClient.fetchQuery(
      editorBootstrapQuery(queryClient, pageId),
    );

    expect(result).not.toBeNull();
    expect(result?.degraded).toBe(true);
    expect(result?.degradedBranches).toEqual(['symbols', 'lastBuild']);
    expect(result?.workspace.spaceId).toBe(spaceId);
    expect(result?.workspace.pageId).toBe(pageId);
    expect(result?.workspace.title).toBe('Offline Paper Title');
    expect(lruDocumentCache.getContent(pageId)).toBe('Offline edited LaTeX body');
    expect(lruDocumentCache.isDirty(pageId)).toBe(true);
    expect(usePageStore.getState().workspaceTitle).toBe('Offline Paper Title');
  });

  it('preserves unopened sibling docs, empty folders, and assets during offline synthesis when pageId !== rootDocId && pageId !== spaceId', async () => {
    const spaceId = 'space-multi-1';
    const pageId = 'page-multi-2';
    const rootDocId = 'doc-root-3';
    const siblingDocId = 'doc-sibling-4';

    const onlinePayload = createSampleBootstrapPayload({
      workspace: {
        spaceId,
        pageId,
        rootDocId,
        projectId: null,
        projectName: null,
        title: 'Multi-Page Manuscript',
        mainFilePath: 'main.tex',
        permissions: { role: 'owner', canEdit: true, canCompile: true },
        githubLink: null,
      },
      tree: [
        {
          id: 'node-root',
          projectId: spaceId,
          pageId,
          parentId: null,
          type: 'DOC',
          name: 'main.tex',
          path: '/main.tex',
          docId: rootDocId,
          fileId: null,
          isRootDoc: true,
          sizeBytes: 120,
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'node-sibling-unopened',
          projectId: spaceId,
          pageId,
          parentId: null,
          type: 'DOC',
          name: 'intro.tex',
          path: '/chapters/intro.tex',
          docId: siblingDocId,
          fileId: null,
          isRootDoc: false,
          sizeBytes: 240,
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'node-empty-folder',
          projectId: spaceId,
          pageId,
          parentId: null,
          type: 'FOLDER',
          name: 'appendix',
          path: '/appendix',
          docId: null,
          fileId: null,
          isRootDoc: false,
          sizeBytes: 0,
          sortOrder: 2,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'node-binary-asset',
          projectId: spaceId,
          pageId,
          parentId: null,
          type: 'FILE',
          name: 'diagram.png',
          path: '/figures/diagram.png',
          docId: null,
          fileId: 'file-asset-5',
          isRootDoc: false,
          sizeBytes: 4096,
          sortOrder: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      activeDoc: {
        id: rootDocId,
        nodeId: 'node-root',
        page: {
          id: rootDocId,
          title: 'main.tex',
          content: '\\documentclass{article}\n\\begin{document}\nMulti-page offline content\n\\end{document}',
          path: '/main.tex',
          status: 'published',
          projectId: spaceId,
          mainFile: { id: rootDocId, title: 'main.tex' },
          mainFileId: rootDocId,
          rootPageId: rootDocId,
          version: 1,
          rev: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        lines: ['\\documentclass{article}', '\\begin{document}', 'Multi-page offline content', '\\end{document}'],
        version: 1,
        rev: 1,
        ranges: {},
        fallbackToRoot: false,
      },
    });

    vi.spyOn(pagesService.compiler, 'fetchArtifactBlobUrl').mockResolvedValue(null);
    hydrateEditorBootstrap(queryClient, onlinePayload, pageId);

    // Simulate reload while offline (clear QueryClient and RAM LRU, keep IndexedDB/localStorage snapshot)
    const qcOffline = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    lruDocumentCache.clearAll();
    vi.spyOn(pagesService.bootstrap, 'getEditorBootstrap').mockRejectedValue(
      new Error('Failed to fetch'),
    );

    const offlineResult = await qcOffline.fetchQuery(editorBootstrapQuery(qcOffline, pageId));
    expect(offlineResult).not.toBeNull();
    expect(offlineResult?.workspace.spaceId).toBe(spaceId);
    expect(offlineResult?.workspace.pageId).toBe(pageId);
    expect(offlineResult?.workspace.rootDocId).toBe(rootDocId);
    expect(offlineResult?.tree.map((n) => n.path)).toEqual([
      '/main.tex',
      '/chapters/intro.tex',
      '/appendix',
      '/figures/diagram.png',
    ]);
    expect(offlineResult?.tree.find((n) => n.id === 'node-empty-folder')?.type).toBe('FOLDER');
    expect(offlineResult?.tree.find((n) => n.id === 'node-binary-asset')?.type).toBe('FILE');
    expect(lruDocumentCache.getContent(rootDocId)).toContain('Multi-page offline content');
  });
});
