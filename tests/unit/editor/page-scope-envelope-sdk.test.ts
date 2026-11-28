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
import { buildPageEditorHref } from '@/features/pages/utils/page-url';
import { resolveCitationScope } from '@/features/editor/subsystems/citation/model/scope';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import * as providerPool from '@/features/editor/sdk/realtime/provider-pool';
import type { EditorBootstrapResponseDto } from '@/features/editor/sdk/pages/types';

describe('Slice F1: Envelope-Safe SDK, PageScope, Citations Scope & SessionCoordinator Yjs', () => {
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

  describe('1. Envelope-Safe SDK Unwrapping ({ success: true, data: T })', () => {
    it('filestore.upload unwraps TransformInterceptor envelope and populates id/nodeId/fileId', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'figure1.png', {
        type: 'image/png',
      });
      const result = await pagesService.filestore.upload('proj-1', file, 'figures/figure1.png', 'page-1');

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
          new Response(
            JSON.stringify({
              success: true,
              data: {
                pageId: 'created-page-1',
                rootDocId: 'root-doc-1',
                title: 'New Imported Paper',
                totalDocs: 3,
                totalFiles: 2,
                skippedFiles: ['ignored.DS_Store'],
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                pageId: 'existing-page-2',
                rootDocId: 'root-doc-2',
                totalDocs: 1,
                totalFiles: 0,
                skippedFiles: [],
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
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

    it('compiler.listAuxFiles unwraps { success, data: { files } } and omits dead getMetricsSummary', async () => {
      expect('getMetricsSummary' in pagesService.compiler).toBe(false);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              files: [
                { name: 'output.log', size: 256 },
                { name: 'output.aux', size: 64 },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
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
      const scope = resolvePageScope({
        spaceType: 'personal',
        spaceId: userUuid,
        pageId: 'page-personal-1',
      });

      expect(scope).toEqual({
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
      const scope = resolvePageScope({
        spaceKind: 'project',
        projectId: projectUuid,
        pageId: 'page-proj-1',
      });

      expect(scope).toEqual({
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
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await pagesService.citations.list(projectUuid, 'transformer', 25, 'page-multi-2');
      const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
      expect(calledUrl).toContain(`/spaces/${projectUuid}/citations?`);
      expect(calledUrl).toContain('query=transformer');
      expect(calledUrl).toContain('pageId=page-multi-2');
    });
  });

  describe('3. SessionCoordinator.isRealtimeConnected Yjs Argument Order', () => {
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

      const connected = coordinator.isRealtimeConnected(fileId);

      expect(lookupSpy).toHaveBeenCalledWith(fileId, projectId);
      expect(connected).toBe(true);
    });
  });

  describe('4. Page Build Config Hydration, SpellLang Normalization & Suggestion Headers', () => {
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

    it('sends Idempotency-Key as HTTP header and strips idempotencyKey/silent from suggestion body', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
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
    });

    it('calls /api/ai/editor-chat/sync and strips markdown fences in generateLatexEquation', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              role: 'assistant',
              content: '```latex\n\\begin{equation}\nE = mc^2\n\\end{equation}\n```',
              chatId: 'chat-1',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const latex = await pagesService.ai.generateLatexEquation('Mass-energy equivalence', {
        spaceId: 'personal',
        pageId: 'page-ai-1',
      });

      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/ai/editor-chat/sync');
      expect(latex).toBe('\\begin{equation}\nE = mc^2\n\\end{equation}');
    });
  });
});
