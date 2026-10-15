import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CompilerCoordinatorRegistry,
  compilerCoordinator,
  compilerSubsystem,
  CompilationFlushBarrier,
  type CompilerExecutionPort,
} from '@/features/editor/subsystems/compiler';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { sessionCoordinator, editorCommandBus } from '@/features/editor/core';
import { useCompileStore } from '@/features/editor/core';
import { usePageStore } from '@/features/editor/core';
import { useConnectivityStore } from '@/features/editor/core';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';

describe('CompilerCoordinator as Deep Module (Matt Pocock Codebase Design)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConnectivityStore.setState({ isOnline: true, syncStatus: 'synced', pendingSaveCount: 0 });
    useCompileStore.setState({ compileStatus: 'idle', compileLog: '', compileErrors: [] });
    usePageStore.setState({
      projectId: 'proj-123',
      currentPage: { id: 'main-doc', title: 'main.tex' } as any,
    });
    lruDocumentCache.clear();
    diagnosticsCoordinator.clear();
    diagnosticsCoordinator.setFilterOptions({
      suppressBadBoxes: false,
      suppressFontWarnings: false,
      suppressPackageWarnings: false,
      customPatterns: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('compiles via injected test compiler port without network or child process', async () => {
    let compileCalled = false;
    const testCompiler: CompilerExecutionPort = {
      compile: async (opts) => {
        compileCalled = true;
        return {
          success: true,
          pdfUrl: 'blob:http://localhost/test-uuid',
          synctexMap: null,
          logs: 'Output written on main.pdf (1 page, 12345 bytes).',
          compiledAt: new Date(),
          diagnostics: [
            {
              line: 12,
              message: 'Underfull \\hbox (badness 10000)',
              severity: 'warning',
              file: 'main.tex',
              context: '',
            },
          ],
        };
      },
      cancelInFlightCompile: vi.fn(),
    };

    const compiler = new CompilerCoordinatorRegistry({
      compilerEngine: testCompiler,
      getProjectId: () => 'proj-123',
      getMainFile: () => 'main.tex',
    });

    lruDocumentCache.registerModel('main-doc', {
      content: '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}',
      filePath: 'main.tex',
    });

    const success = await compiler.compile();
    expect(success).toBe(true);
    expect(compileCalled).toBe(true);
    expect(useCompileStore.getState().pdfUrl).toBe('blob:http://localhost/test-uuid');
    expect(useCompileStore.getState().compileStatus).toBe('idle');
    expect(useCompileStore.getState().lastCompiledAt).toBeDefined();

    // Deep diagnostics access via compiler interface
    const diags = compiler.getDiagnostics('main.tex');
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('Underfull \\hbox');
  });

  it('cancels in-flight compile on stop()', () => {
    const cancelMock = vi.fn();
    const testCompiler: CompilerExecutionPort = {
      compile: vi.fn(),
      cancelInFlightCompile: cancelMock,
    };

    const compiler = new CompilerCoordinatorRegistry({
      compilerEngine: testCompiler,
    });

    compiler.stop();
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(useCompileStore.getState().compileStatus).toBe('idle');
  });

  it('provides high-leverage summary metrics across the seam', async () => {
    const testCompiler: CompilerExecutionPort = {
      compile: async () => ({
        success: false,
        error: 'Fatal error occurred',
        logs: '! LaTeX Error: File `missing.sty` not found.',
        errors: [
          {
            line: 4,
            message: 'File `missing.sty` not found.',
            context: '\\usepackage{missing}',
            file: 'main.tex',
            severity: 'error',
          },
        ],
      }),
      cancelInFlightCompile: vi.fn(),
    };

    const compiler = new CompilerCoordinatorRegistry({
      compilerEngine: testCompiler,
    });

    lruDocumentCache.registerModel('main-doc', {
      content: '\\usepackage{missing}',
      filePath: 'main.tex',
    });

    const success = await compiler.compile();
    expect(success).toBe(false);

    // Deep query through compiler
    const summary = compiler.getFileSummary('main.tex');
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(0);
    expect(compiler.getDiagnosticsCount('error')).toBe(1);
  });

  it('compilerSubsystem encapsulates compile intent, duration, and status into structured CompilationOutcome', async () => {
    const testCompiler: CompilerExecutionPort = {
      compile: async () => ({
        success: true,
        pdfUrl: 'blob:http://localhost/seam-test.pdf',
        synctexMap: null,
        logs: 'Success',
        compiledAt: new Date(),
        diagnostics: [
          { line: 5, message: 'Overfull \\hbox', severity: 'warning', file: 'main.tex', context: '' },
        ],
      }),
      cancelInFlightCompile: vi.fn(),
    };

    compilerCoordinator.setCompilerEngine(testCompiler);

    lruDocumentCache.registerModel('main-doc', {
      content: '\\documentclass{article}\\begin{document}Hello\\end{document}',
      filePath: 'main.tex',
    });

    const outcome = await compilerSubsystem.compile({ mode: 'fast', reason: 'manual-button' });
    expect(outcome.status).toBe('success');
    expect(outcome.pdfUrl).toBe('blob:http://localhost/seam-test.pdf');
    expect(outcome.warningCount).toBe(1);
    expect(outcome.errorCount).toBe(0);
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('compilerSubsystem.abort() and jumpToPdf() delegate cleanly to the coordinator seam', async () => {
    const stopSpy = vi.spyOn(compilerCoordinator, 'stop');
    compilerSubsystem.abort();
    expect(stopSpy).toHaveBeenCalledTimes(1);

    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    vi.spyOn(compilerCoordinator, 'resolveForward').mockReturnValue(3);
    const jumped = await compilerSubsystem.jumpToPdf('main.tex', 10);
    expect(jumped).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'viewer:goto-page', page: 3 });
  });

  it('CompilationFlushBarrier flushes pending drafts and synchronizes active dirty buffer', async () => {
    const flushDraftsSpy = vi.spyOn(sessionCoordinator, 'flushPendingDrafts');
    const flushAllSpy = vi.spyOn(sessionCoordinator, 'flushAllPending').mockResolvedValue({
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });

    lruDocumentCache.registerModel('doc-1', {
      content: 'Original content',
      filePath: 'doc.tex',
    });

    const result = await CompilationFlushBarrier.execute('doc-1', 'Updated content via editor');
    expect(flushDraftsSpy).toHaveBeenCalled();
    expect(flushAllSpy).toHaveBeenCalled();
    expect(result.activeFlushed).toBe(true);
    expect(lruDocumentCache.getModel('doc-1')?.content).toBe('Updated content via editor');
    expect(useCompileStore.getState().getDirtyFiles().some((d) => d.fileId === 'doc-1')).toBe(true);
  });
});
