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

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { EditorState, Compartment, Annotation } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  keymap,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, toggleComment } from '@codemirror/commands';
import { foldGutter, foldKeymap, bracketMatching } from '@codemirror/language';
import { search, searchKeymap, gotoLine } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, startCompletion } from '@codemirror/autocomplete';
import { forceLinting, linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { useRetractedItems } from '@/features/library/data';
import { buildRetractedCitationMap } from '../../utils/retracted-citations.util';
import type { RetractedItemInfo } from '../../utils/latex-linter.util';
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
  visualPasteHandler,
  setMathEditCallback,
  type MathPopoverTrigger,
} from '../../sub-features/code-editor/codemirror/latex-visual-plugin';
import { MathInlinePopover } from '../../sub-features/code-editor/codemirror/MathInlinePopover';
import { EditorEventBus } from '../../utils/editor.util';
import { editorCommandBus } from '../../core/command-bus/editor-command-bus';
import { useSettingsStore } from '../../store';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { manuscriptService } from '../../services/manuscript.service';

import type { PageComment, PageSuggestion } from '@/features/editor/types';
import {
  latexCommentsExtension,
  setCommentsEffect,
} from '../../sub-features/code-editor/codemirror/latex-comments';
import {
  latexTrackChangesExtension,
  setTrackChangesEffect,
  type TrackChangesViewMode,
} from '../../sub-features/code-editor/codemirror/latex-track-changes';
import {
  InlineSuggestionWidget,
  type InlineSuggestionWidgetData,
} from './subcomponents/InlineSuggestionWidget';
import { emacsKeymap } from '../../sub-features/code-editor/codemirror/emacs-keymap';
import { createLatexSpellcheckExtension } from '../../sub-features/code-editor/codemirror/latex-spellcheck';
import { latexAutoCloseExtension } from '../../sub-features/code-editor/codemirror/latex-auto-close';

export const externalUpdateAnnotation = Annotation.define<boolean>();

export interface UnifiedCodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  isDarkTheme?: boolean;
  readOnly?: boolean;
  bibEntries?: any[];
  projectFiles?: any[];
  projectId?: string;
  onSyncTexReverse?: (line: number, col: number) => void;
  keybinding?: string;
  yText?: Y.Text | null;
  awareness?: any | null;
  comments?: PageComment[];
  activeCommentId?: string | null;
  suggestions?: PageSuggestion[];
  trackChangesViewMode?: TrackChangesViewMode;
  onAcceptSuggestion?: (suggestion: PageSuggestion) => void;
  onRejectSuggestion?: (suggestion: PageSuggestion) => void;
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
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: resolvedFont,
      lineHeight: `${lineHeight}`,
      outline: 'none',
    },
    '.cm-content': {
      outline: 'none',
    },
  });
}

function createLatexLinterExtension(
  getRetractedMap?: () => Map<string, RetractedItemInfo> | undefined,
) {
  return [
    lintGutter(),
    linter(
      (view) => {
        const doc = view.state.doc;
        const text = doc.toString();
        const rawDiags = runLatexLinter(text, {
          retractedItemsMap: getRetractedMap?.(),
        });

        const diagnostics: Diagnostic[] = [];

        for (const d of rawDiags) {
          const startLineNum = Math.min(Math.max(1, d.startLineNumber), doc.lines);
          const endLineNum = Math.min(Math.max(1, d.endLineNumber), doc.lines);

          const startLine = doc.line(startLineNum);
          const endLine = doc.line(endLineNum);

          const from = Math.min(startLine.from + Math.max(0, d.startColumn - 1), startLine.to);
          const to = Math.min(endLine.from + Math.max(0, d.endColumn - 1), endLine.to);

          const actions =
            d.suggestions && d.suggestions.length > 0
              ? d.suggestions.map((sug) => ({
                  name: `Fix: ${sug}`,
                  apply: (editorView: EditorView, aFrom: number, aTo: number) => {
                    editorView.dispatch({
                      changes: { from: aFrom, to: aTo, insert: sug },
                    });
                  },
                }))
              : undefined;

          diagnostics.push({
            from: Math.min(from, to),
            to: Math.max(from, to, from + 1),
            severity: d.severity,
            message: d.message,
            source: 'LaTeX Code Check',
            actions,
          });
        }

        return diagnostics;
      },
      { delay: 1000 },
    ),
  ];
}

export default function UnifiedCodeMirrorEditor({
  value,
  onChange,
  isDarkTheme = false,
  readOnly = false,
  bibEntries = [],
  projectFiles = [],
  projectId,
  onSyncTexReverse,
  keybinding,
  yText,
  awareness,
  comments = [],
  activeCommentId,
  suggestions = [],
  trackChangesViewMode = 'show',
  onAcceptSuggestion,
  onRejectSuggestion,
}: UnifiedCodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const adapterRef = useRef<CodeMirrorEngineAdapter | null>(null);
  const lastSyncedValueRef = useRef(value);
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
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const spellCheckLanguage = useSettingsStore((s) => s.spellCheckLanguage);

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
  const spellcheckCompartmentRef = useRef(new Compartment());

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

  // Zotero-style: warn on \cite of a retracted work (matched by DOI).
  const { data: retractedItems } = useRetractedItems(projectId, Boolean(linterEnabled));
  const retractedMap = useMemo(
    () => buildRetractedCitationMap(bibEntries, retractedItems),
    [bibEntries, retractedItems],
  );
  const retractedMapRef = useRef(retractedMap);
  useEffect(() => {
    retractedMapRef.current = retractedMap;
    const view = viewRef.current;
    if (view) forceLinting(view);
  }, [retractedMap]);

  const projectFilesRef = useRef(projectFiles);
  useEffect(() => {
    projectFilesRef.current = projectFiles;
  }, [projectFiles]);

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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
    const isEmacs = (keybinding || storeKeybinding) === 'emacs';

    const initialDoc = (yText && yText.length > 0 ? yText.toString() : value) ?? '';
    const startState = EditorState.create({
      doc: initialDoc,
      extensions: [
        // Base extensions
        history(),
        bracketMatching(),
        lineHighlightField,
        latexCommentsExtension,
        latexTrackChangesExtension,
        latexAutoCloseExtension,
        search({ top: false }),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        crosshairCursor(),

        // Dynamic Settings Compartments
        wordWrapCompartmentRef.current.of((wordWrap || isVisual) ? [EditorView.lineWrapping] : []),
        linterCompartmentRef.current.of(
          linterEnabled && !isVisual ? createLatexLinterExtension(() => retractedMapRef.current) : []
        ),
        spellcheckCompartmentRef.current.of(
          spellCheck ? createLatexSpellcheckExtension(projectId, () => spellCheckLanguage) : []
        ),
        lineNumbersCompartmentRef.current.of(
          lineNumbersSetting ? [lineNumbers(), highlightActiveLineGutter()] : []
        ),
        bracketsCompartmentRef.current.of(autoCloseBrackets ? [closeBrackets()] : []),
        autocompleteCompartmentRef.current.of(
          autoComplete ? [latexCompletion] : []
        ),
        cursorBlinkCompartmentRef.current.of(
          nonBlinkingCursor ? [EditorView.theme({ '.cm-cursor': { animation: 'none' } })] : []
        ),

        // Update listener
        EditorView.updateListener.of((update) => {
          if (adapterRef.current) {
            adapterRef.current.handleViewUpdate(update);
          }
          if (update.docChanged) {
            const isExternal = update.transactions.some((tr) => tr.annotation(externalUpdateAnnotation));
            if (!isExternal) {
              const nextText = update.state.doc.toString();
              lastSyncedValueRef.current = nextText;
              onChange(nextText);
            }
          }
        }),

        // Keymaps (Overleaf 1:1 Parity)
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          { key: 'Mod-Space', run: startCompletion },
          { key: 'Ctrl-Space', run: startCompletion },
          { key: 'Mod-/', run: toggleComment },
          { key: 'Mod-Shift-l', run: gotoLine },
          { key: 'Mod-Shift-L', run: gotoLine },
          { key: 'Mod-g', run: gotoLine },
          { key: 'Mod-Shift-k', run: () => { EditorEventBus.emit('flux:open-citation-picker'); return true; } },
          { key: 'Mod-Shift-K', run: () => { EditorEventBus.emit('flux:open-citation-picker'); return true; } },
          { key: 'Alt-Shift-f', run: () => { EditorEventBus.emit('flux:autofix'); return true; } },
          { key: 'Alt-Shift-F', run: () => { EditorEventBus.emit('flux:autofix'); return true; } },
        ]),

        // Keybinding compartment (Vim vs Emacs vs Standard)
        keybindingCompartmentRef.current.of(
          isVim
            ? [vim({ status: true })]
            : isEmacs
            ? [keymap.of(emacsKeymap)]
            : []
        ),

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
                visualPasteHandler,
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

  // ── Dynamic Track Changes / Suggestions Highlighting ───────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setTrackChangesEffect.of({
        suggestions: suggestions || [],
        viewMode: trackChangesViewMode || 'show',
      }),
    });
  }, [suggestions, trackChangesViewMode]);

  // ── Track Changes Floating Widget State & Listener ─────────────────────────
  const [activeSuggestionWidget, setActiveSuggestionWidget] = useState<InlineSuggestionWidgetData | null>(null);

  useEffect(() => {
    const unsub = EditorEventBus.on('flux:open-suggestion-widget', (detail: any) => {
      if (detail && detail.suggestionId) {
        const found = (suggestions || []).find((s) => s.id === detail.suggestionId);
        if (found) {
          setActiveSuggestionWidget({
            suggestion: found,
            x: detail.x ?? 120,
            y: detail.y ?? 120,
          });
        }
      }
    });
    return () => unsub();
  }, [suggestions]);

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

  // ── Dynamic Keybinding Switching (Vim & Emacs modes) ──────────────────────
  const effectiveKeybinding = keybinding || storeKeybinding;
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isVim = effectiveKeybinding === 'vim';
    const isEmacs = effectiveKeybinding === 'emacs';
    view.dispatch({
      effects: keybindingCompartmentRef.current.reconfigure(
        isVim
          ? [vim({ status: true })]
          : isEmacs
          ? [keymap.of(emacsKeymap)]
          : []
      ),
    });
  }, [effectiveKeybinding]);

  // ── Dynamic Spellcheck Switching ──────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: spellcheckCompartmentRef.current.reconfigure(
        spellCheck ? createLatexSpellcheckExtension(projectId, () => spellCheckLanguage) : []
      ),
    });
  }, [spellCheck, spellCheckLanguage, projectId]);

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

    const currentVal = valueRef.current;
    // Seed yText if empty and we have a valid initial value
    if (yText.length === 0 && currentVal && currentVal.length > 0) {
      yText.doc?.transact(() => {
        if (yText.length === 0) {
          yText.insert(0, currentVal);
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
    const modeExtensions = isVisual
      ? [latexVisualPlugin]
      : [
          highlightActiveLine(),
          foldGutter(),
          latexLanguage,
          visualPasteHandler,
        ];

    view.dispatch({
      effects: modeCompartmentRef.current.reconfigure(modeExtensions),
    });
  }, [editorMode]);

  // ── Dynamic Word Wrap Switching ───────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isVisual = editorMode === 'visual';
    view.dispatch({
      effects: wordWrapCompartmentRef.current.reconfigure(
        (wordWrap || isVisual) ? [EditorView.lineWrapping] : []
      ),
    });
  }, [wordWrap, editorMode]);

  // ── Dynamic Line Numbers Switching (Code & Visual modes) ──────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: lineNumbersCompartmentRef.current.reconfigure(
        lineNumbersSetting ? [lineNumbers(), highlightActiveLineGutter()] : []
      ),
    });
  }, [lineNumbersSetting]);

  // ── Dynamic Auto-close Brackets Switching ─────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: bracketsCompartmentRef.current.reconfigure(autoCloseBrackets ? [closeBrackets()] : []),
    });
  }, [autoCloseBrackets]);

  // ── Dynamic Auto-complete Switching (Code & Visual modes) ─────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const latexCompletion = autocompletion({
      override: [
        createLatexCompletionSource(
          () => bibEntriesRef.current,
          () => projectFilesRef.current || []
        ),
      ],
    });
    view.dispatch({
      effects: autocompleteCompartmentRef.current.reconfigure(
        autoComplete ? [latexCompletion] : []
      ),
    });
  }, [autoComplete]);

  // ── Dynamic Non-blinking Cursor Switching ─────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: cursorBlinkCompartmentRef.current.reconfigure(
        nonBlinkingCursor ? [EditorView.theme({ '.cm-cursor': { animation: 'none' } })] : []
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
        linterEnabled && !isVisual ? createLatexLinterExtension(() => retractedMapRef.current) : []
      ),
    });
  }, [linterEnabled, editorMode]);

  // ── Global Editor Commands: AutoFix & Project Lint ─────────────────────────
  useEffect(() => {
    const unsubAutoFix = EditorEventBus.on('flux:autofix', async () => {
      const view = viewRef.current;
      if (!view) return;
      const content = view.state.doc.toString();
      if (!content.trim()) return;

      try {
        toast.loading('Applying LaTeX syntax fixes...', { id: 'flux:autofix' });
        const res = await manuscriptService.diagnostics.autoFix(content);
        if (res && res.fixedSource && res.fixedSource !== content) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: res.fixedSource },
          });
          const count = res.appliedFixes?.length ?? 1;
          toast.success(
            `Applied ${count} LaTeX syntax fix(es)!`,
            { id: 'flux:autofix' }
          );
        } else {
          toast.info('No common LaTeX syntax issues found to fix', { id: 'flux:autofix' });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to auto-fix document', { id: 'flux:autofix' });
      }
    });

    const unsubLint = EditorEventBus.on('flux:lint-page', async () => {
      const view = viewRef.current;
      if (!view) return;
      const content = view.state.doc.toString();
      if (!content.trim()) return;

      try {
        toast.loading('Checking page LaTeX syntax...', { id: 'flux:lint' });
        const diags = runLatexLinter(content, {
          retractedItemsMap: retractedMapRef.current,
        });
        const errs = diags.filter((d) => d.severity === 'error').length;
        const warns = diags.filter((d) => d.severity === 'warning').length;
        if (diags.length > 0) {
          toast.warning(
            `Page check found ${errs} error(s) and ${warns} warning(s)`,
            { id: 'flux:lint' }
          );
        } else {
          toast.success('Page passed static LaTeX check with no issues!', { id: 'flux:lint' });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to check page syntax', { id: 'flux:lint' });
      }
    });

    return () => {
      unsubAutoFix();
      unsubLint();
    };
  }, []);

  // ── Sync External Value (e.g. Page Switch or Remote Sync) ──────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (value === lastSyncedValueRef.current) return;
    lastSyncedValueRef.current = value;

    const currentDoc = view.state.doc.toString();
    const safeVal = value ?? '';
    if (safeVal !== currentDoc && (!yText || yText.length === 0)) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: safeVal },
        annotations: [externalUpdateAnnotation.of(true)],
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
    <div className="flex-1 w-full min-w-0 max-w-full h-full relative min-h-0 overflow-hidden">
      {/* CodeMirror DOM Container */}
      <div
        ref={containerRef}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'w-full h-full min-w-0 max-w-full overflow-hidden',
          '[&_.cm-editor]:h-full [&_.cm-editor]:w-full [&_.cm-editor]:max-w-full [&_.cm-editor]:min-w-0',
          '[&_.cm-scroller]:h-full [&_.cm-scroller]:w-full [&_.cm-scroller]:max-w-full [&_.cm-scroller]:min-w-0',
          '[&_.cm-editor]:outline-none [&_.cm-editor.cm-focused]:outline-none [&_.cm-scroller]:outline-none [&_.cm-content]:outline-none',
          '[&_.cm-ySelectionCaret]:border-l-2 [&_.cm-ySelectionCaret]:border-r-0 [&_.cm-ySelectionCaret]:transition-all',
          '[&_.cm-ySelectionInfo]:font-sans [&_.cm-ySelectionInfo]:rounded-xs [&_.cm-ySelectionInfo]:px-1.5 [&_.cm-ySelectionInfo]:py-0.5 [&_.cm-ySelectionInfo]:text-[10px] [&_.cm-ySelectionInfo]:font-semibold [&_.cm-ySelectionInfo]:tracking-normal',
          editorMode === 'visual' &&
            '[&_.cm-content]:font-sans [&_.cm-content]:text-base [&_.cm-content]:px-6 [&_.cm-content]:py-3'
        )}
      />

      {/* Floating In-place Math Editor Popover */}
      <MathInlinePopover
        trigger={mathTrigger}
        onApply={handleApplyMath}
        onClose={() => setMathTrigger(null)}
      />

      {/* Floating Track Changes / Review Suggestion Card */}
      <InlineSuggestionWidget
        data={activeSuggestionWidget}
        onClose={() => setActiveSuggestionWidget(null)}
        onAccept={(sug) => {
          onAcceptSuggestion?.(sug);
          setActiveSuggestionWidget(null);
        }}
        onReject={(sug) => {
          onRejectSuggestion?.(sug);
          setActiveSuggestionWidget(null);
        }}
        onOpenReviewTab={(sugId) => {
          EditorEventBus.emit('flux:open-panel', { panel: 'Review', suggestionId: sugId });
          setActiveSuggestionWidget(null);
        }}
      />
    </div>
  );
}
