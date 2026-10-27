import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  docs,
  structure,
  updater,
  comments,
  history,
  citations,
  templates,
} from '@/features/editor/sdk/manuscript/manuscript-api.client';

const { apiGetMock, apiPostMock, apiPatchMock, apiDeleteMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
  apiPatchMock: vi.fn(),
  apiDeleteMock: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  apiGet: apiGetMock,
  apiPost: apiPostMock,
  apiPut: vi.fn(),
  apiPatch: apiPatchMock,
  apiDelete: apiDeleteMock,
  getAuthToken: () => 'test-token',
  getEffectiveBaseUrl: () => 'http://localhost:4000/api/v1',
}));

describe('Manuscript FE ↔ BE DTO Contract Alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('docs.updateDocLines sends both rev and expectedRev for OCC enforcement', async () => {
    apiPostMock.mockResolvedValueOnce({ modified: true, rev: 5 });

    const res = await docs.updateDocLines('proj-1', 'doc-1', ['\\section{Intro}'], 4);

    expect(apiPostMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/projects/proj-1/docs/doc/doc-1',
      {
        lines: ['\\section{Intro}'],
        rev: 4,
        expectedRev: 4,
      },
    );
    expect(res).toEqual({ modified: true, rev: 5 });
  });

  it('docs.patchDoc normalizes path to name for PatchDocDto compatibility', async () => {
    apiPatchMock.mockResolvedValueOnce({ _id: 'doc-1', name: 'chapters/intro.tex' });

    await docs.patchDoc('proj-1', 'doc-1', { path: 'chapters/intro.tex', deleted: false });

    expect(apiPatchMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/projects/proj-1/docs/doc/doc-1',
      {
        path: 'chapters/intro.tex',
        name: 'chapters/intro.tex',
        deleted: false,
      },
    );
  });

  it('structure.moveNode maps parentId to destParentId for MoveNodeDto compatibility', async () => {
    apiPatchMock.mockResolvedValueOnce({ id: 'node-1', parentId: 'folder-2' });

    await structure.moveNode('proj-1', 'node-1', { parentId: 'folder-2', sortOrder: 1 });

    expect(apiPatchMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/pages/proj-1/structure/nodes/node-1/move',
      {
        parentId: 'folder-2',
        destParentId: 'folder-2',
        sortOrder: 1,
      },
    );
  });

  it('updater.queueUpdate maps legacy docLines/version to QueueUpdateDto lines/clientRev', async () => {
    apiPostMock.mockResolvedValueOnce({ queued: true });

    await updater.queueUpdate('proj-1', 'doc-1', {
      docLines: ['line 1', 'line 2'],
      version: 7,
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/projects/proj-1/updater/doc/doc-1/update',
      expect.objectContaining({
        docLines: ['line 1', 'line 2'],
        lines: ['line 1', 'line 2'],
        version: 7,
        clientRev: 7,
      }),
    );
  });

  it('comments.deleteReply unwraps updated PageComment from { success, comment } response', async () => {
    const mockComment = {
      id: 'thread-1',
      page: 'doc-1',
      content: 'Quote',
      line: 10,
      status: 'open',
      replies: [],
    };
    apiDeleteMock.mockResolvedValueOnce({ success: true, comment: mockComment });

    const result = await comments.deleteReply('doc-1', 'thread-1', 'reply-1');

    expect(apiDeleteMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/docs/doc-1/comments/thread-1/replies/reply-1',
    );
    expect(result).toEqual(mockComment);
  });

  it('history.getContentAt forwards timestamp query param to /docs/:docId/at', async () => {
    apiGetMock.mockResolvedValueOnce({ content: '\\documentclass{article}', timestamp: 1700000000000 });

    const res = await history.getContentAt('doc-1', 1700000000000);

    expect(apiGetMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/docs/doc-1/at?timestamp=1700000000000',
    );
    expect(res.content).toBe('\\documentclass{article}');
  });

  it('citations.syncLibrary maps targetBibFile to targetFilename for SyncLibraryDto compatibility', async () => {
    apiPostMock.mockResolvedValueOnce({ collectionId: 'col-1', syncedCount: 12, filePath: 'refs.bib' });

    await citations.syncLibrary('proj-1', {
      provider: 'zotero',
      collectionId: 'col-1',
      targetBibFile: 'refs.bib',
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/projects/proj-1/citations/sync-library',
      {
        provider: 'zotero',
        collectionId: 'col-1',
        targetBibFile: 'refs.bib',
        targetFilename: 'refs.bib',
      },
    );
  });

  it('templates.list maps skip to offset and forwards search query param', async () => {
    apiGetMock.mockResolvedValueOnce({
      templates: [{ id: 'ieee', name: 'IEEE Journal', title: 'IEEE Journal' }],
    });

    const items = await templates.list({ category: 'academic_journal', search: 'IEEE', limit: 10, skip: 20 });

    expect(apiGetMock).toHaveBeenCalledWith(
      '/api/v1/manuscripts/templates',
      {
        params: {
          category: 'academic_journal',
          search: 'IEEE',
          limit: '10',
          skip: '20',
          offset: '20',
        },
      },
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('IEEE Journal');
  });
});
