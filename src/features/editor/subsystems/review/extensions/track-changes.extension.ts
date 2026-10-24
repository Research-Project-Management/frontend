/**
 * track-changes.extension.ts
 *
 * CodeMirror 6 Review Mode & Track Changes Extension (Overleaf Parity).
 * Location: `features/editor/engines/extensions/track-changes.extension.ts`
 *
 * Capabilities:
 * 1. Track Changes Visual Decorations:
 *    - 'changes' mode: Green underline & tint for proposed additions (`cm-track-change-insert`),
 *      Red strikethrough & tint for proposed deletions (`cm-track-change-delete`).
 *    - 'clean' mode (Overleaf "Show final text"): Replaces/hides deleted text (`Decoration.replace`),
 *      renders inserted text clean as normal manuscript text.
 *    - 'original' mode (Overleaf "Show original text"): Replaces/hides inserted text (`Decoration.replace`),
 *      renders deleted text as normal manuscript text.
 * 2. Interactive In-Editor Inline Suggestion Widget / Popover:
 *    - Anchored popup with collaborator color, avatar/initials, author name, time ago,
 *      diff preview (inserted/deleted), description note, and 1-click [Accept] / [Reject] buttons.
 * 3. Review Gutter Markers:
 *    - Interactive markers on line margin indicating open comment threads and pending suggestions.
 *    - 1-click jump to review item in sidebar or editor view.
 */

import {
  EditorState,
  StateField,
  StateEffect,
  RangeSetBuilder,
  Transaction,
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
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  CleanReplacePreviewWidget,
  CommentGutterMarker,
  SuggestionGutterMarker,
  CombinedReviewGutterMarker,
  createTrackChangesTooltipDOM,
  trackChangesTheme,
} from './track-changes-widgets';

export { trackChangesTheme };
export type { TrackChangesViewMode };

export interface RawTrackChangeItem {
  id: string;
  docId?: string;
  pageId?: string;
  projectId?: string;
  type?: PageSuggestion['type'];
  text?: string;
  originalText?: string;
  suggestedText?: string;
  status?: PageSuggestion['status'];
  createdAt?: string;
  updatedAt?: string;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  fromIndex?: number;
  toIndex?: number;
  fromLine?: number;
  fromColumn?: number;
  toLine?: number;
  toColumn?: number;
}

export interface RawCommentItem {
  id: string;
  docId?: string;
  pageId?: string;
  projectId?: string;
  authorId?: string;
  authorName?: string;
  content?: string;
  line?: number;
  lineEnd?: number;
  status?: PageComment['status'];
  resolved?: boolean;
  fromIndex?: number;
  toIndex?: number;
  replies?: PageComment['replies'];
  createdAt?: string;
  updatedAt?: string;
}

// ─── STATE EFFECTS ───────────────────────────────────────────────────────────

export const setTrackChangesSuggestionsEffect = StateEffect.define<PageSuggestion[]>();
export const setTrackChangesViewModeEffect = StateEffect.define<TrackChangesViewMode>();
export const setTrackChangesReviewModeEffect = StateEffect.define<boolean>();
export const setTrackChangesCommentsEffect = StateEffect.define<PageComment[]>();
export const setTrackChangesDataEffect = StateEffect.define<{
  suggestions?: PageSuggestion[];
  comments?: Array<PageComment | RawCommentItem>;
  changes?: Array<PageSuggestion | RawTrackChangeItem>;
  viewMode?: TrackChangesViewMode;
  reviewMode?: boolean;
}>();

// Aliases for intuitive API usage
export const setReviewModeEffect = setTrackChangesReviewModeEffect;
export const setViewModeEffect = setTrackChangesViewModeEffect;

export interface TrackChangesConfig {
  pageId?: string;
  suggestions: PageSuggestion[];
  comments: PageComment[];
  viewMode: TrackChangesViewMode;
  reviewMode: boolean;
}

export interface TrackChangesExtensionOptions {
  pageId?: string;
  initialSuggestions?: PageSuggestion[];
  initialComments?: PageComment[];
  initialViewMode?: TrackChangesViewMode;
  initialReviewMode?: boolean;
  reviewMode?: 'on' | 'off' | boolean;
  viewMode?: TrackChangesViewMode;
}

// ─── HELPER: MAP LINE/COL OR OFFSET ──────────────────────────────────────────

export function getSafeOffset(
  doc: EditorView['state']['doc'],
  lineNum?: number,
  colNum?: number,
  index?: number
): number {
  if (typeof index === 'number' && !isNaN(index)) {
    return Math.max(0, Math.min(index, doc.length));
  }
  if (!lineNum || doc.lines === 0) return 0;
  const safeLineNum = Math.max(1, Math.min(lineNum, doc.lines));
  const line = doc.line(safeLineNum);
  const safeCol = Math.max(0, (colNum || 1) - 1);
  return Math.min(line.from + safeCol, line.to);
}

export function resolveSuggestionRange(
  doc: EditorView['state']['doc'],
  s: PageSuggestion,
  _getFullText?: () => string,
): { from: number; to: number } {
  const cand = s as typeof s & {
    fromIndex?: number;
    fromOffset?: number;
    toIndex?: number;
    toOffset?: number;
    startLine?: number;
    endLine?: number;
  };
  const rawFrom = cand.fromIndex ?? cand.fromOffset;
  const rawTo = cand.toIndex ?? cand.toOffset;

  if (typeof rawFrom === 'number' && !isNaN(rawFrom) && typeof rawTo === 'number' && !isNaN(rawTo) && rawFrom < rawTo) {
    return {
      from: Math.max(0, Math.min(rawFrom, doc.length)),
      to: Math.max(0, Math.min(rawTo, doc.length)),
    };
  }

  const anchorFromLine = cand.startLine ?? s.fromLine;
  const anchorToLine = cand.endLine ?? s.toLine;

  if (anchorFromLine && anchorToLine && s.toColumn !== undefined) {
    const f = getSafeOffset(doc, anchorFromLine, s.fromColumn, rawFrom);
    const t = getSafeOffset(doc, anchorToLine, s.toColumn, rawTo);
    if (f < t) return { from: f, to: t };
  }

  const candidates =
    s.type === 'insert'
      ? [s.suggestedText, s.originalText]
      : [s.originalText, s.suggestedText];

  if (anchorFromLine && doc.lines > 0) {
    const safeLineNum = Math.max(1, Math.min(anchorFromLine, doc.lines));
    const lineObj = doc.line(safeLineNum);
    for (const text of candidates) {
      if (text) {
        const idx = lineObj.text.indexOf(text);
        if (idx !== -1) {
          return {
            from: lineObj.from + idx,
            to: lineObj.from + idx + text.length,
          };
        }
      }
    }

    // Bounded local window search around [anchorFromLine - 5, anchorToLine + 5]
    // Only search neighboring lines when candidate text is at least 3 characters to prevent matching stray punctuation
    const safeEndLineNum = Math.max(safeLineNum, Math.min(anchorToLine ?? safeLineNum, doc.lines));
    const minWindowLine = Math.max(1, safeLineNum - 5);
    const maxWindowLine = Math.min(doc.lines, safeEndLineNum + 5);
    const windowFrom = doc.line(minWindowLine).from;
    const windowTo = doc.line(maxWindowLine).to;
    const windowSlice = doc.sliceString(windowFrom, windowTo);

    for (const text of candidates) {
      if (text && text.length >= 3) {
        const idx = windowSlice.indexOf(text);
        if (idx !== -1) {
          return {
            from: windowFrom + idx,
            to: Math.min(doc.length, windowFrom + idx + text.length),
          };
        }
      }
    }
  }

  const from = getSafeOffset(doc, anchorFromLine, s.fromColumn, rawFrom);
  let to = getSafeOffset(doc, anchorToLine ?? anchorFromLine, s.toColumn, rawTo);
  if (from === to) {
    const fallbackLen =
      (s.type === 'insert' ? s.suggestedText?.length : s.originalText?.length) ||
      s.suggestedText?.length ||
      1;
    to = Math.min(doc.length, from + fallbackLen);
  }
  return { from, to };
}

// ─── STATE FIELD: TRACK CHANGES & COMMENTS CONFIG ────────────────────────────

export const trackChangesStateField = StateField.define<TrackChangesConfig>({
  create() {
    return {
      suggestions: [],
      comments: [],
      viewMode: 'changes',
      reviewMode: false,
    };
  },
  update(value, tr: Transaction) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setTrackChangesSuggestionsEffect)) {
        next = { ...next, suggestions: effect.value };
      } else if (effect.is(setTrackChangesViewModeEffect)) {
        next = { ...next, viewMode: effect.value };
      } else if (effect.is(setTrackChangesReviewModeEffect)) {
        next = { ...next, reviewMode: effect.value };
      } else if (effect.is(setTrackChangesCommentsEffect)) {
        next = { ...next, comments: effect.value };
      } else if (effect.is(setTrackChangesDataEffect)) {
        let newSuggestions = next.suggestions;
        if (effect.value.suggestions) {
          newSuggestions = effect.value.suggestions;
        } else if (effect.value.changes) {
          newSuggestions = effect.value.changes.map((raw) => {
            const c = raw as RawTrackChangeItem;
            return {
              id: c.id,
              pageId: c.docId || c.pageId || '',
              projectId: c.projectId || '',
              type: c.type || 'insert',
              originalText: c.type === 'delete' ? (c.text || '') : (c.originalText || ''),
              suggestedText: c.type === 'insert' ? (c.text || '') : (c.suggestedText || ''),
              status: c.status || 'pending',
              createdAt: c.createdAt || new Date().toISOString(),
              updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
              author: { id: c.authorId || '', name: c.authorName || 'Collaborator', email: c.authorEmail || '' },
              authorId: c.authorId || '',
              fromIndex: c.fromIndex,
              toIndex: c.toIndex,
              fromLine: c.fromLine || 1,
              fromColumn: c.fromColumn || 1,
              toLine: c.toLine || 1,
              toColumn: c.toColumn || 1,
            } as PageSuggestion;
          });
        }

        let newComments = next.comments;
        if (effect.value.comments) {
          newComments = effect.value.comments.map((raw) => {
            const c = raw as RawCommentItem;
            const hasIndex = typeof c.fromIndex === 'number';
            const calcLine = hasIndex && tr.state.doc.length > 0
              ? tr.state.doc.lineAt(Math.min(c.fromIndex!, tr.state.doc.length)).number
              : 1;
            return {
              id: c.id,
              pageId: c.docId || c.pageId || '',
              projectPageId: c.docId || c.pageId || '',
              page: c.docId || c.pageId || '',
              projectId: c.projectId || '',
              author: { id: c.authorId || '', name: c.authorName || 'Collaborator' },
              authorId: c.authorId || '',
              content: c.content || '',
              line: c.line || calcLine,
              lineEnd: c.lineEnd || c.line || calcLine,
              status: c.status || (c.resolved ? 'resolved' : 'open'),
              resolved: !!c.resolved,
              fromIndex: c.fromIndex,
              toIndex: c.toIndex,
              replies: c.replies || [],
              createdAt: c.createdAt || new Date().toISOString(),
              updatedAt: c.updatedAt || new Date().toISOString(),
            } as PageComment;
          });
        }

        next = {
          ...next,
          suggestions: newSuggestions,
          comments: newComments,
          viewMode: effect.value.viewMode || next.viewMode,
          reviewMode: effect.value.reviewMode !== undefined ? effect.value.reviewMode : next.reviewMode,
        };
      }
    }
    return next;
  },
});

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
        e.is(setTrackChangesDataEffect)
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
    (s) => s.status === 'pending'
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
        // In original mode: hide the proposed insertion
        items.push({
          from,
          to,
          decoration: DECO_EMPTY_REPLACE,
          isReplace: true,
        });
      }
      // In clean mode: rendered as normal document text without highlights
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
        // In clean mode: hide the proposed deletion
        items.push({
          from,
          to,
          decoration: DECO_EMPTY_REPLACE,
          isReplace: true,
        });
      }
      // In original mode: rendered as normal document text without strikethrough
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
      // In original mode: rendered as normal original document text
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

  // Sort ranges strictly (from ascending, then to ascending)
  items.sort((a, b) => a.from - b.from || a.to - b.to);

  // Eliminate any invalid overlaps for replace decorations to prevent RangeSetBuilder crash
  let lastReplaceEnd = -1;
  for (const item of items) {
    if (item.from < item.to && item.to <= doc.length) {
      if (item.isReplace) {
        if (item.from < lastReplaceEnd) {
          continue; // skip overlapping replace
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

    // 1. Group open comments by line
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

    // 2. Group pending suggestions by line
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

    // 3. Merge all line numbers
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
            lineNum
          )
        );
      } else if (lineComments.length > 0) {
        builder.add(
          linePos,
          linePos,
          new CommentGutterMarker(lineComments.length, lineComments[0].id, lineNum)
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
            hasDelete
          )
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
    // Don't show tooltip if item is hidden by clean/original view mode
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

export const trackChangesReviewModeFilter = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged) return tr;
  const config = tr.startState.field(trackChangesStateField, false);
  if (!config || !config.reviewMode) return tr;
  const currentScopePageId = config.pageId || '';

  const userEvt = tr.annotation(Transaction.userEvent);
  if (!userEvt || (!userEvt.startsWith('input') && !userEvt.startsWith('delete'))) {
    return tr;
  }

  let changeCount = 0;
  let fromA = 0;
  let toA = 0;
  let fromB = 0;
  let toB = 0;
  let insertedText = '';

  tr.changes.iterChanges((fA, tA, fB, tB, inserted) => {
    changeCount++;
    fromA = fA;
    toA = tA;
    fromB = fB;
    toB = tB;
    insertedText = inserted.toString();
  });

  if (changeCount !== 1) return tr;

  const startDoc = tr.startState.doc;
  const existing = [...config.suggestions];
  const nowIso = new Date().toISOString();

  let cachedFullText: string | null = null;
  const getFullText = () => {
    if (cachedFullText === null) {
      cachedFullText = startDoc.toString();
    }
    return cachedFullText;
  };

  // Case 1: Pure insertion in Suggesting Mode
  if (fromA === toA && insertedText.length > 0) {
    const newDoc = tr.newDoc;
    const startLineObj = newDoc.lineAt(fromB);
    const endLineObj = newDoc.lineAt(toB);
    const delta = insertedText.length;

    let coalescedSug: PageSuggestion | null = null;
    const nextSuggestions: PageSuggestion[] = existing.map((s) => {
      const range = resolveSuggestionRange(startDoc, s, getFullText);
      if (
        !coalescedSug &&
        s.status === 'pending' &&
        s.type === 'insert' &&
        (s.authorId === 'current-user' || s.author?.id === 'current-user') &&
        range.to === fromA
      ) {
        const updated: PageSuggestion = {
          ...s,
          suggestedText: (s.suggestedText || '') + insertedText,
          fromIndex: range.from,
          toIndex: range.to + delta,
          toLine: endLineObj.number,
          toColumn: toB - endLineObj.from + 1,
          updatedAt: nowIso,
        };
        coalescedSug = updated;
        return updated;
      }
      if (range.from >= fromA) {
        return {
          ...s,
          fromIndex: range.from + delta,
          toIndex: range.to + delta,
        };
      }
      return s;
    });

    if (!coalescedSug) {
      coalescedSug = {
        id: `sug-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageId: currentScopePageId,
        type: 'insert',
        originalText: '',
        suggestedText: insertedText,
        fromIndex: fromB,
        toIndex: toB,
        fromLine: startLineObj.number,
        fromColumn: fromB - startLineObj.from + 1,
        toLine: endLineObj.number,
        toColumn: toB - endLineObj.from + 1,
        status: 'pending',
        authorId: 'current-user',
        author: { id: 'current-user', name: 'You' },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextSuggestions.push(coalescedSug);
    }

    const recorded = coalescedSug;
    queueMicrotask(() => {
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: currentScopePageId,
        event: 'suggestion:local-recorded',
        payload: { suggestion: recorded },
      });
    });

    return [tr, { effects: setTrackChangesSuggestionsEffect.of(nextSuggestions) }];
  }

  // Case 2: Deletion in Suggesting Mode -> keep text in buffer and mark as pending delete
  if (fromA < toA && insertedText.length === 0) {
    const deletedText = startDoc.sliceString(fromA, toA);
    const startLineObj = startDoc.lineAt(fromA);
    const endLineObj = startDoc.lineAt(toA);

    let coalescedSug: PageSuggestion | null = null;
    const nextSuggestions: PageSuggestion[] = existing.map((s) => {
      const range = resolveSuggestionRange(startDoc, s, getFullText);
      if (
        !coalescedSug &&
        s.status === 'pending' &&
        s.type === 'delete' &&
        (s.authorId === 'current-user' || s.author?.id === 'current-user') &&
        (range.from === toA || range.to === fromA)
      ) {
        const mergedFrom = Math.min(range.from, fromA);
        const mergedTo = Math.max(range.to, toA);
        const mStartLine = startDoc.lineAt(mergedFrom);
        const mEndLine = startDoc.lineAt(mergedTo);
        const updated: PageSuggestion = {
          ...s,
          originalText: startDoc.sliceString(mergedFrom, mergedTo),
          fromIndex: mergedFrom,
          toIndex: mergedTo,
          fromLine: mStartLine.number,
          fromColumn: mergedFrom - mStartLine.from + 1,
          toLine: mEndLine.number,
          toColumn: mergedTo - mEndLine.from + 1,
          updatedAt: nowIso,
        };
        coalescedSug = updated;
        return updated;
      }
      return s;
    });

    if (!coalescedSug) {
      coalescedSug = {
        id: `sug-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageId: currentScopePageId,
        type: 'delete',
        originalText: deletedText,
        suggestedText: '',
        fromIndex: fromA,
        toIndex: toA,
        fromLine: startLineObj.number,
        fromColumn: fromA - startLineObj.from + 1,
        toLine: endLineObj.number,
        toColumn: toA - endLineObj.from + 1,
        status: 'pending',
        authorId: 'current-user',
        author: { id: 'current-user', name: 'You' },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextSuggestions.push(coalescedSug);
    }

    const recorded = coalescedSug;
    queueMicrotask(() => {
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: currentScopePageId,
        event: 'suggestion:local-recorded',
        payload: { suggestion: recorded },
      });
    });

    return {
      selection: { anchor: fromA },
      effects: setTrackChangesSuggestionsEffect.of(nextSuggestions),
    };
  }

  // Case 3: Selection replacement in Suggesting Mode -> keep originalText and mark as pending replace
  if (fromA < toA && insertedText.length > 0) {
    const originalText = startDoc.sliceString(fromA, toA);
    const startLineObj = startDoc.lineAt(fromA);
    const endLineObj = startDoc.lineAt(toA);

    const replaceSug: PageSuggestion = {
      id: `sug-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pageId: currentScopePageId,
      type: 'replace',
      originalText,
      suggestedText: insertedText,
      fromIndex: fromA,
      toIndex: toA,
      fromLine: startLineObj.number,
      fromColumn: fromA - startLineObj.from + 1,
      toLine: endLineObj.number,
      toColumn: toA - endLineObj.from + 1,
      status: 'pending',
      authorId: 'current-user',
      author: { id: 'current-user', name: 'You' },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextSuggestions = [...existing, replaceSug];
    queueMicrotask(() => {
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: currentScopePageId,
        event: 'suggestion:local-recorded',
        payload: { suggestion: replaceSug },
      });
    });

    return {
      selection: { anchor: toA },
      effects: setTrackChangesSuggestionsEffect.of(nextSuggestions),
    };
  }

  return tr;
});

// ─── MASTER EXTENSION FACTORY ────────────────────────────────────────────────

export function createTrackChangesExtension(
  options: TrackChangesExtensionOptions = {}
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
