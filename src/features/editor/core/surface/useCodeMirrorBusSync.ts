/**
 * useCodeMirrorBusSync.ts
 *
 * Mount-lifecycle bus, diagnostics, visibility, and scroll event binding helper
 * for CodeMirrorView. Attached once per persistent EditorView container.
 */

import type React from 'react';
import type { EditorView } from '@codemirror/view';
import { forceLinting } from '@codemirror/lint';
import type * as Y from 'yjs';

import type { CodeMirrorEngineAdapter } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import {
  getActiveEditorEngine,
  setActiveEditorEngine,
  unregisterEditorEngine,
} from '@/features/editor/core/bus/engine-registry';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { visibilityCoordinator } from '@/features/editor/core/coordinator/visibility.coordinator';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { reviewCoordinator } from '@/features/editor/subsystems/review/coordinator/review.coordinator';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  applyDiffToYText,
  applyExternalDiffToView,
  flushViewState,
} from './codemirror-state-factory';

export interface AttachCodeMirrorBusListenersOptions {
  view: EditorView;
  engineAdapter: CodeMirrorEngineAdapter;
  viewRef: React.MutableRefObject<EditorView | null>;
  adapterRef: React.MutableRefObject<CodeMirrorEngineAdapter | null>;
  currentFileIdRef: React.MutableRefObject<string>;
  currentFilePathRef: React.MutableRefObject<string>;
  isSecondaryRef: React.MutableRefObject<boolean>;
  yTextRef: React.MutableRefObject<Y.Text | null | undefined>;
  syncErrorLens: (targetView: EditorView, targetFilePath: string) => void;
  setActiveEditorView: (view: EditorView | null) => void;
  handleFocus: () => void;
}

export function attachCodeMirrorBusListeners(
  opts: AttachCodeMirrorBusListenersOptions,
): () => void {
  const {
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
  } = opts;

  let diagSyncTimerId: ReturnType<typeof setTimeout> | null = null;
  const unsubDiagnostics = diagnosticsCoordinator.subscribe((_fileKey, source) => {
    // Only re-trigger forceLinting when filter options change ('filter').
    // Never call forceLinting on 'linter', 'shift', 'clear', or 'compiler' notifications,
    // preventing coordinator -> forceLinting -> ingestLinterDiagnostics feedback loops.
    const shouldForceLint = source === 'filter';
    const runSync = () => {
      if (viewRef.current) {
        try {
          if (shouldForceLint) {
            forceLinting(viewRef.current);
          }
          syncErrorLens(viewRef.current, currentFilePathRef.current);
        } catch {
          // Defer if called mid-transaction
          if (diagSyncTimerId !== null) clearTimeout(diagSyncTimerId);
          diagSyncTimerId = setTimeout(() => {
            diagSyncTimerId = null;
            if (viewRef.current) {
              if (shouldForceLint) {
                forceLinting(viewRef.current);
              }
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
    const activeFileId = currentFileIdRef.current;
    const matchesDoc =
      cmd.docId === activeFileId ||
      (Boolean(currentFilePathRef.current) &&
        (cmd.docId === currentFilePathRef.current ||
          cmd.docId.replace(/^\//, '') === currentFilePathRef.current.replace(/^\//, '')));
    if (matchesDoc && viewRef.current) {
      if (
        sessionCoordinator.getConflict(activeFileId) ||
        lruDocumentCache.getModel(activeFileId)?.isDirty
      ) {
        return;
      }
      if (yTextRef.current) {
        lruDocumentCache.updateContent(activeFileId, cmd.content, false);
        applyDiffToYText(yTextRef.current, cmd.content, 'remote-content-updated');
        return;
      }
      applyExternalDiffToView(viewRef.current, cmd.content);
    }
  });

  const unsubSetContent = editorCommandBus.subscribe('editor:set-content', (cmd) => {
    const anyCmd = cmd as { type: string; content: string; fileId?: string };
    const activeDocId = usePageStore.getState().getActiveDocumentId();
    const shouldApply = anyCmd.fileId
      ? anyCmd.fileId === currentFileIdRef.current
      : !isSecondaryRef.current || activeDocId === currentFileIdRef.current;

    if (shouldApply && viewRef.current) {
      const liveYText = yTextRef.current;
      if (liveYText) {
        applyDiffToYText(liveYText, anyCmd.content, 'local-set-content');
        return;
      }
      applyExternalDiffToView(viewRef.current, anyCmd.content);
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
    if (diagSyncTimerId !== null) clearTimeout(diagSyncTimerId);
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
    reviewCoordinator.unbindEditorView(view, currentFileIdRef.current);
    unregisterEditorEngine(currentFileIdRef.current, engineAdapter);
    if (getActiveEditorEngine() === engineAdapter) {
      setActiveEditorEngine(null);
    }
    adapterRef.current = null;
    view.destroy();
    viewRef.current = null;
    setActiveEditorView(null);
  };
}
