/**
 * latex-comments.ts
 *
 * CodeMirror 6 inline comment highlight extension for Overleaf parity:
 * - Highlights commented text ranges in warm yellow (#fae29c).
 * - Highlights active/focused comments with blue border/rich amber.
 * - Dispatches click event to open and scroll to comment in ReviewTab.
 */

import { StateField, RangeSet, StateEffect, Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import type { PageComment } from '@/features/editor/types';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';

export const setCommentsEffect = StateEffect.define<{
  comments: PageComment[];
  activeCommentId?: string | null;
}>();

export const commentHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setCommentsEffect)) {
        const { comments, activeCommentId } = effect.value;
        const doc = tr.state.doc;
        const totalLines = doc.lines;
        const decos: any[] = [];

        // Filter and sort open comments by line number
        const validComments = (comments || [])
          .filter(
            (c) =>
              c.status === 'open' &&
              c.line != null &&
              c.line >= 1 &&
              c.line <= totalLines
          )
          .sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

        for (const c of validComments) {
          const startLineNum = c.line!;
          const endLineNum = Math.min(
            Math.max(startLineNum, c.lineEnd ?? startLineNum),
            totalLines
          );
          const startLine = doc.line(startLineNum);
          const endLine = doc.line(endLineNum);

          // Find start column: skip leading whitespace
          const text = startLine.text;
          const match = text.match(/^\s*/);
          const leadingWhitespace = match ? match[0].length : 0;
          const from = Math.min(startLine.from + leadingWhitespace, startLine.to);
          const to = endLine.to;

          if (from < to) {
            const isActive = c.id === activeCommentId;
            const deco = Decoration.mark({
              class: isActive
                ? 'cm-comment-highlight cm-comment-highlight-active'
                : 'cm-comment-highlight',
              attributes: { 'data-comment-id': c.id },
            });
            decos.push(deco.range(from, to));
          }
        }

        try {
          decorations = RangeSet.of(decos, true);
        } catch {
          decorations = Decoration.none;
        }
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const commentClickHandler = EditorView.domEventHandlers({
  click(event) {
    const target = event.target as HTMLElement;
    const highlight = target.closest?.(
      '.cm-comment-highlight, .cm-comment-highlight-active'
    );
    if (highlight) {
      const commentId = highlight.getAttribute('data-comment-id');
      if (commentId) {
        editorCommandBus.dispatch({
          type: 'sidebar:open-panel',
          panel: 'Review',
          commentId,
        });
      }
    }
  },
});

export const latexCommentsExtension: Extension = [
  commentHighlightField,
  commentClickHandler,
];
