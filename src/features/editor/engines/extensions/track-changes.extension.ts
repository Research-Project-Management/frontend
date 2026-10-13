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
  StateField,
  StateEffect,
  RangeSetBuilder,
  type Extension,
  type Transaction,
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
import type { PageSuggestion } from '../../domain/types/suggestion.types';
import type { PageComment } from '../../domain/types/comment.types';
import { editorCommandBus } from '../../coordinators/command-bus';
import { timeAgo, formatOverleafDate, getAuthorColor } from '../../domain/collaboration/author-display';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export type TrackChangesViewMode = 'changes' | 'clean' | 'original' | 'show' | 'hide';

// ─── STATE EFFECTS ───────────────────────────────────────────────────────────

export const setTrackChangesSuggestionsEffect = StateEffect.define<PageSuggestion[]>();
export const setTrackChangesViewModeEffect = StateEffect.define<TrackChangesViewMode>();
export const setTrackChangesReviewModeEffect = StateEffect.define<boolean>();
export const setTrackChangesCommentsEffect = StateEffect.define<PageComment[]>();
export const setTrackChangesDataEffect = StateEffect.define<{
  suggestions?: PageSuggestion[];
  comments?: any[];
  changes?: any[];
  viewMode?: TrackChangesViewMode;
  reviewMode?: boolean;
}>();

// Aliases for intuitive API usage
export const setReviewModeEffect = setTrackChangesReviewModeEffect;
export const setViewModeEffect = setTrackChangesViewModeEffect;
export const setSuggestionsEffect = setTrackChangesSuggestionsEffect;
export const setCommentsEffect = setTrackChangesCommentsEffect;

export interface TrackChangesConfig {
  suggestions: PageSuggestion[];
  comments: PageComment[];
  viewMode: TrackChangesViewMode;
  reviewMode: boolean;
}

export interface TrackChangesExtensionOptions {
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
          newSuggestions = effect.value.changes.map((c: any) => ({
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
          } as PageSuggestion));
        }

        let newComments = next.comments;
        if (effect.value.comments) {
          newComments = effect.value.comments.map((c: any) => {
            const hasIndex = typeof c.fromIndex === 'number';
            const calcLine = hasIndex && tr.state.doc.length > 0
              ? tr.state.doc.lineAt(Math.min(c.fromIndex, tr.state.doc.length)).number
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

    if (tr.docChanged || configChanged) {
      return buildDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildDecorations(state: EditorView['state']): DecorationSet {
  const config = state.field(trackChangesStateField);
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

  // 1. Pending Suggestions (Insertions / Deletions / Replacements)
  const pendingSuggestions = config.suggestions.filter(
    (s) => s.status === 'pending'
  );

  for (const s of pendingSuggestions) {
    const cand = s as typeof s & { fromIndex?: number; fromOffset?: number; toIndex?: number; toOffset?: number };
    const rawFrom = cand.fromIndex ?? cand.fromOffset;
    const rawTo = cand.toIndex ?? cand.toOffset;
    const from = getSafeOffset(doc, s.fromLine, s.fromColumn, rawFrom);
    let to = getSafeOffset(doc, s.toLine, s.toColumn, rawTo);

    if (from === to && s.type === 'insert') {
      to = Math.min(doc.length, from + (s.suggestedText?.length || 1));
    }
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
          decoration: Decoration.replace({ inclusive: false }),
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
          decoration: Decoration.replace({ inclusive: false }),
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
      }
    }
  }

  // 2. Open Comment Threads
  const openComments = config.comments.filter((c) => c.status === 'open');
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

// ─── GUTTER MARKERS: COMMENTS & SUGGESTIONS IN LINE MARGIN ───────────────────

class CommentGutterMarker extends GutterMarker {
  constructor(
    private readonly count: number,
    private readonly firstCommentId: string,
    private readonly line: number
  ) {
    super();
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-review-gutter-marker';
    el.title = `${this.count} comment${this.count > 1 ? 's' : ''} on line ${this.line} (click to view)`;
    el.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" class="text-warning">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
      ${this.count > 1 ? `<span class="cm-review-gutter-count">${this.count}</span>` : ''}
    `;

    el.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      editorCommandBus.dispatch({
        type: 'sidebar:open-panel',
        panel: 'Review',
        commentId: this.firstCommentId,
      });
      editorCommandBus.dispatch({
        type: 'review:navigate-to-comment',
        commentId: this.firstCommentId,
        line: this.line,
      });
    };

    return el;
  }
}

class SuggestionGutterMarker extends GutterMarker {
  constructor(
    private readonly count: number,
    private readonly firstSuggestionId: string,
    private readonly line: number,
    private readonly hasInsert: boolean,
    private readonly hasDelete: boolean
  ) {
    super();
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-review-gutter-marker cm-review-gutter-suggestion-marker';
    el.title = `${this.count} pending change${this.count > 1 ? 's' : ''} on line ${this.line} (click to review)`;

    const colorClass = this.hasInsert && this.hasDelete
      ? 'text-primary'
      : this.hasInsert
        ? 'text-success'
        : 'text-destructive';

    el.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="${colorClass}">
        ${this.hasInsert && this.hasDelete
          ? '<circle cx="12" cy="12" r="5" fill="currentColor"/>'
          : this.hasInsert
            ? '<path d="M12 5v14M5 12h14"/>'
            : '<path d="M5 12h14"/>'}
      </svg>
      ${this.count > 1 ? `<span class="cm-review-gutter-count">${this.count}</span>` : ''}
    `;

    el.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      editorCommandBus.dispatch({
        type: 'sidebar:open-panel',
        panel: 'Review',
        suggestionId: this.firstSuggestionId,
      });
      editorCommandBus.dispatch({
        type: 'review:navigate-to-change',
        suggestionId: this.firstSuggestionId,
        line: this.line,
      });
    };

    return el;
  }
}

class CombinedReviewGutterMarker extends GutterMarker {
  constructor(
    private readonly commentCount: number,
    private readonly suggestionCount: number,
    private readonly firstCommentId: string,
    private readonly firstSuggestionId: string,
    private readonly line: number
  ) {
    super();
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-review-gutter-marker';
    el.title = `${this.commentCount} comment(s), ${this.suggestionCount} change(s) on line ${this.line}`;
    el.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-warning">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
      <span class="cm-review-gutter-count">${this.commentCount + this.suggestionCount}</span>
    `;

    el.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      editorCommandBus.dispatch({
        type: 'sidebar:open-panel',
        panel: 'Review',
        commentId: this.firstCommentId,
        suggestionId: this.firstSuggestionId,
      });
    };

    return el;
  }
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
    for (const s of pendingSuggestions) {
      // Don't show tooltip if item is hidden by clean/original view mode
      if (isClean && s.type === 'delete') continue;
      if (isOriginal && s.type === 'insert') continue;

      const cand = s as typeof s & { fromIndex?: number; fromOffset?: number; toIndex?: number; toOffset?: number };
      const rawFrom = cand.fromIndex ?? cand.fromOffset;
      const rawTo = cand.toIndex ?? cand.toOffset;
      const from = getSafeOffset(doc, s.fromLine, s.fromColumn, rawFrom);
      let to = getSafeOffset(doc, s.toLine, s.toColumn, rawTo);

      if (from === to && s.type === 'insert') {
        to = Math.min(doc.length, from + (s.suggestedText?.length || 1));
      }

      if (pos >= from && pos <= to) {
        return {
          pos: from,
          end: to,
          above: true,
          create() {
            const dom = document.createElement('div');
            dom.className = 'cm-track-tooltip';
            dom.setAttribute('data-testid', 'inline-suggestion-tooltip');

            const author = s.author?.name || 'Collaborator';
            const authorInitials = author.slice(0, 2).toUpperCase();
            const authorColor = getAuthorColor(s.author?.id || s.authorId || author);
            const timeDisplay = timeAgo(s.createdAt) || formatOverleafDate(s.createdAt) || 'just now';

            const typeLabel = s.type === 'insert' ? 'Added' : s.type === 'delete' ? 'Deleted' : 'Replaced';
            const typeBadgeColor =
              s.type === 'insert'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : s.type === 'delete'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';

            // Diff snippet HTML
            let diffPreviewHtml = '';
            if (s.originalText && s.type !== 'insert') {
              diffPreviewHtml += `<div class="cm-track-diff-del">- ${escapeHtml(s.originalText)}</div>`;
            }
            if (s.suggestedText && s.type !== 'delete') {
              diffPreviewHtml += `<div class="cm-track-diff-ins">+ ${escapeHtml(s.suggestedText)}</div>`;
            }

            const descHtml = s.description
              ? `<div class="cm-track-desc">&ldquo;${escapeHtml(s.description)}&rdquo;</div>`
              : '';

            dom.innerHTML = `
              <div class="cm-track-header">
                <div class="cm-track-author-info">
                  <div class="cm-track-avatar" style="background-color: ${authorColor}">
                    ${escapeHtml(authorInitials)}
                  </div>
                  <div class="cm-track-author-details">
                    <span class="cm-track-author-name">${escapeHtml(author)}</span>
                    <span class="cm-track-time">${escapeHtml(timeDisplay)}</span>
                  </div>
                </div>
                <span class="cm-track-type-badge ${typeBadgeColor}">${typeLabel}</span>
              </div>

              ${diffPreviewHtml ? `<div class="cm-track-diff-preview">${diffPreviewHtml}</div>` : ''}
              ${descHtml}

              <div class="cm-track-actions">
                <button
                  type="button"
                  class="cm-track-btn cm-track-btn-reject"
                  data-testid="inline-reject-btn"
                  title="Reject change (Esc)"
                  aria-label="Reject change"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  class="cm-track-btn cm-track-btn-accept"
                  data-testid="inline-accept-btn"
                  title="Accept change (Tab)"
                  aria-label="Accept change"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>Accept</span>
                </button>
              </div>
            `;

            const acceptBtn = dom.querySelector('.cm-track-btn-accept') as HTMLButtonElement;
            const rejectBtn = dom.querySelector('.cm-track-btn-reject') as HTMLButtonElement;

            if (acceptBtn) {
              acceptBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                editorCommandBus.dispatch({
                  type: 'review:accept-suggestion',
                  suggestionId: s.id,
                });
              };
            }

            if (rejectBtn) {
              rejectBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                editorCommandBus.dispatch({
                  type: 'review:reject-suggestion',
                  suggestionId: s.id,
                });
              };
            }

            return { dom };
          },
        };
      }
    }

    return null;
}

export const trackChangesHoverTooltip = hoverTooltip(getTrackChangesTooltip, { hoverTime: 120 });

// ─── STYLES & THEME ─────────────────────────────────────────────────────────

export const trackChangesTheme = EditorView.baseTheme({
  '.cm-track-change-insert': {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    textDecoration: 'underline',
    textDecorationColor: '#22c55e',
    textDecorationThickness: '2px',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  '.cm-track-change-delete': {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    textDecoration: 'line-through',
    textDecorationColor: '#ef4444',
    textDecorationThickness: '2px',
    color: '#ef4444',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  '.cm-track-change-replace': {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    textDecoration: 'underline',
    textDecorationColor: '#3b82f6',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  '.cm-comment-highlight': {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderBottom: '2px dashed #f59e0b',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  '.cm-review-gutter': {
    width: '22px',
    userSelect: 'none',
  },
  '.cm-review-gutter-marker': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    height: '100%',
  },
  '.cm-review-gutter-count': {
    position: 'absolute',
    top: '-3px',
    right: '-3px',
    fontSize: '8px',
    fontWeight: '600',
    backgroundColor: 'var(--warning, #f59e0b)',
    color: 'var(--warning-foreground, #000)',
    borderRadius: '999px',
    padding: '0 3px',
    lineHeight: '10px',
  },
  '.cm-track-tooltip': {
    backgroundColor: 'var(--popover, #18181b)',
    color: 'var(--popover-foreground, #f4f4f5)',
    border: '1px solid var(--border, rgba(255,255,255,0.12))',
    borderRadius: '8px',
    padding: '10px 12px',
    boxShadow: 'var(--shadow-overlay, 0 8px 24px -4px rgba(0,0,0,0.35))',
    fontSize: '11px',
    zIndex: 999,
    minWidth: '220px',
    maxWidth: '320px',
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
  },
  '.cm-track-header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '8px',
  },
  '.cm-track-author-info': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: '0',
  },
  '.cm-track-avatar': {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: '600',
    color: '#ffffff',
    flexShrink: '0',
  },
  '.cm-track-author-details': {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '0',
    lineHeight: '1.2',
  },
  '.cm-track-author-name': {
    fontWeight: '600',
    fontSize: '11px',
    color: 'var(--foreground, #f4f4f5)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
  },
  '.cm-track-time': {
    fontSize: '9px',
    color: 'var(--muted-foreground, #a1a1aa)',
  },
  '.cm-track-type-badge': {
    fontSize: '9px',
    fontWeight: '600',
    textTransform: 'uppercase',
    padding: '2px 5px',
    borderRadius: '3px',
    letterSpacing: '0.03em',
    flexShrink: '0',
  },
  '.cm-track-diff-preview': {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '11px',
    backgroundColor: 'hsl(var(--muted) / 0.5)',
    borderRadius: '4px',
    padding: '6px 8px',
    marginBottom: '8px',
    maxHeight: '80px',
    overflowY: 'auto',
    wordBreak: 'break-word',
    lineHeight: '1.4',
  },
  '.cm-track-diff-del': {
    color: 'var(--destructive, #ef4444)',
    textDecoration: 'line-through',
  },
  '.cm-track-diff-ins': {
    color: 'var(--success, #22c55e)',
  },
  '.cm-track-desc': {
    fontStyle: 'italic',
    fontSize: '10px',
    color: 'var(--muted-foreground, #a1a1aa)',
    marginBottom: '8px',
    lineHeight: '1.3',
  },
  '.cm-track-actions': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
    paddingTop: '4px',
    borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
  },
  '.cm-track-btn': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s ease',
  },
  '.cm-track-btn-accept': {
    backgroundColor: 'var(--primary, #2563eb)',
    color: 'var(--primary-foreground, #ffffff)',
    '&:hover': {
      filter: 'brightness(1.1)',
    },
  },
  '.cm-track-btn-reject': {
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground, #a1a1aa)',
    border: '1px solid var(--border, rgba(255,255,255,0.15))',
    '&:hover': {
      backgroundColor: 'hsl(var(--destructive) / 0.15)',
      color: 'var(--destructive, #ef4444)',
      borderColor: 'var(--destructive, #ef4444)',
    },
  },
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
      suggestions: options.initialSuggestions || [],
      comments: options.initialComments || [],
      viewMode,
      reviewMode,
    })),
    trackChangesDecorationsField,
    trackChangesGutter,
    trackChangesHoverTooltip,
    trackChangesTheme,
  ];
}

export const trackChangesExtension = createTrackChangesExtension;
