/**
 * track-changes.extension.ts
 *
 * CodeMirror 6 Review Mode & Track Changes Extension (Overleaf Parity).
 * Location: `features/editor/engines/extensions/track-changes.extension.ts`
 *
 * Capabilities:
 * 1. Track Changes Visual Decorations:
 *    - Green underline & tint for proposed insertions (`cm-track-change-insert`).
 *    - Red strikethrough & tint for proposed deletions (`cm-track-change-delete`).
 *    - Replaces/hides deleted text when `viewMode === 'hide'` for clean preview reading.
 * 2. Comment Thread Highlights & Gutter Markers:
 *    - Soft amber highlight on commented text ranges (`cm-comment-highlight`).
 *    - Interactive comment gutter marker with reply count indicator.
 * 3. Interactive Hover Action Tooltip:
 *    - Shows author name, avatar, timestamp, and quick [Accept ✓] / [Reject ✗] buttons.
 * 4. Gutter click routing:
 *    - Clicking gutter marker focuses the thread in the Review Tab sidebar.
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
import type { PageSuggestion, SuggestionStatus } from '../../domain/types/suggestion.types';
import type { PageComment } from '../../domain/types/comment.types';
import { editorCommandBus } from '../../coordinators/command-bus';

// ─── STATE EFFECTS ───────────────────────────────────────────────────────────

export const setTrackChangesSuggestionsEffect = StateEffect.define<PageSuggestion[]>();
export const setTrackChangesViewModeEffect = StateEffect.define<'show' | 'hide'>();
export const setTrackChangesReviewModeEffect = StateEffect.define<boolean>();
export const setTrackChangesCommentsEffect = StateEffect.define<PageComment[]>();
export const setTrackChangesDataEffect = StateEffect.define<{
  suggestions?: PageSuggestion[];
  comments?: any[];
  changes?: any[];
}>();

// Aliases for intuitive API usage
export const setReviewModeEffect = setTrackChangesReviewModeEffect;
export const setViewModeEffect = setTrackChangesViewModeEffect;
export const setSuggestionsEffect = setTrackChangesSuggestionsEffect;
export const setCommentsEffect = setTrackChangesCommentsEffect;

export interface TrackChangesConfig {
  suggestions: PageSuggestion[];
  comments: PageComment[];
  viewMode: 'show' | 'hide';
  reviewMode: boolean;
}

export interface TrackChangesExtensionOptions {
  initialSuggestions?: PageSuggestion[];
  initialComments?: PageComment[];
  initialViewMode?: 'show' | 'hide';
  initialReviewMode?: boolean;
  reviewMode?: 'on' | 'off' | boolean;
  viewMode?: 'show' | 'hide';
}

// ─── HELPER: MAP LINE/COL OR OFFSET ──────────────────────────────────────────

function getSafeOffset(
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
      viewMode: 'show',
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
            originalText: c.type === 'delete' ? (c.text || '') : '',
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
              page: null as any,
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
    // Recompute if doc changed or track changes state modified
    const configChanged = tr.effects.some(
      (e) =>
        e.is(setTrackChangesSuggestionsEffect) ||
        e.is(setTrackChangesViewModeEffect) ||
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
  }
  const items: RangeItem[] = [];

  // 1. Pending Suggestions (Insertions / Deletions / Replacements)
  const pendingSuggestions = config.suggestions.filter(
    (s) => s.status === 'pending'
  );

  for (const s of pendingSuggestions) {
    const rawFrom = (s as any).fromIndex ?? (s as any).fromOffset;
    const rawTo = (s as any).toIndex ?? (s as any).toOffset;
    const from = getSafeOffset(doc, s.fromLine, s.fromColumn, rawFrom);
    let to = getSafeOffset(doc, s.toLine, s.toColumn, rawTo);

    if (from === to && s.type === 'insert') {
      // For pure insertion at point: highlight up to end of inserted segment or next char
      to = Math.min(doc.length, from + (s.suggestedText?.length || 1));
    }
    if (from >= to) continue;

    const authorName = s.author?.name || 'Collaborator';

    if (s.type === 'insert') {
      if (config.viewMode === 'show') {
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
        });
      }
    } else if (s.type === 'delete') {
      if (config.viewMode === 'show') {
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
        });
      } else {
        // In "hide" view mode, hide proposed deleted text cleanly
        items.push({
          from,
          to,
          decoration: Decoration.replace({
            inclusive: false,
          }),
        });
      }
    } else if (s.type === 'replace') {
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
      });
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
      });
    }
  }

  // RangeSetBuilder requires strictly sorted ranges (from ascending, then to ascending)
  items.sort((a, b) => a.from - b.from || a.to - b.to);

  // Eliminate any invalid overlaps for replace decorations
  for (const item of items) {
    if (item.from < item.to && item.to <= doc.length) {
      builder.add(item.from, item.to, item.decoration);
    }
  }

  return builder.finish();
}

// ─── GUTTER MARKER: COMMENT ICON IN LINE MARGIN ─────────────────────────────

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
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" class="text-amber-500">
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

export const trackChangesGutter = gutter({
  class: 'cm-review-gutter',
  markers: (view: EditorView) => {
    const config = view.state.field(trackChangesStateField);
    const doc = view.state.doc;
    const builder = new RangeSetBuilder<GutterMarker>();

    // Group open comments by line number
    const lineMap = new Map<number, PageComment[]>();
    for (const c of config.comments) {
      const isOpen = c.status === 'open' || (c as any).resolved === false;
      if (isOpen) {
        let lineNum = c.line;
        if (!lineNum && typeof (c as any).fromIndex === 'number' && doc.length > 0) {
          lineNum = doc.lineAt(Math.min((c as any).fromIndex, doc.length)).number;
        }
        if (lineNum) {
          const safeLine = Math.max(1, Math.min(lineNum, doc.lines));
          const list = lineMap.get(safeLine) || [];
          list.push(c);
          lineMap.set(safeLine, list);
        }
      }
    }

    const sortedLines = Array.from(lineMap.keys()).sort((a, b) => a - b);
    for (const lineNum of sortedLines) {
      const lineComments = lineMap.get(lineNum)!;
      const linePos = doc.line(lineNum).from;
      builder.add(
        linePos,
        linePos,
        new CommentGutterMarker(lineComments.length, lineComments[0].id, lineNum)
      );
    }

    return builder.finish();
  },
  initialSpacer: () => new CommentGutterMarker(1, '', 1),
});

// ─── INTERACTIVE HOVER TOOLTIP: ACCEPT / REJECT MINI-CARD ────────────────────

export const trackChangesHoverTooltip = hoverTooltip((view, pos) => {
  const config = view.state.field(trackChangesStateField);
  const doc = view.state.doc;

  // 1. Check if hovering on a Track Change suggestion
  const pendingSuggestions = config.suggestions.filter((s) => s.status === 'pending');
  for (const s of pendingSuggestions) {
    const from = getSafeOffset(doc, s.fromLine, s.fromColumn);
    const to = Math.max(from + 1, getSafeOffset(doc, s.toLine, s.toColumn));

    if (pos >= from && pos <= to) {
      return {
        pos: from,
        end: to,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-track-tooltip';

          const author = s.author?.name || 'Collaborator';
          const typeLabel = s.type === 'insert' ? 'Added' : s.type === 'delete' ? 'Deleted' : 'Changed';
          const typeBadgeColor = s.type === 'insert' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400';

          dom.innerHTML = `
            <div class="flex items-center justify-between gap-3 pb-1 mb-1.5 border-b border-border/40 text-xs">
              <div class="flex items-center gap-1.5 font-medium">
                <span class="w-2 h-2 rounded-full ${s.type === 'insert' ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
                <span class="truncate max-w-[120px]">${author}</span>
                <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${typeBadgeColor}">${typeLabel}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 pt-0.5">
              <button class="cm-track-btn cm-track-btn-accept" title="Accept change">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Accept
              </button>
              <button class="cm-track-btn cm-track-btn-reject" title="Reject change">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Reject
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
});

// ─── STYLES & THEME ─────────────────────────────────────────────────────────

const trackChangesTheme = EditorView.baseTheme({
  '.cm-track-change-insert': {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    textDecoration: 'underline',
    textDecorationColor: '#22c55e',
    textDecorationThickness: '2px',
    borderRadius: '2px',
  },
  '.cm-track-change-delete': {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    textDecoration: 'line-through',
    textDecorationColor: '#ef4444',
    textDecorationThickness: '2px',
    color: '#ef4444',
    borderRadius: '2px',
  },
  '.cm-track-change-replace': {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    textDecoration: 'underline',
    textDecorationColor: '#3b82f6',
    borderRadius: '2px',
  },
  '.cm-comment-highlight': {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderBottom: '2px dashed #f59e0b',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  '.cm-review-gutter': {
    width: '20px',
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
    fontWeight: 'bold',
    backgroundColor: '#f59e0b',
    color: '#000',
    borderRadius: '999px',
    padding: '0 3px',
    lineHeight: '10px',
  },
  '.cm-track-tooltip': {
    backgroundColor: 'var(--popover, #18181b)',
    color: 'var(--popover-foreground, #f4f4f5)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: '6px',
    padding: '6px 8px',
    boxShadow: '0 4px 14px 0 rgba(0,0,0,0.4)',
    fontSize: '11px',
    zIndex: 999,
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
    transition: 'background-color 0.15s ease',
  },
  '.cm-track-btn-accept': {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
    '&:hover': {
      backgroundColor: 'rgba(34, 197, 94, 0.35)',
    },
  },
  '.cm-track-btn-reject': {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    '&:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.35)',
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
  const viewMode = options.viewMode || options.initialViewMode || 'show';

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
