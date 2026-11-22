/**
 * useEditorToolbarActions.ts
 *
 * State and formatting/insert/review action handlers for EditorToolbar.
 */

import { useState, useCallback } from 'react';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { getActiveEditorEngine } from '@/features/editor/core/bus/engine-registry';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';

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

    if (editorMode === 'visual') {
      editorCommandBus.dispatch({
        type: 'editor:visual-command',
        command: option.visualCommand,
        level: option.visualLevel,
      });
      return;
    }

    if (option.id === 'normal') {
      editorCommandBus.dispatch({
        type: 'editor:format',
        format: 'normal',
      });
      return;
    }

    if (option.latexPrefix) {
      editorCommandBus.dispatch({
        type: 'editor:wrap-selection',
        prefix: option.latexPrefix,
        suffix: option.latexSuffix,
      });
    }
  };

  const handleInlineFormat = (format: 'bold' | 'italic' | 'underline') => {
    if (readOnly) return;

    if (editorMode === 'visual') {
      editorCommandBus.dispatch({ type: 'editor:visual-command', command: format });
      return;
    }

    editorCommandBus.dispatch({
      type: 'editor:format',
      format,
    });
  };

  const handleInsertMath = () => {
    if (readOnly) return;
    if (editorMode === 'visual') {
      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'insertMath' });
      return;
    }
    editorCommandBus.dispatch({
      type: 'editor:format',
      format: 'inlineMath',
    });
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

  const handleInsertLink = () => {
    if (readOnly) return;
    if (editorMode === 'visual') {
      const url = window.prompt('Enter link URL:');
      if (url) {
        editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'createLink', contentHtml: url });
      }
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

  const handleInsertCrossRef = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({
      type: 'editor:format',
      format: 'ref',
    });
  };

  const handleInsertEnvironment = (env: 'itemize' | 'enumerate' | 'quote' | 'code') => {
    if (readOnly) return;

    if (editorMode === 'visual') {
      const visualMap: Record<string, string> = {
        itemize: 'bulletList',
        enumerate: 'orderedList',
        quote: 'quote',
        code: 'codeBlock',
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
    handleInsertSymbol,
    handleInsertTable,
    handleInsertFigure,
    handleInsertLink,
    handleInsertCitation,
    handleInsertCrossRef,
    handleInsertEnvironment,
    handleAddComment,
    handleFind,
  };
}
