/**
 * latex-track-changes.ts
 *
 * CodeMirror 6 inline track-changes and review suggestion extension for Overleaf parity:
 * - Highlights inserted text ranges (green underline / subtle tint).
 * - Highlights deleted text ranges (red strikethrough / subtle tint).
 * - Highlights replaced text ranges (amber dashed underline).
 * - Supports Overleaf review view modes:
 *     'show'     - Displays full diff decorations (insertions + deletions)
 *     'clean'    - Previews the document as if all changes were accepted
 *     'original' - Previews the document in its original pre-change state
 * - Dispatches click and hover events to position and reveal the InlineSuggestionWidget.
 */

import { StateField, RangeSet, StateEffect, Extension, EditorState, Annotation } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import type { PageSuggestion } from '@/features/editor/types';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export const externalUpdateAnnotation = Annotation.define<boolean>();

export type TrackChangesViewMode = 'show' | 'changes' | 'clean' | 'original';

export interface SetTrackChangesPayload {
  suggestions: PageSuggestion[];
  viewMode?: TrackChangesViewMode;
}

export interface TrackChangeRecordPayload {
  type: 'insert' | 'delete';
  text: string;
  originalText?: string;
  suggestedText?: string;
  fromLine: number;
  fromColumn: number;
  toLine: number;
  toColumn: number;
  silent?: boolean;
}

export interface TrackChangesInterceptorOptions {
  isReviewMode: () => boolean;
  onRecordChange: (change: TrackChangeRecordPayload) => void;
}

export const setTrackChangesEffect = StateEffect.define<SetTrackChangesPayload>();

export const trackChangesHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setTrackChangesEffect)) {
        const { suggestions, viewMode = 'show' } = effect.value;
        const doc = tr.state.doc;
        const totalLines = doc.lines;
        const decos: any[] = [];

        // Only process pending suggestions with valid line info
        const pending = (suggestions || []).filter(
          (s) =>
            s.status === 'pending' &&
            s.fromLine != null &&
            s.fromLine >= 1 &&
            s.fromLine <= totalLines,
        );

        // Sort by starting line & column to satisfy CodeMirror RangeSet ordering
        pending.sort((a, b) => {
          if (a.fromLine !== b.fromLine) return a.fromLine - b.fromLine;
          return (a.fromColumn ?? 0) - (b.fromColumn ?? 0);
        });

        for (const s of pending) {
          const startLineNum = Math.min(Math.max(1, s.fromLine), totalLines);
          const endLineNum = Math.min(
            Math.max(startLineNum, s.toLine ?? startLineNum),
            totalLines,
          );

          const startLine = doc.line(startLineNum);
          const endLine = doc.line(endLineNum);

          const fromCol = Math.max(0, (s.fromColumn ?? 1) - 1);
          const toCol = s.toColumn != null ? Math.max(0, s.toColumn - 1) : endLine.length;

          let from = Math.min(startLine.from + fromCol, startLine.to);
          let to = Math.min(endLine.from + toCol, endLine.to);

          if (from >= to) {
            // Ensure minimum range of 1 character or string length
            const textLen = s.originalText?.length || s.suggestedText?.length || 1;
            to = Math.min(from + textLen, doc.length);
          }

          if (from < to && from <= doc.length && to <= doc.length) {
            const authorName = s.author?.name || 'Collaborator';

            if (viewMode === 'clean') {
              // Clean preview: accepted view
              if (s.type === 'delete') {
                // Hide deleted text
                const deco = Decoration.mark({
                  class: 'cm-track-change-hidden',
                });
                decos.push(deco.range(from, to));
              }
              // Insertions are displayed as standard unadorned text
            } else if (viewMode === 'original') {
              // Original preview: pre-change view
              if (s.type === 'insert') {
                // Hide inserted text
                const deco = Decoration.mark({
                  class: 'cm-track-change-hidden',
                });
                decos.push(deco.range(from, to));
              }
              // Deletions are displayed as standard unadorned text
            } else {
              // Standard Overleaf 'show' mode: full visual mark
              let markClass = 'cm-track-change ';
              let titlePrefix = 'Suggestion';

              if (s.type === 'insert') {
                markClass += 'cm-track-change-insert';
                titlePrefix = `Inserted by ${authorName}`;
              } else if (s.type === 'delete') {
                markClass += 'cm-track-change-delete';
                titlePrefix = `Deleted by ${authorName}`;
              } else {
                markClass += 'cm-track-change-replace';
                titlePrefix = `Replaced by ${authorName}`;
              }

              const deco = Decoration.mark({
                class: markClass,
                attributes: {
                  'data-suggestion-id': s.id,
                  'data-suggestion-type': s.type,
                  title: `${titlePrefix}: "${s.suggestedText || s.originalText || ''}"`,
                },
              });
              decos.push(deco.range(from, to));
            }
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

export const trackChangesClickHandler = EditorView.domEventHandlers({
  click(event) {
    const target = event.target as HTMLElement;
    const highlight = target.closest?.('.cm-track-change');
    if (highlight) {
      const suggestionId = highlight.getAttribute('data-suggestion-id');
      if (suggestionId) {
        const rect = highlight.getBoundingClientRect();
        EditorEventBus.emit('flux:open-suggestion-widget', {
          suggestionId,
          x: Math.round(rect.left),
          y: Math.round(rect.bottom + 6),
        });
      }
    }
  },
});

export const latexTrackChangesExtension: Extension = [
  trackChangesHighlightField,
  trackChangesClickHandler,
];

/**
 * Creates CodeMirror transaction interceptor for Overleaf 1:1 Track Changes.
 * - In Review Mode:
 *   - Backspacing / deleting text cancels document buffer excision and records a 'delete' suggestion.
 *   - Typing text inserts characters and records an 'insert' suggestion, coalesced via debounce.
 *   - Typing over a selection records both 'delete' and 'insert'.
 */
export function createTrackChangesInterceptor(options: TrackChangesInterceptorOptions): Extension {
  let pendingInsert: {
    text: string;
    fromLine: number;
    fromColumn: number;
    toLine: number;
    toColumn: number;
    endPos: number;
    timer: any;
  } | null = null;

  const flushPendingInsert = () => {
    if (!pendingInsert) return;
    if (pendingInsert.timer) {
      clearTimeout(pendingInsert.timer);
      pendingInsert.timer = null;
    }
    const toSend = { ...pendingInsert };
    pendingInsert = null;

    if (toSend.text.length > 0) {
      options.onRecordChange({
        type: 'insert',
        text: toSend.text,
        suggestedText: toSend.text,
        fromLine: toSend.fromLine,
        fromColumn: toSend.fromColumn,
        toLine: toSend.toLine,
        toColumn: toSend.toColumn,
        silent: true,
      });
    }
  };

  const filter = EditorState.transactionFilter.of((tr) => {
    if (!options.isReviewMode()) {
      if (pendingInsert) flushPendingInsert();
      return tr;
    }

    if (!tr.docChanged) return tr;

    // Ignore programmatic updates or undo/redo
    if (tr.annotation(externalUpdateAnnotation)) return tr;
    if (tr.isUserEvent('undo') || tr.isUserEvent('redo')) return tr;

    let cancelDeletion = false;
    let cursorAnchor: number | null = null;

    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      // 1. Deletion (Backspace or Delete key or selection cut/erasure)
      if (fromA < toA && inserted.length === 0) {
        cancelDeletion = true;
        flushPendingInsert();

        const deletedText = tr.startState.sliceDoc(fromA, toA);
        const startLine = tr.startState.doc.lineAt(fromA);
        const endLine = tr.startState.doc.lineAt(toA);

        const fromLine = startLine.number;
        const fromColumn = fromA - startLine.from + 1; // 1-indexed for backend parity
        const toLine = endLine.number;
        const toColumn = toA - endLine.from + 1;

        cursorAnchor = fromA;

        options.onRecordChange({
          type: 'delete',
          text: deletedText,
          originalText: deletedText,
          fromLine,
          fromColumn,
          toLine,
          toColumn,
          silent: true,
        });
      }
      // 2. Replacement (Selection typed over)
      else if (fromA < toA && inserted.length > 0) {
        flushPendingInsert();

        const deletedText = tr.startState.sliceDoc(fromA, toA);
        const insertedText = inserted.toString();
        const startLine = tr.startState.doc.lineAt(fromA);
        const endLine = tr.startState.doc.lineAt(toA);

        const fromLine = startLine.number;
        const fromColumn = fromA - startLine.from + 1;
        const toLine = endLine.number;
        const toColumn = toA - endLine.from + 1;

        options.onRecordChange({
          type: 'delete',
          text: deletedText,
          originalText: deletedText,
          fromLine,
          fromColumn,
          toLine,
          toColumn,
          silent: true,
        });

        options.onRecordChange({
          type: 'insert',
          text: insertedText,
          suggestedText: insertedText,
          fromLine,
          fromColumn,
          toLine: fromLine,
          toColumn: fromColumn + insertedText.length,
          silent: true,
        });
      }
      // 3. Insertion (Standard typing at cursor)
      else if (fromA === toA && inserted.length > 0) {
        const insertedText = inserted.toString();
        const startLine = tr.startState.doc.lineAt(fromA);
        const lineNum = startLine.number;
        const colNum = fromA - startLine.from + 1;

        if (
          pendingInsert &&
          pendingInsert.endPos === fromA &&
          pendingInsert.toLine === lineNum &&
          !insertedText.includes('\n')
        ) {
          pendingInsert.text += insertedText;
          pendingInsert.toColumn += insertedText.length;
          pendingInsert.endPos = fromA + inserted.length;
          if (pendingInsert.timer) clearTimeout(pendingInsert.timer);
          pendingInsert.timer = setTimeout(flushPendingInsert, 500);
        } else {
          flushPendingInsert();

          pendingInsert = {
            text: insertedText,
            fromLine: lineNum,
            fromColumn: colNum,
            toLine: lineNum,
            toColumn: colNum + insertedText.length,
            endPos: fromA + inserted.length,
            timer: setTimeout(flushPendingInsert, 500),
          };
        }
      }
    });

    if (cancelDeletion) {
      // In Overleaf, deleted text remains visible in the document buffer with red strikethrough.
      // We cancel the physical excision of text and place the cursor where the delete occurred.
      return {
        selection: { anchor: cursorAnchor ?? tr.startState.selection.main.from },
      };
    }

    return tr;
  });

  const domHandlers = EditorView.domEventHandlers({
    blur: () => {
      flushPendingInsert();
      return false;
    },
  });

  return [filter, domHandlers];
}
