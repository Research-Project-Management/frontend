/**
 * review.coordinator.ts
 *
 * Headless Review & Track Changes Coordinator (Coordinators Layer).
 *
 * Responsibilities:
 * - Single source of coordination between CodeMirror 6, Sidebar ReviewTab, and Backend Review/Suggestion Service.
 * - Handles navigation between comments/suggestions and editor line offsets.
 * - Dispatches single-click Accept and Reject mutations, updating editor state and document tree.
 * - Executes 0ms optimistic local document edits for instant user feedback.
 * - Bridges track changes view modes ('changes' | 'clean' | 'original') and review mode directly to CodeMirror.
 * - Integrates with IEditorCommandBus for cross-component event decoupling.
 */

import { type EditorView } from '@codemirror/view';
import { editorCommandBus, getActiveEditorEngine } from './command-bus';
import { suggestionService } from '@/features/editor/sdk/manuscript.service';
import {
  setTrackChangesSuggestionsEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  getSafeOffset,
  type TrackChangesViewMode,
} from '../engines/extensions/track-changes.extension';
import type { PageSuggestion } from '../domain/types/suggestion.types';
import type { PageComment } from '../domain/types/comment.types';
import { toast } from 'sonner';

export class ReviewCoordinatorRegistry {
  private activeView: EditorView | null = null;
  private activePageId: string | null = null;
  private currentSuggestions = new Map<string, PageSuggestion>();
  private currentComments = new Map<string, PageComment>();
  private currentViewMode: TrackChangesViewMode = 'changes';
  private currentReviewMode = false;
  private initialized = false;

  constructor() {
    this.initSubscriptions();
  }

  private initSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // 1. Navigate to Comment Thread in Editor
    editorCommandBus.subscribe('review:navigate-to-comment', (cmd) => {
      if (cmd.line) {
        this.navigateToLine(cmd.line);
      }
    });

    // 2. Navigate to Track Change Suggestion in Editor
    editorCommandBus.subscribe('review:navigate-to-change', (cmd) => {
      if (cmd.line) {
        this.navigateToLine(cmd.line);
      }
    });

    // 3. Accept Suggestion via 1-Click
    editorCommandBus.subscribe('review:accept-suggestion', async (cmd) => {
      if (this.activePageId && cmd.suggestionId) {
        await this.acceptSuggestion(this.activePageId, cmd.suggestionId);
      }
    });

    // 4. Reject Suggestion via 1-Click
    editorCommandBus.subscribe('review:reject-suggestion', async (cmd) => {
      if (this.activePageId && cmd.suggestionId) {
        await this.rejectSuggestion(this.activePageId, cmd.suggestionId);
      }
    });
  }

  /**
   * Registers current CodeMirror EditorView for live decoration updates.
   */
  public bindEditorView(view: EditorView | null, pageId: string): void {
    this.activeView = view;
    this.activePageId = pageId;

    if (view && this.currentSuggestions.size > 0) {
      this.syncEditorDecorations(
        view,
        Array.from(this.currentSuggestions.values()),
        Array.from(this.currentComments.values()),
        this.currentViewMode,
        this.currentReviewMode
      );
    }
  }

  /**
   * Retrieves currently cached suggestion by ID.
   */
  public getSuggestion(suggestionId: string): PageSuggestion | undefined {
    return this.currentSuggestions.get(suggestionId);
  }

  /**
   * Updates CodeMirror Track Changes and Comments decorations in-place without editor reload.
   */
  public syncEditorDecorations(
    view: EditorView | null,
    suggestions: PageSuggestion[],
    comments: PageComment[],
    viewMode: TrackChangesViewMode = 'changes',
    reviewMode: boolean = false
  ): void {
    this.currentSuggestions.clear();
    for (const s of suggestions) {
      this.currentSuggestions.set(s.id, s);
    }
    this.currentComments.clear();
    for (const c of comments) {
      this.currentComments.set(c.id, c);
    }
    this.currentViewMode = viewMode;
    this.currentReviewMode = reviewMode;

    const targetView = view || this.activeView;
    if (!targetView) return;

    try {
      targetView.dispatch({
        effects: [
          setTrackChangesSuggestionsEffect.of(suggestions),
          setTrackChangesCommentsEffect.of(comments),
          setTrackChangesViewModeEffect.of(viewMode),
          setTrackChangesReviewModeEffect.of(reviewMode),
        ],
      });
    } catch (err) {
      console.debug('[ReviewCoordinator] Failed to sync decorations:', err);
    }
  }

  /**
   * Applies local optimistic text edits into CodeMirror for 0ms tactile responsiveness.
   */
  public applySuggestionLocally(
    view: EditorView,
    sug: PageSuggestion,
    action: 'accept' | 'reject'
  ): void {
    const doc = view.state.doc;
    const cand = sug as typeof sug & { fromIndex?: number; fromOffset?: number; toIndex?: number; toOffset?: number };
    const rawFrom = cand.fromIndex ?? cand.fromOffset;
    const rawTo = cand.toIndex ?? cand.toOffset;
    const from = getSafeOffset(doc, sug.fromLine, sug.fromColumn, rawFrom);
    let to = getSafeOffset(doc, sug.toLine, sug.toColumn, rawTo);

    if (from === to && sug.type === 'insert') {
      to = Math.min(doc.length, from + (sug.suggestedText?.length || 1));
    }

    if (action === 'accept') {
      if (sug.type === 'delete') {
        // Text marked for deletion is permanently removed on accept
        if (from < to && to <= doc.length) {
          view.dispatch({
            changes: { from, to, insert: '' },
          });
        }
      }
      // If type === 'insert', text is already present in document
    } else {
      // action === 'reject'
      if (sug.type === 'insert') {
        // Proposed insertion is removed on reject
        if (from < to && to <= doc.length) {
          view.dispatch({
            changes: { from, to, insert: '' },
          });
        }
      }
      // If type === 'delete', original text was preserved in document
    }

    // Mark suggestion resolved in local cache
    const updatedSug = {
      ...sug,
      status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
    };
    this.currentSuggestions.set(sug.id, updatedSug);

    // Update active view decorations immediately
    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode
    );
  }

  /**
   * Scrolls CodeMirror view to specified 1-indexed line and sets cursor position.
   */
  public navigateToLine(lineNum: number): void {
    if (this.activeView) {
      const doc = this.activeView.state.doc;
      const safeLine = Math.max(1, Math.min(lineNum, doc.lines));
      const line = doc.line(safeLine);
      this.activeView.dispatch({
        selection: { anchor: line.from, head: line.from },
        scrollIntoView: true,
      });
      this.activeView.focus();
      return;
    }

    const engine = getActiveEditorEngine();
    if (engine?.jumpToLine) {
      engine.jumpToLine(lineNum, 'synctex');
      return;
    }
  }

  /**
   * Accepts a proposed track change and applies it permanently.
   */
  public async acceptSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    const sug = this.currentSuggestions.get(suggestionId);
    if (this.activeView && sug) {
      this.applySuggestionLocally(this.activeView, sug, 'accept');
    }

    try {
      await suggestionService.acceptSuggestion(pageId, suggestionId);
      toast.success('Change accepted', { id: `sug-${suggestionId}` });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted',
        payload: { suggestionId },
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to accept change', { id: `sug-${suggestionId}` });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rollback',
        payload: { suggestionId },
      });
      return false;
    }
  }

  /**
   * Rejects a proposed track change and reverts it.
   */
  public async rejectSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    const sug = this.currentSuggestions.get(suggestionId);
    if (this.activeView && sug) {
      this.applySuggestionLocally(this.activeView, sug, 'reject');
    }

    try {
      await suggestionService.rejectSuggestion(pageId, suggestionId);
      toast.success('Change rejected', { id: `sug-${suggestionId}` });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected',
        payload: { suggestionId },
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to reject change', { id: `sug-${suggestionId}` });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rollback',
        payload: { suggestionId },
      });
      return false;
    }
  }

  /**
   * Bulk accepts all pending changes in a document.
   */
  public async acceptAll(pageId: string): Promise<boolean> {
    // Optimistically accept all in local view
    if (this.activeView) {
      const pending = Array.from(this.currentSuggestions.values()).filter((s) => s.status === 'pending');
      for (const s of pending) {
        this.applySuggestionLocally(this.activeView, s, 'accept');
      }
    }

    try {
      await suggestionService.acceptAllSuggestions(pageId);
      toast.success('All changes accepted', { id: 'sug-bulk' });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted-all',
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to accept all changes', { id: 'sug-bulk' });
      return false;
    }
  }

  /**
   * Bulk rejects all pending changes in a document.
   */
  public async rejectAll(pageId: string): Promise<boolean> {
    // Optimistically reject all in local view
    if (this.activeView) {
      const pending = Array.from(this.currentSuggestions.values()).filter((s) => s.status === 'pending');
      for (const s of pending) {
        this.applySuggestionLocally(this.activeView, s, 'reject');
      }
    }

    try {
      await suggestionService.rejectAllSuggestions(pageId);
      toast.success('All changes rejected', { id: 'sug-bulk' });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected-all',
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to reject all changes', { id: 'sug-bulk' });
      return false;
    }
  }

  /**
   * Bulk accepts selected pending changes in a document.
   */
  public async acceptSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    if (!suggestionIds || suggestionIds.length === 0) return true;
    try {
      await suggestionService.acceptSelectedSuggestions(pageId, suggestionIds);
      toast.success(`${suggestionIds.length} changes accepted`, { id: 'sug-bulk' });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted-selected',
        payload: { suggestionIds },
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to accept selected changes', { id: 'sug-bulk' });
      return false;
    }
  }

  /**
   * Bulk rejects selected pending changes in a document.
   */
  public async rejectSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    if (!suggestionIds || suggestionIds.length === 0) return true;
    try {
      await suggestionService.rejectSelectedSuggestions(pageId, suggestionIds);
      toast.success(`${suggestionIds.length} changes rejected`, { id: 'sug-bulk' });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected-selected',
        payload: { suggestionIds },
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to reject selected changes', { id: 'sug-bulk' });
      return false;
    }
  }
}

export const reviewCoordinator = new ReviewCoordinatorRegistry();
