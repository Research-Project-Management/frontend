/**
 * compile-diagnostics.mapper.ts
 * Pure diagnostics normalization, summary computation, and network error classification for compilation.
 */

import { getIsOnline } from '@/shared/lib/network';
import type {
  CompileError,
  CompileStatus,
  CompilerDiagnostic,
  DiagnosticsSummary,
} from '@/features/editor/domain/types/compiler.types';
import { parseCompileErrors } from '@/features/editor/domain/latex/latex-structure';

export const VALID_COMPILE_STATUSES = new Set<CompileStatus>([
  'idle',
  'flushing',
  'compiling',
  'syncing',
  'done',
  'success',
  'error',
  'aborted',
]);

export function isCompileNetworkError(err: unknown): boolean {
  if (!getIsOnline()) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('err_internet_disconnected')
  );
}

export function resolveDiagnosticsWithSummary(params: {
  backendDiags: CompilerDiagnostic[];
  fallbackErrors?: CompileError[];
  rawLog: string;
  mainFile: string;
  backendSummary?: DiagnosticsSummary;
}): { diagnostics: CompilerDiagnostic[]; summary: DiagnosticsSummary } {
  const { backendDiags, fallbackErrors, rawLog, mainFile, backendSummary } = params;
  const parsedFallback =
    backendDiags.length > 0 || !rawLog
      ? []
      : fallbackErrors && fallbackErrors.length > 0
        ? fallbackErrors
        : parseCompileErrors(rawLog);

  const diagnostics: CompilerDiagnostic[] =
    backendDiags.length > 0
      ? backendDiags
      : parsedFallback.map((item) => ({
          file: item.file || mainFile,
          line: item.line,
          message: item.message,
          context: item.context ?? '',
          severity: item.severity || ('error' as const),
          source: item.source,
          highlightCommand: item.highlightCommand,
          code: item.code,
          suggestion: item.suggestion,
          quickFix: 'quickFix' in item ? item.quickFix : undefined,
        }));

  const summary: DiagnosticsSummary = backendSummary ?? {
    totalErrors: diagnostics.filter((diag) => diag.severity === 'error').length,
    totalWarnings: diagnostics.filter((diag) => diag.severity === 'warning').length,
    totalBadboxes: diagnostics.filter(
      (diag) => diag.severity === 'badbox' || diag.category === 'badbox',
    ).length,
    suppressedCascadeCount: 0,
    truncated: false,
  };

  return { diagnostics, summary };
}
