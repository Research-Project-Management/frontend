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

import { StateField, RangeSet, StateEffect, Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import type { PageSuggestion } from '@/features/editor/types';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export type TrackChangesViewMode = 'show' | 'changes' | 'clean' | 'original';

export interface SetTrackChangesPayload {
  suggestions: PageSuggestion[];
  viewMode?: TrackChangesViewMode;
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
