import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CompilerCoordinatorRegistry,
  type CompilerExecutionPort,
} from '@/features/editor/coordinators/compiler.coordinator';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { useCompileStore } from '@/features/editor/store/compiler.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useConnectivityStore } from '@/features/editor/store/connectivity.store';
import { diagnosticsCoordinator } from '@/features/editor/coordinators/diagnostics.coordinator';

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
});
