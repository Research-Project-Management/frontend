/**
 * UnifiedCodeMirrorEditor.tsx
 *
 * Unified CodeMirror 6 Cockpit for Flux (Overleaf 1:1 Parity):
 * - Unified single LaTeX document buffer in memory for both Source and Visual modes.
 * - 0ms instant mode switching via CodeMirror Compartments.
 * - KaTeX in-place math popover editor.
 * - Native Vim mode keybindings via @replit/codemirror-vim (:w / :write save & compile).
 * - Real-time multiplayer CRDT collaboration via y-codemirror.next (yCollab).
 * - DocumentModelManager integration for 0ms tab switching and persistent cursor/scroll retention.
 * - Plugs into IEditorEngine via CodeMirrorEngineAdapter.
 */

'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, toggleComment } from '@codemirror/commands';
import { foldKeymap, bracketMatching } from '@codemirror/language';
import { search, searchKeymap, gotoLine } from '@codemirror/search';
import { closeBracketsKeymap, completionKeymap, startCompletion } from '@codemirror/autocomplete';
import { forceLinting } from '@codemirror/lint';
import type * as Y from 'yjs';

import { useRetractedItems } from '@/features/library/data';
import { buildRetractedCitationMap } from '../../utils/retracted-citations.util';
import { useEditorInstance } from '../../core/context/editor-instance.context';
import { CodeMirrorEngineAdapter } from '../../adapters/codemirror/codemirror.adapter';
import { lineHighlightField } from '../../sub-features/code-editor/codemirror/latex-language';
import { MathInlinePopover } from '../../sub-features/code-editor/codemirror/MathInlinePopover';
import { EditorEventBus } from '../../utils/editor.util';
import { useSettingsStore, useCompileStore } from '../../store';
import { cn } from '@/shared/lib/utils';
import { useEditorDiagnosticsListener } from './hooks/useEditorDiagnosticsListener';
import { documentModelManager } from '../../core/models/document-model-manager';

import type { PageComment, PageSuggestion } from '@/features/editor/types';
import { latexCommentsExtension } from '../../sub-features/code-editor/codemirror/latex-comments';
import {
  latexTrackChangesExtension,
  externalUpdateAnnotation,
  type TrackChangesViewMode,
  type TrackChangeRecordPayload,
} from '../../sub-features/code-editor/codemirror/latex-track-changes';
import {
  InlineSuggestionWidget,
} from './subcomponents/InlineSuggestionWidget';
import type { SelFloating } from './subcomponents/EditorFloatingBar';
import type { MisspelledItem } from '../../sub-features/code-editor/codemirror/latex-spellcheck';
import { latexAutoCloseExtension } from '../../sub-features/code-editor/codemirror/latex-auto-close';

import { useEditorCompartments } from '../../sub-features/code-editor/codemirror/hooks/useEditorCompartments';
import { useEditorInteractions } from '../../sub-features/code-editor/codemirror/hooks/useEditorInteractions';
import {
  createSelectionUpdateHandler,
  createContextMenuHandler,
} from '../../sub-features/code-editor/codemirror/hooks/useEditorSelectionBar';

export { externalUpdateAnnotation };

export interface UnifiedCodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  fileId?: string;
  filePath?: string;
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
  reviewMode?: boolean;
  onCreateSuggestion?: (change: TrackChangeRecordPayload) => void;
  onSelectionFloating?: (floating: SelFloating | null) => void;
  onContextMenu?: (data: {
    x: number;
    y: number;
    startLine: number;
    endLine: number;
    text: string;
    misspelledInfo?: MisspelledItem | null;
  }) => void;
}

export default function UnifiedCodeMirrorEditor({
  value,
  onChange,
  fileId,
  filePath,
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
  reviewMode,
  onCreateSuggestion,
  onSelectionFloating,
  onContextMenu,
}: UnifiedCodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const adapterRef = useRef<CodeMirrorEngineAdapter | null>(null);
  const lastSyncedValueRef = useRef(value);
  const { setEngine } = useEditorInstance();

  const onSelectionFloatingRef = useRef(onSelectionFloating);
  onSelectionFloatingRef.current = onSelectionFloating;
  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;

  const reviewModeRef = useRef(reviewMode);
  reviewModeRef.current = reviewMode;
  const onCreateSuggestionRef = useRef(onCreateSuggestion);
  onCreateSuggestionRef.current = onCreateSuggestion;

  // Settings from global store
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

  const compileErrors = useCompileStore((s) => s.compileErrors);
  const compileErrorsRef = useRef(compileErrors);
  compileErrorsRef.current = compileErrors;

  const linterEnabledRef = useRef(linterEnabled);
  linterEnabledRef.current = linterEnabled;

  const effectiveKeybinding = keybinding || storeKeybinding;

  // Shared project / bib references
  const bibEntriesRef = useRef(bibEntries);
  useEffect(() => {
    bibEntriesRef.current = bibEntries;
  }, [bibEntries]);

  const projectFilesRef = useRef(projectFiles);
  useEffect(() => {
    projectFilesRef.current = projectFiles;
  }, [projectFiles]);

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Zotero-style: warn on \cite of a retracted work (matched by DOI)
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

  // Force re-linting immediately when compiler errors or linter setting updates
  useEffect(() => {
    if (viewRef.current) {
      forceLinting(viewRef.current);
    }
  }, [compileErrors, linterEnabled]);

  // ── CodeMirror Compartments & Dynamic Reconfigurations ─────────────────────
  const { getInitialExtensions } = useEditorCompartments({
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
  });

  // ── Editor Interactions & In-place Widgets ────────────────────────────────
  const {
    mathTrigger,
    setMathTrigger,
    activeSuggestionWidget,
    setActiveSuggestionWidget,
    handleApplyMath,
    handleDoubleClick,
  } = useEditorInteractions({
    viewRef,
    suggestions,
    onSyncTexReverse,
  });

  // ── Global Editor Commands: AutoFix & Project Lint ─────────────────────────
  useEditorDiagnosticsListener({ viewRef, retractedMapRef });

  // ── Register In-Memory Virtual Document Model ──────────────────────────────
  useEffect(() => {
    if (fileId) {
      documentModelManager.registerModel(fileId, {
        filePath: filePath || fileId,
        content: value,
        yText,
      });
    }
  }, [fileId, filePath, yText]);

  // ── Mount CodeMirror 6 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let changeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const flushPendingChange = () => {
      if (changeDebounceTimer) {
        clearTimeout(changeDebounceTimer);
        changeDebounceTimer = null;
        const view = viewRef.current;
        if (view) {
          const nextText = view.state.doc.toString();
          if (nextText !== lastSyncedValueRef.current) {
            lastSyncedValueRef.current = nextText;
            if (fileId) {
              documentModelManager.updateContent(fileId, nextText, true);
            }
            onChange(nextText);
          }
        }
      }
    };

    const initialDoc = (yText && yText.length > 0 ? yText.toString() : value) ?? '';
    const selectionUpdateHandler = createSelectionUpdateHandler(onSelectionFloatingRef);

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

        // Context menu handler (Overleaf parity right-click spellcheck & editor actions)
        createContextMenuHandler(onContextMenuRef),

        // Update listener
        EditorView.updateListener.of((update) => {
          if (adapterRef.current) {
            adapterRef.current.handleViewUpdate(update);
          }

          selectionUpdateHandler(update);

          if (fileId && (update.selectionSet || update.geometryChanged)) {
            const mainSel = update.state.selection.main;
            const scroller = update.view.scrollDOM;
            documentModelManager.updateViewState(
              fileId,
              { anchor: mainSel.anchor, head: mainSel.head },
              { top: scroller.scrollTop, left: scroller.scrollLeft }
            );
          }

          if (update.docChanged) {
            const isExternal = update.transactions.some((tr) => tr.annotation(externalUpdateAnnotation));
            if (!isExternal) {
              // Micro-debounce stringification (75ms): eliminates megabyte rope re-allocations on every single keystroke
              if (changeDebounceTimer) {
                clearTimeout(changeDebounceTimer);
              }
              changeDebounceTimer = setTimeout(() => {
                changeDebounceTimer = null;
                const view = viewRef.current;
                if (!view) return;
                const nextText = view.state.doc.toString();
                if (nextText !== lastSyncedValueRef.current) {
                  lastSyncedValueRef.current = nextText;
                  if (fileId) {
                    documentModelManager.updateContent(fileId, nextText, true);
                  }
                  onChange(nextText);
                }
              }, 75);
            }
          }
        }),

        // Compartments
        ...getInitialExtensions(),
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

    // 0ms Instant View State Restoration from Virtual Document Model
    if (fileId) {
      const cached = documentModelManager.getModel(fileId);
      if (cached?.selection) {
        const maxLen = view.state.doc.length;
        const anchor = Math.min(cached.selection.anchor, maxLen);
        const head = Math.min(cached.selection.head, maxLen);
        view.dispatch({
          selection: { anchor, head },
          scrollIntoView: false,
        });
      }
      if (cached?.scrollViewport) {
        requestAnimationFrame(() => {
          if (view.scrollDOM) {
            view.scrollDOM.scrollTop = cached.scrollViewport!.top;
            view.scrollDOM.scrollLeft = cached.scrollViewport!.left;
          }
        });
      }
    }

    const unsubCompile = EditorEventBus.on('flux:compile-started', flushPendingChange);
    view.contentDOM.addEventListener('blur', flushPendingChange);

    return () => {
      if (fileId && viewRef.current) {
        const mainSel = viewRef.current.state.selection.main;
        const scroller = viewRef.current.scrollDOM;
        documentModelManager.updateViewState(
          fileId,
          { anchor: mainSel.anchor, head: mainSel.head },
          { top: scroller.scrollTop, left: scroller.scrollLeft }
        );
      }
      flushPendingChange();
      unsubCompile();
      view.contentDOM.removeEventListener('blur', flushPendingChange);
      adapter.onDestroy();
      setEngine(null);
      view.destroy();
      viewRef.current = null;
      adapterRef.current = null;
    };
  }, []); // Mount once

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
          '[&_.cm-ySelectionInfo]:font-sans [&_.cm-ySelectionInfo]:rounded-xs [&_.cm-ySelectionInfo]:px-1.5 [&_.cm-ySelectionInfo]:py-0.5 [&_.cm-ySelectionInfo]:text-10 [&_.cm-ySelectionInfo]:font-semibold [&_.cm-ySelectionInfo]:tracking-normal',
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
