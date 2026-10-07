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

import React, { useEffect, useRef, useMemo } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { forceLinting } from '@codemirror/lint';
import type * as Y from 'yjs';

import {
  createCodeMirrorPreset,
  reconfigureLineNumbers,
  reconfigureLineWrapping,
  reconfigureVimMode,
  reconfigureReadOnly,
} from '../../../engines/codemirror-preset';
import { YjsCodeMirrorAdapter } from '../../../engines/yjs-codemirror-adapter';
import { CodeMirrorEngineAdapter } from '../../../adapters/codemirror/codemirror.adapter';
import { lruDocumentCache } from '../../../domain/lru-document-cache';
import { visibilityCoordinator } from '../../../coordinators/visibility.coordinator';
import { diagnosticsCoordinator } from '../../../coordinators/diagnostics.coordinator';
import { sessionCoordinator } from '../../../coordinators/session.coordinator';
import { useSettingsStore } from '../../../store/settings.store';
import { createDiagnosticsGutter } from './DiagnosticsGutter';
import { setErrorLensDiagnosticsEffect } from '../../../engines/latex-error-lens';
import { useEditorInstance } from '../../../core/context/editor-instance.context';
import { cn } from '@/shared/lib/utils';

export interface CodeMirrorViewProps {
  fileId: string;
  filePath: string;
  value: string;
  onChange: (nextValue: string) => void;
  yText?: Y.Text | null;
  awareness?: any | null;
  readOnly?: boolean;
  className?: string;
  onCursorChange?: (line: number, column: number) => void;
}

export function CodeMirrorView({
  fileId,
  filePath,
  value,
  onChange,
  yText,
  awareness,
  readOnly = false,
  className,
  onCursorChange,
}: CodeMirrorViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const adapterRef = useRef<CodeMirrorEngineAdapter | null>(null);
  const collabAdapter = useMemo(() => new YjsCodeMirrorAdapter(), []);

  const { setEngine } = useEditorInstance();
  // Narrow selectors to prevent useless re-renders when other settings mutate
  const keybinding = useSettingsStore((s) => s.keybinding);
  const lineNumbers = useSettingsStore((s) => s.lineNumbers);
  const wordWrap = useSettingsStore((s) => s.wordWrap);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Hydrate previous view state from LRU Cache
    const cachedModel = lruDocumentCache.get(fileId);
    const initialText = yText && yText.length > 0 ? yText.toString() : (cachedModel?.content ?? value);

    // 2. Preset Extensions & Diagnostic Gutter
    const presetExtensions = createCodeMirrorPreset({
      readOnly,
      lineNumbers,
      lineWrapping: wordWrap,
      vimMode: keybinding === 'vim',
      enableMathPreview: true,
      enableAutocomplete: true,
    });

    const diagnosticsExtension = createDiagnosticsGutter({
      filePath,
      enabled: true,
    });

    const collabExtension = collabAdapter.getExtension({
      yText: yText ?? null,
      awareness,
    });

    // 3. View Update Listener
    const viewUpdateListener = EditorView.updateListener.of((update) => {
      if (adapterRef.current) {
        adapterRef.current.handleViewUpdate(update);
      }

      if (update.docChanged) {
        const nextContent = update.state.doc.toString();
        lruDocumentCache.updateContent(fileId, nextContent, true);
        sessionCoordinator.notifyContentChange(fileId, nextContent, {
          isRealtimeActive: Boolean(yText),
        });
        onChangeRef.current(nextContent);
      }

      if (update.selectionSet || update.geometryChanged) {
        const mainSel = update.state.selection.main;
        const scrollDOM = update.view.scrollDOM;

        lruDocumentCache.updateViewState(
          fileId,
          { anchor: mainSel.anchor, head: mainSel.head },
          { top: scrollDOM.scrollTop, left: scrollDOM.scrollLeft }
        );

        if (onCursorChangeRef.current) {
          const line = update.state.doc.lineAt(mainSel.head);
          onCursorChangeRef.current(line.number, mainSel.head - line.from + 1);
        }
      }
    });

    // 4. Assemble State & View
    const state = EditorState.create({
      doc: initialText,
      extensions: [
        ...presetExtensions,
        diagnosticsExtension,
        collabExtension,
        viewUpdateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // 5. Connect Concrete Engine Adapter to Global Context
    const engineAdapter = new CodeMirrorEngineAdapter(view);
    adapterRef.current = engineAdapter;
    setEngine(engineAdapter);

    // 6. Restore cached selection & scroll position
    if (cachedModel?.selection) {
      const docLen = state.doc.length;
      const anchor = Math.min(cachedModel.selection.anchor, docLen);
      const head = Math.min(cachedModel.selection.head, docLen);
      view.dispatch({ selection: { anchor, head } });
    }

    if (cachedModel?.scrollViewport) {
      requestAnimationFrame(() => {
        if (view.scrollDOM) {
          view.scrollDOM.scrollTop = cachedModel.scrollViewport!.top;
          view.scrollDOM.scrollLeft = cachedModel.scrollViewport!.left;
        }
      });
    }

    // 7. Subscribe to Diagnostics updates to trigger re-lint & refresh Error Lens
    const syncErrorLens = (targetView: EditorView) => {
      const diags = diagnosticsCoordinator.getDiagnosticsForFile(filePath);
      targetView.dispatch({
        effects: setErrorLensDiagnosticsEffect.of(diags),
      });
    };

    const unsubDiagnostics = diagnosticsCoordinator.subscribe(() => {
      if (viewRef.current) {
        forceLinting(viewRef.current);
        syncErrorLens(viewRef.current);
      }
    });

    // Initial Error Lens hydration
    syncErrorLens(view);

    // 8. Tab Visibility Hibernation Handler
    const unsubVisibility = visibilityCoordinator.subscribe((lifecycle) => {
      if (lifecycle === 'hibernated') {
        if (viewRef.current) {
          const scroller = viewRef.current.scrollDOM;
          const mainSel = viewRef.current.state.selection.main;
          lruDocumentCache.updateViewState(
            fileId,
            { anchor: mainSel.anchor, head: mainSel.head },
            { top: scroller.scrollTop, left: scroller.scrollLeft }
          );
        }
      }
    });

    return () => {
      unsubDiagnostics();
      unsubVisibility();
      setEngine(null);
      adapterRef.current = null;
      view.destroy();
      viewRef.current = null;
    };
  }, [fileId, filePath, setEngine]);

  // ── 0ms Dynamic Compartment Reconfigurations (No View Re-mount) ───────────
  useEffect(() => {
    if (!viewRef.current) return;
    reconfigureLineNumbers(viewRef.current, lineNumbers);
  }, [lineNumbers]);

  useEffect(() => {
    if (!viewRef.current) return;
    reconfigureLineWrapping(viewRef.current, wordWrap);
  }, [wordWrap]);

  useEffect(() => {
    if (!viewRef.current) return;
    reconfigureVimMode(viewRef.current, keybinding === 'vim');
  }, [keybinding]);

  useEffect(() => {
    if (!viewRef.current) return;
    reconfigureReadOnly(viewRef.current, readOnly);
  }, [readOnly]);

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
