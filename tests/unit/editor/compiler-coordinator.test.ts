import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  compilerFsmTransition,
  createInitialCompilerFsmContext,
  deriveCompileStatus,
  isCompilerFsmRunning,
  type CompilerFsmContext,
} from '@/features/editor/domain/document/compiler-fsm';
import { assembleCompilationSnapshot } from '@/features/editor/domain/document/compilation-snapshot';
import { computeUnsyncedEditDiffSummary } from '@/features/editor/domain/document/unsynced-edit-diff';
import {
  CompilerCoordinator,
  compilerCoordinator,
  compilerSubsystem,
  FlushBarrier,
  useCompileStore,
  buildPageStoreFilePaths,
  type CompilerPort,
} from '@/features/editor/subsystems/compiler';
import {
  editorCommandBus,
  sessionCoordinator,
  usePageStore,
  useSettingsStore,
} from '@/features/editor/core';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { pagesService } from '@/features/editor/sdk/pages.service';
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

describe('Compiler FSM, CompilerCoordinator, Auto-Compile & Snapshot Assembly', () => {
  describe('1. Pure Compiler FSM (compilerFsmTransition)', () => {
    it('transitions idle -> flushing -> compiling -> done with monotonic runId and rejects stale runIds', () => {
      let ctx: CompilerFsmContext = createInitialCompilerFsmContext();
      expect(ctx.phase).toBe('idle');
      expect(deriveCompileStatus(ctx)).toBe('idle');
      expect(isCompilerFsmRunning(ctx)).toBe(false);

      ctx = compilerFsmTransition(ctx, { type: 'START_FLUSH' });
      expect(ctx.phase).toBe('flushing');
      expect(ctx.runId).toBe(1);
      expect(isCompilerFsmRunning(ctx)).toBe(true);
      expect(compilerFsmTransition(ctx, { type: 'START_FLUSH' })).toBe(ctx);

      // Stale runId=999 ignored
      expect(compilerFsmTransition(ctx, { type: 'FLUSH_COMPLETE', runId: 999 }).phase).toBe('flushing');

      ctx = compilerFsmTransition(ctx, { type: 'FLUSH_COMPLETE', runId: 1 });
      expect(deriveCompileStatus(ctx)).toBe('compiling');

      const report = makeReport();
      ctx = compilerFsmTransition(ctx, { type: 'RUN_SETTLED', runId: 1, report });
      expect(ctx.phase).toBe('done');
      expect(ctx.outcome).toBe('success');
      expect(deriveCompileStatus(ctx)).toBe('done');
      expect(isCompilerFsmRunning(ctx)).toBe(false);
    });

    it('handles USER_STOP, QUEUE_SUPERSEDE, BLOCKED_*, SYNC_*, CLEAR_LOGS, and RESET', () => {
      const idleStopped = compilerFsmTransition(createInitialCompilerFsmContext(), {
        type: 'USER_STOP',
        mainFile: 'main.tex',
      });
      expect(deriveCompileStatus(idleStopped)).toBe('idle');

      let ctx = compilerFsmTransition(createInitialCompilerFsmContext(), { type: 'START_FLUSH' });
      ctx = compilerFsmTransition(ctx, { type: 'FLUSH_COMPLETE', runId: 1 });
      ctx = compilerFsmTransition(ctx, { type: 'USER_STOP', mainFile: 'main.tex' });
      expect(ctx.outcome).toBe('terminated');
      expect(deriveCompileStatus(ctx)).toBe('aborted');
      expect(compilerFsmTransition(ctx, { type: 'RUN_SETTLED', runId: 1, report: makeReport() }).outcome).toBe(
        'terminated',
      );

      // Superseded run unwinds cleanly
      const prevSuccess = makeReport();
      let sup = compilerFsmTransition(createInitialCompilerFsmContext(), {
        type: 'RUN_SETTLED',
        report: prevSuccess,
      });
      sup = compilerFsmTransition(sup, { type: 'START_FLUSH' });
      sup = compilerFsmTransition(sup, { type: 'FLUSH_COMPLETE', runId: 1 });
      sup = compilerFsmTransition(sup, { type: 'QUEUE_SUPERSEDE' });
      sup = compilerFsmTransition(sup, { type: 'RUN_ABORTED', runId: 1, serverTerminated: true });
      expect(sup.phase).toBe('idle');
      expect(sup.hasPendingRun).toBe(true);
      expect(sup.outcome).toBe('success');
      expect(compilerFsmTransition(sup, { type: 'CONSUME_PENDING' }).hasPendingRun).toBe(false);

      // Blocked & Sync transitions
      let b = compilerFsmTransition(sup, { type: 'BLOCKED_CODE_CHECK', mainFile: 'intro.tex' });
      expect(b.outcome).toBe('code-check-blocked');
      b = compilerFsmTransition(b, {
        type: 'BLOCKED_OFFLINE',
        mainFile: 'main.tex',
        logText: '[Offline Mode]',
      });
      expect(b.outcome).toBe('offline-queued');

      b = compilerFsmTransition(b, { type: 'SYNC_START' });
      expect(deriveCompileStatus(b)).toBe('syncing');
      b = compilerFsmTransition(b, { type: 'SYNC_FAILED', errorMessage: 'Sync timeout' });
      expect(deriveCompileStatus(b)).toBe('error');
      b = compilerFsmTransition(b, { type: 'CLEAR_LOGS' });
      expect(b.report).toBeNull();
      b = compilerFsmTransition(b, { type: 'RESET' });
      expect(b).toEqual(createInitialCompilerFsmContext());
    });
  });

  describe('2. CompilerCoordinator & compilerSubsystem Integration', () => {
    const originalEngine = compilerCoordinator.getCompilerEngine();

    beforeEach(() => {
      vi.restoreAllMocks();
      compilerCoordinator.stop();
      compilerCoordinator.setCompilerEngine(originalEngine);
      useCompileStore.getState().resetCompiler();
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
      diagnosticsCoordinator.setFilterOptions({
        suppressBadBoxes: false,
        suppressFontWarnings: false,
        suppressPackageWarnings: false,
        customPatterns: [],
      });
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

    it('compiles via injected CompilerPort, populates diagnostics summaries, and supports stopOnFirstError toggle', async () => {
      useSettingsStore.getState().toggleStopOnFirstError();
      expect(useSettingsStore.getState().stopOnFirstError).toBe(true);
      useSettingsStore.getState().setStopOnFirstError(false);
      expect(useSettingsStore.getState().stopOnFirstError).toBe(false);

      const testCompiler: CompilerPort = {
        compile: async () => ({
          success: true,
          pdfUrl: 'blob:http://localhost/test-uuid',
          synctexMap: null,
          logs: 'Output written on main.pdf.',
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
        }),
        cancelInFlightCompile: vi.fn(),
      };

      compilerCoordinator.setCompilerEngine(testCompiler);

      expect(await compilerCoordinator.compile()).toBe(true);
      expect(useCompileStore.getState().pdfUrl).toBe('blob:http://localhost/test-uuid');
      expect(compilerCoordinator.getDiagnostics('main.tex')).toHaveLength(1);
      expect(compilerCoordinator.getFileSummary('main.tex').warningCount).toBe(1);

      const outcome = await compilerSubsystem.compile({ mode: 'fast', reason: 'manual-button' });
      expect(outcome.status).toBe('success');
      expect(outcome.warningCount).toBe(1);

      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      vi.spyOn(compilerCoordinator, 'resolveForward').mockReturnValue(3);
      expect(await compilerSubsystem.jumpToPdf('main.tex', 10)).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'viewer:goto-page', page: 3 });

      const flushAllSpy = vi.spyOn(sessionCoordinator, 'flushAllPending').mockResolvedValue({
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });
      const barrierRes = await FlushBarrier.execute('root-fsm', 'Updated content via editor');
      expect(flushAllSpy).toHaveBeenCalled();
      expect(barrierRes.activeFlushed).toBe(true);
    });

    it('transitions flushing -> compiling -> done, handles mid-compile stop(), and supersedes double compile()', async () => {
      const observedStatuses: string[] = [];
      const unsub = useCompileStore.subscribe((s, prev) => {
        if (s.compileStatus !== prev.compileStatus) observedStatuses.push(s.compileStatus);
      });

      vi.spyOn(FlushBarrier, 'execute').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { dirtyFileCount: 0, activeFlushed: false };
      });

      compilerCoordinator.setCompilerEngine({
        compile: async () => ({
          success: true,
          outcome: 'success',
          pdfUrl: 'blob:http://localhost/fsm-ok.pdf',
          logs: 'Output written on main.pdf',
          diagnostics: [],
          compiledAt: new Date(),
        }),
        cancelInFlightCompile: vi.fn(),
      });
      expect(await compilerCoordinator.compile({ reason: 'manual' })).toBe(true);
      unsub();
      expect(observedStatuses).toEqual(['flushing', 'compiling', 'done']);

      // Mid-compile stop()
      let resolveLate!: (val: { success: boolean; pdfUrl: string; logs: string }) => void;
      compilerCoordinator.setCompilerEngine({
        compile: vi.fn(() => new Promise((r) => (resolveLate = r))),
        cancelInFlightCompile: vi.fn(),
      });
      const pending = compilerCoordinator.compile({ reason: 'manual' });
      await vi.waitFor(() => expect(useCompileStore.getState().compileStatus).toBe('compiling'));
      compilerCoordinator.stop();
      resolveLate({ success: true, pdfUrl: 'blob:http://localhost/late.pdf', logs: 'Late' });
      expect(await pending).toBe(false);
      expect(useCompileStore.getState().compileOutcome).toBe('terminated');

      // Double compile() supersede
      useCompileStore.getState().resetCompiler();
      let callCount = 0;
      compilerCoordinator.setCompilerEngine({
        compile: vi.fn(async (opts) => {
          callCount++;
          if (callCount === 1) {
            await new Promise<void>((r) =>
              opts.signal?.addEventListener('abort', () => r(), { once: true }),
            );
            return {
              success: false,
              aborted: true,
              outcome: 'terminated' as const,
              error: 'Aborted',
              logs: '',
            };
          }
          return {
            success: true,
            outcome: 'success' as const,
            pdfUrl: 'blob:http://localhost/run-2.pdf',
            logs: 'Run 2',
            diagnostics: [],
            compiledAt: new Date(),
          };
        }),
        cancelInFlightCompile: vi.fn(),
      });

      const first = compilerCoordinator.compile({ reason: 'manual' });
      await vi.waitFor(() => expect(useCompileStore.getState().compileStatus).toBe('compiling'));
      expect(await compilerCoordinator.compile({ reason: 'manual' })).toBe(false);
      expect(await first).toBe(false);
      await vi.waitFor(() =>
        expect(useCompileStore.getState().pdfUrl).toBe('blob:http://localhost/run-2.pdf'),
      );
      expect(useCompileStore.getState().compileOutcome).toBe('success');
    });

    it('blocks reason="auto" on linter errors, bypasses on shortcut, and ignores unsolicited remote compiler:progress', async () => {
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
      await vi.waitFor(() =>
        expect(useCompileStore.getState().compileOutcome).toBe('code-check-blocked'),
      );
      expect(compileMock).not.toHaveBeenCalled();

      editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' });
      await vi.waitFor(() => expect(compileMock).toHaveBeenCalledTimes(1));

      useCompileStore.getState().resetCompiler();
      editorCommandBus.dispatch({
        type: 'compiler:progress',
        status: 'compiling',
        logs: ['[CLSI Queue] Another user started compiling...'],
      });
      expect(useCompileStore.getState().compileStatus).toBe('idle');
    });
  });

  describe('3. Auto-Compile Debounce on Typing', () => {
    let unsubCompile: (() => void) | null = null;

    beforeEach(() => {
      vi.restoreAllMocks();
      vi.spyOn(pagesService.docs, 'updateContent').mockResolvedValue({ success: true } as never);
      vi.spyOn(pagesService.updater, 'flushProject').mockResolvedValue({ success: true } as never);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      useSettingsStore.setState({ autoCompile: true });
      useCompileStore.setState({
        compileStatus: 'idle',
        pendingCompile: false,
        dirtyContentMap: new Map(),
      });
      lruDocumentCache.registerModel('page-1', {
        content: '\\documentclass{article}\\begin{document}Hello\\end{document}',
      });
    });

    afterEach(() => {
      unsubCompile?.();
      unsubCompile = null;
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('debounces typing by 1500ms, resets on continued typing, skips identical text, and respects autoCompile=false', () => {
      const compileMock = vi.fn();
      unsubCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

      sessionCoordinator.notifyContentChange('page-1', 'First edit', { isRealtimeActive: false });
      vi.advanceTimersByTime(1000);
      expect(compileMock).not.toHaveBeenCalled();

      sessionCoordinator.notifyContentChange('page-1', 'Second edit', { isRealtimeActive: false });
      vi.advanceTimersByTime(1000);
      expect(compileMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(compileMock).toHaveBeenCalledTimes(1);

      // Identical content does not re-trigger
      sessionCoordinator.notifyContentChange('page-1', 'Second edit', { isRealtimeActive: false });
      vi.advanceTimersByTime(3000);
      expect(compileMock).toHaveBeenCalledTimes(1);

      // Disabled autoCompile does not trigger
      useSettingsStore.setState({ autoCompile: false });
      sessionCoordinator.notifyContentChange('page-1', 'Third edit', { isRealtimeActive: false });
      vi.advanceTimersByTime(5000);
      expect(compileMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Compilation Snapshot Path Resolution & Unsynced Edit Diff', () => {
    it('resolves LRU models and dirty buffers to canonical virtual paths without UUID.tex pollution', () => {
      const chapterId = '3f2a9c1e-uuid-chapter';
      const snap = assembleCompilationSnapshot({
        baseFiles: [{ id: chapterId, title: 'chapters/intro.tex', content: 'stale server' }],
        lruModels: [{ fileId: chapterId, filePath: chapterId, content: 'fresh buffer', isDirty: true }],
      });
      expect(snap.files['chapters/intro.tex']).toBe('fresh buffer');
      expect(Object.keys(snap.files)).not.toContain(`${chapterId}.tex`);

      const dirtySnap = assembleCompilationSnapshot({
        baseFiles: [{ id: chapterId, title: 'chapters/intro.tex', content: 'stale' }],
        dirtyFiles: [{ fileId: chapterId, content: 'dirty newest' }],
      });
      expect(dirtySnap.files['chapters/intro.tex']).toBe('dirty newest');

      const explicitSnap = assembleCompilationSnapshot({
        lruModels: [{ fileId: chapterId, content: 'x' }],
        filePathsById: { [chapterId]: 'refs.bib' },
      });
      expect(explicitSnap.files['refs.bib']).toBe('x');

      const pathMap = buildPageStoreFilePaths({
        currentPage: { id: 'root', title: 'main.tex' },
        activeFilePage: { id: 'f1', title: 'intro.tex', path: 'chapters/intro.tex' },
        fileHierarchy: [
          { id: 'root', title: 'main.tex', children: [{ id: 'c2', title: 'refs.bib' } as never] } as never,
        ],
      });
      expect(pathMap).toEqual({ root: 'main.tex', f1: 'chapters/intro.tex', c2: 'refs.bib' });

      expect(computeUnsyncedEditDiffSummary('a\nb', 'a\nb').identical).toBe(true);
      const diff = computeUnsyncedEditDiffSummary('a\nB\nc\nd', 'a\nb\nc');
      expect(diff.identical).toBe(false);
      expect(diff.addedLines).toBe(2);
      expect(diff.removedLines).toBe(1);
    });
  });
});
