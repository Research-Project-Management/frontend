'use client';

import React from 'react';
import { ExternalLink, ArrowDownToDot, Eye, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { CompileStatus } from '@/features/editor/store';

export interface DetachedViewerPlaceholderProps {
  onReattach: () => void;
  onFocusWindow?: () => void;
  compileStatus: CompileStatus;
  lastCompiledAt: Date | null;
}

export default function DetachedViewerPlaceholder({
  onReattach,
  onFocusWindow,
  compileStatus,
  lastCompiledAt,
}: DetachedViewerPlaceholderProps) {
  const isRunning =
    compileStatus !== 'idle' && compileStatus !== 'done' && compileStatus !== 'error';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-muted/30 select-none text-center animate-in fade-in duration-200">
      <div className="relative mb-6">
        <div className="size-20 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
          <ExternalLink className="size-10" strokeWidth={1.5} />
        </div>
        <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-background border border-border shadow-2xs flex items-center justify-center">
          {isRunning ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : compileStatus === 'error' ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-500" />
          )}
        </div>
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1.5">
        PDF Viewer is open in a separate window
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        Full 2-way SyncTeX and real-time updates are active. Double-click on the PDF to jump to code here, or press <kbd className="px-1.5 py-0.5 rounded-sm bg-muted border border-border font-mono text-10">Ctrl+Enter</kbd> to recompile.
      </p>

      <div className="flex items-center gap-2.5">
        <Button
          variant="default"
          size="sm"
          onClick={onReattach}
          className="gap-1.5 h-8 text-xs font-medium rounded-md cursor-pointer shadow-2xs bg-primary hover:bg-primary-hover text-primary-foreground"
        >
          <ArrowDownToDot className="size-3.5" />
          Re-attach to Editor
        </Button>
        {onFocusWindow && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFocusWindow}
            className="gap-1.5 h-8 text-xs font-medium rounded-md border-border bg-background hover:bg-muted text-foreground shadow-2xs cursor-pointer"
          >
            <Eye className="size-3.5" />
            Focus Window
          </Button>
        )}
      </div>

      {lastCompiledAt && (
        <div className="mt-8 text-[11px] text-muted-foreground/80 flex items-center gap-1.5 font-mono">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Last compiled at {lastCompiledAt.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
