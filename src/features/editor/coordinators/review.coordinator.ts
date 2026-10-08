/**
 * review.coordinator.ts
 *
 * Headless Review & Track Changes Coordinator (Coordinators Layer).
 *
 * Responsibilities:
 * - Single source of coordination between CodeMirror 6, Sidebar ReviewTab, and Backend Review/Suggestion Service.
 * - Handles navigation between comments/suggestions and editor line offsets.
 * - Dispatches single-click Accept and Reject mutations, updating editor state and document tree.
 * - Bridges track changes view mode ('show' | 'hide') and review mode ('on' | 'off') directly to CodeMirror.
 * - Integrates with IEditorCommandBus for cross-component event decoupling.
 */

import { type EditorView } from '@codemirror/view';
import { editorCommandBus, getActiveEditorEngine } from './command-bus';
import { suggestionService } from './services/suggestion.service';
import { commentService } from './services/comment.service';
import { manuscriptService } from './services/manuscript.service';
import {
  setTrackChangesSuggestionsEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
} from '../engines/extensions/track-changes.extension';
import type { PageSuggestion } from '../domain/types/suggestion.types';
import type { PageComment } from '../domain/types/comment.types';
import { toast } from 'sonner';

export class ReviewCoordinatorRegistry {
  private activeView: EditorView | null = null;
  private activePageId: string | null = null;
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
  }

  /**
   * Updates CodeMirror Track Changes and Comments decorations in-place without editor reload.
   */
  public syncEditorDecorations(
    view: EditorView | null,
    suggestions: PageSuggestion[],
    comments: PageComment[],
    viewMode: 'show' | 'hide' = 'show',
    reviewMode: boolean = false
  ): void {
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
    try {
      await suggestionService.acceptSuggestion(pageId, suggestionId);
      toast.success('Change accepted');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted',
        payload: { suggestionId },
      });
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept change');
      return false;
    }
  }

  /**
   * Rejects a proposed track change and reverts it.
   */
  public async rejectSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    try {
      await suggestionService.rejectSuggestion(pageId, suggestionId);
      toast.success('Change rejected');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected',
        payload: { suggestionId },
      });
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject change');
      return false;
    }
  }

  /**
   * Bulk accepts all pending changes in a document.
   */
  public async acceptAll(pageId: string): Promise<boolean> {
    try {
      await suggestionService.acceptAllSuggestions(pageId);
      toast.success('All changes accepted');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted-all',
      });
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept all changes');
      return false;
    }
  }

  /**
   * Bulk rejects all pending changes in a document.
   */
  public async rejectAll(pageId: string): Promise<boolean> {
    try {
      await suggestionService.rejectAllSuggestions(pageId);
      toast.success('All changes rejected');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected-all',
      });
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject all changes');
      return false;
    }
  }
}

export const reviewCoordinator = new ReviewCoordinatorRegistry();
