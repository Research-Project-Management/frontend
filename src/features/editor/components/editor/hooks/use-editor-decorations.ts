'use client';

import { useRef, useState, useEffect } from 'react';
import type { PageComment, PageSuggestion } from '@/features/editor/types';
import { useCompileStore, usePageStore, useSettingsStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import type { InlineSuggestionWidgetData } from '../subcomponents/InlineSuggestionWidget';

export interface UseEditorDecorationsOptions {
  editorRef?: React.MutableRefObject<any>;
  monacoRef?: React.MutableRefObject<any>;
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
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const currentPage = usePageStore((s) => s.currentPage);
  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const decorationCollRef = useRef<any>(null);
  const suggestionDecorationsRef = useRef<any>(null);
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

  // Synchronize compilation errors with inline squiggles & markers
  useEffect(() => {
    const ed = editorRef?.current;
    const monaco = monacoRef?.current;
    if (!ed || !monaco || !ed.getModel) return;
    const model = ed.getModel();
    if (!model) return;

    if (!compileErrors || compileErrors.length === 0) {
      monaco.editor.setModelMarkers(model, 'latex-compiler', []);
      return;
    }

    const currentFileName = (activeFilePage?.title || currentPage?.title || 'main.tex').toLowerCase();
    const currentBase = currentFileName.replace(/\.tex$/, '');

    // Multi-file filter: only show errors belonging to the open file (or global errors)
    const relevantErrors = compileErrors.filter((err) => {
      if (!err.file) return true;
      const errFile = err.file.toLowerCase().replace(/\\/g, '/');
      const errBase = errFile.split('/').pop() || errFile;
      return (
        errBase === currentFileName ||
        errBase.replace(/\.tex$/, '') === currentBase ||
        currentFileName.endsWith(errBase)
      );
    });

    const markers: any[] = relevantErrors.map((err) => {
      const line = Math.max(1, Math.min(err.line || 1, model.getLineCount()));
      const lineContent = model.getLineContent(line);
      const isWarning = err.severity === 'warning';
      return {
        severity: isWarning ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: Math.max(1, lineContent.length + 1),
        message: err.message || (isWarning ? 'LaTeX warning' : 'LaTeX compilation error'),
      };
    });

    monaco.editor.setModelMarkers(model, 'latex-compiler', markers);
  }, [compileErrors, activeFilePage?.title, currentPage?.title, editorMounted, editorRef, monacoRef]);

  // Synchronize Track Changes (Suggestions) with inline decorations
  useEffect(() => {
    const ed = editorRef?.current;
    const monaco = monacoRef?.current;
    if (!ed || !monaco || !ed.getModel) return;
    const model = ed.getModel();
    if (!model) return;

    if (!suggestionDecorationsRef.current) {
      suggestionDecorationsRef.current = ed.createDecorationsCollection ? ed.createDecorationsCollection([]) : null;
    }

    // View Mode: 'original' hides all suggestions, showing clean original text
    if (!suggestions || suggestions.length === 0 || trackChangesViewMode === 'original') {
      suggestionDecorationsRef.current?.set([]);
      return;
    }

    const maxLine = model.getLineCount();

    const newDecs: any[] = suggestions.flatMap((s): any[] => {
      if (s.status !== 'pending' && s.status) return [];

      const isDelete = s.type === 'delete';
      const isInsert = s.type === 'insert';

      const fromLine = Math.max(1, Math.min(s.fromLine || 1, maxLine));
      const toLine = Math.max(fromLine, Math.min(s.toLine || fromLine, maxLine));
      const lineContent = model.getLineContent(toLine);
      const maxCol = Math.max(1, lineContent.length + 1);
      const fromCol = Math.max(1, Math.min(s.fromColumn || 1, maxCol));
      const toCol = Math.max(fromCol, Math.min(s.toColumn || maxCol, maxCol));

      const hoverMessage = {
        value: `**Suggested ${s.type.toUpperCase()} by ${s.author?.name || 'Author'}**\n\n` +
          (s.originalText ? `*Original:* \`${s.originalText}\`\n\n` : '') +
          (s.suggestedText ? `*Proposed:* \`${s.suggestedText}\`\n\n` : '') +
          (s.description ? `*Note:* *${s.description}*\n\n` : '') +
          `*💡 Click this text to Accept or Reject inline*`,
      };

      // ── View Mode: Clean Preview (Preview text as if all pending changes are accepted) ──
      if (trackChangesViewMode === 'clean') {
        if (isDelete) {
          // Hide deleted text completely
          return [{
            range: new monaco.Range(fromLine, fromCol, toLine, toCol),
            options: {
              isWholeLine: false,
              inlineClassName: 'flux-track-hidden',
              hoverMessage,
            },
          }];
        }

        if (isInsert) {
          // Render inserted text as standard text without diff highlights
          return [{
            range: new monaco.Range(fromLine, fromCol, fromLine, fromCol),
            options: {
              isWholeLine: false,
              after: {
                content: s.suggestedText || '',
                inlineClassName: 'flux-track-clean-insert',
              },
              hoverMessage,
            },
          }];
        }

        // isReplace
        return [{
          range: new monaco.Range(fromLine, fromCol, toLine, toCol),
          options: {
            isWholeLine: false,
            inlineClassName: 'flux-track-hidden',
            after: {
              content: s.suggestedText || '',
              inlineClassName: 'flux-track-clean-insert',
            },
            hoverMessage,
          },
        }];
      }

      // ── View Mode: Changes (Full Diff — Overleaf 1:1) ──
      if (isDelete) {
        return [{
          range: new monaco.Range(fromLine, fromCol, toLine, toCol),
          options: {
            isWholeLine: false,
            className: 'bg-rose-500/20 line-through text-rose-600 dark:text-rose-400 font-mono',
            linesDecorationsClassName: 'border-l-2 border-rose-500',
            hoverMessage,
          },
        }];
      }

      if (isInsert) {
        return [{
          range: new monaco.Range(fromLine, fromCol, fromLine, fromCol),
          options: {
            isWholeLine: false,
            after: {
              content: ' ' + (s.suggestedText || '') + ' ',
              inlineClassName: 'flux-track-insert-inline font-mono',
            },
            linesDecorationsClassName: 'border-l-2 border-emerald-500',
            hoverMessage,
          },
        }];
      }

      // isReplace: strike through original text AND inject proposed replacement text
      return [{
        range: new monaco.Range(fromLine, fromCol, toLine, toCol),
        options: {
          isWholeLine: false,
          className: 'bg-rose-500/20 line-through text-rose-600 dark:text-rose-400 font-mono',
          after: {
            content: ' ' + (s.suggestedText || '') + ' ',
            inlineClassName: 'flux-track-replace-inline font-mono',
          },
          linesDecorationsClassName: 'border-l-2 border-amber-500',
          hoverMessage,
        },
      }];
    });

    suggestionDecorationsRef.current.set(newDecs);
  }, [suggestions, trackChangesViewMode, editorMounted, editorRef, monacoRef]);

  // Setup gutter and mouse event listeners for comments
  const bindDecorationListeners = (
    ed: any,
    monaco: any,
  ): { dispose: () => void } => {
    if (!ed || !monaco) {
      return { dispose: () => {} };
    }

    const scrollDisposable = ed?.onDidScrollChange?.(() => {
      setActiveSuggestionWidgetData(null);
      setGlyphTooltip(null);
    }) ?? { dispose: () => {} };

    const moveDisposable = ed?.onMouseMove?.((e: any) => {
      const target = e.target;
      const isGlyph =
        target?.type === monaco.editor?.MouseTargetType?.GUTTER_GLYPH_MARGIN ||
        target?.type === monaco.editor?.MouseTargetType?.GUTTER_LINE_NUMBERS;

      if (isGlyph && target.position) {
        const line = target.position.lineNumber;
        const matched = lineCommentsRef.current.get(line);
        if (matched && matched.length > 0) {
          const editorDom = ed.getDomNode?.();
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
    }) ?? { dispose: () => {} };

    const leaveDisposable = ed?.onMouseLeave?.(() => {
      setGlyphTooltip(null);
    }) ?? { dispose: () => {} };

    const downDisposable = ed?.onMouseDown?.((e: any) => {
      const target = e.target;

      // Handle comment glyph click
      if (
        (target?.type === monaco.editor?.MouseTargetType?.GUTTER_GLYPH_MARGIN ||
          target?.type === monaco.editor?.MouseTargetType?.GUTTER_LINE_NUMBERS) &&
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
        (target?.type === monaco.editor?.MouseTargetType?.CONTENT_TEXT ||
          target?.type === monaco.editor?.MouseTargetType?.CONTENT_EMPTY) &&
        target.position
      ) {
        const line = target.position.lineNumber;
        const col = target.position.column;
        const matched = suggestionsRef.current.find((s) => {
          if (s.status !== 'pending' && s.status) return false;
          if (line < s.fromLine || line > s.toLine) return false;
          const minCol = Math.max(1, (s.fromColumn || 1) - 1);
          const extraLen = (s.suggestedText?.length || 0) + 12;
          const maxCol = (s.toColumn || s.fromColumn || 1) + extraLen;
          if (line === s.fromLine && col < minCol) return false;
          if (line === s.toLine && col > maxCol) return false;
          return true;
        });

        if (matched) {
          const editorDom = ed.getDomNode?.();
          if (editorDom) {
            const rect = editorDom.getBoundingClientRect();
            const visPos = ed.getScrolledVisiblePosition?.(target.position);
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
    }) ?? { dispose: () => {} };

    return {
      dispose: () => {
        scrollDisposable?.dispose?.();
        moveDisposable?.dispose?.();
        leaveDisposable?.dispose?.();
        downDisposable?.dispose?.();
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
