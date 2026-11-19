/**
 * track-changes.extension.ts
 *
 * CodeMirror 6 Review Mode & Track Changes Extension (Overleaf Parity).
 * Location: `features/editor/subsystems/review/extensions/track-changes.extension.ts`
 *
 * Capabilities:
 * 1. Track Changes Visual Decorations ('changes' | 'clean' | 'original').
 * 2. Interactive In-Editor Inline Suggestion Widget / Popover.
 * 3. Review Gutter Markers.
 */

import {
  StateField,
  RangeSetBuilder,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  gutter,
  GutterMarker,
  hoverTooltip,
  type Tooltip,
} from '@codemirror/view';
import type { PageSuggestion, TrackChangesViewMode } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import {
  CleanReplacePreviewWidget,
  CommentGutterMarker,
  SuggestionGutterMarker,
  CombinedReviewGutterMarker,
  createTrackChangesTooltipDOM,
  trackChangesTheme,
} from './track-changes-widgets';
import {
  type RawTrackChangeItem,
  type RawCommentItem,
  type TrackChangesConfig,
  type TrackChangesExtensionOptions,
  setTrackChangesSuggestionsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesDataEffect,
  setReviewModeEffect,
  setViewModeEffect,
  getSafeOffset,
  resolveSuggestionRange,
  trackChangesStateField,
} from './track-changes-state';
import { trackChangesReviewModeFilter } from './track-changes-review-filter';

export {
  trackChangesTheme,
  setTrackChangesSuggestionsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesDataEffect,
  setReviewModeEffect,
  setViewModeEffect,
  getSafeOffset,
  resolveSuggestionRange,
  trackChangesStateField,
  trackChangesReviewModeFilter,
};
export type {
  TrackChangesViewMode,
  RawTrackChangeItem,
  RawCommentItem,
  TrackChangesConfig,
  TrackChangesExtensionOptions,
};

// ─── DECORATIONS FIELD: INLINE MARKS FOR SUGGESTIONS & COMMENTS ─────────────

const DECO_EMPTY_REPLACE = Decoration.replace({ inclusive: false });

export const trackChangesDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(decorations, tr) {
    const configChanged = tr.effects.some(
      (e) =>
        e.is(setTrackChangesSuggestionsEffect) ||
        e.is(setTrackChangesViewModeEffect) ||
        e.is(setTrackChangesReviewModeEffect) ||
        e.is(setTrackChangesCommentsEffect) ||
        e.is(setTrackChangesDataEffect),
    );

    if (configChanged) {
      return buildDecorations(tr.state);
    }

    if (tr.docChanged) {
      const config = tr.state.field(trackChangesStateField);
      const hasPendingOrOpen =
        config.suggestions.some((s) => s.status === 'pending') ||
        config.comments.some((c) => c.status === 'open');
      if (!hasPendingOrOpen) {
        return Decoration.none;
      }
      return buildDecorations(tr.state);
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildDecorations(state: EditorView['state']): DecorationSet {
  const config = state.field(trackChangesStateField);
  const pendingSuggestions = config.suggestions.filter(
    (s) => s.status === 'pending',
  );
  const openComments = config.comments.filter((c) => c.status === 'open');

  if (pendingSuggestions.length === 0 && openComments.length === 0) {
    return Decoration.none;
  }

  const doc = state.doc;
  const builder = new RangeSetBuilder<Decoration>();

  let cachedFullText: string | null = null;
  const getFullText = () => {
    if (cachedFullText === null) {
      cachedFullText = doc.toString();
    }
    return cachedFullText;
  };

  interface RangeItem {
    from: number;
    to: number;
    decoration: Decoration;
    isReplace: boolean;
  }
  const items: RangeItem[] = [];

  const isClean = config.viewMode === 'clean' || config.viewMode === 'hide';
  const isOriginal = config.viewMode === 'original';
  const isChanges = !isClean && !isOriginal;

  // 1. Pending Suggestions (Insertions / Deletions / Replacements)
  for (const s of pendingSuggestions) {
    const { from, to } = resolveSuggestionRange(doc, s, getFullText);
    if (from >= to) continue;

    const authorName = s.author?.name || 'Collaborator';

    if (s.type === 'insert') {
      if (isChanges) {
        items.push({
          from,
          to,
          decoration: Decoration.mark({
            class: 'cm-track-change-insert',
            attributes: {
              'data-suggestion-id': s.id,
              'data-author': authorName,
              title: `Inserted by ${authorName}`,
            },
          }),
          isReplace: false,
        });
      } else if (isOriginal) {
        items.push({
          from,
          to,
          decoration: DECO_EMPTY_REPLACE,
          isReplace: true,
        });
      }
    } else if (s.type === 'delete') {
      if (isChanges) {
        items.push({
          from,
          to,
          decoration: Decoration.mark({
            class: 'cm-track-change-delete',
            attributes: {
              'data-suggestion-id': s.id,
              'data-author': authorName,
              title: `Deleted by ${authorName}`,
            },
          }),
          isReplace: false,
        });
      } else if (isClean) {
        items.push({
          from,
          to,
          decoration: DECO_EMPTY_REPLACE,
          isReplace: true,
        });
      }
    } else if (s.type === 'replace') {
      if (isChanges) {
        items.push({
          from,
          to,
          decoration: Decoration.mark({
            class: 'cm-track-change-replace',
            attributes: {
              'data-suggestion-id': s.id,
              'data-author': authorName,
              title: `Modified by ${authorName}`,
            },
          }),
          isReplace: false,
        });
      } else if (isClean && s.suggestedText !== undefined) {
        items.push({
          from,
          to,
          decoration: Decoration.replace({
            widget: new CleanReplacePreviewWidget(s.suggestedText),
            inclusive: false,
          }),
          isReplace: true,
        });
      }
    }
  }

  // 2. Open Comment Threads
  for (const c of openComments) {
    if (!c.line) continue;
    const startLine = Math.max(1, Math.min(c.line, doc.lines));
    const endLine = Math.max(startLine, Math.min(c.lineEnd || c.line, doc.lines));

    const from = doc.line(startLine).from;
    const to = doc.line(endLine).to;

    if (from < to) {
      items.push({
        from,
        to,
        decoration: Decoration.mark({
          class: 'cm-comment-highlight',
          attributes: {
            'data-comment-id': c.id,
            title: `Comment by ${c.author?.name || 'Reviewer'}: ${c.content.slice(0, 50)}`,
          },
        }),
        isReplace: false,
      });
    }
  }

  items.sort((a, b) => a.from - b.from || a.to - b.to);

  let lastReplaceEnd = -1;
  for (const item of items) {
    if (item.from < item.to && item.to <= doc.length) {
      if (item.isReplace) {
        if (item.from < lastReplaceEnd) {
          continue;
        }
        lastReplaceEnd = item.to;
      }
      builder.add(item.from, item.to, item.decoration);
    }
  }

  return builder.finish();
}

export const trackChangesGutter = gutter({
  class: 'cm-review-gutter',
  markers: (view: EditorView) => {
    const config = view.state.field(trackChangesStateField);
    const doc = view.state.doc;
    const builder = new RangeSetBuilder<GutterMarker>();

    const commentsByLine = new Map<number, PageComment[]>();
    for (const c of config.comments) {
      if (c.status === 'open') {
        let lineNum = c.line;
        const fromIndex = (c as typeof c & { fromIndex?: number }).fromIndex;
        if (!lineNum && typeof fromIndex === 'number' && doc.length > 0) {
          lineNum = doc.lineAt(Math.min(fromIndex, doc.length)).number;
        }
        if (lineNum) {
          const safeLine = Math.max(1, Math.min(lineNum, doc.lines));
          const list = commentsByLine.get(safeLine) || [];
          list.push(c);
          commentsByLine.set(safeLine, list);
        }
      }
    }

    const suggestionsByLine = new Map<number, PageSuggestion[]>();
    for (const s of config.suggestions) {
      if (s.status === 'pending') {
        let lineNum = s.fromLine;
        const fromIndex = (s as typeof s & { fromIndex?: number }).fromIndex;
        if (!lineNum && typeof fromIndex === 'number' && doc.length > 0) {
          lineNum = doc.lineAt(Math.min(fromIndex, doc.length)).number;
        }
        if (lineNum) {
          const safeLine = Math.max(1, Math.min(lineNum, doc.lines));
          const list = suggestionsByLine.get(safeLine) || [];
          list.push(s);
          suggestionsByLine.set(safeLine, list);
        }
      }
    }

    const allLines = new Set<number>([
      ...commentsByLine.keys(),
      ...suggestionsByLine.keys(),
    ]);
    const sortedLines = Array.from(allLines).sort((a, b) => a - b);

    for (const lineNum of sortedLines) {
      const linePos = doc.line(lineNum).from;
      const lineComments = commentsByLine.get(lineNum) || [];
      const lineSuggestions = suggestionsByLine.get(lineNum) || [];

      if (lineComments.length > 0 && lineSuggestions.length > 0) {
        builder.add(
          linePos,
          linePos,
          new CombinedReviewGutterMarker(
            lineComments.length,
            lineSuggestions.length,
            lineComments[0].id,
            lineSuggestions[0].id,
            lineNum,
          ),
        );
      } else if (lineComments.length > 0) {
        builder.add(
          linePos,
          linePos,
          new CommentGutterMarker(lineComments.length, lineComments[0].id, lineNum),
        );
      } else if (lineSuggestions.length > 0) {
        const hasInsert = lineSuggestions.some((s) => s.type === 'insert' || s.type === 'replace');
        const hasDelete = lineSuggestions.some((s) => s.type === 'delete' || s.type === 'replace');
        builder.add(
          linePos,
          linePos,
          new SuggestionGutterMarker(
            lineSuggestions.length,
            lineSuggestions[0].id,
            lineNum,
            hasInsert,
            hasDelete,
          ),
        );
      }
    }

    return builder.finish();
  },
  initialSpacer: () => new CommentGutterMarker(1, '', 1),
});

// ─── INTERACTIVE HOVER ACTION TOOLTIP (OVERLEAF PARITY) ─────────────────────

export function getTrackChangesTooltip(view: EditorView, pos: number): Tooltip | null {
  const config = view.state.field(trackChangesStateField);
  const doc = view.state.doc;

  const isClean = config.viewMode === 'clean' || config.viewMode === 'hide';
  const isOriginal = config.viewMode === 'original';

  const pendingSuggestions = config.suggestions.filter((s) => s.status === 'pending');
  let cachedFullText: string | null = null;
  const getFullText = () => {
    if (cachedFullText === null) {
      cachedFullText = doc.toString();
    }
    return cachedFullText;
  };

  for (const s of pendingSuggestions) {
    if (isClean && s.type === 'delete') continue;
    if (isOriginal && s.type === 'insert') continue;

    const { from, to } = resolveSuggestionRange(doc, s, getFullText);

    if (pos >= from && pos <= to) {
      return {
        pos: from,
        end: to,
        above: true,
        create() {
          return { dom: createTrackChangesTooltipDOM(s) };
        },
      };
    }
  }

  return null;
}

export const trackChangesHoverTooltip = hoverTooltip(getTrackChangesTooltip, { hoverTime: 120 });

// ─── MASTER EXTENSION FACTORY ────────────────────────────────────────────────

export function createTrackChangesExtension(
  options: TrackChangesExtensionOptions = {},
): Extension {
  const reviewMode =
    typeof options.reviewMode === 'string'
      ? options.reviewMode === 'on'
      : (options.reviewMode ?? options.initialReviewMode ?? false);
  const viewMode = options.viewMode || options.initialViewMode || 'changes';

  return [
    trackChangesStateField.init(() => ({
      pageId: options.pageId || '',
      suggestions: options.initialSuggestions || [],
      comments: options.initialComments || [],
      viewMode,
      reviewMode,
    })),
    trackChangesReviewModeFilter,
    trackChangesDecorationsField,
    trackChangesHoverTooltip,
    trackChangesTheme,
  ];
}

export const trackChangesExtension = createTrackChangesExtension;
