'use client';

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Terminal,
} from 'lucide-react';
import type { CompileStatus } from '@/features/editor/store/compile.store';
import type { ParsedLog } from './Logs';

export interface StatusProps {
  compileStatus: CompileStatus;
  lastCompiledAt: Date | null;
  pdfUrl: string | null;
  parsedLog: ParsedLog | null;
  onToggleLog: () => void;
}

export default function Status({
  compileStatus,
  lastCompiledAt,
  pdfUrl,
  parsedLog,
  onToggleLog,
}: StatusProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-secondary text-xs text-muted-foreground shrink-0">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-2"
      >
        {compileStatus === 'flushing' && (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin shrink-0" />
            Saving…
          </span>
        )}
        {compileStatus === 'syncing' && (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin shrink-0" />
            Syncing…
          </span>
        )}
        {compileStatus === 'compiling' && (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin shrink-0" />
            Compiling…
          </span>
        )}
        {compileStatus === 'done' && lastCompiledAt && (
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="size-3 shrink-0" />
            {lastCompiledAt.toLocaleTimeString()}
          </span>
        )}
        {parsedLog && (compileStatus === 'error' || compileStatus === 'done') && (
          <button
            type="button"
            onClick={onToggleLog}
            aria-label={`Toggle build log: ${parsedLog.errors.length} errors, ${parsedLog.warnings.length} warnings`}
            className="flex items-center gap-1.5 hover:opacity-75 transition-opacity outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1"
          >
            {parsedLog.errors.length > 0 && (
              <span className="flex items-center gap-0.5 text-destructive">
                <AlertCircle className="size-3 shrink-0" />
                {parsedLog.errors.length} error{parsedLog.errors.length !== 1 ? 's' : ''}
              </span>
            )}
            {parsedLog.warnings.length > 0 && (
              <span className="flex items-center gap-0.5 text-warning">
                <AlertTriangle className="size-3 shrink-0" />
                {parsedLog.warnings.length} warning{parsedLog.warnings.length !== 1 ? 's' : ''}
              </span>
            )}
            {parsedLog.errors.length === 0 && parsedLog.warnings.length === 0 && (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <Terminal className="size-3 shrink-0" />
                Log
              </span>
            )}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {pdfUrl && compileStatus !== 'compiling' && (
          <span className="text-success font-medium">PDF ready</span>
        )}
      </div>
    </div>
  );
}
