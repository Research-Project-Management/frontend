/**
 * StatusBar.tsx
 *
 * Canonical VS Code-Style Status Bar (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/StatusBar.tsx`
 *
 * Provides the interactive footer strip (24px) at the bottom:
 * - Left: Git branch, Problems counter (clickable), Sync status, In-flight compiler status.
 * - Right: Vim Mode badge, Cursor coordinates (Ln, Col), Encoding, Indent, Compiler Engine, Panel Toggle.
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
  Terminal,
  FileText,
  Cloud,
  CloudOff,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useLayoutStore } from '../../store/layout.store';
import { useCompilerStore } from '../../store/compiler.store';
import { useSettingsStore } from '../../store/settings.store';
import { useConnectivityStore } from '../../store/connectivity.store';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { editorCommandBus } from '../../coordinators/command-bus';

export function StatusBar() {
  const bottomPanelOpen = useLayoutStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useLayoutStore((s) => s.toggleBottomPanel);
  const openBottomTab = useLayoutStore((s) => s.openBottomTab);

  const compileStatus = useCompilerStore((s) => s.compileStatus);
  const compileErrors = useCompilerStore((s) => s.compileErrors);

  const keybinding = useSettingsStore((s) => s.keybinding);
  const latexEngine = useSettingsStore((s) => (s as any).latexEngine || s.engine);

  const { engine } = useEditorInstance();

  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [vimMode, setVimMode] = useState<string>('NORMAL');

  // Listen to cursor updates from engine or bus
  useEffect(() => {
    if (!engine) return;
    const unsub = engine.onCursorChange((line: number, col: number) => {
      setCursorPos({ line, col });
    });
    return unsub;
  }, [engine]);

  // Count errors and warnings
  const errorCount = compileErrors.filter((e) => e.severity === 'error' || !e.severity).length;
  const warningCount = compileErrors.filter((e) => e.severity === 'warning').length;

  const isCompiling = compileStatus === 'compiling';
  const hasErrors = errorCount > 0;

  const isOnline = useConnectivityStore((s) => s.isOnline);
  const syncStatus = useConnectivityStore((s) => s.syncStatus);
  const pendingSaveCount = useConnectivityStore((s) => s.pendingSaveCount);

  return (
    <footer
      aria-label="Status Bar"
      className="h-6 w-full shrink-0 flex items-center justify-between border-t border-border bg-sidebar px-3 text-[11px] font-mono text-muted-foreground select-none z-30"
    >
      {/* ── Left Items ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Branch / Workspace */}
        <div className="flex items-center gap-1 hover:text-foreground transition-colors cursor-default">
          <GitBranch className="size-3 shrink-0" />
          <span>main</span>
        </div>

        {/* Cloud Sync Status Indicator */}
        {!isOnline ? (
          <div
            className="flex items-center gap-1 text-amber-500 font-medium"
            title="You are currently offline. Changes are saved locally and will sync once reconnected."
          >
            <WifiOff className="size-3 shrink-0" />
            <span>Offline</span>
          </div>
        ) : syncStatus === 'saving' || pendingSaveCount > 0 ? (
          <div className="flex items-center gap-1 text-sky-400" title="Saving changes to cloud...">
            <Loader2 className="size-3 animate-spin shrink-0" />
            <span>Saving...</span>
          </div>
        ) : syncStatus === 'error' ? (
          <div className="flex items-center gap-1 text-destructive font-medium" title="Failed to sync changes with cloud. Will retry automatically.">
            <CloudOff className="size-3 shrink-0" />
            <span>Sync Error</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground/80 hover:text-foreground transition-colors cursor-default" title="All changes saved to cloud">
            <Cloud className="size-3 shrink-0 text-emerald-500/80" />
            <span className="hidden sm:inline">Saved</span>
          </div>
        )}

        {/* Problems Badge (Clickable to open Problems Panel) */}
        <button
          type="button"
          onClick={() => openBottomTab('problems')}
          className={cn(
            'flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
            hasErrors
              ? 'bg-destructive/15 text-destructive font-semibold hover:bg-destructive/25'
              : warningCount > 0
              ? 'bg-warning/15 text-warning font-semibold hover:bg-warning/25'
              : 'hover:text-foreground hover:bg-sidebar-hover'
          )}
          title="Toggle Problems View"
        >
          <div className="flex items-center gap-1">
            <AlertCircle className="size-3 shrink-0" />
            <span>{errorCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="size-3 shrink-0" />
            <span>{warningCount}</span>
          </div>
        </button>

        {/* Compiler Progress Indicator */}
        {isCompiling ? (
          <div className="flex items-center gap-1.5 text-primary">
            <Loader2 className="size-3 animate-spin shrink-0" />
            <span>Compiling...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-success">
            <Check className="size-3 shrink-0" />
            <span>Ready</span>
          </div>
        )}
      </div>

      {/* ── Right Items ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Vim Mode indicator (if enabled) */}
        {keybinding === 'vim' && (
          <span className="px-1.5 py-0.2 rounded-xs bg-primary/20 text-primary font-semibold tracking-wider text-[10px]">
            {vimMode}
          </span>
        )}

        {/* Word Count trigger */}
        <button
          type="button"
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' })}
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
          title="Open Word Count statistics"
        >
          <FileText className="size-3 shrink-0" />
          <span>Words</span>
        </button>

        {/* Cursor Position: Ln X, Col Y */}
        <div className="hover:text-foreground transition-colors cursor-default">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
        </div>

        {/* Encoding */}
        <span className="hover:text-foreground transition-colors cursor-default hidden sm:inline">
          UTF-8
        </span>

        {/* Indentation */}
        <span className="hover:text-foreground transition-colors cursor-default hidden sm:inline">
          Spaces: 2
        </span>

        {/* LaTeX Compiler Engine */}
        <span className="hover:text-foreground transition-colors cursor-default px-1 py-0.2 rounded-xs bg-secondary/60">
          {latexEngine || 'pdfLaTeX'}
        </span>

        {/* Toggle Bottom Dock Panel */}
        <button
          type="button"
          onClick={toggleBottomPanel}
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
            bottomPanelOpen
              ? 'bg-sidebar-accent text-foreground font-semibold'
              : 'hover:text-foreground hover:bg-sidebar-hover'
          )}
          title="Toggle Problems & Output Terminal (Ctrl+J)"
        >
          <Terminal className="size-3 shrink-0" />
          <span className="hidden sm:inline">Panel</span>
        </button>
      </div>
    </footer>
  );
}

export default StatusBar;
