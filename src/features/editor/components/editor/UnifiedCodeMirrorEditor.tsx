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
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { foldGutter, foldKeymap, bracketMatching } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
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
import { runLatexLinter } from '../../utils/latex-linter.util';
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

import type { PageComment } from '@/features/editor/types';
import {
  latexCommentsExtension,
  setCommentsEffect,
} from '../../sub-features/code-editor/codemirror/latex-comments';

export interface UnifiedCodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  isDarkTheme?: boolean;
  readOnly?: boolean;
  bibEntries?: any[];
  projectFiles?: any[];
  onSyncTexReverse?: (line: number, col: number) => void;
  keybinding?: string;
  yText?: Y.Text | null;
  awareness?: any | null;
  comments?: PageComment[];
  activeCommentId?: string | null;
}

function getTypographyExtension(fontSize = 15, fontFamily = 'default', lineHeight = 1.6) {
  const fontMap: Record<string, string> = {
    default: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
    menlo: 'Menlo, Monaco, "Courier New", monospace',
    consolas: 'Consolas, "Lucida Console", monospace',
    fira: '"Fira Code", monospace',
    'source-code': '"Source Code Pro", monospace',
  };
  const resolvedFont = fontMap[fontFamily] || fontMap.default;

  return EditorView.theme({
    '&': {
      fontSize: `${fontSize}px`,
    },
    '&.cm-focused': {
      outline: 'none !important',
    },
    '.cm-scroller': {
      fontFamily: resolvedFont,
      lineHeight: `${lineHeight}`,
      outline: 'none !important',
    },
    '.cm-content': {
      outline: 'none !important',
    },
  });
}

function createLatexLinterExtension() {
  return [
    lintGutter(),
    linter((view) => {
      const doc = view.state.doc;
      const text = doc.toString();
      const rawDiags = runLatexLinter(text);

      const diagnostics: Diagnostic[] = [];

      for (const d of rawDiags) {
        const startLineNum = Math.min(Math.max(1, d.startLineNumber), doc.lines);
        const endLineNum = Math.min(Math.max(1, d.endLineNumber), doc.lines);

        const startLine = doc.line(startLineNum);
        const endLine = doc.line(endLineNum);

        const from = Math.min(startLine.from + Math.max(0, d.startColumn - 1), startLine.to);
        const to = Math.min(endLine.from + Math.max(0, d.endColumn - 1), endLine.to);

        diagnostics.push({
          from: Math.min(from, to),
          to: Math.max(from, to, from + 1),
          severity: d.severity,
          message: d.message,
          source: 'LaTeX Code Check',
        });
      }

      return diagnostics;
    }),
  ];
}

export default function UnifiedCodeMirrorEditor({
  value,
  onChange,
  isDarkTheme = false,
  readOnly = false,
  bibEntries = [],
  projectFiles = [],
  onSyncTexReverse,
  keybinding,
  yText,
  awareness,
  comments = [],
  activeCommentId,
}: UnifiedCodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const adapterRef = useRef<CodeMirrorEngineAdapter | null>(null);
  const { setEngine } = useEditorInstance();

  const editorMode = useSettingsStore((s) => s.editorMode);
  const storeKeybinding = useSettingsStore((s) => s.keybinding);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const lineNumbersSetting = useSettingsStore((s) => s.lineNumbers);
  const autoCloseBrackets = useSettingsStore((s) => s.autoCloseBrackets);
  const autoComplete = useSettingsStore((s) => s.autoComplete);
  const nonBlinkingCursor = useSettingsStore((s) => s.nonBlinkingCursor);
  const linterEnabled = useSettingsStore((s) => s.linterEnabled);

  const [mathTrigger, setMathTrigger] = useState<MathPopoverTrigger | null>(null);

  // Compartments for dynamic reconfiguration without recreating editor
  const modeCompartmentRef = useRef(new Compartment());
  const themeCompartmentRef = useRef(new Compartment());
  const typographyCompartmentRef = useRef(new Compartment());
  const readOnlyCompartmentRef = useRef(new Compartment());
  const keybindingCompartmentRef = useRef(new Compartment());
  const collabCompartmentRef = useRef(new Compartment());
  const wordWrapCompartmentRef = useRef(new Compartment());
  const lineNumbersCompartmentRef = useRef(new Compartment());
  const bracketsCompartmentRef = useRef(new Compartment());
  const autocompleteCompartmentRef = useRef(new Compartment());
  const cursorBlinkCompartmentRef = useRef(new Compartment());
  const linterCompartmentRef = useRef(new Compartment());

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

  const bibEntriesRef = useRef(bibEntries);
  useEffect(() => {
    bibEntriesRef.current = bibEntries;
  }, [bibEntries]);

  const projectFilesRef = useRef(projectFiles);
  useEffect(() => {
    projectFilesRef.current = projectFiles;
  }, [projectFiles]);

  // ── Mount CodeMirror 6 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const latexCompletion = autocompletion({
      override: [
        createLatexCompletionSource(
          () => bibEntriesRef.current,
          () => projectFilesRef.current || []
        ),
      ],
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
        lineHighlightField,
        latexCommentsExtension,
        search({ top: false }),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        crosshairCursor(),

        // Dynamic Settings Compartments
        wordWrapCompartmentRef.current.of(wordWrap ? [EditorView.lineWrapping] : []),
        lineNumbersCompartmentRef.current.of(
          lineNumbersSetting && !isVisual ? [lineNumbers(), highlightActiveLineGutter()] : []
        ),
        bracketsCompartmentRef.current.of(autoCloseBrackets ? [closeBrackets()] : []),
        autocompleteCompartmentRef.current.of(
          autoComplete && !isVisual ? [latexCompletion] : []
        ),
        cursorBlinkCompartmentRef.current.of(
          nonBlinkingCursor ? [EditorView.theme({ '.cm-cursor': { animation: 'none !important' } })] : []
        ),
        linterCompartmentRef.current.of(
          linterEnabled && !isVisual ? createLatexLinterExtension() : []
        ),

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

        // Typography compartment (Font size, family, line height)
        typographyCompartmentRef.current.of(
          getTypographyExtension(fontSize, fontFamily, lineHeight)
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
                highlightActiveLine(),
                foldGutter(),
                latexLanguage,
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

  // ── Dynamic Comments Highlighting Switching ────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setCommentsEffect.of({
        comments: comments || [],
        activeCommentId,
      }),
    });
  }, [comments, activeCommentId]);

  // ── Dynamic Theme Switching ───────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(getEditorTheme(isDarkTheme)),
    });
  }, [isDarkTheme]);

  // ── Dynamic Typography Switching (Font size, family, line height) ─────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: typographyCompartmentRef.current.reconfigure(
        getTypographyExtension(fontSize, fontFamily, lineHeight)
      ),
    });
  }, [fontSize, fontFamily, lineHeight]);

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

    if (!yText || !awareness) {
      view.dispatch({
        effects: collabCompartmentRef.current.reconfigure([]),
      });
      return;
    }

    // Seed yText if empty and we have a valid initial value
    if (yText.length === 0 && value && value.length > 0) {
      yText.doc?.transact(() => {
        if (yText.length === 0) {
          yText.insert(0, value);
        }
      });
    }

    const currentDoc = view.state.doc.toString();
    const yContent = yText.toString();
    if (yContent.length > 0 && currentDoc !== yContent) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: yContent },
        effects: collabCompartmentRef.current.reconfigure([yCollab(yText, awareness)]),
      });
      return;
    }

    view.dispatch({
      effects: collabCompartmentRef.current.reconfigure([yCollab(yText, awareness)]),
    });
  }, [yText, awareness]);

  // ── 0ms Instant Mode Toggle (Code <-> Visual) ─────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const isVisual = editorMode === 'visual';
    const bibKeys = bibEntries.map((b: any) => b.id || b.key || b.citationKey).filter(Boolean);
    const latexCompletion = autocompletion({
      override: [
        createLatexCompletionSource(
          bibKeys,
          () => projectFilesRef.current || []
        ),
      ],
    });

    const modeExtensions = isVisual
      ? [latexVisualPlugin]
      : [
          highlightActiveLine(),
          foldGutter(),
          latexLanguage,
        ];

    view.dispatch({
      effects: [
        modeCompartmentRef.current.reconfigure(modeExtensions),
        lineNumbersCompartmentRef.current.reconfigure(
          lineNumbersSetting && !isVisual ? [lineNumbers(), highlightActiveLineGutter()] : []
        ),
        autocompleteCompartmentRef.current.reconfigure(
          autoComplete && !isVisual ? [latexCompletion] : []
        ),
        linterCompartmentRef.current.reconfigure(
          linterEnabled && !isVisual ? createLatexLinterExtension() : []
        ),
      ],
    });
  }, [editorMode, bibEntries, lineNumbersSetting, autoComplete, linterEnabled]);

  // ── Dynamic Word Wrap Switching ───────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wordWrapCompartmentRef.current.reconfigure(wordWrap ? [EditorView.lineWrapping] : []),
    });
  }, [wordWrap]);

  // ── Dynamic Line Numbers Switching ────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isVisual = editorMode === 'visual';
    view.dispatch({
      effects: lineNumbersCompartmentRef.current.reconfigure(
        lineNumbersSetting && !isVisual ? [lineNumbers(), highlightActiveLineGutter()] : []
      ),
    });
  }, [lineNumbersSetting, editorMode]);

  // ── Dynamic Auto-close Brackets Switching ─────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: bracketsCompartmentRef.current.reconfigure(autoCloseBrackets ? [closeBrackets()] : []),
    });
  }, [autoCloseBrackets]);

  // ── Dynamic Auto-complete Switching ───────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isVisual = editorMode === 'visual';
    const bibKeys = bibEntries.map((b: any) => b.id || b.key || b.citationKey).filter(Boolean);
    const latexCompletion = autocompletion({
      override: [createLatexCompletionSource(bibKeys, () => projectFilesRef.current || [])],
    });
    view.dispatch({
      effects: autocompleteCompartmentRef.current.reconfigure(
        autoComplete && !isVisual ? [latexCompletion] : []
      ),
    });
  }, [autoComplete, editorMode, bibEntries]);

  // ── Dynamic Non-blinking Cursor Switching ─────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: cursorBlinkCompartmentRef.current.reconfigure(
        nonBlinkingCursor ? [EditorView.theme({ '.cm-cursor': { animation: 'none !important' } })] : []
      ),
    });
  }, [nonBlinkingCursor]);

  // ── Dynamic Code Check / Linter Switching ─────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isVisual = editorMode === 'visual';
    view.dispatch({
      effects: linterCompartmentRef.current.reconfigure(
        linterEnabled && !isVisual ? createLatexLinterExtension() : []
      ),
    });
  }, [linterEnabled, editorMode]);

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
    <div className="h-full w-full relative flex flex-col bg-background">
      {/* CodeMirror DOM Container */}
      <div
        ref={containerRef}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'flex-1 w-full h-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:h-full',
          '[&_.cm-editor]:outline-none [&_.cm-editor.cm-focused]:outline-none [&_.cm-scroller]:outline-none [&_.cm-content]:outline-none',
          '[&_.cm-ySelectionCaret]:border-l-2 [&_.cm-ySelectionCaret]:border-r-0 [&_.cm-ySelectionCaret]:transition-all',
          '[&_.cm-ySelectionInfo]:font-sans [&_.cm-ySelectionInfo]:rounded-xs [&_.cm-ySelectionInfo]:px-1.5 [&_.cm-ySelectionInfo]:py-0.5 [&_.cm-ySelectionInfo]:text-[10px] [&_.cm-ySelectionInfo]:font-semibold [&_.cm-ySelectionInfo]:tracking-normal',
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
