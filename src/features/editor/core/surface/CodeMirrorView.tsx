/**
 * CodeMirrorView.tsx
 *
 * Core CodeMirror 6 Editor View (Block 6: UI Features Layer).
 * Location: `features/editor/core/surface/CodeMirrorView.tsx`
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
import { type StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { forceLinting } from '@codemirror/lint';
import { ySyncAnnotation } from 'y-codemirror.next';
import type * as Y from 'yjs';

import {
  reconfigureEditorCompartments,
  type EditorRuntimeConfig,
} from '@/features/editor/core/engine/codemirror/codemirror-preset';
import {
  YjsCodeMirrorAdapter,
  type YjsCollabOptions,
} from '@/features/editor/core/engine/collaboration/yjs-codemirror-adapter';
import {
  clearDiffEffect,
  proposeDiffEffect,
} from '@/features/editor/core/engine/extensions/inline-diff';
import {
  CodeMirrorEngineAdapter,
  programmaticSyncAnnotation,
} from '@/features/editor/core/engine/adapters/codemirror.adapter';
import { aiCoordinator } from '@/features/editor/subsystems/ai/coordinator/ai.coordinator';
import {
  reviewCoordinator,
  setReviewModeEffect,
  setViewModeEffect,
  useReviewSync,
} from '@/features/editor/subsystems/review';
import { setErrorLensDiagnosticsEffect } from '@/features/editor/subsystems/diagnostics/extensions/latex-error-lens';
import { setCompilerDiagnosticsEffect } from '@/features/editor/subsystems/diagnostics/extensions/diagnostics-gutter';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation/coordinator/navigation.coordinator';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { shouldUseRealtimePersistence } from '@/features/editor/core/coordinator/session-persistence.strategy';
import {
  setActiveEditorEngine,
  registerEditorEngine,
  unregisterEditorEngine,
} from '@/features/editor/core/bus/engine-registry';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { getIsOnline } from '@/shared/lib/network';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { warmEditorStatePool } from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import { cn } from '@/shared/lib/utils';

import {
  buildEditorState,
  flushViewState,
  restoreViewState,
  applyExternalDiffToView,
  reconfigureYjsBindingInView,
  type BuildEditorStateOptions,
} from './codemirror-state-factory';
import { attachCodeMirrorBusListeners } from '../hooks/useCodeMirrorBusSync';

export { buildEditorState, type BuildEditorStateOptions };

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
  isSecondary?: boolean;
  onCursorChange?: (line: number, column: number) => void;
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
  isSecondary = false,
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
  const isSecondaryRef = useRef<boolean>(isSecondary);
  isSecondaryRef.current = isSecondary;

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
  const autoCloseBrackets = useSettingsStore((s) => s.autoCloseBrackets);
  const showEquationPreview = useSettingsStore((s) => s.showEquationPreview);
  const autoComplete = useSettingsStore((s) => s.autoComplete);
  const linterEnabled = useSettingsStore((s) => s.linterEnabled);

  // Synchronize suggestions & comments to active CodeMirror view independently of Review sidebar
  useReviewSync(fileId, activeEditorView);

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

  const syncErrorLens = useCallback(
    (
      targetView: EditorView,
      targetFilePath: string,
      options?: { syncCompilerGutter?: boolean },
    ) => {
      const diags = diagnosticsCoordinator.getDiagnosticsForFile(targetFilePath);
      const effects = [
        setErrorLensDiagnosticsEffect.of({
          diagnostics: diags,
          filePath: targetFilePath,
        }),
        ...(options?.syncCompilerGutter === false
          ? []
          : [setCompilerDiagnosticsEffect.of(diags)]),
      ];
      targetView.dispatch({ effects });
    },
    [],
  );

  // Stable view update listener delegating dynamically via refs
  const viewUpdateListener = useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (adapterRef.current) {
        adapterRef.current.handleViewUpdate(update);
      }

      if (update.docChanged) {
        const isRemote = update.transactions.some(
          (tr) => Boolean(tr.annotation(ySyncAnnotation)) || Boolean(tr.annotation(programmaticSyncAnnotation)),
        );
        const origin: 'local' | 'remote' = isRemote ? 'remote' : 'local';

        let hasStructuralChange = false;
        update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          if (hasStructuralChange) return;
          if (inserted.length > 0) {
            const slice = inserted.sliceString(0, Math.min(inserted.length, 500));
            if (
              /\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)\b/.test(
                slice,
              ) ||
              slice.includes('{') ||
              slice.includes('}')
            ) {
              hasStructuralChange = true;
              return;
            }
          }
          if (toA > fromA) {
            const deletedSlice = update.startState.doc.sliceString(
              fromA,
              Math.min(toA, fromA + 500),
            );
            if (
              deletedSlice.includes('\\') ||
              deletedSlice.includes('{') ||
              deletedSlice.includes('}')
            ) {
              hasStructuralChange = true;
            }
          }
        });

        const nextContent = update.state.doc.toString();
        const activeId = currentFileIdRef.current;
        if (origin === 'local' && activeId) {
          useWorkspaceStore.getState().pinTabForFile(activeId);
        }
        const isOnline = getIsOnline();
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
          { top: scrollDOM.scrollTop, left: scrollDOM.scrollLeft },
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
      const effectiveYText = yText ?? null;
      if (effectiveYText && effectiveYText.length === 0 && cachedContent) {
        if (effectiveYText.doc) {
          effectiveYText.doc.transact(() => {
            if (effectiveYText && effectiveYText.length === 0) {
              effectiveYText.insert(0, cachedContent);
            }
          }, 'local-init');
        } else {
          effectiveYText.insert(0, cachedContent);
        }
      }
      const initialText = effectiveYText ? effectiveYText.toString() : cachedContent;

      return buildEditorState({
        fileId: docFileId,
        filePath: docFilePath,
        initialText,
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
        autoCloseBrackets,
        enableMathPreview: showEquationPreview,
        enableAutocomplete: autoComplete,
        enableLinter: linterEnabled,
        collabAdapter,
        yText: yText ?? null,
        awareness,
        viewUpdateListener,
        warmSnapshot: warmEditorStatePool.get(docFileId),
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
      autoCloseBrackets,
      showEquationPreview,
      autoComplete,
      linterEnabled,
      collabAdapter,
      awareness,
      viewUpdateListener,
    ],
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
      autoCloseBrackets,
      enableMathPreview: showEquationPreview,
      enableAutocomplete: autoComplete,
      enableLinter: linterEnabled,
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
      autoCloseBrackets,
      showEquationPreview,
      autoComplete,
      linterEnabled,
    ],
  );

  const prevConfigRef = useRef<{
    runtime: EditorRuntimeConfig;
    reviewMode: boolean;
    trackChangesViewMode: string;
  } | null>(null);
  const boundYTextRef = useRef<Y.Text | null>(yText ?? null);

  // ── Persistent Editor View Mount Lifecycle (Runs ONCE per container) ───────
  useEffect(() => {
    if (!containerRef.current) return;

    currentFileIdRef.current = fileId;
    currentFilePathRef.current = filePath;
    boundYTextRef.current = yText ?? null;

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
    registerEditorEngine(fileId, engineAdapter);
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
    const initialPendingDiff = aiCoordinator.consumePendingDiffForFile(
      fileId,
      state.doc.toString(),
    );
    if (initialPendingDiff) {
      const docLen = state.doc.length;
      const from = Math.max(0, Math.min(initialPendingDiff.from, docLen));
      const to = Math.max(from, Math.min(initialPendingDiff.to, docLen));
      view.dispatch({
        effects: [proposeDiffEffect.of({ ...initialPendingDiff, from, to })],
      });
    }
    syncErrorLens(view, filePath);
    if (isActiveRef.current) {
      navigationCoordinator.registerEditorView(fileId, filePath);
    }

    return attachCodeMirrorBusListeners({
      view,
      engineAdapter,
      viewRef,
      adapterRef,
      currentFileIdRef,
      currentFilePathRef,
      isSecondaryRef,
      yTextRef,
      syncErrorLens,
      setActiveEditorView,
      handleFocus,
    });
    // Safe Intentional Exception: Persistent CodeMirror DOM container lifecycle.
    // Mounts exactly once. Subsequent document swaps and reactive updates are handled
    // by zero-remount view.setState and reactive effect listeners below without tearing down DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Zero-Remount Document Swapping via view.setState ──────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const prevFileId = currentFileIdRef.current;
    const prevFilePath = currentFilePathRef.current;
    const prevDocKey = prevFileId || prevFilePath;
    const nextDocKey = (fileId || '') || (filePath || '');
    const isSameDoc = prevDocKey !== '' && prevDocKey === nextDocKey;

    // Skip full EditorState rebuild when staying on the same document;
    // Yjs collab binding changes are reconfigured in-place via collabAdapter below.
    if (isSameDoc) {
      if (prevFilePath !== filePath) {
        currentFilePathRef.current = filePath;
        syncErrorLens(view, filePath);
        if (isActiveRef.current) {
          navigationCoordinator.registerEditorView(fileId, filePath);
        }
      }
      return;
    }

    // 1. Flush previous document content & viewState to LRU Cache
    flushViewState(view, prevFileId);
    reviewCoordinator.unbindEditorView(view, prevFileId);
    if (adapterRef.current) {
      unregisterEditorEngine(prevFileId, adapterRef.current);
    }

    // 2. Build new EditorState for the target document (bound to current yText & awareness)
    const nextState = createStateForDocument(fileId, filePath, value);

    // 3. 0ms Zero-Remount State Swap (Preserves DOM container & event listeners)
    view.setState(nextState);
    const nextPendingDiff = aiCoordinator.consumePendingDiffForFile(
      fileId,
      nextState.doc.toString(),
    );
    if (nextPendingDiff) {
      const docLen = nextState.doc.length;
      const from = Math.max(0, Math.min(nextPendingDiff.from, docLen));
      const to = Math.max(from, Math.min(nextPendingDiff.to, docLen));
      view.dispatch({
        effects: [proposeDiffEffect.of({ ...nextPendingDiff, from, to })],
      });
    } else {
      view.dispatch({ effects: clearDiffEffect.of() });
    }
    boundYTextRef.current = yText ?? null;
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
      registerEditorEngine(fileId, adapterRef.current);
      if (isActiveRef.current) {
        setActiveEditorEngine(adapterRef.current);
        navigationCoordinator.registerEditorView(fileId, filePath);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, filePath]);

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
    // Do not overwrite live non-empty Yjs-backed CodeMirror buffer when REST value prop refetches
    if (yText && yText.length > 0) return;
    if (yTextRef.current) {
      if (yTextRef.current.length > 0) return;
      // When Yjs doc is still empty (e.g. freshly switched file before/without realtime server)
      // and async REST fetch arrives with content, hydrate yText once so CodeMirror displays it.
      if (value.length > 0) {
        const targetYText = yTextRef.current;
        if (targetYText.doc) {
          targetYText.doc.transact(() => {
            if (targetYText.length === 0) {
              targetYText.insert(0, value);
            }
          }, 'local-init');
        } else {
          targetYText.insert(0, value);
        }
      }
      return;
    }

    applyExternalDiffToView(viewRef.current, value);
  }, [value, fileId, yText]);

  // ── 0ms Batched Dynamic Compartment Reconfiguration Seam (No View Re-mount) ──
  useEffect(() => {
    const view = viewRef.current;
    const prev = prevConfigRef.current;
    if (!view || !prev) return;

    const additionalEffects: StateEffect<unknown>[] = [];
    if (prev.trackChangesViewMode !== trackChangesViewMode) {
      additionalEffects.push(setViewModeEffect.of(trackChangesViewMode));
    }
    if (prev.reviewMode !== Boolean(reviewMode)) {
      additionalEffects.push(setReviewModeEffect.of(Boolean(reviewMode)));
    }
    if (prev.runtime.visualMode !== currentRuntimeConfig.visualMode) {
      additionalEffects.push(
        EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }),
      );
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
    const view = viewRef.current;
    if (!view) return;
    reconfigureYjsBindingInView(view, boundYTextRef, yText ?? null, awareness, collabAdapter);
  }, [yText, awareness, collabAdapter]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col font-mono text-sm manuscript-editor-view',
        className,
      )}
    />
  );
}

export default CodeMirrorView;
