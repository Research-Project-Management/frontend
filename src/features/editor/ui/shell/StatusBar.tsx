/**
 * StatusBar.tsx
 *
 * Canonical VS Code / Overleaf-Style Status Bar (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/StatusBar.tsx`
 *
 * Information Architecture & Ordering:
 * - Left (Workspace & Engine Health):
 *   1. Git Branch: Active working branch.
 *   2. Cloud Sync: Realtime Yjs & backend persistence status.
 *   3. Build & Diagnostics Pill: Single source of truth for build progress & problems,
 *      clicking toggles the bottom dock panel seamlessly.
 *
 * - Right (Active Editor & Document Context):
 *   1. Vim Mode: Active modal state (if enabled).
 *   2. Cursor Position: Ln X, Col Y in active document.
 *   3. Word Count: Live estimated word count with 1-click full metrics dialog.
 *   4. Indentation: Editor spaces/tabs configuration.
 *   5. Encoding: Character encoding (UTF-8).
 *   6. Engine: Active TeX compiler backend (pdfLaTeX / XeLaTeX / LuaLaTeX).
 *
 * Strictly compliant with DESIGN.md semantic tokens and WCAG AA accessibility standards.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
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
  const setBottomPanelOpen = useLayoutStore((s) => s.setBottomPanelOpen);
  const setActiveBottomTab = useLayoutStore((s) => s.setActiveBottomTab);

  const compileStatus = useCompilerStore((s) => s.compileStatus);
  const compileErrors = useCompilerStore((s) => s.compileErrors);

  const keybinding = useSettingsStore((s) => s.keybinding);
  const latexEngine = useSettingsStore((s) => (s as any).latexEngine || s.engine);

  const { engine } = useEditorInstance();

  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [vimMode] = useState<string>('NORMAL');
  const [wordCount, setWordCount] = useState<number | null>(null);

  // Listen to cursor updates from editor engine
  useEffect(() => {
    if (!engine) return;
    const unsub = engine.onCursorChange((line: number, col: number) => {
      setCursorPos({ line, col });
    });
    return unsub;
  }, [engine]);

  // Live estimated word count calculation
  useEffect(() => {
    if (!engine) return;
    const calculateWords = () => {
      const text = engine.getContent();
      if (!text) {
        setWordCount(0);
        return;
      }
      // Heuristic LaTeX word counter (strips TeX comments and control sequences)
      const stripped = text
        .replace(/%.*$/gm, ' ')
        .replace(/\\[a-zA-Z]+(?:\*|\b)(?:\[[^\]]*\])?(?:\{[^\}]*\})?/g, ' ')
        .replace(/[{}$_&~^\\]/g, ' ');
      const words = stripped.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(words);
    };

    calculateWords();
    const interval = setInterval(calculateWords, 4000);
    return () => clearInterval(interval);
  }, [engine]);

  // Diagnostic counts
  const errorCount = compileErrors.filter((e) => e.severity === 'error' || !e.severity).length;
  const warningCount = compileErrors.filter((e) => e.severity === 'warning').length;

  const isCompiling = compileStatus === 'compiling';
  const hasErrors = errorCount > 0;

  // Connectivity & Cloud Sync state
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const syncStatus = useConnectivityStore((s) => s.syncStatus);
  const pendingSaveCount = useConnectivityStore((s) => s.pendingSaveCount);

  // Single Source of Truth for Bottom Panel Toggle
  const handleTogglePanel = useCallback(() => {
    if (bottomPanelOpen) {
      setBottomPanelOpen(false);
    } else {
      setActiveBottomTab(hasErrors || warningCount > 0 ? 'problems' : 'output');
      setBottomPanelOpen(true);
    }
  }, [bottomPanelOpen, hasErrors, warningCount, setBottomPanelOpen, setActiveBottomTab]);

  return (
    <footer
      aria-label="Status Bar"
      className="h-6 w-full shrink-0 flex items-center justify-between border-t border-border bg-sidebar px-3 text-11 font-mono text-muted-foreground select-none z-30"
    >
      {/* ── Left Zone: Workspace & Engine Health ────────────────────────────── */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* 1. Git Branch */}
        <div
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-default shrink-0"
          title="Current Git branch"
        >
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate max-w-[80px] sm:max-w-none">main</span>
        </div>

        {/* 2. Cloud Sync Status Indicator */}
        {!isOnline ? (
          <div
            className="flex items-center gap-1 text-warning font-medium shrink-0"
            title="You are currently offline. Changes are saved locally and will sync once reconnected."
          >
            <WifiOff className="size-3 shrink-0" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        ) : syncStatus === 'saving' || pendingSaveCount > 0 ? (
          <div
            className="flex items-center gap-1 text-primary font-medium shrink-0"
            title="Saving changes to cloud..."
          >
            <Loader2 className="size-3 animate-spin shrink-0" />
            <span className="hidden sm:inline">Saving...</span>
          </div>
        ) : syncStatus === 'error' ? (
          <div
            className="flex items-center gap-1 text-destructive font-medium shrink-0"
            title="Failed to sync changes with cloud. Will retry automatically."
          >
            <CloudOff className="size-3 shrink-0" />
            <span className="hidden sm:inline">Sync Error</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-default shrink-0"
            title="All changes saved to cloud"
          >
            <Cloud className="size-3 shrink-0 text-success" />
            <span className="hidden sm:inline">Saved</span>
          </div>
        )}

        {/* Divider */}
        <div className="h-3 w-px bg-border/60 shrink-0" />

        {/* 3. Unified Build & Diagnostics Pill (Single Dock Toggle) */}
        <button
          type="button"
          onClick={handleTogglePanel}
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-sm transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none shrink-0',
            bottomPanelOpen
              ? 'bg-muted text-foreground font-semibold ring-1 ring-border/80'
              : hasErrors
              ? 'bg-destructive/15 text-destructive font-semibold hover:bg-destructive/25'
              : warningCount > 0
              ? 'bg-warning/15 text-warning font-semibold hover:bg-warning/25'
              : 'hover:text-foreground hover:bg-muted/50'
          )}
          title={
            bottomPanelOpen
              ? 'Close bottom panel (Ctrl+J)'
              : hasErrors
              ? `${errorCount} errors detected. Click to toggle Problems view.`
              : warningCount > 0
              ? `${warningCount} warnings detected. Click to toggle Problems view.`
              : 'Compiler ready. Click to open bottom panel (Ctrl+J).'
          }
        >
          {isCompiling ? (
            <>
              <Loader2 className="size-3 animate-spin text-primary shrink-0" />
              <span className="text-primary font-medium">Compiling...</span>
            </>
          ) : hasErrors ? (
            <>
              <AlertCircle className="size-3 text-destructive shrink-0" />
              <span className="font-semibold">{errorCount}</span>
              {warningCount > 0 && (
                <>
                  <AlertTriangle className="size-3 text-warning shrink-0 ml-0.5" />
                  <span className="font-semibold">{warningCount}</span>
                </>
              )}
            </>
          ) : warningCount > 0 ? (
            <>
              <AlertTriangle className="size-3 text-warning shrink-0" />
              <span className="font-semibold">{warningCount}</span>
            </>
          ) : (
            <>
              <Check className="size-3 text-success shrink-0" />
              <span className="text-success font-medium">Ready</span>
            </>
          )}
        </button>
      </div>

      {/* ── Right Zone: Active Editor & Document Context ─────────────────────── */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 select-none">
        {/* 1. Vim Mode Indicator (if enabled) */}
        {keybinding === 'vim' && (
          <span className="px-1.5 py-0.2 rounded-xs bg-primary/15 text-primary font-semibold tracking-wider text-11">
            {vimMode}
          </span>
        )}

        {/* 2. Cursor Coordinates: Ln X, Col Y */}
        <div
          className="hover:text-foreground transition-colors cursor-default"
          title="Cursor line and column position"
        >
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        </div>

        {/* 3. Live Word Count with Modal Trigger */}
        <button
          type="button"
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' })}
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
          title="Document word count (Click for detailed statistics)"
        >
          <FileText className="size-3 shrink-0" />
          <span>
            {wordCount != null ? (
              <>
                {wordCount.toLocaleString()} <span className="hidden sm:inline">words</span>
              </>
            ) : (
              'Words'
            )}
          </span>
        </button>

        {/* 4. Indentation */}
        <span
          className="hover:text-foreground transition-colors cursor-default hidden sm:inline"
          title="Indentation configuration"
        >
          Spaces: 2
        </span>

        {/* 5. Character Encoding */}
        <span
          className="hover:text-foreground transition-colors cursor-default hidden md:inline"
          title="File character encoding"
        >
          UTF-8
        </span>

        {/* 6. LaTeX Compiler Engine */}
        <span
          className="hover:text-foreground transition-colors cursor-default px-1.5 py-0.2 rounded-xs bg-muted/60 text-foreground font-medium"
          title="Active LaTeX Compiler Engine"
        >
          {latexEngine || 'pdfLaTeX'}
        </span>
      </div>
    </footer>
  );
}

export default StatusBar;
