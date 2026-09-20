'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Terminal,
  Zap,
} from 'lucide-react';
import { useCompileStore, usePageStore, useSettingsStore, type CompileStatus } from '@/features/editor/store';
import type { ParsedLog } from './Logs';
import { fetchWordCount } from '@/features/editor/services/compiler.service';
import RawLogModal from './RawLogModal';
import { WordCountDialog } from '../editor/subcomponents/WordCountDialog';

export interface StatusProps {
  compileStatus: CompileStatus;
  lastCompiledAt: Date | null;
  pdfUrl: string | null;
  parsedLog: ParsedLog | null;
  onToggleLog: () => void;
  onJumpToFirstError?: () => void;
}

export default React.memo(function Status({
  compileStatus,
  lastCompiledAt,
  pdfUrl,
  parsedLog,
  onToggleLog,
  onJumpToFirstError,
}: StatusProps) {
  const getEditorContent = usePageStore((s) => s.getEditorContent);
  const compileLog = useCompileStore((s) => s.compileLog);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [rawLogOpen, setRawLogOpen] = useState(false);
  const [wordCountOpen, setWordCountOpen] = useState(false);

  useEffect(() => {
    if (compileStatus === 'done') {
      const src = getEditorContent.current?.();
      if (src && src.trim().length > 0) {
        fetchWordCount(src)
          .then((res) => {
            if (res.success && res.stats) {
              setWordCount(res.stats.wordsInText);
            }
          })
          .catch(() => {});
      }
    }
  }, [compileStatus, getEditorContent]);

  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-secondary text-xs text-muted-foreground shrink-0">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-2"
      >
        {autoCompile && (
          <span
            title="Auto-compile is active (2.5s typing idle)"
            className="inline-flex items-center gap-1 text-10 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-medium select-none"
          >
            <Zap className="size-2.5" />
            Auto
          </span>
        )}
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

        {/* Overleaf Parity: Jump to First Error Shortcut */}
        {parsedLog && parsedLog.errors.length > 0 && onJumpToFirstError && (
          <button
            type="button"
            onClick={onJumpToFirstError}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors cursor-pointer"
            title="Jump directly to the first error in code"
          >
            <span>Jump to first error</span>
          </button>
        )}

        {/* Overleaf Parity: Raw Logs Modal Trigger */}
        {(compileStatus === 'error' || compileStatus === 'done') && compileLog && (
          <button
            type="button"
            onClick={() => setRawLogOpen(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            title="View Raw LaTeX Engine Log"
          >
            <Terminal className="size-3 text-muted-foreground" />
            <span>Raw Logs</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {wordCount !== null && (
          <button
            type="button"
            onClick={() => setWordCountOpen(true)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 px-1.5 py-0.5 rounded transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Click to view full TeXcount statistics breakdown"
          >
            <FileText className="size-3 text-primary shrink-0" />
            <span className="font-medium">{wordCount.toLocaleString()} words</span>
          </button>
        )}
        {pdfUrl && compileStatus !== 'compiling' && (
          <span className="text-success font-medium">PDF ready</span>
        )}
      </div>

      {/* Raw Logs Modal */}
      <RawLogModal
        open={rawLogOpen}
        onOpenChange={setRawLogOpen}
        logs={compileLog || ''}
        hasErrors={compileStatus === 'error'}
      />

      {/* TeXcount Word Count Modal */}
      <WordCountDialog
        open={wordCountOpen}
        onClose={() => setWordCountOpen(false)}
        content={getEditorContent.current?.() ?? ''}
      />
    </div>
  );
});
