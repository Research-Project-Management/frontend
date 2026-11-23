// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  compilerFsmTransition,
  createInitialCompilerFsmContext,
  deriveCompileStatus,
  isCompilerFsmRunning,
  type CompilerFsmContext,
} from '@/features/editor/domain/document/compiler-fsm';
import {
  compilerCoordinator,
  FlushBarrier,
  useCompileStore,
  type CompilerPort,
} from '@/features/editor/subsystems/compiler';
import {
  editorCommandBus,
  useConnectivityStore,
  usePageStore,
  useSettingsStore,
} from '@/features/editor/core';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import type { CompileReport } from '@/features/editor/domain/types/compiler.types';

function makeReport(overrides: Partial<CompileReport> = {}): CompileReport {
  return {
    outcome: 'success',
    errorMessage: null,
    diagnostics: [],
    summary: {
      totalErrors: 0,
      totalWarnings: 0,
      totalBadboxes: 0,
      suppressedCascadeCount: 0,
      truncated: false,
    },
    validationIssues: [],
    logText: 'Output written on main.pdf (1 page).',
    logMeta: null,
    compiledAt: new Date(),
    mainFile: 'main.tex',
    ...overrides,
  };
}

describe('Compiler FSM (Pure Domain State Machine)', () => {
  it('transitions idle -> flushing -> compiling -> done cleanly with monotonic runId', () => {
    let ctx: CompilerFsmContext = createInitialCompilerFsmContext();
    expect(ctx.phase).toBe('idle');
    expect(deriveCompileStatus(ctx)).toBe('idle');
    expect(isCompilerFsmRunning(ctx)).toBe(false);

    ctx = compilerFsmTransition(ctx, { type: 'START_FLUSH' });
    expect(ctx.phase).toBe('flushing');
    expect(ctx.runId).toBe(1);
    expect(ctx.activeRunId).toBe(1);
    expect(deriveCompileStatus(ctx)).toBe('flushing');
    expect(isCompilerFsmRunning(ctx)).toBe(true);

    // Concurrent START_FLUSH while active is ignored
    const dupStart = compilerFsmTransition(ctx, { type: 'START_FLUSH' });
    expect(dupStart).toBe(ctx);

    ctx = compilerFsmTransition(ctx, { type: 'FLUSH_COMPLETE', runId: 1 });
    expect(ctx.phase).toBe('compiling');
    expect(deriveCompileStatus(ctx)).toBe('compiling');

    const report = makeReport();
    ctx = compilerFsmTransition(ctx, { type: 'RUN_SETTLED', runId: 1, report });
    expect(ctx.phase).toBe('done');
    expect(ctx.activeRunId).toBeNull();
    expect(ctx.outcome).toBe('success');
    expect(ctx.report).toBe(report);
    expect(deriveCompileStatus(ctx)).toBe('done');
    expect(isCompilerFsmRunning(ctx)).toBe(false);
  });

  it('rejects stale runId transitions (FLUSH_COMPLETE, RUN_SETTLED, RUN_ABORTED)', () => {
    let ctx = createInitialCompilerFsmContext();
    ctx = compilerFsmTransition(ctx, { type: 'START_FLUSH' }); // runId=1
    ctx = compilerFsmTransition(ctx, { type: 'FLUSH_COMPLETE', runId: 999 });
    expect(ctx.phase).toBe('flushing');

    const staleReport = makeReport({ outcome: 'failure' });
    ctx = compilerFsmTransition(ctx, { type: 'RUN_SETTLED', runId: 999, report: staleReport });
    expect(ctx.phase).toBe('flushing');
    expect(ctx.report).toBeNull();

    ctx = compilerFsmTransition(ctx, { type: 'RUN_ABORTED', runId: 999, serverTerminated: true });
    expect(ctx.phase).toBe('flushing');
    expect(ctx.outcome).toBeNull();
  });

  it('handles USER_STOP while running -> terminated/aborted and prevents late RUN_ABORTED overwrite', () => {
    let ctx = createInitialCompilerFsmContext();
    ctx = compilerFsmTransition(ctx, { type: 'START_FLUSH' });
    ctx = compilerFsmTransition(ctx, { type: 'FLUSH_COMPLETE', runId: 1 });

    ctx = compilerFsmTransition(ctx, { type: 'USER_STOP', mainFile: 'main.tex' });
    expect(ctx.phase).toBe('done');
    expect(ctx.activeRunId).toBeNull();
    expect(ctx.outcome).toBe('terminated');
    expect(deriveCompileStatus(ctx)).toBe('aborted');
    expect(ctx.report?.outcome).toBe('terminated');

    // Late abort or settle from runId=1 must be ignored once stopped
    ctx = compilerFsmTransition(ctx, { type: 'RUN_ABORTED', runId: 1 });
    expect(ctx.outcome).toBe('terminated');
    expect(deriveCompileStatus(ctx)).toBe('aborted');

    ctx = compilerFsmTransition(ctx, { type: 'RUN_SETTLED', runId: 1, report: makeReport() });
    expect(ctx.outcome).toBe('terminated');
  });

  it('keeps idle state on USER_STOP when already idle (no false terminated)', () => {
    const initial = createInitialCompilerFsmContext();
    const stopped = compilerFsmTransition(initial, { type: 'USER_STOP', mainFile: 'main.tex' });
    expect(stopped.phase).toBe('idle');
    expect(stopped.outcome).toBeNull();
    expect(deriveCompileStatus(stopped)).toBe('idle');
  });

  it('unwinds superseded runs to idle without flashing terminated and preserves hasPendingRun', () => {
    const prevSuccess = makeReport();
    let ctx = compilerFsmTransition(createInitialCompilerFsmContext(), {
      type: 'RUN_SETTLED',
      report: prevSuccess,
    });

    ctx = compilerFsmTransition(ctx, { type: 'START_FLUSH' }); // runId=1
    ctx = compilerFsmTransition(ctx, { type: 'FLUSH_COMPLETE', runId: 1 });
    ctx = compilerFsmTransition(ctx, { type: 'QUEUE_SUPERSEDE' });
    expect(ctx.hasPendingRun).toBe(true);

    ctx = compilerFsmTransition(ctx, {
      type: 'RUN_ABORTED',
      runId: 1,
      serverTerminated: true,
    });
    expect(ctx.phase).toBe('idle');
    expect(ctx.activeRunId).toBeNull();
    expect(ctx.hasPendingRun).toBe(true);
    expect(ctx.outcome).toBe('success');
    expect(ctx.report).toBe(prevSuccess);

    ctx = compilerFsmTransition(ctx, { type: 'CONSUME_PENDING' });
    expect(ctx.hasPendingRun).toBe(false);
  });

  it('atomically replaces stale CompileReport on BLOCKED_OFFLINE and BLOCKED_CODE_CHECK', () => {
    let ctx = compilerFsmTransition(createInitialCompilerFsmContext(), {
      type: 'RUN_SETTLED',
      report: makeReport({ outcome: 'failure', errorMessage: 'Old error' }),
    });

    ctx = compilerFsmTransition(ctx, {
      type: 'BLOCKED_CODE_CHECK',
      mainFile: 'chapters/intro.tex',
    });
    expect(ctx.phase).toBe('idle');
    expect(deriveCompileStatus(ctx)).toBe('idle');
    expect(ctx.outcome).toBe('code-check-blocked');
    expect(ctx.report?.outcome).toBe('code-check-blocked');
    expect(ctx.report?.diagnostics).toEqual([]);
    expect(ctx.report?.mainFile).toBe('chapters/intro.tex');

    ctx = compilerFsmTransition(ctx, {
      type: 'BLOCKED_OFFLINE',
      mainFile: 'main.tex',
      logText: '[Offline Mode] Queued',
    });
    expect(ctx.phase).toBe('idle');
    expect(deriveCompileStatus(ctx)).toBe('idle');
    expect(ctx.outcome).toBe('offline-queued');
    expect(ctx.report?.outcome).toBe('offline-queued');
    expect(ctx.report?.logText).toBe('[Offline Mode] Queued');
  });

  it('tracks SYNC_START -> SYNC_END and SYNC_FAILED, REMOTE_COMPLETED, CLEAR_LOGS, and RESET', () => {
    let ctx = createInitialCompilerFsmContext();
    ctx = compilerFsmTransition(ctx, { type: 'SYNC_START' });
    expect(deriveCompileStatus(ctx)).toBe('syncing');
    expect(isCompilerFsmRunning(ctx)).toBe(true);

    ctx = compilerFsmTransition(ctx, { type: 'SYNC_END' });
    expect(deriveCompileStatus(ctx)).toBe('idle');
    expect(isCompilerFsmRunning(ctx)).toBe(false);

    ctx = compilerFsmTransition(ctx, { type: 'SYNC_START' });
    ctx = compilerFsmTransition(ctx, { type: 'SYNC_FAILED', errorMessage: 'Sync timeout' });
    expect(ctx.phase).toBe('done');
    expect(ctx.outcome).toBe('clsi-unavailable');
    expect(deriveCompileStatus(ctx)).toBe('error');

    ctx = compilerFsmTransition(ctx, { type: 'CLEAR_LOGS' });
    expect(ctx.report).toBeNull();
    expect(ctx.outcome).toBeNull();
    expect(ctx.phase).toBe('idle');

    ctx = compilerFsmTransition(ctx, { type: 'REMOTE_COMPLETED' });
    expect(ctx.phase).toBe('done');
    expect(ctx.outcome).toBe('success');

    ctx = compilerFsmTransition(ctx, { type: 'RESET' });
    expect(ctx).toEqual(createInitialCompilerFsmContext());
  });
});

describe('CompilerCoordinator & useCompileStore FSM Integration', () => {
  const originalEngine = compilerCoordinator.getCompilerEngine();

  beforeEach(() => {
    vi.restoreAllMocks();
    compilerCoordinator.stop();
    compilerCoordinator.setCompilerEngine(originalEngine);
    useCompileStore.getState().resetCompiler();
    useConnectivityStore.setState({ isOnline: true, offlinePendingCompile: false });
    useSettingsStore.setState({
      engine: 'pdflatex',
      compileMode: 'full',
      useCache: true,
      stopOnFirstError: false,
      stopOnValidationError: true,
    });
    usePageStore.setState({
      projectId: 'proj-fsm',
      rootPageId: 'root-fsm',
      currentPage: { id: 'root-fsm', title: 'main.tex' } as never,
      activeFilePage: { id: 'root-fsm', title: 'main.tex', path: 'main.tex' } as never,
    });
    lruDocumentCache.clear();
    diagnosticsCoordinator.clear();
    lruDocumentCache.registerModel('root-fsm', {
      content: '\\documentclass{article}\\begin{document}FSM\\end{document}',
      filePath: 'main.tex',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    compilerCoordinator.stop();
    compilerCoordinator.setCompilerEngine(originalEngine);
    useCompileStore.getState().resetCompiler();
    lruDocumentCache.clear();
    diagnosticsCoordinator.clear();
  });

  it('transitions visibly through flushing -> compiling -> done without bus clobbering', async () => {
    const observedStatuses: string[] = [];
    const unsub = useCompileStore.subscribe((s, prev) => {
      if (s.compileStatus !== prev.compileStatus) {
        observedStatuses.push(s.compileStatus);
      }
    });

    vi.spyOn(FlushBarrier, 'execute').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { dirtyFileCount: 0, activeFlushed: false };
    });

    const engine: CompilerPort = {
      compile: async () => {
        expect(useCompileStore.getState().compilePhase).toBe('compiling');
        expect(useCompileStore.getState().compileStatus).toBe('compiling');
        return {
          success: true,
          outcome: 'success',
          pdfUrl: 'blob:http://localhost/fsm-ok.pdf',
          logs: 'Output written on main.pdf',
          diagnostics: [],
          compiledAt: new Date(),
        };
      },
      cancelInFlightCompile: vi.fn(),
    };

    compilerCoordinator.setCompilerEngine(engine);
    const ok = await compilerCoordinator.compile({ reason: 'manual' });
    unsub();

    expect(ok).toBe(true);
    expect(observedStatuses).toEqual(['flushing', 'compiling', 'done']);
    expect(useCompileStore.getState().compilePhase).toBe('done');
    expect(useCompileStore.getState().compileStatus).toBe('done');
    expect(useCompileStore.getState().compileOutcome).toBe('success');
  });

  it('transitions to terminated/aborted on stop() mid-compile even if promise resolves afterwards', async () => {
    let resolveCompile!: (value: {
      success: boolean;
      pdfUrl: string;
      logs: string;
    }) => void;
    const engine: CompilerPort = {
      compile: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveCompile = resolve;
          }),
      ),
      cancelInFlightCompile: vi.fn(),
    };

    vi.spyOn(FlushBarrier, 'execute').mockResolvedValue({ dirtyFileCount: 0, activeFlushed: false });

    compilerCoordinator.setCompilerEngine(engine);
    const pendingPromise = compilerCoordinator.compile({ reason: 'manual' });

    // Wait until compiling starts
    await vi.waitFor(() => {
      expect(useCompileStore.getState().compileStatus).toBe('compiling');
    });

    compilerCoordinator.stop();
    expect(useCompileStore.getState().compileStatus).toBe('aborted');
    expect(useCompileStore.getState().compileOutcome).toBe('terminated');
    expect(useCompileStore.getState().compilePhase).toBe('done');

    // Late resolution must not overwrite terminated
    resolveCompile({
      success: true,
      pdfUrl: 'blob:http://localhost/late.pdf',
      logs: 'Late success',
    });
    const ok = await pendingPromise;
    expect(ok).toBe(false);
    expect(useCompileStore.getState().compileStatus).toBe('aborted');
    expect(useCompileStore.getState().compileOutcome).toBe('terminated');
    expect(useCompileStore.getState().pdfUrl).toBeNull();
  });

  it('supersedes rapid double compile() without flashing terminated and settles on the second run', async () => {
    const outcomesSeen: Array<string | null> = [];
    const unsub = useCompileStore.subscribe((s, prev) => {
      if (s.compileOutcome !== prev.compileOutcome) {
        outcomesSeen.push(s.compileOutcome);
      }
    });

    vi.spyOn(FlushBarrier, 'execute').mockResolvedValue({ dirtyFileCount: 0, activeFlushed: false });

    let callCount = 0;
    const engine: CompilerPort = {
      compile: vi.fn(async (opts) => {
        callCount++;
        if (callCount === 1) {
          await new Promise<void>((resolve) => {
            opts.signal?.addEventListener('abort', () => resolve(), { once: true });
          });
          return {
            success: false,
            aborted: true,
            outcome: 'terminated' as const,
            error: 'Compilation aborted',
            logs: '',
          };
        }
        return {
          success: true,
          outcome: 'success' as const,
          pdfUrl: 'blob:http://localhost/run-2.pdf',
          logs: 'Run 2 succeeded',
          diagnostics: [],
          compiledAt: new Date(),
        };
      }),
      cancelInFlightCompile: vi.fn(),
    };

    compilerCoordinator.setCompilerEngine(engine);
    const first = compilerCoordinator.compile({ reason: 'manual' });
    await vi.waitFor(() => {
      expect(useCompileStore.getState().compileStatus).toBe('compiling');
    });

    const secondImmediate = await compilerCoordinator.compile({ reason: 'manual' });
    expect(secondImmediate).toBe(false);
    expect(await first).toBe(false);

    await vi.waitFor(() => {
      expect(useCompileStore.getState().pdfUrl).toBe('blob:http://localhost/run-2.pdf');
    });
    unsub();

    expect(callCount).toBe(2);
    expect(outcomesSeen).not.toContain('terminated');
    expect(useCompileStore.getState().compileStatus).toBe('done');
    expect(useCompileStore.getState().compileOutcome).toBe('success');
  });

  it('forwards reason through compiler:trigger so reason="auto" hits code-check-blocked while shortcut bypasses', async () => {
    diagnosticsCoordinator.ingestLinterDiagnostics('main.tex', [
      {
        id: 'lint-err',
        file: 'main.tex',
        line: 1,
        column: 1,
        severity: 'error',
        code: 'UNBALANCED_BRACES',
        message: 'Unclosed `{`.',
        source: 'LaTeX Linter',
      },
    ]);

    const compileMock = vi.fn().mockResolvedValue({
      success: true,
      outcome: 'success',
      pdfUrl: 'blob:http://localhost/bypass.pdf',
      logs: 'ok',
      diagnostics: [],
    });
    compilerCoordinator.setCompilerEngine({
      compile: compileMock,
      cancelInFlightCompile: vi.fn(),
    });
    vi.spyOn(FlushBarrier, 'execute').mockResolvedValue({ dirtyFileCount: 0, activeFlushed: false });

    editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'auto' });
    await vi.waitFor(() => {
      expect(useCompileStore.getState().compileOutcome).toBe('code-check-blocked');
    });
    expect(compileMock).not.toHaveBeenCalled();

    editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' });
    await vi.waitFor(() => {
      expect(compileMock).toHaveBeenCalledTimes(1);
    });
    expect(useCompileStore.getState().compileOutcome).toBe('success');
  });

  it('ignores remote compiler:progress broadcasts when this user did not initiate an active compile (Overleaf local-compile-context.tsx:168 parity)', () => {
    expect(useCompileStore.getState().compileStatus).toBe('idle');

    editorCommandBus.dispatch({
      type: 'compiler:progress',
      status: 'compiling',
      logs: ['[CLSI Queue] Another user started compiling...'],
    });

    expect(useCompileStore.getState().compileStatus).toBe('idle');
    expect(useCompileStore.getState().compilePhase).toBe('idle');
  });
});
