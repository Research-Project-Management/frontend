/**
 * UnifiedCodeMirrorEditor.tsx
 *
 * Unified CodeMirror 6 Cockpit for Flux (Overleaf 1:1 Parity):
 * - Unified single LaTeX document buffer in memory for both Source and Visual modes.
 * - 0ms instant mode switching via CodeMirror Compartments.
 * - KaTeX in-place math popover editor.
 * - Native Vim mode keybindings via @replit/codemirror-vim (:w / :write save & compile).
 * - Real-time multiplayer CRDT collaboration via y-codemirror.next (yCollab).
 * - Plugs into IEditorEngine via CodeMirrorEngineAdapter.
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { foldGutter, foldKeymap, bracketMatching } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { vim, Vim } from '@replit/codemirror-vim';
import { yCollab } from 'y-codemirror.next';
import type * as Y from 'yjs';

import { useEditorInstance } from '../../core/context/editor-instance.context';
import { CodeMirrorEngineAdapter } from '../../adapters/codemirror/codemirror.adapter';
import { getEditorTheme } from '../../sub-features/code-editor/codemirror/theme';
import {
  latexLanguage,
  lineHighlightField,
} from '../../sub-features/code-editor/codemirror/latex-language';
import { createLatexCompletionSource } from '../../sub-features/code-editor/codemirror/latex-autocomplete';
import {
  latexVisualPlugin,
  setMathEditCallback,
  type MathPopoverTrigger,
} from '../../sub-features/code-editor/codemirror/latex-visual-plugin';
import { MathInlinePopover } from '../../sub-features/code-editor/codemirror/MathInlinePopover';
import { EditorEventBus } from '../../utils/editor.util';
import { editorCommandBus } from '../../core/command-bus/editor-command-bus';
import { useSettingsStore } from '../../store';
import { cn } from '@/shared/lib/utils';

export interface UnifiedCodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  isDarkTheme?: boolean;
  readOnly?: boolean;
  bibEntries?: any[];
  onSyncTexReverse?: (line: number, col: number) => void;
  keybinding?: string;
  yText?: Y.Text | null;
  awareness?: any | null;
}

export default function UnifiedCodeMirrorEditor({
  value,
  onChange,
  isDarkTheme = false,
  readOnly = false,
  bibEntries = [],
  onSyncTexReverse,
  keybinding,
  yText,
  awareness,
}: UnifiedCodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const adapterRef = useRef<CodeMirrorEngineAdapter | null>(null);
  const { setEngine } = useEditorInstance();

  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);
  const storeKeybinding = useSettingsStore((s) => s.keybinding);

  const [mathTrigger, setMathTrigger] = useState<MathPopoverTrigger | null>(null);

  // Compartments for dynamic reconfiguration without recreating editor
  const modeCompartmentRef = useRef(new Compartment());
  const themeCompartmentRef = useRef(new Compartment());
  const readOnlyCompartmentRef = useRef(new Compartment());
  const keybindingCompartmentRef = useRef(new Compartment());
  const collabCompartmentRef = useRef(new Compartment());

  // Listen for math widget clicks
  useEffect(() => {
    setMathEditCallback((trigger) => {
      setMathTrigger(trigger);
    });
    return () => {
      setMathEditCallback(null);
    };
  }, []);

  // Register Vim Ex commands (:w, :write, :wq to compile & save)
  useEffect(() => {
    try {
      Vim.defineEx('write', 'w', () => {
        editorCommandBus.dispatch({ type: 'compiler:trigger' });
      });
      Vim.defineEx('wq', 'wq', () => {
        editorCommandBus.dispatch({ type: 'compiler:trigger' });
      });
    } catch {
      // Ex commands already defined in shared namespace
    }
  }, []);

  // ── Mount CodeMirror 6 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const bibKeys = bibEntries.map((b: any) => b.id || b.key || b.citationKey).filter(Boolean);
    const latexCompletion = autocompletion({
      override: [createLatexCompletionSource(bibKeys)],
    });

    const isVisual = editorMode === 'visual';
    const isVim = (keybinding || storeKeybinding) === 'vim';

    const initialDoc = yText && yText.length > 0 ? yText.toString() : value;
    const startState = EditorState.create({
      doc: initialDoc,
      extensions: [
        // Base extensions
        history(),
        bracketMatching(),
        closeBrackets(),
        lineHighlightField,
        EditorView.lineWrapping,

        // Update listener
        EditorView.updateListener.of((update) => {
          if (adapterRef.current) {
            adapterRef.current.handleViewUpdate(update);
          }
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),

        // Keymaps
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
        ]),

        // Keybinding compartment (Vim vs Standard)
        keybindingCompartmentRef.current.of(isVim ? [vim({ status: true })] : []),

        // Yjs Multiplayer Collaboration compartment
        collabCompartmentRef.current.of(
          yText && awareness ? [yCollab(yText, awareness)] : []
        ),

        // Theme compartment
        themeCompartmentRef.current.of(getEditorTheme(isDarkTheme)),

        // ReadOnly compartment
        readOnlyCompartmentRef.current.of(EditorState.readOnly.of(readOnly)),

        // Mode compartment: Code vs Visual (Overleaf 0ms dynamic toggle)
        modeCompartmentRef.current.of(
          isVisual
            ? [latexVisualPlugin]
            : [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightActiveLine(),
                foldGutter(),
                latexLanguage,
                latexCompletion,
              ]
        ),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;
    const adapter = new CodeMirrorEngineAdapter(view);
    adapterRef.current = adapter;
    setEngine(adapter);

    return () => {
      adapter.onDestroy();
      setEngine(null);
      view.destroy();
      viewRef.current = null;
      adapterRef.current = null;
    };
  }, []); // Mount once

  // ── Dynamic Theme Switching ───────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(getEditorTheme(isDarkTheme)),
    });
  }, [isDarkTheme]);

  // ── Dynamic ReadOnly Switching ────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // ── Dynamic Keybinding Switching (Vim mode) ────────────────────────────────
  const effectiveKeybinding = keybinding || storeKeybinding;
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isVim = effectiveKeybinding === 'vim';
    view.dispatch({
      effects: keybindingCompartmentRef.current.reconfigure(isVim ? [vim({ status: true })] : []),
    });
  }, [effectiveKeybinding]);

  // ── Dynamic Yjs Multiplayer Collaboration Switching ────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (yText && yText.length > 0) {
      const currentDoc = view.state.doc.toString();
      const yContent = yText.toString();
      if (currentDoc !== yContent) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: yContent },
          effects: collabCompartmentRef.current.reconfigure(
            awareness ? [yCollab(yText, awareness)] : []
          ),
        });
        return;
      }
    }

    view.dispatch({
      effects: collabCompartmentRef.current.reconfigure(
        yText && awareness ? [yCollab(yText, awareness)] : []
      ),
    });
  }, [yText, awareness]);

  // Seed initial content into Yjs document if empty
  useEffect(() => {
    if (yText && yText.length === 0 && value && value.length > 0) {
      yText.doc?.transact(() => {
        if (yText.length === 0) {
          yText.insert(0, value);
        }
      });
    }
  }, [yText, value]);

  // ── 0ms Instant Mode Toggle (Code <-> Visual) ─────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const isVisual = editorMode === 'visual';
    const bibKeys = bibEntries.map((b: any) => b.id || b.key || b.citationKey).filter(Boolean);
    const latexCompletion = autocompletion({
      override: [createLatexCompletionSource(bibKeys)],
    });

    const modeExtensions = isVisual
      ? [latexVisualPlugin]
      : [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          foldGutter(),
          latexLanguage,
          latexCompletion,
        ];

    view.dispatch({
      effects: modeCompartmentRef.current.reconfigure(modeExtensions),
    });
  }, [editorMode, bibEntries]);

  // ── Sync External Value (e.g. Page Switch or Remote Sync) ──────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc && (!yText || yText.length === 0)) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value, yText]);

  // ── In-place Math Popover Save ─────────────────────────────────────────────
  const handleApplyMath = useCallback(
    (newFormula: string, from: number, to: number, isDisplay: boolean) => {
      const view = viewRef.current;
      if (!view) return;

      const replacement = isDisplay ? `$$\n${newFormula}\n$$` : `$${newFormula}$`;
      view.dispatch({
        changes: { from, to, insert: replacement },
      });
      view.focus();
    },
    []
  );

  // ── Reverse SyncTeX on Double Click or Ctrl+Click ─────────────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const view = viewRef.current;
      if (!view) return;

      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos);
        const col = pos - line.from + 1;

        if (onSyncTexReverse) {
          onSyncTexReverse(line.number, col);
        }
        editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line: line.number });
      }
    },
    [onSyncTexReverse]
  );

  return (
    <div className="h-full w-full relative flex flex-col overflow-hidden bg-background">
      {/* Visual Mode Indicator Banner (Overleaf 1:1) */}
      {editorMode === 'visual' && (
        <div className="flex items-center justify-between px-3 py-1 bg-primary/10 border-b border-primary/20 text-primary text-xs shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-10 px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary uppercase tracking-wide">
              Visual Mode (CodeMirror 6)
            </span>
            <span className="text-[11px] text-foreground/80">
              Interactive KaTeX rendering. Click any math formula to edit in-place.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditorMode('code')}
            className="ml-3 px-2 py-0.5 text-11 font-medium bg-primary/20 hover:bg-primary/30 text-primary rounded-sm transition-colors cursor-pointer shrink-0"
          >
            Switch to Source
          </button>
        </div>
      )}

      {/* CodeMirror DOM Container */}
      <div
        ref={containerRef}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'flex-1 w-full h-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:h-full',
          editorMode === 'visual' &&
            'max-w-4xl mx-auto w-full px-6 py-4 [&_.cm-content]:font-sans [&_.cm-content]:text-base'
        )}
      />

      {/* Floating In-place Math Editor Popover */}
      <MathInlinePopover
        trigger={mathTrigger}
        onApply={handleApplyMath}
        onClose={() => setMathTrigger(null)}
      />
    </div>
  );
}
