'use client';

/**
 * DetachedPdfPlaceholder.tsx
 *
 * Dedicated placeholder displayed in the main workbench when PDF Preview
 * has been detached/popped out into a separate window or tab.
 * Location: `features/editor/subsystems/compiler/ui/DetachedPdfPlaceholder.tsx`
 */

import React from 'react';
import { ExternalLink, Minimize2, CheckCircle2, AlertCircle, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { editorCommandBus, useCompileStore, useSettingsStore } from '@/features/editor/core';
import { cn } from '@/shared/lib/utils';

export function DetachedPdfPlaceholder() {
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const lastCompiledAt = useCompileStore((s) => s.lastCompiledAt);
  const layout = useSettingsStore((s) => s.layout);
  const setLayout = useSettingsStore((s) => s.setLayout);

  const handleReattach = () => {
    editorCommandBus.dispatch({ type: 'preview:attach' });
  };

  const handleExpandEditor = () => {
    setLayout('editor-only');
  };

  const formattedTime = lastCompiledAt
    ? new Date(lastCompiledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div
      data-testid="detached-pdf-placeholder"
      className="h-full w-full flex flex-col items-center justify-center p-6 bg-canvas text-foreground select-none overflow-y-auto"
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center p-6 rounded-xl border border-border/80 bg-card shadow-sm space-y-4">
        {/* Icon & Popout Badge */}
        <div className="relative">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <ExternalLink className="size-6 stroke-[1.8]" />
          </div>
          <span className="absolute -bottom-1 -right-1 size-3 rounded-full bg-emerald-500 ring-2 ring-card" />
        </div>

        {/* Headings */}
        <div className="space-y-1.5">
          <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
            PDF is open in a separate window
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Real-time compile updates and bidirectional SyncTeX navigation remain active across windows.
          </p>
        </div>

        {/* Sync / Compilation Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border/40 text-[11px] font-medium">
          {compileStatus === 'compiling' ? (
            <>
              <Loader2 className="size-3.5 text-amber-500 animate-spin" />
              <span className="text-muted-foreground">Compiling document…</span>
            </>
          ) : compileStatus === 'error' ? (
            <>
              <AlertCircle className="size-3.5 text-destructive" />
              <span className="text-destructive font-medium">Compilation error</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span className="text-muted-foreground">
                Synchronized {formattedTime ? `(${formattedTime})` : ''}
              </span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-2 pt-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleReattach}
            className="w-full sm:flex-1 h-8 text-xs gap-1.5 font-medium shadow-sm cursor-pointer"
          >
            <Minimize2 className="size-3.5" />
            <span>Re-attach PDF</span>
          </Button>

          {layout !== 'editor-only' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExpandEditor}
              className="w-full sm:flex-1 h-8 text-xs gap-1.5 font-medium cursor-pointer border-border hover:bg-muted"
            >
              <Maximize2 className="size-3.5" />
              <span>Full-width editor</span>
            </Button>
          )}
        </div>

        {/* SyncTeX Tips */}
        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground/80 space-y-1 text-left w-full">
          <div className="flex items-start gap-1.5">
            <span className="text-primary font-semibold">•</span>
            <span>Click inside the detached PDF to jump to corresponding code lines.</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-primary font-semibold">•</span>
            <span>Closing the separate tab or clicking Re-attach restores preview here.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetachedPdfPlaceholder;
