import { RangeSetBuilder, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  hoverTooltip,
  type DecorationSet,
  type Tooltip,
} from '@codemirror/view';
import type { PageSuggestion, TrackChangesViewMode } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import { reviewModeFilter } from './filter';
import {
  createLocalSuggestionId,
  decodeYjsAnchor,
  encodeYjsAnchor,
  getSafeOffset,
  isLocalSuggestionId,
  resolveCommentRange,
  resolveSuggestionRange,
  resolveYjsAnchorRange,
  reviewStateField,
  setCommentsEffect,
  setReviewDataEffect,
  setReviewModeEffect,
  setSuggestionsEffect,
  setViewModeEffect,
  setYDocEffect,
  type RawComment,
  type RawSuggestion,
  type ReviewExtensionConfig,
  type ReviewExtensionOptions,
} from './state';
import {
  CleanReplaceWidget,
  CombinedReviewGutterMarker,
  CommentGutterMarker,
  SuggestionGutterMarker,
  createSuggestionTooltipDom,
  reviewTheme,
} from './widgets';

export {
  createLocalSuggestionId,
  decodeYjsAnchor,
  encodeYjsAnchor,
  getSafeOffset,
  isLocalSuggestionId,
  resolveCommentRange,
  resolveSuggestionRange,
  resolveYjsAnchorRange,
  reviewModeFilter,
  reviewStateField,
  reviewTheme,
  setCommentsEffect,
  setReviewDataEffect,
  setReviewModeEffect,
  setSuggestionsEffect,
  setViewModeEffect,
  setYDocEffect,
};
export type {
  RawComment,
  RawSuggestion,
  ReviewExtensionConfig,
  ReviewExtensionOptions,
  TrackChangesViewMode,
};

const DECO_EMPTY_REPLACE = Decoration.replace({ inclusive: false });

export const reviewDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(decorations, tr) {
    const configChanged = tr.effects.some(
      (e) =>
        e.is(setSuggestionsEffect) ||
        e.is(setViewModeEffect) ||
        e.is(setReviewModeEffect) ||
        e.is(setCommentsEffect) ||
        e.is(setReviewDataEffect) ||
        e.is(setYDocEffect),
    );

    if (configChanged) {
      return buildDecorations(tr.state);
    }

    if (tr.docChanged) {
      const config = tr.state.field(reviewStateField);
      const hasActive =
        config.suggestions.some((s) => s.status === 'pending') ||
        config.comments.some((c) => c.status === 'open');
      return hasActive ? buildDecorations(tr.state) : Decoration.none;
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildDecorations(state: EditorView['state']): DecorationSet {
  const config = state.field(reviewStateField);
  const pendingSuggestions = config.suggestions.filter((s) => s.status === 'pending');
  const openComments = config.comments.filter((c) => c.status === 'open');

  if (pendingSuggestions.length === 0 && openComments.length === 0) {
    return Decoration.none;
  }

  const doc = state.doc;
  const builder = new RangeSetBuilder<Decoration>();

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

  for (const s of pendingSuggestions) {
    const { from, to } = resolveSuggestionRange(doc, s, config.yDoc);
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
        items.push({ from, to, decoration: DECO_EMPTY_REPLACE, isReplace: true });
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
        items.push({ from, to, decoration: DECO_EMPTY_REPLACE, isReplace: true });
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
            widget: new CleanReplaceWidget(s.suggestedText),
            inclusive: false,
          }),
          isReplace: true,
        });
      }
    }
  }

  for (const c of openComments) {
    const resolved = resolveCommentRange(doc, c, config.yDoc);
    if (!resolved) continue;
    const { from, to } = resolved;

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
        if (item.from < lastReplaceEnd) continue;
        lastReplaceEnd = item.to;
      }
      builder.add(item.from, item.to, item.decoration);
    }
  }

  return builder.finish();
}

export const reviewGutter = gutter({
  class: 'cm-review-gutter',
  markers: (view: EditorView) => {
    const config = view.state.field(reviewStateField);
    const doc = view.state.doc;
    const builder = new RangeSetBuilder<GutterMarker>();

    const commentsByLine = new Map<number, PageComment[]>();
    for (const c of config.comments) {
      if (c.status === 'open') {
        const resolved = resolveCommentRange(doc, c, config.yDoc);
        if (resolved) {
          const list = commentsByLine.get(resolved.line) || [];
          list.push(c);
          commentsByLine.set(resolved.line, list);
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

    const sortedLines = Array.from(
      new Set<number>([...commentsByLine.keys(), ...suggestionsByLine.keys()]),
    ).sort((a, b) => a - b);

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

export function getSuggestionTooltip(view: EditorView, pos: number): Tooltip | null {
  const config = view.state.field(reviewStateField);
  const doc = view.state.doc;

  const isClean = config.viewMode === 'clean' || config.viewMode === 'hide';
  const isOriginal = config.viewMode === 'original';

  for (const s of config.suggestions) {
    if (s.status !== 'pending') continue;
    if (isClean && s.type === 'delete') continue;
    if (isOriginal && s.type === 'insert') continue;

    const { from, to } = resolveSuggestionRange(doc, s, config.yDoc);
    if (pos >= from && pos <= to) {
      return {
        pos: from,
        end: to,
        above: true,
        create() {
          return { dom: createSuggestionTooltipDom(s) };
        },
      };
    }
  }

  return null;
}

export const reviewHoverTooltip = hoverTooltip(getSuggestionTooltip, { hoverTime: 120 });

export function createReviewExtension(options: ReviewExtensionOptions = {}): Extension {
  const reviewMode =
    typeof options.reviewMode === 'string'
      ? options.reviewMode === 'on'
      : (options.reviewMode ?? options.initialReviewMode ?? false);
  const viewMode = options.viewMode || options.initialViewMode || 'changes';

  return [
    reviewStateField.init(() => ({
      pageId: options.pageId || '',
      suggestions: options.initialSuggestions || [],
      comments: options.initialComments || [],
      viewMode,
      reviewMode,
      yDoc: options.yDoc ?? null,
    })),
    reviewModeFilter,
    reviewDecorationsField,
    reviewHoverTooltip,
    reviewTheme,
  ];
}
