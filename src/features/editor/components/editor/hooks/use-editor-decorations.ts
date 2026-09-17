'use client';

import { useRef, useState, useEffect } from 'react';
import type { editor } from 'monaco-editor';
import type { PageComment, PageSuggestion } from '@/features/editor/types';
import { useCompileStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import type { InlineSuggestionWidgetData } from '../subcomponents/InlineSuggestionWidget';

export interface UseEditorDecorationsOptions {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<any>;
  comments: PageComment[];
  suggestions: PageSuggestion[];
  editorMounted: boolean;
}

export function useEditorDecorations({
  editorRef,
  monacoRef,
  comments,
  suggestions,
  editorMounted,
}: UseEditorDecorationsOptions) {
  const { compileErrors } = useCompileStore();
  const decorationCollRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const suggestionDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const lineCommentsRef = useRef<Map<number, PageComment[]>>(new Map());
  const suggestionsRef = useRef<PageSuggestion[]>(suggestions);
  suggestionsRef.current = suggestions;

  const [glyphTooltip, setGlyphTooltip] = useState<{
    x: number;
    bottom: number;
    comments: PageComment[];
  } | null>(null);

  const [activeSuggestionWidgetData, setActiveSuggestionWidgetData] =
    useState<InlineSuggestionWidgetData | null>(null);

  // Synchronize comment glyphs in editor gutter
  useEffect(() => {
    const coll = decorationCollRef.current;
    if (!coll) return;

    const lineComments = new Map<number, PageComment[]>();
    comments.forEach((c) => {
      if (c.line == null) return;
      const from = c.line;
      const to = (c as any).lineEnd ?? c.line;
      for (let l = from; l <= to; l++) {
        if (!lineComments.has(l)) lineComments.set(l, []);
        lineComments.get(l)!.push(c);
      }
    });

    lineCommentsRef.current = lineComments;

    coll.set(
      Array.from(lineComments.entries()).map(([line]) => ({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          glyphMarginClassName: 'flux-comment-glyph',
        },
      })),
    );
  }, [comments, editorMounted]);

  // Synchronize compilation errors with Monaco inline squiggles & markers
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;

    if (!compileErrors || compileErrors.length === 0) {
      monaco.editor.setModelMarkers(model, 'latex-compiler', []);
      return;
    }

    const markers: editor.IMarkerData[] = compileErrors.map((err) => {
      const line = Math.max(1, Math.min(err.line || 1, model.getLineCount()));
      const lineContent = model.getLineContent(line);
      return {
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: Math.max(1, lineContent.length + 1),
        message: err.message || 'LaTeX compilation error',
      };
    });

    monaco.editor.setModelMarkers(model, 'latex-compiler', markers);
  }, [compileErrors, editorMounted, editorRef, monacoRef]);

  // Synchronize Track Changes (Suggestions) with Monaco inline decorations
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    if (!suggestionDecorationsRef.current) {
      suggestionDecorationsRef.current = ed.createDecorationsCollection([]);
    }

    if (!suggestions || suggestions.length === 0) {
      suggestionDecorationsRef.current.set([]);
      return;
    }

    const newDecs = suggestions.map((s) => {
      const isDelete = s.type === 'delete';
      const isInsert = s.type === 'insert';

      return {
        range: new monaco.Range(
          s.fromLine,
          s.fromColumn || 1,
          s.toLine,
          s.toColumn || 1000,
        ),
        options: {
          isWholeLine: false,
          className: isDelete
            ? 'bg-rose-500/20 line-through text-rose-600 dark:text-rose-400 font-mono'
            : isInsert
              ? 'bg-emerald-500/20 underline decoration-emerald-500 text-emerald-600 dark:text-emerald-400 font-medium'
              : 'bg-amber-500/20 underline decoration-amber-500 text-amber-600 dark:text-amber-400',
          hoverMessage: {
            value: `**Suggested ${s.type.toUpperCase()} by ${s.author.name}**\n\n*Original:* \`${s.originalText || '(none)'}\`\n\n*Suggested:* \`${s.suggestedText || '(none)'}\`${s.description ? `\n\n*Note:* ${s.description}` : ''}`,
          },
          linesDecorationsClassName: isDelete
            ? 'border-l-2 border-rose-500'
            : 'border-l-2 border-emerald-500',
        },
      };
    });

    suggestionDecorationsRef.current.set(newDecs);
  }, [suggestions, editorMounted, editorRef, monacoRef]);

  // Setup gutter and mouse event listeners for comments
  const bindDecorationListeners = (
    ed: editor.IStandaloneCodeEditor,
    monaco: any,
  ): { dispose: () => void } => {
    const scrollDisposable = ed.onDidScrollChange(() => {
      setActiveSuggestionWidgetData(null);
      setGlyphTooltip(null);
    });

    const moveDisposable = ed.onMouseMove((e) => {
      const target = e.target;
      const isGlyph =
        target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

      if (isGlyph && target.position) {
        const line = target.position.lineNumber;
        const matched = lineCommentsRef.current.get(line);
        if (matched && matched.length > 0) {
          const editorDom = ed.getDomNode();
          if (editorDom) {
            const rect = editorDom.getBoundingClientRect();
            const glyphLeft = rect.left + (e.event.posx - rect.left);
            const bottomFromViewport = window.innerHeight - e.event.posy + 8;
            setGlyphTooltip({
              x: glyphLeft,
              bottom: bottomFromViewport,
              comments: matched,
            });
          }
          return;
        }
      }
      setGlyphTooltip(null);
    });

    const leaveDisposable = ed.onMouseLeave(() => {
      setGlyphTooltip(null);
    });

    const downDisposable = ed.onMouseDown((e) => {
      const target = e.target;

      // Handle comment glyph click
      if (
        (target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
          target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) &&
        target.position
      ) {
        const line = target.position.lineNumber;
        const matched = lineCommentsRef.current.get(line);
        if (matched && matched.length > 0) {
          EditorEventBus.emit('flux:open-panel', {
            panel: 'Review',
            commentId: matched[0].id,
          });
        }
        return;
      }

      // Handle suggestion click: open interactive suggestion action widget
      if (
        (target.type === monaco.editor.MouseTargetType.CONTENT_TEXT ||
          target.type === monaco.editor.MouseTargetType.CONTENT_EMPTY) &&
        target.position
      ) {
        const line = target.position.lineNumber;
        const col = target.position.column;
        const matched = suggestionsRef.current.find((s) => {
          if (s.status !== 'pending' && s.status) return false;
          if (line < s.fromLine || line > s.toLine) return false;
          if (line === s.fromLine && col < (s.fromColumn || 1)) return false;
          if (line === s.toLine && col > (s.toColumn || 1000)) return false;
          return true;
        });

        if (matched) {
          const editorDom = ed.getDomNode();
          if (editorDom) {
            const rect = editorDom.getBoundingClientRect();
            const visPos = ed.getScrolledVisiblePosition(target.position);
            if (visPos) {
              setActiveSuggestionWidgetData({
                suggestion: matched,
                x: rect.left + visPos.left,
                y: rect.top + visPos.top + visPos.height + 4,
              });
              return;
            }
          }
        }
      }

      // Clicked on plain editor code -> dismiss suggestion widget
      setActiveSuggestionWidgetData(null);
    });

    return {
      dispose: () => {
        scrollDisposable.dispose();
        moveDisposable.dispose();
        leaveDisposable.dispose();
        downDisposable.dispose();
      },
    };
  };

  return {
    glyphTooltip,
    activeSuggestionWidgetData,
    setActiveSuggestionWidgetData,
    bindDecorationListeners,
  };
}
