/**
 * useEditorToolbarActions.ts
 *
 * State and formatting/insert/review action handlers for EditorToolbar.
 */

import { useState, useCallback, useEffect } from 'react';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  getActiveEditorEngine,
  subscribeEditorEngineChanges,
} from '@/features/editor/core/bus/engine-registry';
import type { LatexFormatType } from '@/features/editor/domain/types/ports/editor-engine.port';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';

function detectStyleLabelFromLine(lineText: string): string {
  const trimmed = lineText.trimStart();
  if (/^\\title\*?\{/.test(trimmed)) return 'Title';
  if (/^\\section\*?\{/.test(trimmed)) return 'Section';
  if (/^\\subsection\*?\{/.test(trimmed)) return 'Subsection';
  if (/^\\subsubsection\*?\{/.test(trimmed)) return 'Subsubsection';
  if (/^\\paragraph\*?\{/.test(trimmed)) return 'Paragraph';
  return 'Normal';
}

export interface StyleOption {
  id: string;
  label: string;
  latexPrefix: string;
  latexSuffix: string;
  visualCommand: string;
  visualLevel?: 0 | 1 | 2 | 3;
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'normal', label: 'Normal', latexPrefix: '', latexSuffix: '', visualCommand: 'normal' },
  { id: 'title', label: 'Title', latexPrefix: '\\title{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 0 },
  { id: 'section', label: 'Section', latexPrefix: '\\section{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 1 },
  { id: 'subsection', label: 'Subsection', latexPrefix: '\\subsection{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 2 },
  { id: 'subsubsection', label: 'Subsubsection', latexPrefix: '\\subsubsection{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 3 },
  { id: 'paragraph', label: 'Paragraph', latexPrefix: '\\paragraph{', latexSuffix: '}', visualCommand: 'paragraph' },
];

export function useEditorToolbarActions(readOnly: boolean) {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const [currentStyle, setCurrentStyle] = useState<string>('Normal');

  useEffect(() => {
    let unsubCursor: (() => void) | undefined;
    let unsubContent: (() => void) | undefined;

    const syncStyleFromEngine = (
      engine: ReturnType<typeof getActiveEditorEngine>,
      lineOverride?: number,
    ) => {
      if (!engine) {
        setCurrentStyle('Normal');
        return;
      }
      const line = lineOverride ?? engine.getCursorPosition()?.line ?? 1;
      const lines = engine.getContent().split(/\r?\n/);
      const lineText = lines[line - 1] ?? '';
      setCurrentStyle(detectStyleLabelFromLine(lineText));
    };

    const bindEngine = (engine: ReturnType<typeof getActiveEditorEngine>) => {
      unsubCursor?.();
      unsubContent?.();
      unsubCursor = undefined;
      unsubContent = undefined;
      syncStyleFromEngine(engine);
      if (engine) {
        unsubCursor = engine.onCursorChange((line) => syncStyleFromEngine(engine, line));
        unsubContent = engine.onContentChange(() => syncStyleFromEngine(engine));
      }
    };

    bindEngine(getActiveEditorEngine());
    const unsubEngine = subscribeEditorEngineChanges(() => {
      bindEngine(getActiveEditorEngine());
    });

    return () => {
      unsubEngine();
      unsubCursor?.();
      unsubContent?.();
    };
  }, []);

  const handleUndo = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'editor:undo' });
  };

  const handleRedo = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'editor:redo' });
  };

  const handleSelectStyle = (option: StyleOption) => {
    if (readOnly) return;
    setCurrentStyle(option.label);

    editorCommandBus.dispatch({
      type: 'editor:format',
      format: option.id as LatexFormatType,
    });
  };

  const handleInlineFormat = (format: 'bold' | 'italic' | 'underline') => {
    if (readOnly) return;

    editorCommandBus.dispatch({
      type: 'editor:format',
      format,
    });
  };

  const handleInsertMath = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({
      type: 'editor:format',
      format: 'inlineMath',
    });
  };

  const handleInsertDisplayMath = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({
      type: 'editor:format',
      format: 'displayMath',
    });
  };

  const handleOpenEquationModal = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'equation-generator' });
  };

  const handleInsertSymbol = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'symbol-palette' });
  };

  const handleInsertTable = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' });
  };

  const handleInsertFigure = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'figure-wizard' });
  };

  const handleInsertLink = (url?: string, text?: string) => {
    if (readOnly) return;
    if (typeof url === 'string') {
      const cleanUrl = url.trim();
      if (!cleanUrl) return;
      const cleanText = typeof text === 'string' ? text.trim() : '';
      editorCommandBus.dispatch({
        type: 'editor:insert-text',
        text: cleanText ? `\\href{${cleanUrl}}{${cleanText}}` : `\\url{${cleanUrl}}`,
      });
      editorCommandBus.dispatch({ type: 'editor:focus' });
      return;
    }
    editorCommandBus.dispatch({
      type: 'editor:format',
      format: 'link',
    });
  };

  const handleInsertCitation = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
  };

  const handleInsertCrossRef = (label?: string) => {
    if (readOnly) return;
    if (typeof label === 'string' && label.length > 0) {
      editorCommandBus.dispatch({
        type: 'editor:insert-text',
        text: `\\ref{${label}}`,
      });
      editorCommandBus.dispatch({ type: 'editor:focus' });
      return;
    }
    editorCommandBus.dispatch({
      type: 'editor:format',
      format: 'ref',
    });
  };

  const getDocumentLabels = useCallback((): string[] => {
    const content = getActiveEditorEngine()?.getContent?.() || '';
    const seen = new Set<string>();
    const labels: string[] = [];
    const regex = /\\label\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const lbl = match[1]?.trim();
      if (lbl && !seen.has(lbl)) {
        seen.add(lbl);
        labels.push(lbl);
      }
    }
    return labels;
  }, []);

  const getSelectedText = useCallback((): string => {
    return getActiveEditorEngine()?.getSelectedText?.() || '';
  }, []);

  const handleInsertEnvironment = (env: 'itemize' | 'enumerate' | 'quote' | 'code' | 'equation') => {
    if (readOnly) return;

    if (editorMode === 'visual') {
      const visualMap: Record<string, string> = {
        itemize: 'bulletList',
        enumerate: 'orderedList',
        quote: 'quote',
        code: 'codeBlock',
        equation: 'equation',
      };
      const cmd = visualMap[env];
      if (cmd) {
        editorCommandBus.dispatch({ type: 'editor:visual-command', command: cmd });
        return;
      }
    }

    editorCommandBus.dispatch({
      type: 'editor:format',
      format: env === 'code' ? 'codeBlock' : env,
    });
  };

  const handleAddComment = useCallback(() => {
    if (readOnly) return;
    const engine = getActiveEditorEngine();
    const sel = engine?.getSelection?.();
    const cursor = engine?.getCursorPosition?.();
    const selectedText = engine?.getSelectedText?.() || '';

    const selRec = sel as { fromLine?: number; startLine?: number; toLine?: number; endLine?: number } | null | undefined;
    const startLine = selRec?.fromLine ?? selRec?.startLine ?? cursor?.line ?? 1;
    const endLine = selRec?.toLine ?? selRec?.endLine ?? cursor?.line ?? 1;

    useDocumentCollaborationStore.getState().setPendingComment({
      startLine,
      endLine,
      selectedText,
    });
    useWorkspaceStore.getState().setActiveSidebarTab('review');
    useWorkspaceStore.getState().setSidebarLeftOpen(true);

    editorCommandBus.dispatch({
      type: 'review:create-comment',
      line: startLine,
      endLine,
      selectedText,
    });
  }, [readOnly]);

  const handleFind = () => {
    editorCommandBus.dispatch({ type: 'editor:find' });
  };

  return {
    currentStyle,
    handleUndo,
    handleRedo,
    handleSelectStyle,
    handleInlineFormat,
    handleInsertMath,
    handleInsertDisplayMath,
    handleOpenEquationModal,
    handleInsertSymbol,
    handleInsertTable,
    handleInsertFigure,
    handleInsertLink,
    handleInsertCitation,
    handleInsertCrossRef,
    getDocumentLabels,
    getSelectedText,
    handleInsertEnvironment,
    handleAddComment,
    handleFind,
  };
}
