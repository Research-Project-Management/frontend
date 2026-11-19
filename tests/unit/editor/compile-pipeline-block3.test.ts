import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as zlib from 'zlib';
import { assembleCompilationSnapshot } from '@/features/editor/domain/document/compilation-snapshot';
import {
  CompilerCoordinator,
  CompilePipeline,
  type CompilerPort,
} from '@/features/editor/subsystems/compiler';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator, usePageStore, useConnectivityStore } from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';

describe('Block 3 Frontend Compile Pipeline Regression Tests', () => {
  beforeEach(() => {
    useConnectivityStore.setState({ isOnline: true, syncStatus: 'synced', pendingSaveCount: 0 });
    useCompileStore.getState().resetCompiler();
    usePageStore.getState().resetPageState();
    lruDocumentCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lruDocumentCache.clear();
  });

  it('assembleCompilationSnapshot skips unloaded empty baseFiles stubs while keeping intentionally emptied dirty buffers', () => {
    const snap = assembleCompilationSnapshot({
      baseFiles: [
        { id: 'ch1-id', path: 'chapters/ch1.tex', content: '' },
        { id: 'main-id', path: 'main.tex', content: '\\documentclass{article}' },
      ],
      lruModels: [
        { fileId: 'ch2-id', filePath: 'chapters/ch2.tex', content: '', isDirty: true },
      ],
    });

    expect('chapters/ch1.tex' in snap.files).toBe(false);
    expect('ch1-id' in snap.files).toBe(false);
    expect(snap.files['chapters/ch2.tex']).toBe('');
    expect(snap.files['main.tex']).toBe('\\documentclass{article}');
  });

  it('CompilerCoordinator.compile sends canonical rootPageId even when active tab is a child chapter', async () => {
    const capturedOpts: Array<{ projectId: string; pageId?: string; mainFile?: string }> = [];
    const testCompiler: CompilerPort = {
      compile: async (opts) => {
        capturedOpts.push({
          projectId: opts.projectId,
          pageId: opts.pageId,
          mainFile: opts.mainFile,
        });
        return {
          success: true,
          pdfUrl: 'blob:http://localhost/root-pdf',
          logs: 'ok',
        };
      },
      cancelInFlightCompile: vi.fn(),
    };

    usePageStore.setState({
      spaceId: 'space-1',
      projectId: 'proj-1',
      rootPageId: 'root-page-uuid',
      parentPageId: 'root-page-uuid',
      currentPage: {
        id: 'child-ch2-uuid',
        title: 'chapters/ch2.tex',
        path: 'chapters/ch2.tex',
        content: '\\section{Chapter Two}',
      } as any,
      activeFilePage: {
        id: 'child-ch2-uuid',
        title: 'chapters/ch2.tex',
        path: 'chapters/ch2.tex',
        content: '\\section{Chapter Two}',
      } as any,
    });

    const coordinator = new CompilerCoordinator({
      compilerEngine: testCompiler,
      getProjectId: () => 'proj-1',
      getMainFile: () => 'main.tex',
    });

    const ok = await coordinator.compile();
    expect(ok).toBe(true);
    expect(capturedOpts).toHaveLength(1);
    expect(capturedOpts[0]?.pageId).toBe('root-page-uuid');
  });

  it('CompilePipeline.compile sends artifact mode with zero clean files when flushed and streams PDF + SyncTeX', async () => {
    vi.spyOn(sessionCoordinator, 'isRealtimeConnected').mockReturnValue(false);
    vi.spyOn(sessionCoordinator, 'flushFile').mockImplementation(async (fid) => {
      lruDocumentCache.markClean(fid);
      return true;
    });

    lruDocumentCache.registerModel('doc-clean', {
      content: '\\documentclass{article}\\n\\begin{document}Clean\\end{document}',
      filePath: 'main.tex',
    });

    const compileSpy = vi.spyOn(pagesService.compiler, 'compile').mockResolvedValue({
      success: true,
      pdf: '',
      pdfArtifactUrl: '/api/v1/pages/pages/root-page-uuid/artifacts/output.pdf?v=123',
      synctexArtifactUrl: '/api/v1/pages/pages/root-page-uuid/artifacts/output.synctex.gz?v=123',
      synctexAvailable: true,
      logs: 'Output written on output.pdf',
    });

    const pdfBlob = new Blob(['%PDF-1.5 streamed'], { type: 'application/pdf' });
    const blobSpy = vi
      .spyOn(pagesService.compiler, 'fetchArtifactBlob')
      .mockResolvedValue({ url: 'blob:http://localhost/streamed-pdf', blob: pdfBlob });

    const gzippedSync = zlib.gzipSync(
      'SyncTeX Version:1\nInput:1:./main.tex\nOutput:pdf\nContent:\n{1\nh1,5:100,200:50,12,0\n}1\nPostamble:\n',
    );
    const arrayBuf = gzippedSync.buffer.slice(
      gzippedSync.byteOffset,
      gzippedSync.byteOffset + gzippedSync.byteLength,
    ) as ArrayBuffer;
    const bufSpy = vi
      .spyOn(pagesService.compiler, 'fetchArtifactArrayBuffer')
      .mockResolvedValue(arrayBuf);

    const res = await CompilePipeline.compile({
      projectId: 'proj-1',
      pageId: 'root-page-uuid',
      mainFile: 'main.tex',
      engine: 'pdflatex',
      files: { 'main.tex': '\\documentclass{article}' },
      source: '\\documentclass{article}',
    });

    expect(res.success).toBe(true);
    expect(res.pdfUrl).toBe('blob:http://localhost/streamed-pdf');
    expect(compileSpy).toHaveBeenCalledTimes(1);
    const payload = compileSpy.mock.calls[0]![0];
    expect(payload.responseMode).toBe('artifact');
    expect(payload.source).toBeUndefined();
    expect(payload.files).toBeUndefined();

    expect(blobSpy).toHaveBeenCalledWith(
      '/api/v1/pages/pages/root-page-uuid/artifacts/output.pdf?v=123',
      expect.any(AbortSignal),
    );
    expect(bufSpy).toHaveBeenCalledWith(
      '/api/v1/pages/pages/root-page-uuid/artifacts/output.synctex.gz?v=123',
      expect.any(AbortSignal),
    );

    const syncMap = await res.synctexPromise;
    expect(syncMap?.tagToPath.get(1)).toContain('main.tex');
  });

  it('CompilePipeline.compile sends ONLY still-dirty overlay files when a flush fails', async () => {
    vi.spyOn(sessionCoordinator, 'isRealtimeConnected').mockReturnValue(false);
    vi.spyOn(sessionCoordinator, 'flushFile').mockResolvedValue(false);

    lruDocumentCache.registerModel('doc-clean', {
      content: 'clean main content',
      filePath: 'main.tex',
    });
    lruDocumentCache.registerModel('doc-dirty', {
      content: 'initial content',
      filePath: 'chapters/ch1.tex',
    });
    lruDocumentCache.updateContent('doc-dirty', '\\section{Unsaved Dirty}', true);

    const compileSpy = vi.spyOn(pagesService.compiler, 'compile').mockResolvedValue({
      success: true,
      pdf: Buffer.from('%PDF-1.5 inline').toString('base64'),
      logs: 'ok',
    });

    const res = await CompilePipeline.compile({
      projectId: 'proj-1',
      pageId: 'root-page-uuid',
      mainFile: 'main.tex',
      engine: 'pdflatex',
      dirtyFiles: [
        { fileId: 'doc-dirty', path: 'chapters/ch1.tex', content: '\\section{Unsaved Dirty}' },
      ],
    });

    expect(res.success).toBe(true);
    const payload = compileSpy.mock.calls[0]![0];
    expect(payload.responseMode).toBe('artifact');
    expect(payload.source).toBeUndefined();
    expect(payload.files).toEqual({
      'chapters/ch1.tex': '\\section{Unsaved Dirty}',
    });
  });
});
