/**
 * useEditorCompartments.ts
 *
 * Dedicated Hook for CodeMirror 6 Compartments and dynamic reconfiguration.
 * Isolates all compartment creation, state mapping, and dynamic reconfigurations
 * to maintain clean separation of concerns and high-performance updates.
 */

import { useRef, useEffect } from 'react';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine, keymap } from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { vim } from '@replit/codemirror-vim';
import { emacsKeymap } from '../emacs-keymap';
import { yCollab } from 'y-codemirror.next';
import type * as Y from 'yjs';

import { getEditorTheme } from '../theme';
import { getTypographyExtension } from '../latex-typography';
import { createLatexLinterExtension } from '../latex-linter-extension';
import { createLatexSpellcheckExtension } from '../latex-spellcheck';
import { createLatexCompletionSource } from '../latex-autocomplete';
import { latexVisualPlugin, visualPasteHandler } from '../latex-visual-plugin';
import { latexLanguage } from '../latex-language';
import { createTrackChangesInterceptor, setTrackChangesEffect, type TrackChangesViewMode, type TrackChangeRecordPayload } from '../latex-track-changes';
import { setCommentsEffect } from '../latex-comments';
import type { PageComment, PageSuggestion } from '@/features/editor/types';
import type { CompileError } from '@/features/editor/types/compiler.types';
import type { RetractedItemInfo } from '@/features/editor/utils/latex-linter.util';

export interface UseEditorCompartmentsParams {
  viewRef: React.RefObject<EditorView | null>;
  editorMode: string;
  isDarkTheme: boolean;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  readOnly: boolean;
  effectiveKeybinding: string;
  spellCheck: boolean;
  spellCheckLanguage: string;
  projectId?: string;
  yText?: Y.Text | null;
  awareness?: any | null;
  valueRef: React.RefObject<string>;
  wordWrap: boolean;
  lineNumbersSetting: boolean;
  reviewModeRef: React.RefObject<boolean | undefined>;
  onCreateSuggestionRef: React.RefObject<((change: TrackChangeRecordPayload) => void) | undefined>;
  autoCloseBrackets: boolean;
  autoComplete: boolean;
  nonBlinkingCursor: boolean;
  retractedMapRef: React.RefObject<Map<string, RetractedItemInfo>>;
  compileErrorsRef: React.RefObject<CompileError[]>;
  linterEnabledRef: React.RefObject<boolean>;
  comments?: PageComment[];
  activeCommentId?: string | null;
  suggestions?: PageSuggestion[];
  trackChangesViewMode?: TrackChangesViewMode;
  bibEntriesRef: React.RefObject<any[]>;
  projectFilesRef: React.RefObject<any[]>;
}

export function useEditorCompartments(params: UseEditorCompartmentsParams) {
  const {
    viewRef,
    editorMode,
    isDarkTheme,
    fontSize,
    fontFamily,
    lineHeight,
    readOnly,
    effectiveKeybinding,
    spellCheck,
    spellCheckLanguage,
    projectId,
    yText,
    awareness,
    valueRef,
    wordWrap,
    lineNumbersSetting,
    reviewModeRef,
    onCreateSuggestionRef,
    autoCloseBrackets,
    autoComplete,
    nonBlinkingCursor,
    retractedMapRef,
    compileErrorsRef,
    linterEnabledRef,
    comments,
    activeCommentId,
    suggestions,
    trackChangesViewMode,
    bibEntriesRef,
    projectFilesRef,
  } = params;

  // Compartment references
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
  const trackChangesInterceptorCompartmentRef = useRef(new Compartment());

  const isVisual = editorMode === 'visual';
  const isVim = effectiveKeybinding === 'vim';
  const isEmacs = effectiveKeybinding === 'emacs';

  /**
   * Builds initial compartment extensions bundle for EditorState.create()
   */
  const getInitialExtensions = (): Extension[] => {
    const latexCompletion = autocompletion({
      override: [
        createLatexCompletionSource(
          () => bibEntriesRef.current,
          () => projectFilesRef.current || []
        ),
      ],
    });

    return [
      wordWrapCompartmentRef.current.of((wordWrap || isVisual) ? [EditorView.lineWrapping] : []),
      linterCompartmentRef.current.of(
        !isVisual
          ? createLatexLinterExtension(
              () => retractedMapRef.current,
              () => compileErrorsRef.current,
              () => linterEnabledRef.current,
            )
          : []
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
      keybindingCompartmentRef.current.of(
        isVim
          ? [vim({ status: true })]
          : isEmacs
          ? [keymap.of(emacsKeymap)]
          : []
      ),
      collabCompartmentRef.current.of(
        yText && awareness ? [yCollab(yText, awareness)] : []
      ),
      typographyCompartmentRef.current.of(
        getTypographyExtension(fontSize, fontFamily, lineHeight)
      ),
      themeCompartmentRef.current.of(getEditorTheme(isDarkTheme)),
      readOnlyCompartmentRef.current.of(EditorState.readOnly.of(readOnly)),
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
      trackChangesInterceptorCompartmentRef.current.of(
        createTrackChangesInterceptor({
          isReviewMode: () => Boolean(reviewModeRef.current),
          onRecordChange: (change) => {
            onCreateSuggestionRef.current?.(change);
          },
        })
      ),
    ];
  };

  // ── Dynamic Comments Highlighting ──────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setCommentsEffect.of({
        comments: comments || [],
        activeCommentId,
      }),
    });
  }, [comments, activeCommentId, viewRef]);

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
  }, [suggestions, trackChangesViewMode, viewRef]);

  // ── Dynamic Theme Switching ───────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(getEditorTheme(isDarkTheme)),
    });
  }, [isDarkTheme, viewRef]);

  // ── Dynamic Typography Switching ──────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: typographyCompartmentRef.current.reconfigure(
        getTypographyExtension(fontSize, fontFamily, lineHeight)
      ),
    });
  }, [fontSize, fontFamily, lineHeight, viewRef]);

  // ── Dynamic ReadOnly Switching ────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly, viewRef]);

  // ── Dynamic Keybinding Switching (Vim & Emacs) ────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const vimActive = effectiveKeybinding === 'vim';
    const emacsActive = effectiveKeybinding === 'emacs';
    view.dispatch({
      effects: keybindingCompartmentRef.current.reconfigure(
        vimActive
          ? [vim({ status: true })]
          : emacsActive
          ? [keymap.of(emacsKeymap)]
          : []
      ),
    });
  }, [effectiveKeybinding, viewRef]);

  // ── Dynamic Spellcheck Switching ──────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: spellcheckCompartmentRef.current.reconfigure(
        spellCheck ? createLatexSpellcheckExtension(projectId, () => spellCheckLanguage) : []
      ),
    });
  }, [spellCheck, spellCheckLanguage, projectId, viewRef]);

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
  }, [yText, awareness, valueRef, viewRef]);

  // ── 0ms Instant Mode Toggle (Code <-> Visual) ─────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const visual = editorMode === 'visual';
    const modeExtensions = visual
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
  }, [editorMode, viewRef]);

  // ── Dynamic Word Wrap Switching ───────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const visual = editorMode === 'visual';
    view.dispatch({
      effects: wordWrapCompartmentRef.current.reconfigure(
        (wordWrap || visual) ? [EditorView.lineWrapping] : []
      ),
    });
  }, [wordWrap, editorMode, viewRef]);

  // ── Dynamic Line Numbers Switching ────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: lineNumbersCompartmentRef.current.reconfigure(
        lineNumbersSetting ? [lineNumbers(), highlightActiveLineGutter()] : []
      ),
    });
  }, [lineNumbersSetting, viewRef]);

  // ── Dynamic Review Mode Interceptor Switching ─────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: trackChangesInterceptorCompartmentRef.current.reconfigure(
        createTrackChangesInterceptor({
          isReviewMode: () => Boolean(reviewModeRef.current),
          onRecordChange: (change) => {
            onCreateSuggestionRef.current?.(change);
          },
        })
      ),
    });
  }, [reviewModeRef, onCreateSuggestionRef, viewRef]);

  // ── Dynamic Auto-close Brackets ───────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: bracketsCompartmentRef.current.reconfigure(autoCloseBrackets ? [closeBrackets()] : []),
    });
  }, [autoCloseBrackets, viewRef]);

  // ── Dynamic Auto-complete ─────────────────────────────────────────────────
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
  }, [autoComplete, bibEntriesRef, projectFilesRef, viewRef]);

  // ── Dynamic Non-blinking Cursor ───────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: cursorBlinkCompartmentRef.current.reconfigure(
        nonBlinkingCursor ? [EditorView.theme({ '.cm-cursor': { animation: 'none' } })] : []
      ),
    });
  }, [nonBlinkingCursor, viewRef]);

  // ── Dynamic Code Check / Linter ───────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const visual = editorMode === 'visual';
    view.dispatch({
      effects: linterCompartmentRef.current.reconfigure(
        !visual
          ? createLatexLinterExtension(
              () => retractedMapRef.current,
              () => compileErrorsRef.current,
              () => linterEnabledRef.current,
            )
          : []
      ),
    });
  }, [editorMode, retractedMapRef, compileErrorsRef, linterEnabledRef, viewRef]);

  return {
    getInitialExtensions,
  };
}
