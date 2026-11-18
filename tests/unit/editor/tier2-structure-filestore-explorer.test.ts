import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  MANUSCRIPTS_API_BASE,
  filestore,
  structure,
} from '@/features/editor/sdk/pages.service';
import { hydrateEditorBootstrap } from '@/features/editor/ui/hooks/document.queries';
import {
  WorkspaceCoordinator,
  SessionCoordinator,
  sessionCoordinator,
  usePageStore,
  useWorkspaceStore,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';
import type { EditorBootstrapResponseDto } from '@/features/editor/sdk/pages/types';
import type {
  WorkspaceServicePort,
  WorkspaceNotificationPort,
  WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';

describe('Khối 2 / Tầng 2 — Virtual Tree SDK, Explorer Safety & Filestore Hardening', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    lruDocumentCache.clearAll();
    usePageStore.getState().resetPageState();
    useWorkspaceStore.setState({ tabsByProject: {}, activeByProject: {} });
    await draftStorageService.clearMutations();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('routes Personal vs Project Space filestore stream URLs cleanly and prefixes nested parentId in uploadPageFile', async () => {
    // Project Space: distinct spaceId & pageId -> /spaces/:spaceId/files/:fileId?pageId=:pageId
    expect(filestore.getStreamUrl('space-1', 'file-1', 'page-2')).toBe(
      `${MANUSCRIPTS_API_BASE}/spaces/space-1/files/file-1?pageId=page-2`,
    );

    // Personal Space: store spaceId differs from active rootPageId
    usePageStore.getState().setWorkspaceContext({ spaceId: 'user-personal' });
    usePageStore.getState().setRootPageId('page-personal');
    expect(filestore.getStreamUrl('page-personal', 'file-9')).toBe(
      `${MANUSCRIPTS_API_BASE}/pages/page-personal/files/file-9`,
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
      `${MANUSCRIPTS_API_BASE}/spaces/space-1/files/file-uploaded?pageId=page-2`,
    );
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

  it('preserves FOLDER and FILE items across space/page scopes in initProjectSymbols and updates activeFilePage/selectedAsset/snapshots on rename', async () => {
    const mockService: WorkspaceServicePort = {
      createNode: vi.fn(),
      renameNode: vi.fn().mockResolvedValue({ success: true }),
      deleteNode: vi.fn().mockResolvedValue({ success: true }),
      moveNode: vi.fn().mockResolvedValue({ success: true }),
      restoreFile: vi.fn(),
      setRootDoc: vi.fn(),
      getFilesByProjectId: vi.fn().mockResolvedValue([]),
      updateFileContent: vi.fn(),
    };
    const mockNotification: WorkspaceNotificationPort = {
      notifySuccess: vi.fn(),
      notifyError: vi.fn(),
      notifyInfo: vi.fn(),
    };
    const mockStore: WorkspaceStorePort = {
      getActiveProjectId: vi.fn().mockReturnValue('page-x'),
      closeTab: vi.fn(),
      updateTabTitle: vi.fn(),
      setMainFile: vi.fn(),
      getActiveDocumentId: vi.fn().mockReturnValue('doc-sec1'),
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

    // Prepare activeFilePage, asset tab, selectedAsset, and projectFileSnapshot before folder rename
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
    await draftStorageService.saveProjectFileSnapshot({
      id: 'doc-sec1',
      projectId: 'page-x',
      title: 'sections/intro.tex',
      filePath: 'sections/intro.tex',
      content: 'hello',
      updatedAt: Date.now(),
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
    const updatedSnap = await draftStorageService.getProjectFileSnapshot('doc-sec1');
    expect(updatedSnap?.filePath).toBe('chapters/intro.tex');

    // Protected Root Document & folder deletion blocked without hitting backend
    expect(await coordinator.deleteFile('doc-main', 'page-x')).toBe(false);
    expect(mockService.deleteNode).not.toHaveBeenCalled();

    // Deleting non-root folder cancels autosave timers, deletes cleanly, and evicts descendants & offline mutations
    await draftStorageService.enqueueMutation({
      fileId: 'doc-sec1',
      projectId: 'page-x',
      type: 'update_content',
      payload: { content: 'unsaved' },
    });
    const cancelSpy = vi.spyOn(sessionCoordinator, 'cancelPendingAutoSave');
    expect(await coordinator.deleteFile('folder-sec', 'page-x')).toBe(true);
    expect(cancelSpy).toHaveBeenCalledWith('doc-sec1');
    const pendingAfterDelete = await draftStorageService.getPendingMutations();
    expect(pendingAfterDelete.some((m) => m.fileId === 'doc-sec1')).toBe(false);
  });

  it('purges offline mutations in SessionCoordinator.evictDeletedFile', async () => {
    const sc = new SessionCoordinator({
      persistenceAdapter: { updateContent: vi.fn() },
    });
    await draftStorageService.enqueueMutation({
      fileId: 'del-mut-doc',
      projectId: 'p1',
      type: 'update_content',
      payload: { content: 'stale offline' },
    });

    sc.evictDeletedFile('del-mut-doc');
    await vi.runAllTimersAsync();

    const remaining = await draftStorageService.getPendingMutations();
    expect(remaining.some((m) => m.fileId === 'del-mut-doc')).toBe(false);
  });
});
