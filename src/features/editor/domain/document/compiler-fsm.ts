/**
 * compiler-fsm.ts
 *
 * Pure Finite State Machine (Domain Layer) for the LaTeX Compiler Lifecycle.
 * Follows the same pure-computation pattern as `session-fsm.ts`:
 * - 0 side effects, 0 I/O, 0 store/bus imports.
 * - Single authoritative state (`phase`, `outcome`, `activeRunId`, `hasPendingRun`, `isSyncing`, `report`).
 * - Monotonic `runId` fencing prevents stale async completions or aborts from clobbering newer state.
 */

import type {
  CompileOutcome,
  CompilePhase,
  CompileReport,
  CompileStatus,
  DiagnosticsSummary,
} from '../types/compiler.types';

type CompilerFsmPhase = CompilePhase;

export interface CompilerFsmContext {
  readonly phase: CompilerFsmPhase;
  /** Monotonically increasing run counter to fence async completions. */
  readonly runId: number;
  /** Active in-flight runId while flushing or compiling, otherwise null. */
  readonly activeRunId: number | null;
  readonly outcome: CompileOutcome | null;
  readonly hasPendingRun: boolean;
  readonly isSyncing: boolean;
  readonly report: CompileReport | null;
}

export type CompilerFsmEvent =
  | { type: 'START_FLUSH' }
  | { type: 'FLUSH_COMPLETE'; runId: number }
  | { type: 'QUEUE_SUPERSEDE' }
  | { type: 'CONSUME_PENDING' }
  | { type: 'RUN_SETTLED'; runId?: number; report: CompileReport }
  | {
      type: 'RUN_ABORTED';
      runId: number;
      mainFile?: string;
      logText?: string | null;
      serverTerminated?: boolean;
    }
  | { type: 'USER_STOP'; mainFile?: string }
  | { type: 'BLOCKED_OFFLINE'; runId?: number; mainFile: string; logText: string }
  | { type: 'BLOCKED_CODE_CHECK'; mainFile: string }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_END' }
  | { type: 'SYNC_FAILED'; errorMessage: string; mainFile?: string }
  | { type: 'REMOTE_COMPLETED' }
  | { type: 'REMOTE_PROGRESS'; status: CompileStatus }
  | { type: 'FORCE_STATUS'; status: CompileStatus }
  | { type: 'CLEAR_LOGS' }
  | { type: 'RESET' };

function createEmptyDiagnosticsSummary(): DiagnosticsSummary {
  return {
    totalErrors: 0,
    totalWarnings: 0,
    totalBadboxes: 0,
    suppressedCascadeCount: 0,
    truncated: false,
  };
}

export function createInitialCompilerFsmContext(): CompilerFsmContext {
  return {
    phase: 'idle',
    runId: 0,
    activeRunId: null,
    outcome: null,
    hasPendingRun: false,
    isSyncing: false,
    report: null,
  };
}

export function isCompilerFsmRunning(ctx: CompilerFsmContext): boolean {
  return (
    ctx.isSyncing ||
    ctx.phase === 'flushing' ||
    ctx.phase === 'compiling' ||
    ctx.activeRunId !== null
  );
}

export function deriveCompileStatus(ctx: CompilerFsmContext): CompileStatus {
  if (ctx.isSyncing) return 'syncing';
  if (ctx.phase === 'flushing') return 'flushing';
  if (ctx.phase === 'compiling') return 'compiling';
  if (ctx.phase === 'idle') return 'idle';

  // ctx.phase === 'done'
  if (ctx.outcome === 'success') return 'done';
  if (ctx.outcome === 'terminated') return 'aborted';
  if (ctx.outcome === 'offline-queued' || ctx.outcome === 'code-check-blocked') return 'idle';
  return 'error';
}

export function compilerFsmTransition(
  ctx: CompilerFsmContext,
  event: CompilerFsmEvent,
): CompilerFsmContext {
  switch (event.type) {
    case 'START_FLUSH': {
      if (ctx.activeRunId !== null) return ctx;
      const nextRunId = ctx.runId + 1;
      return {
        ...ctx,
        phase: 'flushing',
        runId: nextRunId,
        activeRunId: nextRunId,
        hasPendingRun: false,
        isSyncing: false,
      };
    }

    case 'FLUSH_COMPLETE': {
      if (ctx.activeRunId !== event.runId || ctx.phase !== 'flushing') return ctx;
      return {
        ...ctx,
        phase: 'compiling',
      };
    }

    case 'QUEUE_SUPERSEDE': {
      return ctx.hasPendingRun ? ctx : { ...ctx, hasPendingRun: true };
    }

    case 'CONSUME_PENDING': {
      return !ctx.hasPendingRun ? ctx : { ...ctx, hasPendingRun: false };
    }

    case 'RUN_SETTLED': {
      if (event.runId !== undefined && ctx.activeRunId !== event.runId) {
        return ctx;
      }
      return {
        ...ctx,
        phase: 'done',
        activeRunId: null,
        isSyncing: false,
        outcome: event.report.outcome,
        report: event.report,
      };
    }

    case 'RUN_ABORTED': {
      if (ctx.activeRunId !== event.runId) return ctx;

      // Supersede unwinds silently without flashing `terminated`; pending run will launch next.
      if (ctx.hasPendingRun) {
        return {
          ...ctx,
          phase: 'idle',
          activeRunId: null,
          isSyncing: false,
        };
      }

      if (event.serverTerminated) {
        const terminatedReport: CompileReport = {
          outcome: 'terminated',
          errorMessage: 'Compilation stopped',
          diagnostics: [],
          summary: createEmptyDiagnosticsSummary(),
          validationIssues: [],
          logText: event.logText ?? ctx.report?.logText ?? null,
          logMeta: null,
          compiledAt: null,
          mainFile: event.mainFile || ctx.report?.mainFile || 'main.tex',
        };
        return {
          ...ctx,
          phase: 'done',
          activeRunId: null,
          isSyncing: false,
          outcome: 'terminated',
          report: terminatedReport,
        };
      }

      return {
        ...ctx,
        phase: 'idle',
        activeRunId: null,
        isSyncing: false,
      };
    }

    case 'USER_STOP': {
      if (ctx.activeRunId !== null || ctx.isSyncing) {
        const terminatedReport: CompileReport = {
          outcome: 'terminated',
          errorMessage: 'Compilation stopped by user.',
          diagnostics: [],
          summary: createEmptyDiagnosticsSummary(),
          validationIssues: [],
          logText: ctx.report?.logText ?? null,
          logMeta: ctx.report?.logMeta ?? null,
          compiledAt: null,
          mainFile: event.mainFile || ctx.report?.mainFile || 'main.tex',
        };
        return {
          ...ctx,
          phase: 'done',
          activeRunId: null,
          hasPendingRun: false,
          isSyncing: false,
          outcome: 'terminated',
          report: terminatedReport,
        };
      }

      return {
        ...ctx,
        phase: 'idle',
        activeRunId: null,
        hasPendingRun: false,
        isSyncing: false,
      };
    }

    case 'BLOCKED_OFFLINE': {
      if (
        event.runId !== undefined
          ? ctx.activeRunId !== event.runId
          : ctx.activeRunId !== null
      ) {
        return ctx;
      }
      const offlineReport: CompileReport = {
        outcome: 'offline-queued',
        errorMessage: 'Offline — compile queued',
        diagnostics: [],
        summary: createEmptyDiagnosticsSummary(),
        validationIssues: [],
        logText: event.logText,
        logMeta: null,
        compiledAt: null,
        mainFile: event.mainFile,
      };
      return {
        ...ctx,
        phase: 'idle',
        activeRunId: null,
        hasPendingRun: false,
        isSyncing: false,
        outcome: 'offline-queued',
        report: offlineReport,
      };
    }

    case 'BLOCKED_CODE_CHECK': {
      if (ctx.activeRunId !== null) return ctx;
      const blockedReport: CompileReport = {
        outcome: 'code-check-blocked',
        errorMessage: 'Auto-compile paused by Code Check due to local syntax errors.',
        diagnostics: [],
        summary: createEmptyDiagnosticsSummary(),
        validationIssues: [],
        logText: ctx.report?.logText ?? null,
        logMeta: null,
        compiledAt: null,
        mainFile: event.mainFile,
      };
      return {
        ...ctx,
        phase: 'idle',
        hasPendingRun: false,
        outcome: 'code-check-blocked',
        report: blockedReport,
      };
    }

    case 'SYNC_START': {
      return ctx.isSyncing ? ctx : { ...ctx, isSyncing: true };
    }

    case 'SYNC_END': {
      return !ctx.isSyncing ? ctx : { ...ctx, isSyncing: false };
    }

    case 'SYNC_FAILED': {
      const failedReport: CompileReport = {
        outcome: 'clsi-unavailable',
        errorMessage: event.errorMessage,
        diagnostics: [],
        summary: createEmptyDiagnosticsSummary(),
        validationIssues: [],
        logText: event.errorMessage || null,
        logMeta: null,
        compiledAt: null,
        mainFile: event.mainFile || ctx.report?.mainFile || 'main.tex',
      };
      return {
        ...ctx,
        phase: 'done',
        activeRunId: null,
        hasPendingRun: false,
        isSyncing: false,
        outcome: 'clsi-unavailable',
        report: failedReport,
      };
    }

    case 'REMOTE_COMPLETED': {
      if (ctx.activeRunId !== null || ctx.isSyncing) return ctx;
      return {
        ...ctx,
        phase: 'done',
        outcome: 'success',
      };
    }

    case 'REMOTE_PROGRESS': {
      if (event.status === 'syncing') {
        return { ...ctx, isSyncing: true };
      }
      if (event.status === 'flushing') {
        return { ...ctx, phase: 'flushing', isSyncing: false };
      }
      if (event.status === 'compiling') {
        return { ...ctx, phase: 'compiling', isSyncing: false };
      }
      if (
        event.status === 'error' &&
        (ctx.activeRunId !== null || ctx.phase === 'compiling' || ctx.phase === 'flushing')
      ) {
        return {
          ...ctx,
          phase: 'done',
          isSyncing: false,
          outcome: ctx.outcome && ctx.outcome !== 'success' ? ctx.outcome : 'failure',
        };
      }
      return ctx;
    }

    case 'FORCE_STATUS': {
      switch (event.status) {
        case 'idle':
          return { ...ctx, phase: 'idle', activeRunId: null, isSyncing: false };
        case 'flushing':
          return { ...ctx, phase: 'flushing', isSyncing: false };
        case 'compiling':
          return { ...ctx, phase: 'compiling', isSyncing: false };
        case 'syncing':
          return { ...ctx, isSyncing: true };
        case 'done':
        case 'success':
          return { ...ctx, phase: 'done', activeRunId: null, isSyncing: false, outcome: 'success' };
        case 'aborted':
          return {
            ...ctx,
            phase: 'done',
            activeRunId: null,
            isSyncing: false,
            outcome: 'terminated',
          };
        case 'error':
          return {
            ...ctx,
            phase: 'done',
            activeRunId: null,
            isSyncing: false,
            outcome: ctx.outcome && ctx.outcome !== 'success' ? ctx.outcome : 'failure',
          };
        default:
          return ctx;
      }
    }

    case 'CLEAR_LOGS': {
      return {
        ...ctx,
        phase: ctx.phase === 'done' ? 'idle' : ctx.phase,
        outcome: null,
        report: null,
      };
    }

    case 'RESET': {
      return createInitialCompilerFsmContext();
    }

    default:
      return ctx;
  }
}
