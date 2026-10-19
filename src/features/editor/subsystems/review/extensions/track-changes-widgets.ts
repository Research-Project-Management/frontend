/**
 * track-changes-widgets.ts
 *
 * DOM Widgets, Gutter Markers, Hover Tooltip DOM renderer, and Base Theme
 * for the CodeMirror 6 Review Mode & Track Changes extension.
 */

import { EditorView, WidgetType, GutterMarker } from '@codemirror/view';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  timeAgo,
  formatOverleafDate,
  getAuthorColor,
} from '@/features/editor/domain/collaboration/author-display';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class CleanReplacePreviewWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  override eq(other: CleanReplacePreviewWidget): boolean {
    return this.text === other.text;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-track-clean-replace';
    span.textContent = this.text;
    return span;
  }
}

// ─── GUTTER MARKERS: COMMENTS & SUGGESTIONS IN LINE MARGIN ───────────────────

export class CommentGutterMarker extends GutterMarker {
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

export class SuggestionGutterMarker extends GutterMarker {
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

    const colorClass =
      this.hasInsert && this.hasDelete
        ? 'text-primary'
        : this.hasInsert
          ? 'text-success'
          : 'text-destructive';

    el.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="${colorClass}">
        ${
          this.hasInsert && this.hasDelete
            ? '<circle cx="12" cy="12" r="5" fill="currentColor"/>'
            : this.hasInsert
              ? '<path d="M12 5v14M5 12h14"/>'
              : '<path d="M5 12h14"/>'
        }
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

export class CombinedReviewGutterMarker extends GutterMarker {
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

export function createTrackChangesTooltipDOM(s: PageSuggestion): HTMLElement {
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
      ? 'bg-success/15 text-success border border-success/30'
      : s.type === 'delete'
        ? 'bg-destructive/15 text-destructive border border-destructive/30'
        : 'bg-warning/15 text-warning border border-warning/30';

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

  return dom;
}

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
