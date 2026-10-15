/**
 * CodeMirrorView.tsx
 *
 * Core CodeMirror 6 Editor View (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/CodeMirrorView.tsx`
 *
 * Integrates:
 * - CodeMirror preset extensions from `engines/codemirror-preset.ts`.
 * - Yjs real-time collaboration adapter from `engines/yjs-codemirror-adapter.ts`.
 * - Bounded LRU Cache hydration (restores cursor selection & scroll position in 0ms).
 * - CodeMirrorEngineAdapter registered into EditorInstanceContext for global bus orchestration.
 * - DiagnosticsGutter for compiler and syntax error markers.
 * - Tab Visibility & Hibernation Coordinator (auto-flushes and frees DOM resources).
 */

'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { EditorState, type Extension, type StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { forceLinting } from '@codemirror/lint';
import { ySyncAnnotation } from 'y-codemirror.next';
import type * as Y from 'yjs';

import {
  createCodeMirrorPreset,
  reconfigureEditorCompartments,
  type EditorRuntimeConfig,
} from '@/features/editor/core/engine/codemirror/codemirror-preset';
import {
  YjsCodeMirrorAdapter,
  type YjsCollabOptions,
} from '@/features/editor/core/engine/collaboration/yjs-codemirror-adapter';
import {
  createTrackChangesExtension,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  reviewCoordinator,
} from '@/features/editor/subsystems/review';
import { useEditorReviewSync } from '@/features/editor/ui/hooks/useEditorReviewSync';
import {
  setErrorLensDiagnosticsEffect,
  createDiagnosticsGutter,
  diagnosticsCoordinator,
} from '@/features/editor/subsystems/diagnostics';
import { CodeMirrorEngineAdapter } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import {
  visibilityCoordinator,
  sessionCoordinator,
  shouldUseRealtimePersistence,
  setActiveEditorEngine,
  getActiveEditorEngine,
  editorCommandBus,
  useSettingsStore,
  useConnectivityStore,
} from '@/features/editor/core';
import { cn } from '@/shared/lib/utils';

export interface CodeMirrorViewProps {
  fileId: string;
  filePath: string;
  value: string;
  onChange?: (nextValue: string) => void;
  yText?: Y.Text | null;
  awareness?: YjsCollabOptions['awareness'];
  /** True only while the realtime (Yjs socket) provider is actually connected. */
  isRealtimeConnected?: boolean;
  readOnly?: boolean;
  className?: string;
  projectId?: string;
  isActive?: boolean;
  onCursorChange?: (line: number, column: number) => void;
}

export interface BuildEditorStateOptions {
  fileId: string;
  filePath: string;
  initialText: string;
  readOnly: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  keybinding: 'standard' | 'vim' | 'emacs';
  errorLensEnabled: boolean;
  spellCheck: boolean;
  spellCheckLanguage: string;
  projectId?: string;
  editorTheme: string;
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number;
  editorMode: string;
  trackChangesViewMode: string;
  reviewMode: boolean;
  collabAdapter: YjsCodeMirrorAdapter;
  yText?: Y.Text | null;
  awareness?: YjsCollabOptions['awareness'];
  viewUpdateListener: Extension;
}

/**
 * Pure state factory: builds a fresh CodeMirror EditorState configured with
 * presets, diagnostics gutter, track changes, collaboration, and update listeners.
 */
export function buildEditorState(options: BuildEditorStateOptions): EditorState {
  const presetExtensions = createCodeMirrorPreset({
    readOnly: options.readOnly,
    lineNumbers: options.lineNumbers,
    lineWrapping: options.wordWrap,
    keybinding: options.keybinding,
    vimMode: options.keybinding === 'vim',
    enableMathPreview: true,
    enableAutocomplete: true,
    enableErrorLens: options.errorLensEnabled,
    enableSpellCheck: options.spellCheck,
    spellCheckLanguage: options.spellCheckLanguage,
    projectId: options.projectId,
    editorTheme: options.editorTheme,
    fontSize: options.fontSize,
    fontFamily: options.fontFamily,
    lineHeight: options.lineHeight,
    enableVisualMode: options.editorMode === 'visual',
  });

  const diagnosticsExtension = createDiagnosticsGutter({
    filePath: options.filePath,
    enabled: true,
  });

  const collabExtension = options.collabAdapter.getExtension({
    yText: options.yText ?? null,
    awareness: options.awareness,
  });

  const trackChangesExtension = createTrackChangesExtension({
    initialViewMode:
      options.trackChangesViewMode === 'clean' ||
      options.trackChangesViewMode === 'original' ||
      options.trackChangesViewMode === 'changes'
        ? options.trackChangesViewMode
        : 'changes',
    initialReviewMode: Boolean(options.reviewMode),
  });

  return EditorState.create({
    doc: options.initialText,
    extensions: [
      ...presetExtensions,
      diagnosticsExtension,
      collabExtension,
      trackChangesExtension,
      options.viewUpdateListener,
    ],
  });
}

function flushViewState(view: EditorView, targetFileId: string): void {
  const latestDoc = view.state.doc.toString();
  if (lruDocumentCache.getModel(targetFileId)?.content !== latestDoc) {
    lruDocumentCache.updateContent(targetFileId, latestDoc, true);
  }
  const mainSel = view.state.selection.main;
  const scrollDOM = view.scrollDOM;
  lruDocumentCache.updateViewState(
    targetFileId,
    { anchor: mainSel.anchor, head: mainSel.head },
    { top: scrollDOM.scrollTop, left: scrollDOM.scrollLeft }
  );
}

function restoreViewState(view: EditorView, targetFileId: string, docLength: number): void {
  const cachedModel = lruDocumentCache.get(targetFileId);
  if (cachedModel?.selection) {
    const anchor = Math.min(cachedModel.selection.anchor, docLength);
    const head = Math.min(cachedModel.selection.head, docLength);
    view.dispatch({ selection: { anchor, head } });
  }

  if (cachedModel?.scrollViewport) {
    requestAnimationFrame(() => {
      if (view.scrollDOM && cachedModel.scrollViewport) {
        view.scrollDOM.scrollTop = cachedModel.scrollViewport.top;
        view.scrollDOM.scrollLeft = cachedModel.scrollViewport.left;
      }
    });
  }
}

export function CodeMirrorView({
  fileId,
  filePath,
  value,
  onChange,
  yText,
  awareness,
  isRealtimeConnected = false,
  readOnly = false,
  className,
  projectId,
  isActive = true,
  onCursorChange,
}: CodeMirrorViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const adapterRef = useRef<CodeMirrorEngineAdapter | null>(null);
  const [activeEditorView, setActiveEditorView] = React.useState<EditorView | null>(null);
  const collabAdapter = useMemo(() => new YjsCodeMirrorAdapter(), []);

  // Track currently loaded file within the mounted view instance
  const currentFileIdRef = useRef<string>(fileId);
  const currentFilePathRef = useRef<string>(filePath);

  // Narrow selectors to prevent useless re-renders when other settings mutate
  const keybinding = useSettingsStore((s) => s.keybinding);
  const lineNumbers = useSettingsStore((s) => s.lineNumbers);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const spellCheckLanguage = useSettingsStore((s) => s.spellCheckLanguage);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const editorTheme = useSettingsStore((s) => s.editorTheme);
  const editorMode = useSettingsStore((s) => s.editorMode);
  const errorLensEnabled = useSettingsStore((s) => s.errorLensEnabled);

  // Synchronize suggestions & comments to active CodeMirror view independently of Review sidebar
  useEditorReviewSync(fileId, activeEditorView);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const yTextRef = useRef(yText);
  yTextRef.current = yText;

  const isRealtimeConnectedRef = useRef(isRealtimeConnected);
  isRealtimeConnectedRef.current = isRealtimeConnected;

  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const syncErrorLens = useCallback((targetView: EditorView, targetFilePath: string) => {
    const diags = diagnosticsCoordinator.getDiagnosticsForFile(targetFilePath);
    targetView.dispatch({
      effects: setErrorLensDiagnosticsEffect.of({
        diagnostics: diags,
        filePath: targetFilePath,
      }),
    });
  }, []);

  // Stable view update listener delegating dynamically via refs
  const viewUpdateListener = useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (adapterRef.current) {
        adapterRef.current.handleViewUpdate(update);
      }

      if (update.docChanged) {
        const isRemote = update.transactions.some((tr) => Boolean(tr.annotation(ySyncAnnotation)));
        const origin: 'local' | 'remote' = isRemote ? 'remote' : 'local';

        let hasStructuralChange = false;
        update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
          if (hasStructuralChange) return;
          if (inserted.length > 0) {
            const slice = inserted.sliceString(0, Math.min(inserted.length, 500));
            if (slice.includes('\\')) {
              hasStructuralChange = true;
            }
          }
        });

        const nextContent = update.state.doc.toString();
        const activeId = currentFileIdRef.current;
        const isOnline = useConnectivityStore.getState().isOnline;
        sessionCoordinator.notifyContentChange(activeId, nextContent, {
          isRealtimeActive: shouldUseRealtimePersistence({
            hasYText: Boolean(yTextRef.current),
            isOnline,
            isProviderConnected: isRealtimeConnectedRef.current,
          }),
          hasStructuralChange,
          origin,
        });
        onChangeRef.current?.(nextContent);
      }

      if (update.selectionSet || update.geometryChanged) {
        const mainSel = update.state.selection.main;
        const scrollDOM = update.view.scrollDOM;
        const activeId = currentFileIdRef.current;

        lruDocumentCache.updateViewState(
          activeId,
          { anchor: mainSel.anchor, head: mainSel.head },
          { top: scrollDOM.scrollTop, left: scrollDOM.scrollLeft }
        );

        if (onCursorChangeRef.current) {
          const line = update.state.doc.lineAt(mainSel.head);
          onCursorChangeRef.current(line.number, mainSel.head - line.from + 1);
        }
      }
    });
  }, []);

  const createStateForDocument = useCallback(
    (docFileId: string, docFilePath: string, docValue: string) => {
      const cachedModel = lruDocumentCache.get(docFileId);
      const cachedContent =
        cachedModel?.content !== undefined && (cachedModel.content.length > 0 || !docValue)
          ? cachedModel.content
          : docValue;
      const initialText =
        yText && yText.length > 0 ? yText.toString() : cachedContent;

      return buildEditorState({
        fileId: docFileId,
        filePath: docFilePath,
        initialText,
        readOnly,
        lineNumbers: editorMode === 'visual' ? false : lineNumbers,
        wordWrap,
        keybinding,
        errorLensEnabled,
        spellCheck,
        spellCheckLanguage,
        projectId,
        editorTheme,
        fontSize,
        fontFamily,
        lineHeight,
        editorMode,
        trackChangesViewMode,
        reviewMode,
        collabAdapter,
        yText: yText ?? null,
        awareness,
        viewUpdateListener,
      });
    },
    [
      yText,
      readOnly,
      lineNumbers,
      wordWrap,
      keybinding,
      errorLensEnabled,
      spellCheck,
      spellCheckLanguage,
      projectId,
      editorTheme,
      fontSize,
      fontFamily,
      lineHeight,
      editorMode,
      trackChangesViewMode,
      reviewMode,
      collabAdapter,
      awareness,
      viewUpdateListener,
    ]
  );

  const currentRuntimeConfig: EditorRuntimeConfig = useMemo(
    () => ({
      readOnly,
      lineNumbers,
      lineWrapping: wordWrap,
      keybinding,
      spellCheck,
      spellCheckLanguage,
      projectId,
      editorTheme,
      fontSize,
      fontFamily,
      lineHeight,
      visualMode: editorMode === 'visual',
      errorLensEnabled,
    }),
    [
      readOnly,
      lineNumbers,
      wordWrap,
      keybinding,
      spellCheck,
      spellCheckLanguage,
      projectId,
      editorTheme,
      fontSize,
      fontFamily,
      lineHeight,
      editorMode,
      errorLensEnabled,
    ]
  );

  const prevConfigRef = useRef<{
    runtime: EditorRuntimeConfig;
    reviewMode: boolean;
    trackChangesViewMode: string;
  } | null>(null);

  // ── Persistent Editor View Mount Lifecycle (Runs ONCE per container) ───────
  useEffect(() => {
    if (!containerRef.current) return;

    currentFileIdRef.current = fileId;
    currentFilePathRef.current = filePath;

    const state = createStateForDocument(fileId, filePath, value);
    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    prevConfigRef.current = {
      runtime: currentRuntimeConfig,
      reviewMode: Boolean(reviewMode),
      trackChangesViewMode,
    };
    setActiveEditorView(view);
    reviewCoordinator.bindEditorView(view, fileId);

    const engineAdapter = new CodeMirrorEngineAdapter(view);
    adapterRef.current = engineAdapter;
    if (isActiveRef.current) {
      setActiveEditorEngine(engineAdapter);
    }

    const handleFocus = () => {
      if (adapterRef.current) {
        setActiveEditorEngine(adapterRef.current);
      }
    };
    view.dom.addEventListener('focus', handleFocus, true);
    view.dom.addEventListener('mousedown', handleFocus, true);

    restoreViewState(view, fileId, state.doc.length);
    syncErrorLens(view, filePath);
    if (isActiveRef.current) {
      navigationCoordinator.registerEditorView(fileId, filePath);
    }

    const unsubDiagnostics = diagnosticsCoordinator.subscribe(() => {
      const runSync = () => {
        if (viewRef.current) {
          try {
            forceLinting(viewRef.current);
            syncErrorLens(viewRef.current, currentFilePathRef.current);
          } catch {
            // Defer if called mid-transaction
            setTimeout(() => {
              if (viewRef.current) {
                forceLinting(viewRef.current);
                syncErrorLens(viewRef.current, currentFilePathRef.current);
              }
            }, 0);
          }
        }
      };
      runSync();
    });

    const unsubVisibility = visibilityCoordinator.subscribe((lifecycle) => {
      if (lifecycle === 'hibernated' && viewRef.current) {
        flushViewState(viewRef.current, currentFileIdRef.current);
      }
    });

    let scrollRafId: number | null = null;
    let lastDispatchedLine = -1;
    const handleScroll = () => {
      if (scrollRafId !== null) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        if (!viewRef.current || !adapterRef.current) return;
        const line = adapterRef.current.getVisibleLine();
        const totalLines = viewRef.current.state.doc.lines;
        const fraction = totalLines > 1 ? (line - 1) / (totalLines - 1) : 0;
        if (line !== lastDispatchedLine) {
          lastDispatchedLine = line;
          editorCommandBus.dispatch({ type: 'sync:editor-scrolled', line, totalLines, fraction });
        }
      });
    };
    view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });

    const unsubContentUpdated = editorCommandBus.subscribe('document:content-updated', (cmd) => {
      if (cmd.docId === currentFileIdRef.current && viewRef.current) {
        if (sessionCoordinator.getConflict(cmd.docId) || lruDocumentCache.getModel(cmd.docId)?.isDirty) {
          return;
        }
        const currentDoc = viewRef.current.state.doc.toString();
        if (currentDoc !== cmd.content) {
          const sel = viewRef.current.state.selection.main;
          const newLen = cmd.content.length;
          viewRef.current.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: cmd.content },
            selection: {
              anchor: Math.min(sel.anchor, newLen),
              head: Math.min(sel.head, newLen),
            },
          });
        }
      }
    });

    const unsubSetContent = editorCommandBus.subscribe('editor:set-content', (cmd) => {
      const anyCmd = cmd as { type: string; content: string; fileId?: string };
      if ((!anyCmd.fileId || anyCmd.fileId === currentFileIdRef.current) && viewRef.current) {
        const currentDoc = viewRef.current.state.doc.toString();
        if (currentDoc !== anyCmd.content) {
          const sel = viewRef.current.state.selection.main;
          const newLen = anyCmd.content.length;
          viewRef.current.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: anyCmd.content },
            selection: {
              anchor: Math.min(sel.anchor, newLen),
              head: Math.min(sel.head, newLen),
            },
          });
        }
      }
    });

    const unsubLint = editorCommandBus.subscribe('editor:lint-project', () => {
      if (viewRef.current) {
        forceLinting(viewRef.current);
        syncErrorLens(viewRef.current, currentFilePathRef.current);
      }
    });

    return () => {
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      view.scrollDOM.removeEventListener('scroll', handleScroll);
      view.dom.removeEventListener('focus', handleFocus, true);
      view.dom.removeEventListener('mousedown', handleFocus, true);
      unsubContentUpdated();
      unsubSetContent();
      unsubLint();
      unsubDiagnostics();
      unsubVisibility();
      if (viewRef.current) {
        flushViewState(viewRef.current, currentFileIdRef.current);
      }
      reviewCoordinator.bindEditorView(null, currentFileIdRef.current);
      if (getActiveEditorEngine() === engineAdapter) {
        setActiveEditorEngine(null);
      }
      adapterRef.current = null;
      view.destroy();
      viewRef.current = null;
      setActiveEditorView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Zero-Remount Document Swapping via view.setState ──────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const prevFileId = currentFileIdRef.current;
    const prevFilePath = currentFilePathRef.current;

    // Skip if target document matches currently loaded document
    if (prevFileId === fileId && prevFilePath === filePath) return;

    // 1. Flush previous document content & viewState to LRU Cache
    flushViewState(view, prevFileId);
    reviewCoordinator.bindEditorView(null, prevFileId);

    // 2. Build new EditorState for the target document
    const nextState = createStateForDocument(fileId, filePath, value);

    // 3. 0ms Zero-Remount State Swap (Preserves DOM container & event listeners)
    view.setState(nextState);
    prevConfigRef.current = {
      runtime: currentRuntimeConfig,
      reviewMode: Boolean(reviewMode),
      trackChangesViewMode,
    };

    // 4. Update tracking refs
    currentFileIdRef.current = fileId;
    currentFilePathRef.current = filePath;

    // 5. Restore cached selection and scroll position for target document
    restoreViewState(view, fileId, nextState.doc.length);

    // 6. Rebind Review Coordinator & Diagnostics Error Lens
    reviewCoordinator.bindEditorView(view, fileId);
    syncErrorLens(view, filePath);
    forceLinting(view);

    // 7. Re-bind adapter view reference & active engine
    if (adapterRef.current) {
      adapterRef.current.setView(view);
      if (isActiveRef.current) {
        setActiveEditorEngine(adapterRef.current);
        navigationCoordinator.registerEditorView(fileId, filePath);
      }
    }
  }, [fileId, filePath, value, createStateForDocument, currentRuntimeConfig, reviewMode, trackChangesViewMode, syncErrorLens]);

  // Sync active engine when pane active status updates
  useEffect(() => {
    if (isActive && adapterRef.current) {
      setActiveEditorEngine(adapterRef.current);
    }
  }, [isActive]);

  // Synchronize external value changes (e.g. Draft restoration, async fetch, revision revert)
  useEffect(() => {
    if (!viewRef.current || value === undefined) return;
    // Guard against applying external value meant for a previous document during swap
    if (currentFileIdRef.current !== fileId) return;

    const currentDoc = viewRef.current.state.doc.toString();
    if (currentDoc !== value) {
      const sel = viewRef.current.state.selection.main;
      const newLen = value.length;
      viewRef.current.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
        selection: {
          anchor: Math.min(sel.anchor, newLen),
          head: Math.min(sel.head, newLen),
        },
      });
    }
  }, [value, fileId]);

  // ── 0ms Batched Dynamic Compartment Reconfiguration Seam (No View Re-mount) ──
  useEffect(() => {
    const view = viewRef.current;
    const prev = prevConfigRef.current;
    if (!view || !prev) return;

    const additionalEffects: StateEffect<unknown>[] = [];
    if (prev.trackChangesViewMode !== trackChangesViewMode) {
      additionalEffects.push(setTrackChangesViewModeEffect.of(trackChangesViewMode));
    }
    if (prev.reviewMode !== Boolean(reviewMode)) {
      additionalEffects.push(setTrackChangesReviewModeEffect.of(Boolean(reviewMode)));
    }

    const errorLensActivated =
      !prev.runtime.errorLensEnabled && currentRuntimeConfig.errorLensEnabled;

    reconfigureEditorCompartments(view, prev.runtime, currentRuntimeConfig, additionalEffects);

    prevConfigRef.current = {
      runtime: currentRuntimeConfig,
      reviewMode: Boolean(reviewMode),
      trackChangesViewMode,
    };

    if (errorLensActivated) {
      syncErrorLens(view, currentFilePathRef.current);
    }
  }, [currentRuntimeConfig, reviewMode, trackChangesViewMode, syncErrorLens]);

  // Reconfigure Yjs collab extension on prop change
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: collabAdapter.reconfigure({
          yText: yText ?? null,
          awareness,
        }),
      });
    }
  }, [yText, awareness, collabAdapter]);

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full overflow-hidden flex flex-col font-mono text-sm', className)}
    />
  );
}

export default CodeMirrorView;
