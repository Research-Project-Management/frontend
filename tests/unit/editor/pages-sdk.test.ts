import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  SessionCoordinator,
  resolvePageScope,
  buildPageScopeHref,
  resolveEditorScopeFromState,
  usePageStore,
  useSettingsStore,
  pagesService,
} from '@/features/editor/core';
import { normalizeSpellCheckLanguage } from '@/features/editor/core/store/settings.store';
import { hydrateEditorBootstrap } from '@/features/editor/core/queries/bootstrap.queries';
import { pageKeys } from '@/features/editor/core/queries/document.queries';
import { buildPageEditorHref } from '@/features/pages/utils/page-url';
import { resolveCitationScope } from '@/features/editor/subsystems/citation';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import * as providerPool from '@/features/editor/sdk/realtime/provider-pool';
import { gitApi } from '@/features/editor/sdk/pages/git.client';
import { templatesApi } from '@/features/editor/sdk/pages/templates.client';
import { suggestLatexFix } from '@/features/editor/sdk/pages.service';
import type { EditorBootstrapResponseDto } from '@/features/editor/sdk/pages/types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Pages SDK, PageScope Resolution, Git, Templates, Spelling & AI Heuristics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lruDocumentCache.clear();
    usePageStore.getState().resetPageState();
    providerPool.clearYjsProviderPool({ skipFlush: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    providerPool.clearYjsProviderPool({ skipFlush: true });
  });

  describe('1. Envelope-Safe SDK Unwrapping & Query Keys ({ success: true, data: T })', () => {
    it('filestore.upload unwraps TransformInterceptor envelope and populates id/nodeId/fileId', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse(
          {
            success: true,
            data: {
              id: 'file-uuid-1',
              nodeId: 'node-uuid-1',
              fileId: 'file-uuid-1',
              spaceId: 'proj-1',
              projectId: 'proj-1',
              pageId: 'page-1',
              name: 'figure1.png',
              filename: 'figure1.png',
              path: '/figures/figure1.png',
              sizeBytes: 1024,
              mimeType: 'image/png',
            },
          },
          201,
        ),
      );

      const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'figure1.png', {
        type: 'image/png',
      });
      const result = await pagesService.filestore.upload(
        'proj-1',
        file,
        'figures/figure1.png',
        'page-1',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('file-uuid-1');
      expect(result.nodeId).toBe('node-uuid-1');
      expect(result.fileId).toBe('file-uuid-1');
      expect(result.path).toBe('/figures/figure1.png');
    });

    it('export.importZip & convertDocument unwrap envelope and omit/append ?pageId cleanly', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          jsonResponse(
            {
              success: true,
              data: {
                pageId: 'created-page-1',
                rootDocId: 'root-doc-1',
                title: 'New Imported Paper',
                totalDocs: 3,
                totalFiles: 2,
                skippedFiles: ['ignored.DS_Store'],
              },
            },
            201,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              success: true,
              data: {
                pageId: 'existing-page-2',
                rootDocId: 'root-doc-2',
                totalDocs: 1,
                totalFiles: 0,
                skippedFiles: [],
              },
            },
            201,
          ),
        );

      const zipBlob = new File(['PK\x03\x04dummy'], 'paper.zip', { type: 'application/zip' });
      const created = await pagesService.export.importZip('personal', zipBlob);

      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/spaces/personal/import/zip');
      expect(String(fetchSpy.mock.calls[0]?.[0])).not.toContain('pageId=');
      expect(created.pageId).toBe('created-page-1');
      expect(created.rootDocId).toBe('root-doc-1');
      expect(created.skippedFiles).toEqual(['ignored.DS_Store']);

      const docxBlob = new File(['docx-bytes'], 'draft.docx');
      const hydrated = await pagesService.export.convertDocument('proj-77', docxBlob, {
        format: 'docx',
        pageId: 'existing-page-2',
      });

      const secondUrl = String(fetchSpy.mock.calls[1]?.[0]);
      expect(secondUrl).toContain('/spaces/proj-77/import/convert');
      expect(secondUrl).toContain('format=docx');
      expect(secondUrl).toContain('pageId=existing-page-2');
      expect(hydrated.pageId).toBe('existing-page-2');
    });

    it('compiler.listAuxFiles unwraps { success, data: { files } } and pageKeys.deletedFiles exposes canonical key', async () => {
      expect('getMetricsSummary' in pagesService.compiler).toBe(false);
      expect(pageKeys.deletedFiles('proj-page-123')).toEqual([
        'pages',
        'detail',
        'proj-page-123',
        'deleted-files',
      ]);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            files: [
              { name: 'output.log', size: 256 },
              { name: 'output.aux', size: 64 },
            ],
          },
        }),
      );

      const auxFiles = await pagesService.compiler.listAuxFiles('page-aux-1');
      expect(auxFiles).toEqual([
        { name: 'output.log', size: 256 },
        { name: 'output.aux', size: 64 },
      ]);
    });
  });

  describe('2. PageScope & Personal vs Project URL / Library Scope Resolution', () => {
    const userUuid = '550e8400-e29b-41d4-a716-446655440000';
    const projectUuid = '990e8400-e29b-41d4-a716-446655440999';

    it('resolves Personal Space to libraryScope="user" and /pages/:id even when spaceId is user.id UUID', () => {
      expect(
        resolvePageScope({
          spaceType: 'personal',
          spaceId: userUuid,
          pageId: 'page-personal-1',
        }),
      ).toEqual({
        spaceKind: 'personal',
        spaceId: userUuid,
        projectId: '',
        routeSpaceParam: 'personal',
        libraryScope: 'user',
        pageId: 'page-personal-1',
      });

      const citationScope = resolveCitationScope({
        spaceType: 'personal',
        propProjectId: userUuid,
        storeSpaceId: userUuid,
        pageId: 'page-personal-1',
      });
      expect(citationScope.libraryScope).toBe('user');
      expect(citationScope.spaceId).toBe(userUuid);
      expect(citationScope.pageId).toBe('page-personal-1');

      expect(
        resolveCitationScope({
          spaceType: 'personal',
          pageId: 'page-personal-1',
        }),
      ).toEqual({
        spaceId: 'personal',
        libraryScope: 'user',
        pageId: 'page-personal-1',
      });

      expect(buildPageEditorHref('page-personal-1', { spaceKind: 'personal' })).toBe(
        '/pages/page-personal-1',
      );
      expect(
        buildPageEditorHref('page-personal-1', { spaceKind: 'personal', subpath: 'history' }),
      ).toBe('/pages/page-personal-1/history');
      expect(
        buildPageEditorHref('page-personal-1', { spaceKind: 'personal', subpath: 'preview' }),
      ).toBe('/pages/page-personal-1/preview');
    });

    it('resolves Project Space to libraryScope=projectId and /projects/:projectId/pages/:id', () => {
      expect(
        resolvePageScope({
          spaceKind: 'project',
          projectId: projectUuid,
          pageId: 'page-proj-1',
        }),
      ).toEqual({
        spaceKind: 'project',
        spaceId: projectUuid,
        projectId: projectUuid,
        routeSpaceParam: projectUuid,
        libraryScope: projectUuid,
        pageId: 'page-proj-1',
      });

      expect(
        buildPageScopeHref('page-proj-1', { spaceKind: 'project', projectId: projectUuid }),
      ).toBe(`/projects/${projectUuid}/pages/page-proj-1`);
      expect(
        buildPageScopeHref('page-proj-1', {
          spaceKind: 'project',
          projectId: projectUuid,
          subpath: 'history',
        }),
      ).toBe(`/projects/${projectUuid}/pages/page-proj-1/history`);
      expect(
        buildPageScopeHref('page-proj-1', {
          spaceKind: 'project',
          projectId: projectUuid,
          subpath: 'preview',
        }),
      ).toBe(`/projects/${projectUuid}/preview?pageId=page-proj-1`);

      const editorScope = resolveEditorScopeFromState({
        spaceType: 'personal',
        spaceId: userUuid,
        projectId: '',
        rootPageId: 'page-personal-1',
      });
      expect(editorScope.spaceKind).toBe('personal');
      expect(editorScope.libraryScope).toBe('user');
      expect(editorScope.routeSpaceParam).toBe('personal');
    });

    it('forwards pageId query parameter on citations.list', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ success: true, data: { items: [], total: 0 } }));

      await pagesService.citations.list(projectUuid, 'transformer', 25, 'page-multi-2');
      const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
      expect(calledUrl).toContain(`/spaces/${projectUuid}/citations?`);
      expect(calledUrl).toContain('query=transformer');
      expect(calledUrl).toContain('pageId=page-multi-2');
    });
  });

  describe('3. SessionCoordinator.isRealtimeConnected & Bootstrap Hydration', () => {
    it('passes (fileId, projectId) to getActiveYjsProvider so live Yjs sync suppresses HTTP autosave split-brain', () => {
      const projectId = 'proj-yjs-1';
      const fileId = 'doc-file-yjs-1';

      const provider = providerPool.getOrCreateYjsProvider(projectId, fileId);
      provider.isSynced = true;

      lruDocumentCache.registerModel(fileId, {
        content: '\\section{Live Yjs}',
        filePath: 'main.tex',
        projectId,
        yText: provider.yText,
      });

      const lookupSpy = vi.spyOn(providerPool, 'getActiveYjsProvider');
      const coordinator = new SessionCoordinator({
        getProjectId: () => projectId,
      });

      expect(coordinator.isRealtimeConnected(fileId)).toBe(true);
      expect(lookupSpy).toHaveBeenCalledWith(fileId, projectId);
    });

    it('normalizes legacy en_US spellCheckLanguage to BCP-47 en-US and hydrates Page build config from bootstrap', () => {
      expect(normalizeSpellCheckLanguage('en_US')).toBe('en-US');
      expect(normalizeSpellCheckLanguage('en_GB')).toBe('en-GB');
      useSettingsStore.getState().setSpellCheckLanguage('en_US');
      expect(useSettingsStore.getState().spellCheckLanguage).toBe('en-US');

      const qc = new QueryClient();
      const dto: EditorBootstrapResponseDto = {
        workspace: {
          spaceId: 'user-space-1',
          spaceType: 'personal',
          pageId: 'page-vn-1',
          rootDocId: 'doc-vn-1',
          projectName: null,
          title: 'Luận văn',
          mainFilePath: 'main.tex',
          permissions: { role: 'owner', canEdit: true, canCompile: true },
          githubLink: null,
        },
        page: {
          id: 'page-vn-1',
          compiler: 'xelatex',
          texlive: '2024',
          spellLang: 'vi',
        },
        tree: [],
        activeDoc: {
          id: 'doc-vn-1',
          nodeId: 'node-vn-1',
          page: {
            id: 'doc-vn-1',
            title: 'main.tex',
            content: '\\documentclass{article}',
            status: 'draft',
            projectId: '',
            mainFile: { id: 'doc-vn-1', title: 'main.tex' },
            mainFileId: 'doc-vn-1',
            rootPageId: 'page-vn-1',
            version: 1,
            rev: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
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
        serverTimestamp: '2026-01-01T00:00:00.000Z',
      };

      hydrateEditorBootstrap(qc, dto);

      expect(useSettingsStore.getState().engine).toBe('xelatex');
      expect(useSettingsStore.getState().texLiveVersion).toBe('2024');
      expect(useSettingsStore.getState().spellCheckLanguage).toBe('vi');
      expect(usePageStore.getState().pageBuildConfig).toEqual({
        compiler: 'xelatex',
        texlive: '2024',
        spellLang: 'vi',
      });
    });

    it('sends Idempotency-Key header on suggestions and strips markdown fences in generateLatexEquation', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          jsonResponse(
            {
              success: true,
              data: {
                suggestion: {
                  id: 'sug-server-1',
                  pageId: 'doc-1',
                  type: 'insert',
                  originalText: '',
                  suggestedText: 'new text',
                  status: 'pending',
                },
              },
            },
            201,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            success: true,
            data: {
              role: 'assistant',
              content: '```latex\n\\begin{equation}\nE = mc^2\n\\end{equation}\n```',
              chatId: 'chat-1',
            },
          }),
        );

      await pagesService.suggestions.createSuggestion({
        pageId: 'doc-1',
        type: 'insert',
        originalText: '',
        suggestedText: 'new text',
        fromLine: 1,
        fromColumn: 0,
        toLine: 1,
        toColumn: 8,
        idempotencyKey: 'local-sug-123',
        silent: true,
      });

      const [, reqInit] = fetchSpy.mock.calls[0]!;
      const parsedBody = JSON.parse(String(reqInit?.body));
      const headers = reqInit?.headers as Record<string, string>;

      expect(parsedBody).not.toHaveProperty('idempotencyKey');
      expect(parsedBody).not.toHaveProperty('silent');
      expect(headers['Idempotency-Key']).toBe('local-sug-123');

      const latex = await pagesService.ai.generateLatexEquation('Mass-energy equivalence', {
        spaceId: 'personal',
        pageId: 'page-ai-1',
      });

      expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('/api/ai/editor-chat/sync');
      expect(latex).toBe('\\begin{equation}\nE = mc^2\n\\end{equation}');
    });
  });

  describe('4. Git, Templates & Spelling Sub-Clients (Single-Flight & Canonical Endpoints)', () => {
    it('gitApi coalesces concurrent getRepoInfo reads with ?pageId and manages tokens', async () => {
      let resolveRepo!: (res: Response) => void;
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveRepo = resolve;
            }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: 'tok-1',
            label: 'Laptop',
            prefix: 'fluxpat_abcd1234',
            token: 'fluxpat_abcd1234secretvalue9999999999',
            createdAt: '2026-11-28T00:00:00.000Z',
            expiresAt: '2027-11-28T00:00:00.000Z',
            lastUsedAt: null,
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ success: true }));

      const p1 = gitApi.getRepoInfo('space-1', { pageId: 'page-9' });
      const p2 = gitApi.getRepoInfo('space-1', { pageId: 'page-9' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
        '/api/v1/pages/spaces/space-1/git?pageId=page-9',
      );

      const mockInfo = {
        enabled: true,
        repoId: 'page-9',
        cloneUrl: 'http://localhost:18300/git/page-9.git',
        branch: 'main',
        username: 'git',
        canPush: true,
        maxTokens: 10,
        tokens: [],
      };
      resolveRepo(jsonResponse(mockInfo));

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual(mockInfo);
      expect(r2).toEqual(mockInfo);

      const created = await gitApi.createToken('  Laptop  ');
      expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('/api/v1/pages/git/tokens');
      expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual({ label: 'Laptop' });
      expect(created.prefix).toBe('fluxpat_abcd1234');

      const revoked = await gitApi.revokeToken('tok-1');
      expect(String(fetchSpy.mock.calls[2]?.[0])).toContain('/api/v1/pages/git/tokens/tok-1');
      expect(revoked).toEqual({ success: true });
    });

    it('templatesApi coalesces concurrent list() reads and routes getById, publish, instantiate, and remove', async () => {
      let resolveList!: (res: Response) => void;
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveList = resolve;
            }),
        )
        .mockResolvedValueOnce(jsonResponse({ id: 'ieee-transactions', files: [] }))
        .mockResolvedValueOnce(jsonResponse({ id: 'custom-1', files: [] }))
        .mockResolvedValueOnce(
          jsonResponse({
            pageId: 'page-789',
            spaceId: 'space-123',
            isPersonal: false,
            rootDocId: 'page-789',
            title: 'Clone Title',
            compiler: 'xelatex',
            texlive: '2025',
            mainFile: 'main.tex',
            createdDocs: 2,
            createdFiles: 1,
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ success: true }));

      const p1 = templatesApi.list({ category: 'conference', search: 'ieee' });
      const p2 = templatesApi.list({ category: 'conference', search: 'ieee' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const listUrl = String(fetchSpy.mock.calls[0]?.[0]);
      expect(listUrl).toContain('/api/v1/pages/templates');
      expect(listUrl).toContain('category=conference');
      expect(listUrl).toContain('search=ieee');

      resolveList(
        jsonResponse({
          templates: [{ id: 't-1', name: 'IEEE Conference' }],
          total: 1,
        }),
      );

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toHaveLength(1);
      expect(r2).toEqual(r1);

      await templatesApi.getById('ieee-transactions');
      expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
        '/api/v1/pages/templates/ieee-transactions',
      );

      await templatesApi.publish({
        pageId: 'page-456',
        name: 'Team Template',
        category: 'journal',
        scope: 'project',
      });
      expect(String(fetchSpy.mock.calls[2]?.[0])).toContain('/api/v1/pages/templates');
      expect(JSON.parse(String(fetchSpy.mock.calls[2]?.[1]?.body))).toEqual({
        pageId: 'page-456',
        name: 'Team Template',
        category: 'journal',
        scope: 'project',
      });

      await templatesApi.instantiate('space-123', 'ieee-transactions', { title: 'Clone Title' });
      expect(String(fetchSpy.mock.calls[3]?.[0])).toContain(
        '/api/v1/pages/spaces/space-123/templates/ieee-transactions/instantiate',
      );

      await templatesApi.remove('custom-1');
      expect(String(fetchSpy.mock.calls[4]?.[0])).toContain('/api/v1/pages/templates/custom-1');
    });

    it('spelling client lists, learns, and unlearns words against space dictionary endpoints', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          jsonResponse({ words: ['antigravity', 'latexmk', 'biber'], count: 3 }),
        )
        .mockResolvedValueOnce(jsonResponse({ success: true, word: 'transformer' }))
        .mockResolvedValueOnce(jsonResponse({ success: true, removed: true, word: 'mistyped' }));

      const words = await pagesService.spelling.listDictionary('proj-1');
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
        '/api/v1/pages/spaces/proj-1/spelling/dictionary',
      );
      expect(words).toEqual(['antigravity', 'latexmk', 'biber']);

      expect(await pagesService.spelling.learnWord('proj-1', 'transformer')).toBe(true);
      expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual({
        word: 'transformer',
      });

      expect(await pagesService.spelling.unlearnWord('proj-1', 'mistyped')).toBe(true);
      expect(String(fetchSpy.mock.calls[2]?.[0])).toContain(
        '/api/v1/pages/spaces/proj-1/spelling/dictionary/mistyped',
      );
    });
  });

  describe('5. Offline Heuristic AI Error Assist (suggestLatexFix)', () => {
    it('returns deterministic offline LaTeX fixes for booktabs, missing $, missing \\item, and mismatched environments', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Test network offline'));

      const booktabsFix = await suggestLatexFix({
        errorMessage: 'Undefined control sequence. \\toprule',
        errorLine: 12,
        detail: '\\toprule',
        surroundingCode: '\\begin{tabular}{cc}\n\\toprule\nA & B \\\\',
      });
      expect(booktabsFix.confidence).toBe('high');
      expect(booktabsFix.explanation).toContain('booktabs');
      expect(booktabsFix.fixedSnippet).toContain('\\usepackage{booktabs}');

      const mathFix = await suggestLatexFix({
        errorMessage: 'Missing $ inserted',
        errorLine: 25,
        detail: '<inserted text> $',
        surroundingCode: 'Value is x_i',
      });
      expect(mathFix.explanation).toContain('math mode');
      expect(mathFix.fixedSnippet).toContain('$');

      const itemFix = await suggestLatexFix({
        errorMessage: "LaTeX Error: Something's wrong--perhaps a missing \\item",
        errorLine: 40,
        surroundingCode: '\\begin{itemize}\nThis is text without item\n\\end{itemize}',
      });
      expect(itemFix.confidence).toBe('high');
      expect(itemFix.fixedSnippet).toContain('\\item');

      const mismatchFix = await suggestLatexFix({
        errorMessage: '\\begin{figure} ended by \\end{table}',
        errorLine: 55,
        surroundingCode: '\\begin{figure}\n\\includegraphics{pic.png}\n\\end{table}',
      });
      expect(mismatchFix.confidence).toBe('high');
      expect(mismatchFix.explanation).toContain('Mismatched environment');
      expect(mismatchFix.fixedSnippet).toBe('\\end{figure}');
    });
  });
});
