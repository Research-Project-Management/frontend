'use client';

/**
 * CompileOutcomeCard.tsx
 *
 * Dedicated outcome card displayed at the top of CompilerLogs for non-clean
 * build outcomes (timedout, terminated, validation-problems, clsi-unavailable,
 * stopped-on-first-error, code-check-blocked, offline-queued, or zero-diagnostic failure).
 */

import React from 'react';
import {
  AlertTriangle,
  Ban,
  CloudOff,
  Clock,
  RefreshCw,
  ShieldAlert,
  Trash2,
  WifiOff,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  CompileOutcome,
  CompileValidationIssue,
  DiagnosticsSummary,
} from '@/features/editor/domain/types/compiler.types';

export interface CompileOutcomeCardProps {
  outcome?: CompileOutcome | null;
  errorCount: number;
  errorMessage?: string | null;
  validationIssues?: CompileValidationIssue[];
  summary?: DiagnosticsSummary | null;
  onCompile?: () => void;
  onClearCacheAndCompile?: () => void;
  onJumpToFirstError?: () => void;
  className?: string;
}

export const CompileOutcomeCard = React.memo(function CompileOutcomeCard({
  outcome,
  errorCount,
  errorMessage,
  validationIssues,
  summary,
  onCompile,
  onClearCacheAndCompile,
  onJumpToFirstError,
  className,
}: CompileOutcomeCardProps) {
  if (!outcome) {
    return null;
  }

  // When outcome is clean success and no diagnostics were capped/suppressed, omit card
  const hasSummaryNotice =
    Boolean(summary?.truncated) || (summary?.suppressedCascadeCount ?? 0) > 0;

  if (outcome === 'success' && errorCount === 0 && !hasSummaryNotice) {
    return null;
  }

  // If failure already has parsed diagnostics and no summary notice, banner/list handles it
  if (outcome === 'failure' && errorCount > 0 && !hasSummaryNotice) {
    return null;
  }

  let title = '';
  let description = errorMessage || '';
  let tone: 'error' | 'warning' | 'neutral' = 'warning';
  let Icon: React.ComponentType<{ className?: string }> = AlertTriangle;

  switch (outcome) {
    case 'timedout':
      title = 'Compilation timed out';
      description =
        description ||
        'LaTeX took too long to finish. Check for infinite macro loops, large uncached figures, or clear cache and retry.';
      tone = 'error';
      Icon = Clock;
      break;
    case 'terminated':
      title = 'Compilation stopped';
      description = description || 'The compile run was cancelled before completion.';
      tone = 'neutral';
      Icon = Ban;
      break;
    case 'validation-problems':
      title = 'Pre-compile project validation issues';
      description =
        description ||
        'Resolve project structure, missing main file, or oversized asset issues below before compiling.';
      tone = 'error';
      Icon = ShieldAlert;
      break;
    case 'clsi-unavailable':
      title = 'Compiler service unavailable';
      description =
        description ||
        'Could not reach the LaTeX compile service (CLSI). Your files remain safe; retry in a moment.';
      tone = 'error';
      Icon = CloudOff;
      break;
    case 'code-check-blocked':
      title = 'Auto-compile paused by Code Check';
      description =
        description ||
        'A hard syntax error was detected locally. Fix the highlighted syntax issue or click Compile anyway to force a build.';
      tone = 'warning';
      Icon = ShieldAlert;
      break;
    case 'rate-limited':
      title = 'Compilation paused — rate limit or high load';
      description =
        description ||
        'Too many compile requests arrived in a short window or background auto-compile was deferred under load. Retry in a moment.';
      tone = 'warning';
      Icon = Clock;
      break;
    case 'offline-queued':
      title = 'Offline — compile queued';
      description =
        description ||
        'Network connection is offline. Compilation will resume automatically once connectivity returns.';
      tone = 'neutral';
      Icon = WifiOff;
      break;
    case 'stopped-on-first-error':
      title = 'Stopped on first fatal error';
      description =
        description ||
        'Compilation halted at the first TeX error (-halt-on-error). Cascading follow-up messages are suppressed.';
      tone = 'error';
      Icon = AlertTriangle;
      break;
    case 'failure':
      if (errorCount === 0) {
        title = 'Compilation failed';
        description =
          description ||
          'Compilation exited with an error without structured LaTeX diagnostics. Inspect the raw output.log below.';
        tone = 'error';
        Icon = AlertTriangle;
      }
      break;
    case 'success':
      if (hasSummaryNotice) {
        title = 'Build completed with filtered notices';
        tone = 'neutral';
      }
      break;
  }

  if (!title && !hasSummaryNotice) {
    return null;
  }

  const toneClasses =
    tone === 'error'
      ? 'border-destructive/30 bg-destructive/8 text-destructive'
      : tone === 'warning'
        ? 'border-amber-500/35 bg-amber-500/8 text-amber-700 dark:text-amber-300'
        : 'border-border bg-muted/40 text-foreground';

  return (
    <div
      data-testid="compile-outcome-card"
      data-outcome={outcome}
      className={cn(
        'rounded-md border px-3.5 py-2.5 text-xs space-y-2',
        toneClasses,
        className,
      )}
    >
      {title && (
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Icon className="size-4 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-0.5">
              <div className="font-semibold leading-tight">{title}</div>
              {description && (
                <p className="text-[11px] opacity-85 leading-relaxed break-words">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {outcome === 'code-check-blocked' && onJumpToFirstError && (
              <button
                type="button"
                onClick={onJumpToFirstError}
                className="inline-flex items-center gap-1 rounded border border-current/25 px-2 py-1 text-[11px] font-medium hover:bg-background/50 transition-colors cursor-pointer"
              >
                <span>Jump to error</span>
                <ArrowRight className="size-3" />
              </button>
            )}
            {onCompile &&
              (outcome === 'timedout' ||
                outcome === 'terminated' ||
                outcome === 'clsi-unavailable' ||
                outcome === 'rate-limited' ||
                outcome === 'code-check-blocked' ||
                outcome === 'offline-queued') && (
                <button
                  type="button"
                  onClick={onCompile}
                  className="inline-flex items-center gap-1 rounded border border-current/25 px-2 py-1 text-[11px] font-medium hover:bg-background/50 transition-colors cursor-pointer"
                >
                  <RefreshCw className="size-3" />
                  <span>
                    {outcome === 'code-check-blocked' ? 'Compile anyway' : 'Retry compile'}
                  </span>
                </button>
              )}
            {onClearCacheAndCompile && (outcome === 'timedout' || (outcome === 'failure' && errorCount === 0)) && (
              <button
                type="button"
                onClick={onClearCacheAndCompile}
                className="inline-flex items-center gap-1 rounded border border-current/25 px-2 py-1 text-[11px] font-medium hover:bg-background/50 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3" />
                <span>Clear cache &amp; retry</span>
              </button>
            )}
          </div>
        </div>
      )}

      {validationIssues && validationIssues.length > 0 && (
        <ul className="space-y-1 border-t border-current/15 pt-1.5 text-[11px] font-mono">
          {validationIssues.map((issue, idx) => {
            const detail =
              issue.code === 'mainFile'
                ? issue.mainFile
                : issue.code === 'conflictedPaths'
                  ? issue.paths.join(', ')
                  : issue.offendingFiles.map((file) => file.path).join(', ');
            return (
              <li key={`${issue.code}-${idx}`} className="flex items-start gap-1.5">
                <span className="font-semibold shrink-0">[{issue.code}]</span>
                <span className="break-words">
                  {detail ? `${detail}: ` : ''}
                  {issue.message}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {hasSummaryNotice && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-85 border-t border-current/15 pt-1.5">
          {(summary?.suppressedCascadeCount ?? 0) > 0 && (
            <span>
              {summary?.suppressedCascadeCount} cascading follow-up diagnostic
              {summary?.suppressedCascadeCount === 1 ? '' : 's'} suppressed.
            </span>
          )}
          {summary?.truncated && summary && (
            <span>
              Diagnostics list capped ({summary.totalErrors} errors, {summary.totalWarnings} warnings, {summary.totalBadboxes} bad boxes detected before cap).
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default CompileOutcomeCard;
