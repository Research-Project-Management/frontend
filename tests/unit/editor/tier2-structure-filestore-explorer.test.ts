import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  PAGES_API_BASE,
  filestore,
  structure,
  pagesService,
  mapStructureNodesToStorageItems,
} from '@/features/editor/sdk/pages.service';
import { hydrateEditorBootstrap } from '@/features/editor/core/queries/document.queries';
import {
  WorkspaceCoordinator,
  SessionCoordinator,
  sessionCoordinator,
  usePageStore,
  useWorkspaceStore,
} from '@/features/editor/core';
import {
  buildFileTree,
  filterFileTree,
  flattenVisibleTree,
  findAncestorFolderPaths,
  getFileIcon,
  lruDocumentCache,
} from '@/features/editor/subsystems/explorer';
import type { EditorBootstrapResponseDto } from '@/features/editor/sdk/pages/types';
import type {
  WorkspaceServicePort,
  WorkspaceNotificationPort,
  WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';

describe('Khối 2 / Tầng 2 — Virtual Tree SDK, Explorer Seam & Filestore Hardening', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lruDocumentCache.clearAll();
    sessionCoordinator.resetSession();
    usePageStore.getState().resetPageState();
    useWorkspaceStore.setState({ tabsByProject: {}, activeByProject: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('routes Personal vs Project Space filestore stream URLs cleanly and prefixes nested parentId in uploadPageFile', async () => {
    // Project Space: distinct spaceId & pageId -> /spaces/:spaceId/files/:fileId?pageId=:pageId
    expect(filestore.getStreamUrl('space-1', 'file-1', 'page-2')).toBe(
      `${PAGES_API_BASE}/spaces/space-1/files/file-1?pageId=page-2`,
    );

    // Personal Space: store spaceId differs from active rootPageId
    usePageStore.getState().setWorkspaceContext({ spaceId: 'user-personal' });
    usePageStore.getState().setRootPageId('page-personal');
    expect(filestore.getStreamUrl('page-personal', 'file-9')).toBe(
      `${PAGES_API_BASE}/pages/page-personal/files/file-9`,
    );

    const uploadSpy = vi.spyOn(filestore, 'upload').mockResolvedValue({
      id: 'file-uploaded',
      projectId: 'space-1',
      spaceId: 'space-1',
      pageId: 'page-2',
      name: 'figures/plot.png',
      filename: 'figures/plot.png',
      path: '/figures/plot.png',
      sizeBytes: 12,
      hash: 'abc',
      mimeType: 'image/png',
      createdAt: '2026-07-01T00:00:00Z',
    });

    const nodeLookupSpy = vi.spyOn(structure, 'getNodeById').mockResolvedValue({
      id: 'folder-uuid-1',
      projectId: 'space-1',
      pageId: 'page-2',
      name: 'figures',
      path: '/figures',
      type: 'FOLDER',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    });

    const file = new File(['png-bytes'], 'plot.png', { type: 'image/png' });
    const item = await filestore.uploadPageFile(
      'page-2',
      file,
      'folder-uuid-1',
      undefined,
      'space-1',
    );

    expect(nodeLookupSpy).toHaveBeenCalledWith('page-2', 'folder-uuid-1');
    expect(uploadSpy).toHaveBeenCalledWith('space-1', file, 'figures/plot.png', 'page-2');
    expect(item.spaceId).toBe('space-1');
    expect(item.pageId).toBe('page-2');
    expect(item.url).toBe(
      `${PAGES_API_BASE}/spaces/space-1/files/file-uploaded?pageId=page-2`,
    );
  });

  it('assembles structure nodes through explorer public seam (buildFileTree, findAncestorFolderPaths, flattenVisibleTree, getFileIcon)', () => {
    usePageStore.getState().setWorkspaceContext({ spaceId: 'space-1' });
    usePageStore.getState().setRootPageId('page-1');

    const storageItems = mapStructureNodesToStorageItems(
      [
        {
          id: 'node-main',
          spaceId: 'space-1',
          pageId: 'page-1',
          name: 'main.tex',
          path: '/main.tex',
          type: 'DOC',
          docId: 'doc-main',
          isRootDoc: true,
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-01T00:00:00Z',
        },
        {
          id: 'folder-figs',
          spaceId: 'space-1',
          pageId: 'page-1',
          name: 'figures',
          path: '/figures',
          type: 'FOLDER',
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-01T00:00:00Z',
        },
        {
          id: 'node-arch',
          spaceId: 'space-1',
          pageId: 'page-1',
          parentId: 'folder-figs',
          name: 'arch.png',
          path: '/figures/arch.png',
          type: 'FILE',
          fileId: 'file-arch',
          sizeBytes: 2048,
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-01T00:00:00Z',
        },
      ],
      'page-1',
    );

    const tree = buildFileTree({
      projectFiles: storageItems,
      parentPageId: 'page-1',
      projectId: 'space-1',
      mainFileId: 'doc-main',
    });

    expect(tree).toHaveLength(2);
    expect(tree[0].type === 'file' && tree[0].id).toBe('doc-main');
    expect(tree[1].type === 'folder' && tree[1].fullPath).toBe('figures');
    expect(findAncestorFolderPaths(tree, 'asset:file-arch')).toEqual(['figures']);

    const collapsedFlat = flattenVisibleTree(tree, () => false);
    expect(collapsedFlat).toHaveLength(2);

    const expandedFlat = flattenVisibleTree(tree, () => true);
    expect(expandedFlat).toHaveLength(3);
    expect(filterFileTree(tree, 'arch')).toHaveLength(1);
    expect(getFileIcon('paper.tex').icon).toBeDefined();
  });

  it('separates rootPageId (workspace.pageId) from rootDocId (workspace.rootDocId) in hydrateEditorBootstrap', () => {
    const queryClient = new QueryClient();
    const bootstrap: EditorBootstrapResponseDto = {
      workspace: {
        spaceId: 'space-1',
        spaceType: 'project',
        pageId: 'page-container-1',
        rootDocId: 'doc-switched-main',
        projectName: 'Research',
        title: 'Paper',
        mainFilePath: 'chapters/paper.tex',
        permissions: { role: 'owner', canEdit: true, canCompile: true },
        githubLink: null,
      },
      tree: [],
      activeDoc: {
        id: 'doc-switched-main',
        page: {
          id: 'doc-switched-main',
          title: 'paper.tex',
          content: '\\documentclass{article}',
          status: 'published',
          projectId: 'space-1',
          mainFile: { id: 'doc-switched-main', title: 'chapters/paper.tex' },
          mainFileId: 'doc-switched-main',
          rootPageId: 'page-container-1',
          version: 1,
          rev: 1,
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-01T00:00:00Z',
        },
        lines: ['\\documentclass{article}'],
        version: 1,
        rev: 1,
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
      serverTimestamp: '2026-07-01T00:00:00Z',
    };

    hydrateEditorBootstrap(queryClient, bootstrap);

    expect(usePageStore.getState().rootPageId).toBe('page-container-1');
    expect(usePageStore.getState().parentPageId).toBe('page-container-1');
    expect(usePageStore.getState().rootDocId).toBe('doc-switched-main');
  });

  it('preserves FOLDER and FILE items across space/page scopes in initProjectSymbols and cascades folder rename & delete across RAM LRU cache and tabs', async () => {
    const mockService: WorkspaceServicePort = {
      createNode: vi.fn(),
      renameNode: vi.fn().mockResolvedValue({ success: true }),
      deleteNode: vi.fn().mockResolvedValue({ success: true }),
      moveNode: vi.fn().mockResolvedValue({ success: true }),
      restoreFile: vi.fn(),
      setRootDoc: vi.fn(),
    };
    const mockNotification: WorkspaceNotificationPort = {
      notifySuccess: vi.fn(),
      notifyError: vi.fn(),
    };
    const mockStore: WorkspaceStorePort = {
      getActiveProjectId: vi.fn().mockReturnValue('page-x'),
      closeTab: vi.fn(),
      updateTabTitle: vi.fn(),
      setMainFile: vi.fn(),
    };
    const coordinator = new WorkspaceCoordinator({
      service: mockService,
      notification: mockNotification,
      store: mockStore,
    });

    usePageStore.getState().setRootPageId('page-x');
    usePageStore.getState().setRootDocId('doc-main');

    coordinator.syncStructureItems(
      [
        {
          id: 'folder-sec',
          nodeId: 'folder-sec',
          pageId: 'page-x',
          projectId: 'space-x',
          filename: 'sections',
          path: 'sections',
          isFolder: true,
          nodeType: 'FOLDER',
        },
        {
          id: 'asset-fig',
          nodeId: 'asset-fig',
          pageId: 'page-x',
          projectId: 'space-x',
          fileId: 'asset-fig',
          filename: 'sections/fig.png',
          path: 'sections/fig.png',
          isFolder: false,
          nodeType: 'FILE',
        },
        {
          id: 'node-main',
          nodeId: 'node-main',
          pageId: 'page-x',
          docId: 'doc-main',
          filename: 'main.tex',
          path: 'main.tex',
          isFolder: false,
          isRootDoc: true,
          nodeType: 'DOC',
        },
      ],
      'page-x',
    );

    // Calling initProjectSymbols with space-x must NOT wipe FOLDER or FILE items from page-x
    coordinator.initProjectSymbols(
      [
        {
          id: 'doc-sec1',
          docId: 'doc-sec1',
          pageId: 'page-x',
          projectId: 'space-x',
          title: 'sections/intro.tex',
          path: 'sections/intro.tex',
        },
      ],
      'space-x',
    );

    usePageStore.getState().setActiveFilePage({
      id: 'doc-sec1',
      title: 'sections/intro.tex',
      path: 'sections/intro.tex',
      pageId: 'page-x',
    });
    usePageStore.getState().setSelectedAsset({
      id: 'asset-fig',
      filename: 'sections/fig.png',
    });
    useWorkspaceStore.getState().openTab('page-x', {
      id: 'asset:asset-fig',
      title: 'sections/fig.png',
      path: 'sections/fig.png',
      isDirty: false,
    });
    lruDocumentCache.registerModel('doc-sec1', {
      content: 'hello',
      filePath: 'sections/intro.tex',
      projectId: 'page-x',
    });

    await coordinator.renameItem({
      itemId: 'folder-sec',
      oldName: 'sections',
      newName: 'chapters',
      projectId: 'page-x',
    });

    expect(usePageStore.getState().activeFilePage?.path).toBe('chapters/intro.tex');
    expect(usePageStore.getState().selectedAsset?.filename).toBe('chapters/fig.png');
    expect(
      useWorkspaceStore
        .getState()
        .tabsByProject['page-x']?.find((t) => t.id === 'asset:asset-fig')?.title,
    ).toBe('chapters/fig.png');
    expect(lruDocumentCache.getModel('doc-sec1')?.filePath).toBe('chapters/intro.tex');

    // Protected Root Document deletion blocked without hitting backend
    expect(await coordinator.deleteFile('doc-main', 'page-x')).toBe(false);
    expect(mockService.deleteNode).not.toHaveBeenCalled();

    // Deleting non-root folder cancels autosave timers and evicts descendants from RAM LRU cache
    const cancelSpy = vi.spyOn(sessionCoordinator, 'cancelPendingAutoSave');
    expect(await coordinator.deleteFile('folder-sec', 'page-x')).toBe(true);
    expect(cancelSpy).toHaveBeenCalledWith('doc-sec1');
    expect(lruDocumentCache.getModel('doc-sec1')).toBeUndefined();
  });

  it('cancels pending autosaves and clears session state in SessionCoordinator.evictDeletedFile', async () => {
    const updateContent = vi.fn().mockResolvedValue({ rev: 2 });
    const sc = new SessionCoordinator({
      persistenceAdapter: { updateContent },
      autoSaveDelay: 100,
    });

    lruDocumentCache.registerModel('del-mut-doc', {
      content: 'initial',
      filePath: 'draft.tex',
      projectId: 'p1',
    });
    sc.notifyContentChange('del-mut-doc', 'unsaved edit', { skipAutoCompile: true });
    expect(sc.getFsmState('del-mut-doc')).toBe('dirty');

    sc.evictDeletedFile('del-mut-doc');
    await vi.runAllTimersAsync();

    expect(updateContent).not.toHaveBeenCalled();
    expect(sc.getFsmState('del-mut-doc')).toBe('idle');
  });

  it('routes Personal vs Project Space search and batchReplace endpoints with pageId', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { results: [], totalMatches: 0, totalFilesMatched: 0, truncated: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { totalFilesAffected: 1, totalOccurrencesReplaced: 2, affectedFileIds: ['doc-1'] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await pagesService.search.search('personal', '\\cite', { pageId: 'page-personal-1' });
    await pagesService.search.batchReplace('space-proj-1', 'foo', 'bar', { pageId: 'page-proj-1' });

    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      `${PAGES_API_BASE}/pages/page-personal-1/search`,
    );
    expect(String(fetchSpy.mock.calls[1][0])).toContain(
      `${PAGES_API_BASE}/spaces/space-proj-1/replace`,
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toMatchObject({
      query: 'foo',
      replaceWith: 'bar',
      pageId: 'page-proj-1',
    });
  });
});
