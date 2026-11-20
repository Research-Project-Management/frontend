import { StateEffect, StateField, Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { PageSuggestion, TrackChangesViewMode } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';

export type { TrackChangesViewMode };

const LOCAL_SUGGESTION_PREFIX = 'sug-local-';

export function isLocalSuggestionId(id?: string | null): boolean {
  return Boolean(id && id.startsWith(LOCAL_SUGGESTION_PREFIX));
}

export function createLocalSuggestionId(suffix = ''): string {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return suffix ? `${LOCAL_SUGGESTION_PREFIX}${token}-${suffix}` : `${LOCAL_SUGGESTION_PREFIX}${token}`;
}

export interface RawSuggestion {
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

export interface RawComment {
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

export const setSuggestionsEffect = StateEffect.define<PageSuggestion[]>();
export const setViewModeEffect = StateEffect.define<TrackChangesViewMode>();
export const setReviewModeEffect = StateEffect.define<boolean>();
export const setCommentsEffect = StateEffect.define<PageComment[]>();
export const setReviewDataEffect = StateEffect.define<{
  suggestions?: PageSuggestion[];
  comments?: Array<PageComment | RawComment>;
  changes?: Array<PageSuggestion | RawSuggestion>;
  viewMode?: TrackChangesViewMode;
  reviewMode?: boolean;
}>();

export interface ReviewExtensionConfig {
  pageId?: string;
  suggestions: PageSuggestion[];
  comments: PageComment[];
  viewMode: TrackChangesViewMode;
  reviewMode: boolean;
}

export interface ReviewExtensionOptions {
  pageId?: string;
  initialSuggestions?: PageSuggestion[];
  initialComments?: PageComment[];
  initialViewMode?: TrackChangesViewMode;
  initialReviewMode?: boolean;
  reviewMode?: 'on' | 'off' | boolean;
  viewMode?: TrackChangesViewMode;
}

export function getSafeOffset(
  doc: EditorView['state']['doc'],
  lineNum?: number,
  colNum?: number,
  index?: number,
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

export const reviewStateField = StateField.define<ReviewExtensionConfig>({
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
    let suggestionsReplaced = false;

    for (const effect of tr.effects) {
      if (effect.is(setSuggestionsEffect)) {
        next = { ...next, suggestions: effect.value };
        suggestionsReplaced = true;
      } else if (effect.is(setViewModeEffect)) {
        next = { ...next, viewMode: effect.value };
      } else if (effect.is(setReviewModeEffect)) {
        next = { ...next, reviewMode: effect.value };
      } else if (effect.is(setCommentsEffect)) {
        next = { ...next, comments: effect.value };
      } else if (effect.is(setReviewDataEffect)) {
        if (effect.value.suggestions || effect.value.changes) {
          suggestionsReplaced = true;
        }
        let newSuggestions = next.suggestions;
        if (effect.value.suggestions) {
          newSuggestions = effect.value.suggestions;
        } else if (effect.value.changes) {
          newSuggestions = effect.value.changes.map((raw) => {
            const c = raw as RawSuggestion;
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
            const c = raw as RawComment;
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

    if (tr.docChanged && !suggestionsReplaced && next.suggestions.length > 0) {
      const docLen = tr.newDoc.length;
      next = {
        ...next,
        suggestions: next.suggestions.map((s) => {
          if (typeof s.fromIndex !== 'number' || typeof s.toIndex !== 'number') {
            return s;
          }
          const rawFrom = tr.changes.mapPos(Math.max(0, Math.min(s.fromIndex, tr.startState.doc.length)), 1);
          const rawTo = tr.changes.mapPos(Math.max(0, Math.min(s.toIndex, tr.startState.doc.length)), -1);
          return {
            ...s,
            fromIndex: Math.max(0, Math.min(rawFrom, docLen)),
            toIndex: Math.max(Math.max(0, Math.min(rawFrom, docLen)), Math.min(rawTo, docLen)),
          };
        }),
      };
    }

    return next;
  },
});
