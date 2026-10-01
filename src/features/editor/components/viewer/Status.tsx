'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Zap,
} from 'lucide-react';
import { useSettingsStore, type CompileStatus } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import type { ParsedLog } from './Logs';
import { fetchWordCount } from '@/features/editor/services/compiler.service';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export interface StatusProps {
  compileStatus: CompileStatus;
  lastCompiledAt: Date | null;
  pdfUrl: string | null;
  parsedLog?: ParsedLog | null;
  onToggleLog: () => void;
  onJumpToFirstError?: () => void;
}

export default React.memo(function Status({
  compileStatus,
  lastCompiledAt,
  pdfUrl,
  onToggleLog,
}: StatusProps) {
  const { getContent } = useEditorInstance();
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const [wordCount, setWordCount] = useState<number | null>(null);

  useEffect(() => {
    if (compileStatus === 'done') {
      const src = getContent();
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
  }, [compileStatus, getContent]);

  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-secondary text-xs text-muted-foreground shrink-0 select-none">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-2"
      >
        {autoCompile && (
          <span
            title="Auto-compile (2.5s)"
            className="inline-flex items-center gap-1 text-11 px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-mono font-medium select-none"
          >
            <Zap className="size-3" />
            Auto
          </span>
        )}
        {compileStatus === 'flushing' && (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin shrink-0" />
            Preparing…
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
        {compileStatus === 'error' && (
          <button
            type="button"
            onClick={onToggleLog}
            className="flex items-center gap-1 text-destructive hover:opacity-80 transition-opacity cursor-pointer font-medium"
            title="Compilation failed (Click to view logs)"
          >
            <AlertCircle className="size-3 shrink-0" />
            <span>Compilation failed</span>
          </button>
        )}
        {compileStatus === 'done' && lastCompiledAt && (
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="size-3 shrink-0" />
            {lastCompiledAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {wordCount !== null && (
          <button
            type="button"
            onClick={() => EditorEventBus.emit('flux:open-word-count')}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted px-1.5 py-0.5 rounded-sm text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Word count (TeXcount)"
          >
            <FileText className="size-3 text-primary shrink-0" />
            <span className="font-medium">{wordCount.toLocaleString()} words</span>
          </button>
        )}
        {pdfUrl && compileStatus !== 'compiling' && (
          <span className="text-success font-medium">PDF ready</span>
        )}
      </div>
    </div>
  );
});
