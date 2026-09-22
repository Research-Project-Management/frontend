'use client';

import React, { useEffect, useRef } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { MergeView } from '@codemirror/merge';
import { latexLanguage } from '../../sub-features/code-editor/codemirror/latex-language';
import { getEditorTheme } from '../../sub-features/code-editor/codemirror/theme';

export interface HistoryCodeMirrorViewerProps {
  viewMode: 'diff' | 'snapshot' | 'timeline';
  original?: string;
  modified?: string;
  singleContent?: string;
  isDarkTheme: boolean;
  fontSize?: number;
}

export default function HistoryCodeMirrorViewer({
  viewMode,
  original = '',
  modified = '',
  singleContent = '',
  isDarkTheme,
  fontSize = 13,
}: HistoryCodeMirrorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const singleViewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup any existing instances
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
      mergeViewRef.current = null;
    }
    if (singleViewRef.current) {
      singleViewRef.current.destroy();
      singleViewRef.current = null;
    }
    containerRef.current.innerHTML = '';

    const baseExtensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      latexLanguage,
      getEditorTheme(isDarkTheme),
      EditorView.lineWrapping,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: `${fontSize}px`,
          fontFamily: 'var(--font-mono, Menlo, Monaco, "Courier New", monospace)',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'inherit',
          lineHeight: '1.6',
        },
      }),
    ];

    if (viewMode === 'diff') {
      const merge = new MergeView({
        a: {
          doc: original,
          extensions: baseExtensions,
        },
        b: {
          doc: modified,
          extensions: baseExtensions,
        },
        parent: containerRef.current,
        highlightChanges: true,
        gutter: true,
        orientation: 'a-b',
      });
      mergeViewRef.current = merge;
    } else {
      const state = EditorState.create({
        doc: singleContent,
        extensions: baseExtensions,
      });
      const view = new EditorView({
        state,
        parent: containerRef.current,
      });
      singleViewRef.current = view;
    }

    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
      if (singleViewRef.current) {
        singleViewRef.current.destroy();
        singleViewRef.current = null;
      }
    };
  }, [viewMode, original, modified, singleContent, isDarkTheme, fontSize]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-background">
      <div
        ref={containerRef}
        className="w-full h-full cm-history-wrapper [&_.cm-mergeView]:h-full [&_.cm-mergeViewEditors]:h-full [&_.cm-mergeViewEditor]:h-full [&_.cm-editor]:h-full"
      />
    </div>
  );
}
